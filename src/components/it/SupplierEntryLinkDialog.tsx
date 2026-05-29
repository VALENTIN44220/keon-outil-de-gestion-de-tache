/**
 * Dialog : rattache une écriture comptable fournisseur (supplier_accounting_entries)
 * à une ligne budgétaire IT (it_budget_lines). V1 simple : un sélecteur texte
 * filtre la liste des lignes par description / catégorie / fournisseur / id.
 */
import { useMemo, useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useITBudgetGlobal } from '@/hooks/useITProjectBudget';
import { useLinkSupplierEntry, type SupplierAccountingEntry } from '@/hooks/useSupplierAccountingEntries';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// Écritures TTC vs budgets HT — estimation à TVA 20% par défaut
const TVA_STD = 0.20;
const htEstime = (ttc: number | null | undefined): number => (ttc ?? 0) / (1 + TVA_STD);

interface Props {
  entry: SupplierAccountingEntry | null;
  annee: number;
  entite: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierEntryLinkDialog({ entry, annee, entite, open, onOpenChange }: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { lines, linesLoading } = useITBudgetGlobal({ annee, entite });
  const linkMutation = useLinkSupplierEntry();

  // Filtre les lignes par texte libre
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = lines as any[];
    if (q) {
      result = result.filter((l) =>
        [l.description, l.categorie, l.sous_categorie, l.fournisseur_prevu, l.nature_depense]
          .filter(Boolean)
          .some((s: string) => s.toLowerCase().includes(q)),
      );
    }
    return result.slice(0, 100); // garde-fou
  }, [lines, search]);

  // Pré-remplit le filtre avec le fournisseur de l'écriture (souvent utile)
  const handleOpenChange = (o: boolean) => {
    if (o && entry?.supplier_code) {
      setSearch(entry.supplier_code);
      setSelectedId(null);
      setNote('');
    } else if (!o) {
      setSelectedId(null);
      setNote('');
    }
    onOpenChange(o);
  };

  const handleSubmit = async () => {
    if (!entry || !selectedId) return;
    try {
      await linkMutation.mutateAsync({
        budgetLineId: selectedId,
        entryKey: entry.entry_key,
        note: note.trim() || undefined,
      });
      toast({ title: 'Écriture rattachée' });
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rattacher à une ligne budgétaire IT</DialogTitle>
          <DialogDescription>
            Choisis la ligne du budget IT à laquelle cette écriture comptable doit être imputée.
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <div className="border rounded-md p-3 bg-muted/40 text-xs space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">
                {entry.dos} · {entry.journal} · {entry.numero}
              </span>
              <div className="flex items-baseline gap-3 text-right">
                <div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-none">TTC</div>
                  <div className="font-semibold tabular-nums">{eur(entry.solde)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-none">HT est. (20%)</div>
                  <div className="font-semibold tabular-nums text-violet-700">{eur(htEstime(entry.solde))}</div>
                </div>
              </div>
            </div>
            <div className="font-medium truncate">
              {entry.supplier_name ?? entry.supplier_code ?? '—'}
              <span className="text-muted-foreground font-normal"> — {entry.libelle_ecriture ?? ''}</span>
            </div>
            <div className="text-[10px] text-amber-700 pt-1">
              ⚠️ Le budget IT est en HT. Compare le <b>HT estimé</b> au <b>montant budgété</b> de la ligne sélectionnée ci-dessous.
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Rechercher une ligne budgétaire</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              placeholder="catégorie, description, fournisseur, nature…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-72 border rounded-md">
            {linesLoading ? (
              <div className="flex items-center justify-center h-full py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                Aucune ligne budgétaire ne correspond.
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((l: any) => {
                  const selected = selectedId === l.id;
                  return (
                    <button
                      type="button"
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-xs flex items-start gap-2',
                        selected && 'bg-primary/10 hover:bg-primary/10',
                      )}
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                            {l.type_depense ?? '—'}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                            {l.categorie ?? '—'}
                            {l.sous_categorie ? ` / ${l.sous_categorie}` : ''}
                          </Badge>
                          {l.fournisseur_prevu && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {l.fournisseur_prevu}
                            </span>
                          )}
                        </div>
                        <div className="truncate font-medium">
                          {l.description ?? l.nature_depense ?? <span className="italic text-muted-foreground">Sans description</span>}
                        </div>
                      </div>
                      <span className="tabular-nums font-semibold text-[11px] shrink-0">
                        {eur(l.montant_budget_revise ?? l.montant_budget)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="link-note" className="text-xs">
            Note (optionnelle)
          </Label>
          <Input
            id="link-note"
            placeholder="Ex. ventilation mensuelle CCA"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedId || linkMutation.isPending}>
            {linkMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LinkIcon className="h-4 w-4 mr-2" />
            )}
            Rattacher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
