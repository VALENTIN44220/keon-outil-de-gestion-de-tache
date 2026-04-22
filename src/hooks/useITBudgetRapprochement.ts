import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DivaltoCommande {
  fullcdno: string;
  tiers: string | null;
  nomfournisseur: string | null;
  montant_ht: number | null;
  date_commande: string | null;
}

export interface DivaltoFacture {
  reference: string;
  source: string;
  tiers: string | null;
  nomfournisseur: string | null;
  montant_ht: number | null;
  date_facture: string | null;
}

export function useITBudgetRapprochement(
  budgetLineId: string | null,
  fournisseurPrevu: string | null
) {
  const qc = useQueryClient();

  const commandesQuery = useQuery({
    queryKey: ['it-budget-commandes-liees', budgetLineId],
    queryFn: async () => {
      if (!budgetLineId) return [];
      const { data, error } = await supabase
        .from('it_budget_line_commandes')
        .select('id, budget_line_id, fullcdno, created_at, it_divalto_commandes(fullcdno, tiers, nomfournisseur, montant_ht, date_commande)')
        .eq('budget_line_id', budgetLineId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!budgetLineId,
  });

  const facturesQuery = useQuery({
    queryKey: ['it-budget-factures-liees', budgetLineId],
    queryFn: async () => {
      if (!budgetLineId) return [];
      const { data, error } = await supabase
        .from('it_budget_line_factures')
        .select('id, budget_line_id, fullcdno_fac, created_at')
        .eq('budget_line_id', budgetLineId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!budgetLineId,
  });

  const searchCommandes = async (query: string): Promise<DivaltoCommande[]> => {
    let q = supabase
      .from('it_divalto_commandes')
      .select('fullcdno, tiers, nomfournisseur, montant_ht, date_commande')
      .order('date_commande', { ascending: false })
      .limit(50);
    if (fournisseurPrevu) q = q.eq('tiers', fournisseurPrevu);
    if (query.trim()) q = q.ilike('fullcdno', `%${query.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as DivaltoCommande[];
  };

  const searchFactures = async (query: string): Promise<DivaltoFacture[]> => {
    let q = supabase
      .from('it_divalto_factures')
      .select('reference, source, tiers, nomfournisseur, montant_ht, date_facture')
      .order('date_facture', { ascending: false })
      .limit(50);
    if (fournisseurPrevu) q = q.eq('tiers', fournisseurPrevu);
    if (query.trim()) q = q.ilike('reference', `%${query.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as DivaltoFacture[];
  };

  const lierCommande = useMutation({
    mutationFn: async (fullcdno: string) => {
      const { error } = await supabase
        .from('it_budget_line_commandes')
        .insert({ budget_line_id: budgetLineId!, fullcdno });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-budget-commandes-liees', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
    },
  });

  const delierCommande = useMutation({
    mutationFn: async (lienId: string) => {
      const { error } = await supabase.from('it_budget_line_commandes').delete().eq('id', lienId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-budget-commandes-liees', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
    },
  });

  const lierFacture = useMutation({
    mutationFn: async (fullcdno_fac: string) => {
      const { error } = await supabase
        .from('it_budget_line_factures')
        .insert({ budget_line_id: budgetLineId!, fullcdno_fac });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-budget-factures-liees', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
    },
  });

  const delierFacture = useMutation({
    mutationFn: async (lienId: string) => {
      const { error } = await supabase.from('it_budget_line_factures').delete().eq('id', lienId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-budget-factures-liees', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
    },
  });

  const engage = (commandesQuery.data ?? []).reduce((s: number, l: any) => {
    return s + ((l.it_divalto_commandes as any)?.montant_ht ?? 0);
  }, 0);

  const constate = (facturesQuery.data ?? []).reduce((s: number, l: any) => {
    return s + ((l.it_divalto_factures as any)?.montant_ht ?? 0);
  }, 0);

  return {
    commandesLiees: commandesQuery.data ?? [],
    facturesLiees: facturesQuery.data ?? [],
    isLoading: commandesQuery.isLoading || facturesQuery.isLoading,
    searchCommandes,
    searchFactures,
    lierCommande,
    delierCommande,
    lierFacture,
    delierFacture,
    engage,
    constate,
  };
}
