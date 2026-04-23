import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

/**
 * TVA utilisée en fallback quand seule la source `compta` (TTC) est disponible,
 * pour estimer un HT à afficher à l'utilisateur.
 */
const TVA_RATE = 0.20;

interface DivaltoCommande {
  fullcdno: string;
  tiers: string | null;
  nomfournisseur: string | null;
  montant_ht: number | null;
  date_commande: string | null;
}

interface DivaltoFactureRaw {
  reference: string;
  source: string | null;
  tiers: string | null;
  nomfournisseur: string | null;
  libelle: string | null;
  montant_ht: number | null;
  date_facture: string | null;
}

interface DivaltoFactureGrouped {
  reference: string;
  tiers: string | null;
  nomfournisseur: string | null;
  libelle: string | null;
  montant_ht: number | null;   // HT réel (gescom) ou estimé (TTC/1.20)
  montant_ttc: number | null;
  ht_estime: boolean;
  date_facture: string | null;
  has_gescom: boolean;
  has_compta: boolean;
}

function groupFacturesByReference(rows: DivaltoFactureRaw[]): DivaltoFactureGrouped[] {
  const map = new Map<string, DivaltoFactureGrouped & { _htReel: number | null }>();
  for (const row of rows) {
    const key = (row.reference ?? '').trim();
    if (!key) continue;
    let g = map.get(key);
    if (!g) {
      g = {
        reference: key, tiers: row.tiers, nomfournisseur: row.nomfournisseur,
        libelle: row.libelle, montant_ht: null, montant_ttc: null, ht_estime: false,
        date_facture: row.date_facture, has_gescom: false, has_compta: false,
        _htReel: null,
      };
      map.set(key, g);
    }
    const src = (row.source ?? '').toLowerCase();
    if (src === 'gescom') {
      g.has_gescom = true;
      g._htReel = row.montant_ht ?? g._htReel;
      g.libelle = row.libelle ?? g.libelle;
      g.tiers = row.tiers ?? g.tiers;
      g.date_facture = row.date_facture ?? g.date_facture;
    } else if (src === 'compta') {
      g.has_compta = true;
      g.montant_ttc = row.montant_ht ?? g.montant_ttc;
      g.libelle ??= row.libelle;
      g.tiers ??= row.tiers;
      g.date_facture ??= row.date_facture;
    } else {
      g._htReel ??= row.montant_ht;
    }
  }
  const out: DivaltoFactureGrouped[] = [];
  for (const g of map.values()) {
    if (g._htReel != null) { g.montant_ht = g._htReel; g.ht_estime = false; }
    else if (g.montant_ttc != null) { g.montant_ht = g.montant_ttc / (1 + TVA_RATE); g.ht_estime = true; }
    const { _htReel, ...rest } = g;
    out.push(rest);
  }
  out.sort((a, b) => {
    const da = a.date_facture ?? ''; const db = b.date_facture ?? '';
    if (da !== db) return da < db ? 1 : -1;
    return a.reference.localeCompare(b.reference);
  });
  return out;
}

