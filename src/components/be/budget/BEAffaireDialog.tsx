import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useBEAffaires, useBEAffaireCodeIsAvailable } from '@/hooks/useBEAffaires';
import {
  BEAffaire,
  BEAffaireStatus,
  BE_AFFAIRE_STATUS_CONFIG,
  extractProjectCodeFromAffaire,
} from '@/types/beAffaire';

interface BEAffaireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beProjectId: string;
  /** Code projet (chars 2-5 du code_affaire), pour validation UX. Optionnel. */
  expectedProjectCode?: string | null;
  /** Si fourni : edition d'une affaire existante. Sinon : creation. */
  affaire?: BEAffaire | null;
}

export function BEAffaireDialog({
  open,
  onOpenChange,
  beProjectId,
  expectedProjectCode,
  affaire,
}: BEAffaireDialogProps) {
  const isEdit = !!affaire;
  const { createAffaire, updateAffaire } = useBEAffaires(beProjectId);

  const [codeAffaire, setCodeAffaire] = useState('');
  const [libelle, setLibelle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<BEAffaireStatus>('ouverte');
  const [dateOuverture, setDateOuverture] = useState('');

  // (Re)initialise les champs a chaque ouverture
  useEffect(() => {
    if (!open) return;
    setCodeAffaire(affaire?.code_affaire ?? '');
    setLibelle(affaire?.libelle ?? '');
    setDescription(affaire?.description ?? '');
    setStatus(affaire?.status ?? 'ouverte');
    setDateOuverture(affaire?.date_ouverture ?? new Date().toISOString().slice(0, 10));
  }, [open, affaire]);

  // Detection auto du code projet a partir du code_affaire saisi
  const detectedProjectCode = useMemo(
    () => extractProjectCodeFromAffaire(codeAffaire),
    [codeAffaire],
  );
  const projectCodeMismatch =
    !!detectedProjectCode &&
    !!expectedProjectCode &&
    detectedProjectCode.toUpperCase() !== expectedProjectCode.toUpperCase();

  // Verif unicite (sauf si on edite et que le code n'a pas change)
  const codeChanged = codeAffaire.trim() !== (affaire?.code_affaire ?? '');
  const checkAvailability = !isEdit || codeChanged;
  const { data: codeAvailable, isFetching: checkingCode } = useBEAffaireCodeIsAvailable(
    checkAvailability ? codeAffaire.trim() : null,
  );

  const isSubmitDisabled =
    !codeAffaire.trim() ||
    createAffaire.isPending ||
    updateAffaire.isPending ||
    (checkAvailability && (codeAvailable === false || checkingCode));

  const handleSubmit = async () => {
    const trimmed = codeAffaire.trim();
    if (!trimmed) return;

    try {
      if (isEdit && affaire) {
        await updateAffaire.mutateAsync({
          id: affaire.id,
          updates: {
            code_affaire: trimmed,
            libelle: libelle.trim() || null,
            description: description.trim() || null,
            status,
            date_ouverture: dateOuverture || null,
          },
        });
        toast({ title: 'Affaire mise à jour' });
      } else {
        await createAffaire.mutateAsync({
          be_project_id: beProjectId,
          code_affaire: trimmed,
          libelle: libelle.trim() || null,
          description: description.trim() || null,
          date_ouverture: dateOuverture || null,
          source_creation: 'manuelle',
        });
        toast({ title: 'Affaire créée' });
      }
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: extractErrorMessage(e),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l\'affaire' : 'Nouvelle affaire BE'}</DialogTitle>
          <DialogDescription>
            Le code affaire est la clé d'analytique Divalto (ex: <code className="font-mono">EDOLEAEX</code>).
            Les caractères 2 à 5 identifient le projet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="code_affaire">
              Code affaire <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code_affaire"
              value={codeAffaire}
              onChange={(e) => setCodeAffaire(e.target.value.toUpperCase())}
              placeholder="EDOLEAEX"
              className="font-mono uppercase"
              autoComplete="off"
            />

            {/* Indicateurs */}
            <div className="flex items-center gap-3 text-xs min-h-[20px]">
              {detectedProjectCode && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Projet détecté :</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {detectedProjectCode}
                  </Badge>
                </div>
              )}
              {projectCodeMismatch && (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    Différent du projet courant ({expectedProjectCode})
                  </span>
                </div>
              )}
              {checkAvailability && codeAffaire.trim() && (
                <>
                  {checkingCode ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Vérification…
                    </span>
                  ) : codeAvailable === false ? (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Code déjà utilisé
                    </span>
                  ) : codeAvailable === true ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Disponible
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="libelle">Libellé</Label>
            <Input
              id="libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Étude de dimensionnement"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as BEAffaireStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BE_AFFAIRE_STATUS_CONFIG).map(([k, cfg]) => (
                    <SelectItem key={k} value={k}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_ouverture">Date d'ouverture</Label>
              <Input
                id="date_ouverture"
                type="date"
                value={dateOuverture}
                onChange={(e) => setDateOuverture(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte, périmètre, contraintes…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {(createAffaire.isPending || updateAffaire.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {isEdit ? 'Enregistrer' : 'Créer l\'affaire'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
