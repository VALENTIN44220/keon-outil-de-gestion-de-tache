import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  CRITICITE_CONFIG,
  DATALAKE_CONFIG,
  PRESET_SOLUTION_CATEGORIES,
  PRESET_SOLUTION_TYPES,
  type ITSolution,
  type ITSolutionCriticite,
  type ITSolutionDatalakeStatus,
} from '@/types/itSolution';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Solution à éditer ; si null, mode création. */
  solution: ITSolution | null;
  onSaved?: (id: string) => void;
}

const empty = (): Partial<ITSolution> => ({
  nom: '',
  categorie: '',
  type: '',
  usage_principal: '',
  domaine_metier: '',
  visible_dans_schema: true,
  connecte_datalake: null,
  flux_principaux: '',
  statut_temporalite: '',
  perimetre: '',
  criticite: null,
  commentaires: '',
});

export function ITSolutionFormDialog({ open, onOpenChange, solution, onSaved }: Props) {
  const { createSolution, updateSolution } = useITSolutions();
  const [form, setForm] = useState<Partial<ITSolution>>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(solution ? { ...solution } : empty());
  }, [open, solution]);

  const setField = <K extends keyof ITSolution>(k: K, v: ITSolution[K] | null | undefined) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async () => {
    if (!form.nom?.trim()) {
      toast({ title: 'Le nom est requis', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nom: form.nom.trim(),
        categorie: form.categorie || null,
        type: form.type || null,
        usage_principal: form.usage_principal || null,
        domaine_metier: form.domaine_metier || null,
        visible_dans_schema: !!form.visible_dans_schema,
        connecte_datalake: (form.connecte_datalake as ITSolutionDatalakeStatus | null) ?? null,
        flux_principaux: form.flux_principaux || null,
        statut_temporalite: form.statut_temporalite || null,
        owner_metier_id: form.owner_metier_id ?? null,
        owner_it_id: form.owner_it_id ?? null,
        perimetre: form.perimetre || null,
        criticite: (form.criticite as ITSolutionCriticite | null) ?? null,
        commentaires: form.commentaires || null,
      };
      if (solution) {
        await updateSolution.mutateAsync({ id: solution.id, updates: payload });
        toast({ title: 'Solution mise à jour' });
        onSaved?.(solution.id);
      } else {
        const created = await createSolution.mutateAsync(payload);
        toast({ title: 'Solution créée' });
        onSaved?.(created.id);
      }
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const categorieOptions = PRESET_SOLUTION_CATEGORIES.map((c) => ({ value: c, label: c }));
  if (form.categorie && !PRESET_SOLUTION_CATEGORIES.includes(form.categorie as never)) {
    categorieOptions.push({ value: form.categorie, label: form.categorie });
  }

  const typeOptions = PRESET_SOLUTION_TYPES.map((t) => ({ value: t, label: t }));
  if (form.type && !PRESET_SOLUTION_TYPES.includes(form.type as never)) {
    typeOptions.push({ value: form.type, label: form.type });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{solution ? 'Modifier la solution' : 'Nouvelle solution IT'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nom *</Label>
              <Input
                value={form.nom ?? ''}
                onChange={(e) => setField('nom', e.target.value)}
                placeholder="Ex: ERP DIVALTO"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <SearchableSelect
                value={form.categorie ?? ''}
                onValueChange={(v) => setField('categorie', v)}
                options={categorieOptions}
                allowCustom
                customPlaceholder="Ajouter une nouvelle catégorie"
                placeholder="Choisir une catégorie..."
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <SearchableSelect
                value={form.type ?? ''}
                onValueChange={(v) => setField('type', v)}
                options={typeOptions}
                allowCustom
                customPlaceholder="Ajouter un nouveau type"
                placeholder="Choisir un type..."
              />
            </div>

            <div className="space-y-2">
              <Label>Usage principal</Label>
              <Input
                value={form.usage_principal ?? ''}
                onChange={(e) => setField('usage_principal', e.target.value)}
                placeholder="Ex: Gestion ERP, Transport / logistique..."
              />
            </div>

            <div className="space-y-2">
              <Label>Domaine métier / fonction</Label>
              <Input
                value={form.domaine_metier ?? ''}
                onChange={(e) => setField('domaine_metier', e.target.value)}
                placeholder="Ex: Finance / exploitation"
              />
            </div>

            <div className="space-y-2">
              <Label>Connecté au Datalake</Label>
              <Select
                value={form.connecte_datalake ?? '__none__'}
                onValueChange={(v) => setField('connecte_datalake', v === '__none__' ? null : (v as ITSolutionDatalakeStatus))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {Object.entries(DATALAKE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Criticité</Label>
              <Select
                value={form.criticite ?? '__none__'}
                onValueChange={(v) => setField('criticite', v === '__none__' ? null : (v as ITSolutionCriticite))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {Object.entries(CRITICITE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Périmètre / entité</Label>
              <Input
                value={form.perimetre ?? ''}
                onChange={(e) => setField('perimetre', e.target.value)}
                placeholder="Ex: Groupe, SPV majo, Sites Naskeo..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Flux principaux visibles</Label>
            <Textarea
              rows={2}
              value={form.flux_principaux ?? ''}
              onChange={(e) => setField('flux_principaux', e.target.value)}
              placeholder="Ex: Échanges avec TMS TEIKEI ; alimente Datalake..."
            />
          </div>

          <div className="space-y-2">
            <Label>Statut / temporalité</Label>
            <Input
              value={form.statut_temporalite ?? ''}
              onChange={(e) => setField('statut_temporalite', e.target.value)}
              placeholder="Ex: 06/2026 visible sur le schéma, en place depuis fin 2025..."
            />
          </div>

          <div className="space-y-2">
            <Label>Commentaires / points à confirmer</Label>
            <Textarea
              rows={3}
              value={form.commentaires ?? ''}
              onChange={(e) => setField('commentaires', e.target.value)}
              placeholder="Précisions, éléments à valider..."
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              checked={!!form.visible_dans_schema}
              onCheckedChange={(v) => setField('visible_dans_schema', v === true)}
              id="visible_dans_schema"
            />
            <Label htmlFor="visible_dans_schema" className="text-sm font-normal cursor-pointer">
              Solution visible dans le schéma de cartographie
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
            {solution ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
