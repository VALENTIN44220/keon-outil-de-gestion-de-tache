/**
 * Dialog : rattache UNE OU PLUSIEURS écritures comptables fournisseur
 * (supplier_accounting_entries) à une ligne budgétaire IT (it_budget_lines).
 * Un sélecteur texte filtre la liste des lignes ; toutes les écritures reçues
 * sont rattachées à la ligne choisie (rattachement multiple).
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
import { useLinkSupplierEntries, type SupplierAccountingEntry } from '@/hooks/useSupplierAccountingEntries';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// Écritures TTC vs budgets HT — estimation à TVA 20% par défaut.
// On travaille en valeur absolue (le solde peut être ± selon sens débit/crédit).
const TVA_STD = 0.20;
const abs = (n: number | null | undefined): number => Math.abs(n ?? 0);
const htEstime = (ttc: number | null | undefined): number => abs(ttc) / (1 + TVA_STD);

interface Props {
  /** Écriture(s) à rattacher (1 = rattachement simple, N = rattachement multiple). */
  entries: SupplierAccountingEntry[];
  annee: number;
  entite: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierEntryLinkDialog({ entries, annee, entite, open, onOpenChange }: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { lines, linesLoading } = useITBudgetGlobal({ annee, entite });
  const linkMutation = useLinkSupplierEntries();

  const isMulti = entries.length > 1;
  const totalTtc = entries.reduce((s, e) => s + abs(e.solde), 0);
  const totalHt = htEstime(totalTtc);
  // Fournisseur commun (pour préremplir le filtre) si toutes les écritures le partagent.
  const commonSupplier = entries.length > 0 && entries.every((e) => e.supplier_code === entries[0].supplier_code)
    ? entries[0].supplier_code
    : null;

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

  // Pré-remplit le filtre avec le fournisseur commun (souvent utile)
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setSearch(commonSupplier ?? '');
      setSelectedId(null);
      setNote('');
    } else {
      setSelectedId(null);
      setNote('');
    }
    onOpenChange(o);
  };

  const handleSubmit = async () => {
    if (entries.length === 0 || !selectedId) return;
    try {
      const res = await linkMutation.mutateAsync({
        budgetLineId: selectedId,
        entryKeys: entries.map((e) => e.entry_key),
        note: note.trim() || undefined,
      });
      toast({
        title: res.inserted > 1 ? `${res.inserted} écritures rattachées` : 'Écriture rattachée',
      });
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
          <DialogTitle>
            Rattacher {isMulti ? `${entries.length} écritures` : 'une écriture'} à une ligne budgétaire IT
          </DialogTitle>
          <DialogDescription>
            {isMulti
              ? 'Choisis la ligne du budget IT à laquelle ces écritures comptables seront toutes imputées.'
              : 'Choisis la ligne du budget IT à laquelle cette écriture comptable doit être imputée.'}
          </DialogDescription>
        </DialogHeader>

        {entries.length === 1 && (
          <div className="border rounded-md p-3 bg-muted/40 text-xs space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">
                {entries[0].dos} · {entries[0].journal} · {entries[0].numero}
              </span>
              <div className="flex items-baseline gap-3 text-right">
                <div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-none">TTC</div>
                  <div className="font-semibold tabular-nums">{eur(abs(entries[0].solde))}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-none">HT est. (20%)</div>
                  <div className="font-semibold tabular-nums text-violet-700">{eur(htEstime(entries[0].solde))}</div>
                </div>
              </div>
            </div>
            <div className="font-medium truncate">
              {entries[0].supplier_name ?? entries[0].supplier_code ?? '—'}
              <span className="text-muted-foreground font-normal"> — {entries[0].libelle_ecriture ?? ''}</span>
            </div>
            <div className="text-[10px] text-amber-700 pt-1">
              ⚠️ Le budget IT est en HT. Compare le <b>HT estimé</b> au <b>montant budgété</b> de la ligne sélectionnée ci-dessous.
            </div>
          </div>
        )}

        {isMulti && (
          <div className="border rounded-md p-3 bg-muted/40 text-xs space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{entries.length} écritures sélectionnées</span>
              <div className="flex items-baseline gap-3 text-right">
                <div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-none">Total TTC</div>
                  <div className="font-semibold tabular-nums">{eur(totalTtc)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-muted-foreground leading-none">Total HT est.</div>
                  <div className="font-semibold tabular-nums text-violet-700">{eur(totalHt)}</div>
                </div>
              </div>
            </div>
            <div className="max-h-24 overflow-y-auto divide-y rounded border bg-background/60">
              {entries.map((e) => (
                <div key={e.entry_key} className="flex items-center justify-between gap-2 px-2 py-1">
                  <span className="truncate">
                    <span className="font-mono text-[10px] text-muted-foreground mr-1">{e.journal}/{e.numero}</span>
                    {e.supplier_name ?? e.supplier_code ?? '—'}
                  </span>
                  <span className="tabular-nums shrink-0">{eur(abs(e.solde))}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-amber-700">
              ⚠️ Budget IT en HT. Toutes ces écritures seront rattachées à la même ligne.
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
            {isMulti ? `Rattacher ${entries.length} écritures` : 'Rattacher'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
