import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DivaltoCommande {
  fullcdno: string;
  tiers: string | null;
  nomfournisseur: string | null;
  montant_ht: number | null;
  date_commande: string | null;
}

interface DivaltoFacture {
  reference: string;
  source: string;
  tiers: string | null;
  nomfournisseur: string | null;
  montant_ht: number | null;
  date_facture: string | null;
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
  const [factures, setFactures] = useState<DivaltoFacture[]>([]);
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
      const message = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }, []);

  const searchFactures = useCallback(async (q: string) => {
    setSearching(true);
    try {
      let req = supabase
        .from('it_divalto_factures')
        .select('reference, source, tiers, nomfournisseur, montant_ht, date_facture')
        .order('date_facture', { ascending: false })
        .limit(50);
      if (q.trim()) req = req.ilike('reference', `%${q.trim()}%`);
      const { data, error } = await req;
      if (error) throw error;
      setFactures((data ?? []) as DivaltoFacture[]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
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
      const message = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
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
      const message = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
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
                      key={`${f.reference}-${f.source}`}
                      onClick={() => !applying && applyFacture(f.reference)}
                      className={cn(
                        'flex items-center justify-between rounded-sm px-2 py-2 text-sm',
                        applying ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono font-medium">{f.reference}</span>
                        <span className="text-xs text-muted-foreground">
                          {f.tiers} {f.source ? `(${f.source})` : ''}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="tabular-nums font-semibold">{eur(f.montant_ht)}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.date_facture?.slice(0, 10) ?? '—'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
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
