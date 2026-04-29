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
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  useBEAffaireTemps,
  useBETjmReferentiel,
  type UpsertBudgetTempsLine,
} from '@/hooks/useBEAffaireTemps';
import {
  BE_POSTES,
  BE_POSTE_ICON,
  BE_POSTE_LABEL,
  type BEPoste,
} from '@/types/beTemps';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BETempsBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affaireId: string;
  codeAffaire: string;
}

export function BETempsBudgetDialog({
  open,
  onOpenChange,
  affaireId,
  codeAffaire,
}: BETempsBudgetDialogProps) {
  const { budgetLines, upsertBudgetLines } = useBEAffaireTemps(affaireId);
  const { data: tjmByPoste } = useBETjmReferentiel();

  // 1 input par poste, en jours decimaux (ex. 2.5)
  const [values, setValues] = useState<Record<BEPoste, string>>({} as any);

  // Hydrate quand le dialog s'ouvre
  useEffect(() => {
    if (!open) return;
    const next: Record<BEPoste, string> = {} as any;
    for (const poste of BE_POSTES) {
      const existing = budgetLines.find((b) => b.poste === poste);
      next[poste] = existing ? String(existing.jours_budgetes) : '';
    }
    setValues(next);
  }, [open, budgetLines]);

  const totalJours = useMemo(() => {
    let sum = 0;
    for (const v of Object.values(values)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) sum += n;
    }
    return sum;
  }, [values]);

  const totalCout = useMemo(() => {
    if (!tjmByPoste) return 0;
    let sum = 0;
    for (const poste of BE_POSTES) {
      const n = parseFloat(values[poste] ?? '');
      if (!isNaN(n) && n > 0) sum += n * (tjmByPoste[poste] ?? 0);
    }
    return sum;
  }, [values, tjmByPoste]);

  const handleSubmit = async () => {
    const lines: UpsertBudgetTempsLine[] = BE_POSTES.map((poste) => {
      const raw = values[poste] ?? '';
      const n = parseFloat(raw);
      return {
        poste,
        jours_budgetes: !isNaN(n) && n > 0 ? n : 0,
      };
    });

    try {
      await upsertBudgetLines.mutateAsync(lines);
      toast({ title: 'Budget temps enregistré' });
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
          <DialogTitle>Budget temps · {codeAffaire}</DialogTitle>
          <DialogDescription>
            Saisis le nombre de jours prévus par poste. Le coût RH est calculé via le TJM
            (référentiel administré séparément). Laisse vide ou 0 pour ne pas budgéter un poste.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {BE_POSTES.map((poste) => {
            const tjm = tjmByPoste?.[poste] ?? 0;
            const n = parseFloat(values[poste] ?? '');
            const cout = !isNaN(n) && n > 0 ? n * tjm : 0;
            return (
              <div key={poste} className="grid grid-cols-[1fr,90px,110px] gap-2 items-center">
                <Label className="flex items-center gap-2 text-sm">
                  <span>{BE_POSTE_ICON[poste]}</span>
                  <span>{BE_POSTE_LABEL[poste]}</span>
                  <span className="text-[10px] text-muted-foreground/70 ml-auto">
                    TJM {eur(tjm)}
                  </span>
                </Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0"
                  value={values[poste] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [poste]: e.target.value }))
                  }
                  className="h-8 text-right"
                />
                <p className="text-xs tabular-nums text-right text-muted-foreground">
                  {cout > 0 ? eur(cout) : '—'}
                </p>
              </div>
            );
          })}

          <div className="border-t pt-3 mt-2 flex items-center justify-between text-sm">
            <span className="font-semibold">Total</span>
            <div className="flex gap-4">
              <span className="tabular-nums">
                {totalJours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j
              </span>
              <span className="font-semibold tabular-nums w-[110px] text-right">
                {eur(totalCout)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={upsertBudgetLines.isPending}>
            {upsertBudgetLines.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
