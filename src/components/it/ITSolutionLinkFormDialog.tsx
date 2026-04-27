import { useEffect, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from '@/hooks/use-toast';
import { useITSolutions } from '@/hooks/useITSolutions';
import { useITSolutionLinkOptions } from '@/hooks/useITSolutionLinkOptions';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  CRITICITE_CONFIG,
  DIRECTION_LABEL,
  ETAT_FLUX_CONFIG,
  type ITSolution,
  type ITSolutionCriticite,
  type ITSolutionLink,
  type ITSolutionLinkDirection,
  type ITSolutionLinkEtat,
} from '@/types/itSolution';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lien à éditer ; si null mode création. */
  link: ITSolutionLink | null;
  /** Pré-sélection optionnelle de la source quand on crée un lien depuis un nœud du graphe. */
  defaultSourceId?: string | null;
  defaultTargetId?: string | null;
}

export function ITSolutionLinkFormDialog({ open, onOpenChange, link, defaultSourceId, defaultTargetId }: Props) {
  const { solutions, createSolutionLink, updateSolutionLink, deleteSolutionLink } = useITSolutions();
  const {
    typeFluxOptions,
    protocoleOptions,
    frequenceOptions,
    addOption,
  } = useITSolutionLinkOptions();

  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [typeFlux, setTypeFlux] = useState<string>('');
  const [direction, setDirection] = useState<ITSolutionLinkDirection>('source_to_target');
  const [protocole, setProtocole] = useState('');
  const [frequence, setFrequence] = useState('');
  const [criticite, setCriticite] = useState<ITSolutionCriticite | ''>('');
  const [etat, setEtat] = useState<ITSolutionLinkEtat | ''>('');
  const [dateMiseEnService, setDateMiseEnService] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (link) {
      setSourceId(link.source_solution_id);
      setTargetId(link.target_solution_id);
      setTypeFlux(link.type_flux ?? '');
      setDirection(link.direction);
      setProtocole(link.protocole ?? '');
      setFrequence(link.frequence ?? '');
      setCriticite((link.criticite ?? '') as ITSolutionCriticite | '');
      setEtat((link.etat_flux ?? '') as ITSolutionLinkEtat | '');
      setDateMiseEnService(link.date_mise_en_service ?? '');
      setDescription(link.description ?? '');
    } else {
      setSourceId(defaultSourceId ?? '');
      setTargetId(defaultTargetId ?? '');
      setTypeFlux('');
      setDirection('source_to_target');
      setProtocole('');
      setFrequence('');
      setCriticite('');
      setEtat('');
      setDateMiseEnService('');
      setDescription('');
    }
  }, [open, link, defaultSourceId, defaultTargetId]);

  const swap = () => {
    setSourceId(targetId);
    setTargetId(sourceId);
  };

  const submit = async () => {
    if (!sourceId || !targetId) {
      toast({ title: 'Source et cible requises', variant: 'destructive' });
      return;
    }
    if (sourceId === targetId) {
      toast({ title: 'La source et la cible doivent être différentes', variant: 'destructive' });
      return;
    }
    setPending(true);
    try {
      // Persiste les nouvelles valeurs custom dans le catalogue partage
      // (fire-and-forget, ignore les doublons)
      const knownFlux = new Set(typeFluxOptions.map((o) => o.value));
      const knownProto = new Set(protocoleOptions.map((o) => o.value));
      const knownFreq = new Set(frequenceOptions.map((o) => o.value));
      const trimmedFlux = typeFlux.trim();
      const trimmedProto = protocole.trim();
      const trimmedFreq = frequence.trim();
      if (trimmedFlux && !knownFlux.has(trimmedFlux)) {
        addOption.mutate({ option_type: 'type_flux', value: trimmedFlux });
      }
      if (trimmedProto && !knownProto.has(trimmedProto)) {
        addOption.mutate({ option_type: 'protocole', value: trimmedProto });
      }
      if (trimmedFreq && !knownFreq.has(trimmedFreq)) {
        addOption.mutate({ option_type: 'frequence', value: trimmedFreq });
      }

      const payload = {
        source_solution_id: sourceId,
        target_solution_id: targetId,
        type_flux: trimmedFlux || null,
        direction,
        protocole: trimmedProto || null,
        frequence: trimmedFreq || null,
        criticite: (criticite || null) as ITSolutionCriticite | null,
        etat_flux: (etat || null) as ITSolutionLinkEtat | null,
        date_mise_en_service: dateMiseEnService.trim() || null,
        description: description.trim() || null,
      };
      if (link) {
        await updateSolutionLink.mutateAsync({ id: link.id, updates: payload });
        toast({ title: 'Lien mis à jour' });
      } else {
        await createSolutionLink.mutateAsync(payload);
        toast({ title: 'Lien créé' });
      }
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (!link) return;
    setPending(true);
    try {
      await deleteSolutionLink.mutateAsync(link.id);
      toast({ title: 'Lien supprimé' });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };

  const solutionOptions = solutions.map((s: ITSolution) => ({
    value: s.id,
    label: `${s.nom}${s.categorie ? ` — ${s.categorie}` : ''}`,
  }));

  // Affiche egalement la valeur courante si elle a ete saisie a la volee et
  // n'est pas encore en base (le SearchableSelect masquerait sinon le choix)
  const ensureValue = (
    base: { value: string; label: string }[],
    current: string,
  ) => (current && !base.some((o) => o.value === current)
    ? [...base, { value: current, label: current }]
    : base);
  const fluxOpts = ensureValue(typeFluxOptions, typeFlux);
  const protoOpts = ensureValue(protocoleOptions, protocole);
  const freqOpts = ensureValue(frequenceOptions, frequence);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{link ? 'Modifier le lien' : 'Nouveau lien entre solutions'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div className="space-y-2">
              <Label className="text-xs">Solution source</Label>
              <SearchableSelect
                value={sourceId}
                onValueChange={setSourceId}
                options={solutionOptions}
                placeholder="Choisir..."
                searchPlaceholder="Rechercher une solution..."
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="mb-0.5"
              onClick={swap}
              title="Inverser source et cible"
              disabled={pending}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <div className="space-y-2">
              <Label className="text-xs">Solution cible</Label>
              <SearchableSelect
                value={targetId}
                onValueChange={setTargetId}
                options={solutionOptions.filter((o) => o.value !== sourceId)}
                placeholder="Choisir..."
                searchPlaceholder="Rechercher une solution..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type de flux</Label>
              <SearchableSelect
                value={typeFlux}
                onValueChange={setTypeFlux}
                options={fluxOpts}
                allowCustom
                customPlaceholder="Ajouter un type de flux"
                placeholder="Choisir ou saisir..."
                searchPlaceholder="Rechercher un type..."
              />
            </div>

            <div className="space-y-2">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as ITSolutionLinkDirection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(DIRECTION_LABEL) as [ITSolutionLinkDirection, typeof DIRECTION_LABEL.bidirectionnel][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.symbol}  {v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Protocole</Label>
              <SearchableSelect
                value={protocole}
                onValueChange={setProtocole}
                options={protoOpts}
                allowCustom
                customPlaceholder="Ajouter un protocole"
                placeholder="Choisir ou saisir..."
                searchPlaceholder="Rechercher un protocole..."
              />
            </div>

            <div className="space-y-2">
              <Label>Fréquence</Label>
              <SearchableSelect
                value={frequence}
                onValueChange={setFrequence}
                options={freqOpts}
                allowCustom
                customPlaceholder="Ajouter une fréquence"
                placeholder="Choisir ou saisir..."
                searchPlaceholder="Rechercher une fréquence..."
              />
            </div>

            <div className="space-y-2">
              <Label>Criticité du lien</Label>
              <Select value={criticite || '__none__'} onValueChange={(v) => setCriticite(v === '__none__' ? '' : (v as ITSolutionCriticite))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Non définie —</SelectItem>
                  {(Object.entries(CRITICITE_CONFIG) as [ITSolutionCriticite, typeof CRITICITE_CONFIG.faible][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>État du flux</Label>
              <Select value={etat || '__none__'} onValueChange={(v) => setEtat(v === '__none__' ? '' : (v as ITSolutionLinkEtat))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Non défini —</SelectItem>
                  {(Object.entries(ETAT_FLUX_CONFIG) as [ITSolutionLinkEtat, typeof ETAT_FLUX_CONFIG.a_creer][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Date de mise en service</Label>
              <Input
                type="date"
                value={dateMiseEnService}
                onChange={(e) => setDateMiseEnService(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description / commentaire</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Précisions sur le flux, les volumes, contraintes..."
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {link ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive gap-1.5"
              onClick={handleDelete}
              disabled={pending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer le lien
            </Button>
          ) : <span />}

          <div className="flex gap-2 sm:ml-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="button" onClick={submit} disabled={pending} className="gap-1.5">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              {link ? 'Enregistrer' : 'Créer le lien'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
