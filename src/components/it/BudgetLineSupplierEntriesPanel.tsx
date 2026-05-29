/**
 * Panel "Écritures comptables fournisseurs rattachées" pour la fiche d'une
 * it_budget_line. Affiche :
 *  - les écritures déjà rattachées (avec total consommé HT estimé)
 *  - une zone de recherche pour en rattacher de nouvelles
 *
 * Les écritures comptables (supplier_accounting_entries) sont en TTC ; le
 * total HT estimé utilise TVA 20% (taux standard FR) — cohérent avec le
 * tab global Écritures fournisseurs.
 */
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Link as LinkIcon, Unlink, Search, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  useITBudgetLineSupplierEntries,
  useLinkSupplierEntry,
  useLinkSupplierEntries,
  useUnlinkSupplierEntry,
  useSupplierAccountingEntries,
} from '@/hooks/useSupplierAccountingEntries';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const TVA_STD = 0.20;
const htEstime = (ttc: number | null | undefined): number => (ttc ?? 0) / (1 + TVA_STD);

interface Props {
  budgetLineId: string | null;
  fournisseurPrevu: string | null;
}

export function BudgetLineSupplierEntriesPanel({ budgetLineId, fournisseurPrevu }: Props) {
  const [search, setSearch] = useState(fournisseurPrevu ?? '');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const { data: liens = [], isLoading: liensLoading } = useITBudgetLineSupplierEntries(budgetLineId);
  const linkMut = useLinkSupplierEntry();
  const linkManyMut = useLinkSupplierEntries();
  const unlinkMut = useUnlinkSupplierEntry();

  // Suggestions : écritures du même fournisseur (ou recherche libre), sans Gescom par défaut.
  // Si la recherche est exactement le code fournisseur de la ligne, on filtre STRICT
  // sur supplier_code (plus précis que la recherche fuzzy multi-colonnes).
  const searchTrim = search.trim();
  const useStrict = !!fournisseurPrevu && searchTrim.toUpperCase() === fournisseurPrevu.toUpperCase();
  const { data: searchResult, isFetching: searching } = useSupplierAccountingEntries({
    has_gescom_piece: false,
    supplier_code: useStrict ? fournisseurPrevu! : undefined,
    supplier_search: useStrict ? undefined : searchTrim || undefined,
    page: 0,
    page_size: 50,
  });
  const candidates = searchResult?.data ?? [];

  // Reset selection quand la recherche change ou budget line change
  useEffect(() => {
    setSelectedKeys(new Set());
  }, [search, budgetLineId]);

  // Set des entry_keys déjà rattachées (pour griser dans la liste de suggestions)
  const alreadyLinked = useMemo(() => {
    return new Set(liens.map((l: any) => l.supplier_entry_key));
  }, [liens]);

  // Totaux consommation
  const totals = useMemo(() => {
    let ttc = 0;
    for (const l of liens as any[]) {
      const ent = l.supplier_accounting_entries;
      ttc += Number(ent?.solde ?? 0);
    }
    return { ttc, ht: htEstime(ttc) };
  }, [liens]);

  if (!budgetLineId) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Sauvegarde la ligne d'abord pour accéder aux écritures comptables.
      </div>
    );
  }

  const handleLink = async (entryKey: string) => {
    try {
      await linkMut.mutateAsync({ budgetLineId, entryKey });
      toast({ title: 'Écriture rattachée' });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const handleLinkBulk = async () => {
    const keys = [...selectedKeys].filter((k) => !alreadyLinked.has(k));
    if (keys.length === 0) return;
    try {
      const res = await linkManyMut.mutateAsync({ budgetLineId, entryKeys: keys });
      toast({ title: `${res.inserted} écriture(s) rattachée(s)` });
      setSelectedKeys(new Set());
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const toggleSelect = (entryKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(entryKey)) next.delete(entryKey);
      else next.add(entryKey);
      return next;
    });
  };

  const selectAllVisible = () => {
    const eligible = candidates
      .filter((c) => !alreadyLinked.has(c.entry_key))
      .map((c) => c.entry_key);
    const allSelected = eligible.length > 0 && eligible.every((k) => selectedKeys.has(k));
    if (allSelected) {
      // Désélectionne celles affichées
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const k of eligible) next.delete(k);
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const k of eligible) next.add(k);
        return next;
      });
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      await unlinkMut.mutateAsync(linkId);
      toast({ title: 'Lien supprimé' });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Bandeau d'info TTC/HT */}
      <div className="text-[11px] text-amber-700 bg-amber-50/60 border border-amber-200 rounded px-2.5 py-1.5">
        ⚠️ Écritures en <b>TTC</b> · budgets en <b>HT</b>. HT estimé à TVA 20%.
      </div>

      {/* Section : Écritures rattachées */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Écritures rattachées
          </h4>
          <div className="flex items-baseline gap-3 text-right">
            <div>
              <div className="text-[9px] uppercase text-muted-foreground leading-none">Total TTC</div>
              <div className="text-sm font-semibold tabular-nums">{eur(totals.ttc)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase text-muted-foreground leading-none">Total HT est.</div>
              <div className="text-sm font-semibold tabular-nums text-violet-700">{eur(totals.ht)}</div>
            </div>
          </div>
        </div>

        {liensLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
          </div>
        ) : liens.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-3 text-center border rounded-md bg-muted/20">
            Aucune écriture rattachée pour cette ligne.
          </div>
        ) : (
          <div className="border rounded-md divide-y">
            {(liens as any[]).map((l) => {
              const ent = l.supplier_accounting_entries;
              if (!ent) return null;
              return (
                <div
                  key={l.id}
                  className="px-2.5 py-1.5 flex items-center gap-2 text-xs hover:bg-muted/30"
                >
                  <Badge variant="outline" className="font-mono text-[10px] px-1 h-4 shrink-0">
                    {ent.dos}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {ent.journal}/{ent.numero}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {ent.date ?? '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">
                      {ent.supplier_name ?? ent.supplier_code ?? '—'}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {ent.libelle_ecriture ?? ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      TTC {eur(ent.solde)}
                    </div>
                    <div className="text-[10px] tabular-nums text-violet-700 font-medium">
                      HT est. {eur(htEstime(ent.solde))}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleUnlink(l.id)}
                    title="Détacher"
                    disabled={unlinkMut.isPending}
                  >
                    <Unlink className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section : Recherche / rattachement */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Rattacher des écritures comptables
          </h4>
          {selectedKeys.size > 0 && (
            <Button
              size="sm"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={handleLinkBulk}
              disabled={linkManyMut.isPending}
            >
              {linkManyMut.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <LinkIcon className="h-3 w-3" />
              )}
              Rattacher la sélection ({selectedKeys.size})
            </Button>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[11px] text-muted-foreground">
              Recherche (fournisseur, code, libellé){' '}
              {useStrict && (
                <span className="text-emerald-700 font-medium">— filtre strict supplier_code</span>
              )}
            </Label>
            {candidates.length > 0 && (
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <CheckSquare className="h-3 w-3" />
                Tout cocher / décocher
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="F0000xxx, PRODEVAL, KEON.BIO…"
            />
          </div>
        </div>
        <ScrollArea className="h-56 border rounded-md">
          {searching ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground italic">
              {search.trim()
                ? 'Aucune écriture (sans Gescom) ne correspond.'
                : 'Tape un fournisseur / un mot-clé pour chercher.'}
            </div>
          ) : (
            <div className="divide-y">
              {candidates.map((e) => {
                const isLinked = alreadyLinked.has(e.entry_key);
                const isSelected = selectedKeys.has(e.entry_key);
                return (
                  <div
                    key={e.entry_key}
                    className={cn(
                      'px-2.5 py-1.5 flex items-center gap-2 text-xs',
                      isLinked
                        ? 'bg-emerald-50/30'
                        : isSelected
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/30',
                    )}
                  >
                    <Checkbox
                      className="h-3.5 w-3.5 shrink-0"
                      checked={isSelected}
                      disabled={isLinked}
                      onCheckedChange={() => toggleSelect(e.entry_key)}
                    />
                    <Badge variant="outline" className="font-mono text-[10px] px-1 h-4 shrink-0">
                      {e.dos}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {e.journal}/{e.numero}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {e.date ?? '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">
                        {e.supplier_name ?? e.supplier_code ?? '—'}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {e.libelle_ecriture ?? ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {eur(e.solde)} TTC
                      </div>
                      <div className="text-[10px] tabular-nums text-violet-700">
                        ≈ {eur(htEstime(e.solde))} HT
                      </div>
                    </div>
                    {isLinked ? (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 bg-emerald-100 text-emerald-700 border-emerald-300 shrink-0">
                        rattachée
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px] gap-1 shrink-0"
                        onClick={() => handleLink(e.entry_key)}
                        disabled={linkMut.isPending}
                      >
                        <LinkIcon className="h-3 w-3" />
                        Rattacher
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
