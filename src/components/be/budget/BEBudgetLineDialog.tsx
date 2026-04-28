import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
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
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useBEAffaireBudget } from '@/hooks/useBEAffaireBudget';
import {
  BEAffaireBudgetLine,
  BEBudgetLineStatut,
  BE_BUDGET_LINE_STATUT_CONFIG,
} from '@/types/beAffaire';

interface BEBudgetLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affaireId: string;
  line?: BEAffaireBudgetLine | null;
}

export function BEBudgetLineDialog({
  open,
  onOpenChange,
  affaireId,
  line,
}: BEBudgetLineDialogProps) {
  const isEdit = !!line;
  const { addLine, updateLine } = useBEAffaireBudget(affaireId);

  const [poste, setPoste] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [description, setDescription] = useState('');
  const [montantBudget, setMontantBudget] = useState('');
  const [montantRevise, setMontantRevise] = useState('');
  const [typeDepense, setTypeDepense] = useState('');
  const [exercice, setExercice] = useState<string>(String(new Date().getFullYear()));
  const [statut, setStatut] = useState<BEBudgetLineStatut>('brouillon');
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    if (!open) return;
    setPoste(line?.poste ?? '');
    setFournisseur(line?.fournisseur_prevu ?? '');
    setDescription(line?.description ?? '');
    setMontantBudget(line?.montant_budget != null ? String(line.montant_budget) : '');
    setMontantRevise(line?.montant_budget_revise != null ? String(line.montant_budget_revise) : '');
    setTypeDepense(line?.type_depense ?? '');
    setExercice(line?.exercice != null ? String(line.exercice) : String(new Date().getFullYear()));
    setStatut(line?.statut ?? 'brouillon');
    setCommentaire(line?.commentaire ?? '');
  }, [open, line]);

  const isValid = poste.trim().length > 0 && parseFloat(montantBudget) > 0;
  const pending = addLine.isPending || updateLine.isPending;

  const handleSubmit = async () => {
    if (!isValid) return;
    const payload = {
      be_affaire_id: affaireId,
      poste: poste.trim(),
      fournisseur_prevu: fournisseur.trim() || null,
      description: description.trim() || null,
      montant_budget: parseFloat(montantBudget),
      montant_budget_revise: montantRevise.trim() ? parseFloat(montantRevise) : null,
      type_depense: typeDepense.trim() || null,
      exercice: exercice ? parseInt(exercice, 10) : null,
      statut,
      commentaire: commentaire.trim() || null,
    };

    try {
      if (isEdit && line) {
        await updateLine.mutateAsync({ id: line.id, updates: payload });
        toast({ title: 'Ligne mise à jour' });
      } else {
        await addLine.mutateAsync(payload);
        toast({ title: 'Ligne ajoutée' });
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
          <DialogTitle>
            {isEdit ? 'Modifier la ligne budget' : 'Nouvelle ligne budget'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="poste">
              Poste <span className="text-destructive">*</span>
            </Label>
            <Input
              id="poste"
              value={poste}
              onChange={(e) => setPoste(e.target.value)}
              placeholder="Études, MOE, sous-traitance…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="montant_budget">
                Budget HT <span className="text-destructive">*</span>
              </Label>
              <Input
                id="montant_budget"
                type="number"
                step="0.01"
                min="0"
                value={montantBudget}
                onChange={(e) => setMontantBudget(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="montant_revise">Budget révisé HT</Label>
              <Input
                id="montant_revise"
                type="number"
                step="0.01"
                min="0"
                value={montantRevise}
                onChange={(e) => setMontantRevise(e.target.value)}
                placeholder="(optionnel)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="exercice">Exercice</Label>
              <Input
                id="exercice"
                type="number"
                value={exercice}
                onChange={(e) => setExercice(e.target.value)}
                placeholder="2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statut">Statut</Label>
              <Select value={statut} onValueChange={(v) => setStatut(v as BEBudgetLineStatut)}>
                <SelectTrigger id="statut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BE_BUDGET_LINE_STATUT_CONFIG).map(([k, cfg]) => (
                    <SelectItem key={k} value={k}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fournisseur">Fournisseur prévu</Label>
              <Input
                id="fournisseur"
                value={fournisseur}
                onChange={(e) => setFournisseur(e.target.value)}
                placeholder="(optionnel)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type_depense">Type de dépense</Label>
              <Input
                id="type_depense"
                value={typeDepense}
                onChange={(e) => setTypeDepense(e.target.value)}
                placeholder="Opex, Capex, Sous-traitance…"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détail du poste, livrables attendus…"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commentaire">Commentaire</Label>
            <Textarea
              id="commentaire"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Notes internes"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
