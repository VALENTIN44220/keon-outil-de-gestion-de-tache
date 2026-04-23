import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useITBudgetRapprochement } from '@/hooks/useITBudgetRapprochement';
import type { DivaltoCommande, DivaltoFactureGrouped } from '@/hooks/useITBudgetRapprochement';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface Props {
  budgetLineId: string | null;
  fournisseurPrevu: string | null;
}

export function BudgetLineRapprochementPanel({ budgetLineId, fournisseurPrevu }: Props) {
  const {
    commandesLiees,
    facturesLiees,
    facturesLieesGrouped,
    isLoading,
    searchCommandes,
    searchFactures,
    lierCommande,
    delierCommande,
    lierFacture,
    delierFacture,
    engage,
    constate,
  } = useITBudgetRapprochement(budgetLineId, fournisseurPrevu);

  if (!budgetLineId) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Sauvegardez la ligne d'abord pour accéder au rapprochement Divalto.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commandes */}
      <CommandesSection
        liees={commandesLiees}
        isLoading={isLoading}
        fournisseurPrevu={fournisseurPrevu}
        searchCommandes={searchCommandes}
        onLier={(fullcdno) =>
          lierCommande.mutate(fullcdno, {
            onSuccess: () => toast({ title: 'Commande liée' }),
            onError: (e) => toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' }),
          })
        }
        onDelier={(id) =>
          delierCommande.mutate(id, {
            onError: (e) => toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' }),
          })
        }
        pending={lierCommande.isPending || delierCommande.isPending}
      />

      {/* Factures */}
      <FacturesSection
        liens={facturesLiees}
        grouped={facturesLieesGrouped}
        isLoading={isLoading}
        fournisseurPrevu={fournisseurPrevu}
        searchFactures={searchFactures}
        onLier={(reference) =>
          lierFacture.mutate(reference, {
            onSuccess: () => toast({ title: 'Facture liée' }),
            onError: (e) => toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' }),
          })
        }
        onDelier={(id) =>
          delierFacture.mutate(id, {
            onError: (e) => toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' }),
          })
        }
        pending={lierFacture.isPending || delierFacture.isPending}
      />

      {/* Récap */}
      <div className="border-t pt-4 flex items-center gap-6">
        <span className={cn('text-sm tabular-nums font-semibold', engage > 0 ? 'text-indigo-600' : 'text-muted-foreground')}>
          Engagé : {eur(engage)}
        </span>
        <span className={cn('text-sm tabular-nums font-semibold', constate > 0 ? 'text-violet-600' : 'text-muted-foreground')}>
          Constaté : {eur(constate)}
        </span>
      </div>
    </div>
  );
}

// ─── Section Commandes ────────────────────────────────────────────────────────

interface CommandesSectionProps {
  liees: any[];
  isLoading: boolean;
  fournisseurPrevu: string | null;
  searchCommandes: (q: string) => Promise<DivaltoCommande[]>;
  onLier: (fullcdno: string) => void;
  onDelier: (id: string) => void;
  pending: boolean;
}