interface BulkRapprochementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  /** Callback appelé après succès (ex : invalider des queries). */
  onSuccess?: () => void;
}

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function BulkRapprochementDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkRapprochementDialogProps) {
  const [tab, setTab] = useState<'commande' | 'facture'>('commande');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [commandes, setCommandes] = useState<DivaltoCommande[]>([]);
  const [factures, setFactures] = useState<DivaltoFactureGrouped[]>([]);
  const [applying, setApplying] = useState(false);

  const count = selectedIds.length;

  const searchCommandes = useCallback(async (q: string) => {
    setSearching(true);
    try {
      let req = supabase
        .from('it_divalto_commandes')
        .select('fullcdno, tiers, nomfournisseur, montant_ht, date_commande')
        .order('date_commande', { ascending: false })
        .limit(50);
      if (q.trim()) req = req.ilike('fullcdno', `%${q.trim()}%`);
      const { data, error } = await req;
      if (error) throw error;
      setCommandes((data ?? []) as DivaltoCommande[]);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }, []);

  const searchFactures = useCallback(async (q: string) => {
    setSearching(true);
    try {
      let req = supabase
        .from('it_divalto_factures')
        .select('reference, source, tiers, nomfournisseur, libelle, montant_ht, date_facture')
        .order('date_facture', { ascending: false })
        .limit(200);
      if (q.trim()) req = req.ilike('reference', `%${q.trim()}%`);
      const { data, error } = await req;
      if (error) throw error;
      const grouped = groupFacturesByReference((data ?? []) as DivaltoFactureRaw[]);
      setFactures(grouped.slice(0, 50));
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setCommandes([]);
      setFactures([]);
      return;
    }
    if (tab === 'commande') searchCommandes('');
    else searchFactures('');
  }, [open, tab, searchCommandes, searchFactures]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (tab === 'commande') searchCommandes(query);
      else searchFactures(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, tab, searchCommandes, searchFactures]);

  const applyCommande = async (fullcdno: string) => {
    if (selectedIds.length === 0) return;
    setApplying(true);
    try {
      const rows = selectedIds.map((id) => ({ budget_line_id: id, fullcdno }));
      const { error } = await supabase
        .from('it_budget_line_commandes')
        .upsert(rows, { onConflict: 'budget_line_id,fullcdno', ignoreDuplicates: true });
      if (error) throw error;
      toast({
        title: 'Commande affectée',
        description: `${selectedIds.length} ligne(s) liée(s) à ${fullcdno}`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const applyFacture = async (reference: string) => {
    if (selectedIds.length === 0) return;
    setApplying(true);
    try {
      const rows = selectedIds.map((id) => ({ budget_line_id: id, fullcdno_fac: reference }));
      const { error } = await supabase
        .from('it_budget_line_factures')
        .upsert(rows, { onConflict: 'budget_line_id,fullcdno_fac', ignoreDuplicates: true });
      if (error) throw error;
      toast({
        title: 'Facture affectée',
        description: `${selectedIds.length} ligne(s) liée(s) à ${reference}`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const header = useMemo(
    () => `Affecter ${count} ligne${count > 1 ? 's' : ''} à une commande/facture`,
    [count]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{header}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'commande' | 'facture')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="commande">Commande (CFK)</TabsTrigger>
            <TabsTrigger value="facture">Facture (FFK)</TabsTrigger>
          </TabsList>

          <div className="mt-3 space-y-2">
            <Label className="text-xs text-muted-foreground">
              Recherchez puis cliquez sur une entrée — toutes les lignes sélectionnées y seront rattachées.
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === 'commande' ? 'Rechercher par fullcdno...' : 'Rechercher par référence...'}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          <TabsContent value="commande" className="mt-3">
            <ScrollArea className="h-[320px] rounded-md border">
              <div className="p-1">
                {searching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : commandes.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">Aucun résultat</div>
                ) : (
                  commandes.map((c) => (
                    <div
                      key={c.fullcdno}
                      onClick={() => !applying && applyCommande(c.fullcdno)}
                      className={cn(
                        'flex items-center justify-between rounded-sm px-2 py-2 text-sm',
                        applying ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono font-medium">{c.fullcdno}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.tiers} {c.nomfournisseur ? `— ${c.nomfournisseur}` : ''}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="tabular-nums font-semibold">{eur(c.montant_ht)}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.date_commande?.slice(0, 10) ?? '—'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="facture" className="mt-3">
            <TooltipProvider delayDuration={200}>
              <ScrollArea className="h-[320px] rounded-md border">
                <div className="p-1">
                  {searching ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : factures.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">Aucun résultat</div>
                  ) : (
                    factures.map((f) => (
                      <div
                        key={f.reference}
                        onClick={() => !applying && applyFacture(f.reference)}
                        className={cn(
                          'flex items-center justify-between rounded-sm px-2 py-2 text-sm',
                          applying ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
                        )}
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-medium">{f.reference}</span>
                            {f.has_gescom && <Badge variant="outline" className="text-[9px] h-4 px-1 border-indigo-300 text-indigo-600">gescom</Badge>}
                            {f.has_compta && <Badge variant="outline" className="text-[9px] h-4 px-1 border-violet-300 text-violet-600">compta</Badge>}
                            {f.ht_estime && (
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
                          <span className="text-xs text-muted-foreground truncate">
                            {f.tiers ?? '—'}
                            {f.libelle ? ` · ${f.libelle}` : ''}
                          </span>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="tabular-nums font-semibold">
                            {eur(f.montant_ht)}<span className="text-[10px] text-muted-foreground ml-0.5">HT</span>
                          </div>
                          {f.montant_ttc != null && (
                            <div className="text-[10px] text-muted-foreground tabular-nums">{eur(f.montant_ttc)} TTC</div>
                          )}
                          <div className="text-[10px] text-muted-foreground">
                            {f.date_facture?.slice(0, 10) ?? '—'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TooltipProvider>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