function CommandesSection({ liees, isLoading, fournisseurPrevu, searchCommandes, onLier, onDelier, pending }: CommandesSectionProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DivaltoCommande[]>([]);
  const [searching, setSearching] = useState(false);

  const lieeIds = new Set(liees.map((l: any) => l.fullcdno));

  const doSearch = useCallback(async (q: string) => {
    setSearching(true);
    try { setResults(await searchCommandes(q)); }
    catch { setResults([]); }
    finally { setSearching(false); }
  }, [searchCommandes]);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); return; }
    doSearch('');
  }, [open, doSearch]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, open, doSearch]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Commandes liées</span>
        <Badge variant="secondary" className="text-xs">{liees.length}</Badge>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 ml-auto" disabled={pending}>
              <Plus className="h-3.5 w-3.5" /> Lier une commande
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="end">
            <div className="p-2 border-b">
              <Input
                placeholder="Rechercher par fullcdno..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                {searching ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">Aucun résultat</div>
                ) : results.map(r => {
                  const deja = lieeIds.has(r.fullcdno);
                  return (
                    <div
                      key={r.fullcdno}
                      onClick={() => { if (deja) return; onLier(r.fullcdno); setOpen(false); }}
                      className={cn(
                        'flex items-center justify-between rounded-sm px-2 py-1.5 text-xs',
                        deja ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium font-mono">{r.fullcdno}</span>
                        <span className="text-muted-foreground">{r.tiers} {r.nomfournisseur ? `— ${r.nomfournisseur}` : ''}</span>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="font-semibold tabular-nums">{eur(r.montant_ht)}</div>
                        <div className="text-muted-foreground">{r.date_commande?.slice(0, 10) ?? '—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="space-y-1">{[0,1,2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : liees.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">Aucune commande liée</div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Référence</th>
                <th className="text-left px-3 py-1.5 font-medium">Fournisseur</th>
                <th className="text-right px-3 py-1.5 font-medium">Montant HT</th>
                <th className="text-left px-3 py-1.5 font-medium">Date</th>
                <th className="w-[32px]"></th>
              </tr>
            </thead>
            <tbody>
              {liees.map((l: any) => {
                const c = l.it_divalto_commandes;
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono">{l.fullcdno}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c?.tiers ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{eur(c?.montant_ht)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c?.date_commande?.slice(0, 10) ?? '—'}</td>
                    <td className="px-1">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelier(l.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Section Factures ─────────────────────────────────────────────────────────

interface FacturesSectionProps {
  liens: { id: string; fullcdno_fac: string }[];
  grouped: DivaltoFactureGrouped[];
  isLoading: boolean;
  fournisseurPrevu: string | null;
  searchFactures: (q: string) => Promise<DivaltoFactureGrouped[]>;
  onLier: (reference: string) => void;
  onDelier: (id: string) => void;
  pending: boolean;
}

function FacturesSection({ liens, grouped, isLoading, searchFactures, onLier, onDelier, pending }: FacturesSectionProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DivaltoFactureGrouped[]>([]);
  const [searching, setSearching] = useState(false);

  const lieeRefs = new Set(liens.map((l) => l.fullcdno_fac));
  const groupedByRef = new Map(grouped.map((g) => [g.reference, g]));

  const doSearch = useCallback(async (q: string) => {
    setSearching(true);
    try { setResults(await searchFactures(q)); }
    catch { setResults([]); }
    finally { setSearching(false); }
  }, [searchFactures]);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); return; }
    doSearch('');
  }, [open, doSearch]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, open, doSearch]);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Factures liées</span>
        <Badge variant="secondary" className="text-xs">{liens.length}</Badge>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 ml-auto" disabled={pending}>
              <Plus className="h-3.5 w-3.5" /> Lier une facture
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[480px] p-0" align="end">
            <div className="p-2 border-b">
              <Input
                placeholder="Rechercher par référence..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-[240px]">
              <div className="p-1">
                {searching ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">Aucun résultat</div>
                ) : results.map(r => {
                  const deja = lieeRefs.has(r.reference);
                  return (
                    <div
                      key={r.reference}
                      onClick={() => { if (deja) return; onLier(r.reference); setOpen(false); }}
                      className={cn(
                        'flex items-center justify-between rounded-sm px-2 py-2 text-xs',
                        deja ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
                      )}
                    >
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium font-mono">{r.reference}</span>
                          {r.has_gescom && <Badge variant="outline" className="text-[9px] h-4 px-1 border-indigo-300 text-indigo-600">gescom</Badge>}
                          {r.has_compta && <Badge variant="outline" className="text-[9px] h-4 px-1 border-violet-300 text-violet-600">compta</Badge>}
                          {r.ht_estime && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[260px] text-[11px]">
                                HT estimé (TTC / 1,20) — aucune contrepartie gescom trouvée pour cette facture.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <span className="text-muted-foreground truncate">
                          {r.tiers ?? '—'}
                          {r.libelle ? ` · ${r.libelle}` : ''}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="font-semibold tabular-nums">{eur(r.montant_ht)}<span className="text-[9px] text-muted-foreground ml-0.5">HT</span></div>
                        {r.montant_ttc != null && (
                          <div className="text-[10px] text-muted-foreground tabular-nums">{eur(r.montant_ttc)} TTC</div>
                        )}
                        <div className="text-[10px] text-muted-foreground">{r.date_facture?.slice(0, 10) ?? '—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="space-y-1">{[0,1,2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : liens.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">Aucune facture liée</div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Référence</th>
                <th className="text-left px-3 py-1.5 font-medium">Fournisseur</th>
                <th className="text-right px-3 py-1.5 font-medium">Montant HT</th>
                <th className="text-right px-3 py-1.5 font-medium">TTC</th>
                <th className="text-left px-3 py-1.5 font-medium">Date</th>
                <th className="w-[32px]"></th>
              </tr>
            </thead>
            <tbody>
              {liens.map((l) => {
                const g = groupedByRef.get(l.fullcdno_fac);
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono">
                      <div className="flex items-center gap-1">
                        <span>{l.fullcdno_fac}</span>
                        {g?.ht_estime && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px] text-[11px]">
                              HT estimé (TTC / 1,20) — pas de contrepartie gescom.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{g?.tiers ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{g?.montant_ht != null ? eur(g.montant_ht) : '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{g?.montant_ttc != null ? eur(g.montant_ttc) : '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{g?.date_facture?.slice(0, 10) ?? '—'}</td>
                    <td className="px-1">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelier(l.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
