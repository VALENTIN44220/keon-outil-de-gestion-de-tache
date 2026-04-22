import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ITBudgetLine, ITManualExpense, ITBudgetReallocation, ITBudgetKPIs
} from '@/types/itProject';

export function useITProjectBudget(projectId: string | undefined) {
  const qc = useQueryClient();

  // ── Lignes budgétaires ──────────────────────────────────────────────
  const linesQuery = useQuery({
    queryKey: ['it-budget-lines', projectId],
    queryFn: async (): Promise<ITBudgetLine[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('it_budget_lines')
        .select('*')
        .eq('it_project_id', projectId)
        .order('mois_budget', { ascending: true });
      if (error) throw error;
      return (data as ITBudgetLine[]) ?? [];
    },
    enabled: !!projectId,
  });

  const addLine = useMutation({
    mutationFn: async (line: Omit<ITBudgetLine, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('it_budget_lines').insert(line).select().single();
      if (error) throw error;
      return data as ITBudgetLine;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-lines', projectId] }),
  });

  const updateLine = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ITBudgetLine> }) => {
      const { data, error } = await supabase.from('it_budget_lines').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as ITBudgetLine;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-lines', projectId] }),
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_budget_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-lines', projectId] }),
  });

  // ── Dépenses manuelles ──────────────────────────────────────────────
  const expensesQuery = useQuery({
    queryKey: ['it-manual-expenses', projectId],
    queryFn: async (): Promise<ITManualExpense[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('it_manual_expenses')
        .select('*')
        .eq('it_project_id', projectId)
        .order('date_prevue', { ascending: true });
      if (error) throw error;
      return (data as ITManualExpense[]) ?? [];
    },
    enabled: !!projectId,
  });

  const addExpense = useMutation({
    mutationFn: async (exp: Omit<ITManualExpense, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('it_manual_expenses').insert(exp).select().single();
      if (error) throw error;
      return data as ITManualExpense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-manual-expenses', projectId] }),
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ITManualExpense> }) => {
      const { data, error } = await supabase.from('it_manual_expenses').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as ITManualExpense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-manual-expenses', projectId] }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_manual_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-manual-expenses', projectId] }),
  });

  // ── Réaffectations ──────────────────────────────────────────────────
  const reallocQuery = useQuery({
    queryKey: ['it-budget-reallocations', projectId],
    queryFn: async (): Promise<ITBudgetReallocation[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('it_budget_reallocations')
        .select('*')
        .eq('it_project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ITBudgetReallocation[]) ?? [];
    },
    enabled: !!projectId,
  });

  // ── KPIs (calcul client-side MVP) ───────────────────────────────────
  const lines    = linesQuery.data    ?? [];
  const expenses = expensesQuery.data ?? [];

  const budget_initial  = lines.reduce((s, l) => s + (l.montant_budget ?? 0), 0);
  const budget_revise   = lines.reduce((s, l) => s + (l.montant_budget_revise ?? l.montant_budget ?? 0), 0);
  const engage          = 0; // TODO Phase 2 : CFK Divalto
  const constate        = 0; // TODO Phase 2 : FFK Divalto
  const manuel_prevu    = expenses.filter(e => e.statut !== 'annule').reduce((s, e) => s + (e.montant_prevu ?? 0), 0);
  const forecast_fin_annee   = constate + (engage - constate) + manuel_prevu;
  const ecart_budget         = forecast_fin_annee - budget_revise;
  const montant_reaffectable = Math.max(budget_revise - forecast_fin_annee, 0);
  const depassement          = Math.max(forecast_fin_annee - budget_revise, 0);

  const kpis: ITBudgetKPIs = {
    budget_initial,
    budget_revise,
    engage,
    constate,
    reste_a_engager:   budget_revise - engage,
    reste_a_constater: engage - constate,
    forecast_fin_annee,
    ecart_budget,
    montant_reaffectable,
    depassement,
    taux_consommation: budget_revise > 0 ? Math.round((constate / budget_revise) * 100) : 0,
  };

  return {
    lines,    linesLoading:    linesQuery.isLoading,
    addLine,  updateLine,      deleteLine,
    expenses, expensesLoading: expensesQuery.isLoading,
    addExpense, updateExpense, deleteExpense,
    reallocations: reallocQuery.data ?? [],
    kpis,
  };
}

export function useITBudgetGlobal(filters: { annee?: number; entite?: string; type_depense?: string; categorie?: string }) {
  const qc = useQueryClient();

  const linesQuery = useQuery({
    queryKey: ['it-budget-global-lines', filters],
    queryFn: async (): Promise<ITBudgetLine[]> => {
      let q = supabase.from('it_budget_lines').select('*');
      if (filters.annee)        q = q.eq('annee', filters.annee);
      if (filters.entite)       q = q.eq('entite', filters.entite);
      if (filters.type_depense) q = q.eq('type_depense', filters.type_depense);
      if (filters.categorie)    q = q.eq('categorie', filters.categorie);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ITBudgetLine[]) ?? [];
    },
  });

  const expensesQuery = useQuery({
    queryKey: ['it-budget-global-expenses', filters],
    queryFn: async (): Promise<ITManualExpense[]> => {
      let q = supabase.from('it_manual_expenses').select('*');
      if (filters.annee)  q = q.eq('annee', filters.annee);
      if (filters.entite) q = q.eq('entite', filters.entite);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ITManualExpense[]) ?? [];
    },
  });

  const addLine = useMutation({
    mutationFn: async (line: Omit<ITBudgetLine, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('it_budget_lines').insert(line).select().single();
      if (error) throw error;
      return data as ITBudgetLine;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-global-lines'] }),
  });

  const updateLine = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ITBudgetLine> }) => {
      const { data, error } = await supabase.from('it_budget_lines').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as ITBudgetLine;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-global-lines'] }),
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_budget_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-global-lines'] }),
  });

  const bulkUpdateLines = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<ITBudgetLine> }) => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('it_budget_lines')
        .update(updates)
        .in('id', ids)
        .select();
      if (error) throw error;
      return (data ?? []) as ITBudgetLine[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-global-lines'] }),
  });

  const bulkDeleteLines = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('it_budget_lines').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-global-lines'] }),
  });

  const bulkDuplicateLines = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return [];
      const { data: sources, error: e1 } = await supabase
        .from('it_budget_lines')
        .select('*')
        .in('id', ids);
      if (e1) throw e1;
      if (!sources || sources.length === 0) return [];
      const clones = sources.map(({ id, created_at, updated_at, ...rest }: any) => ({
        ...rest,
        statut: 'brouillon',
      }));
      const { data, error } = await supabase.from('it_budget_lines').insert(clones).select();
      if (error) throw error;
      return (data ?? []) as ITBudgetLine[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-global-lines'] }),
  });

  const addExpense = useMutation({
    mutationFn: async (exp: Omit<ITManualExpense, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('it_manual_expenses').insert(exp).select().single();
      if (error) throw error;
      return data as ITManualExpense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-global-expenses'] }),
  });

  const lines    = linesQuery.data    ?? [];
  const expenses = expensesQuery.data ?? [];

  // KPIs globaux
  const budget_initial       = lines.reduce((s, l) => s + (l.montant_budget ?? 0), 0);
  const budget_revise        = lines.reduce((s, l) => s + (l.montant_budget_revise ?? l.montant_budget ?? 0), 0);
  const engage               = 0;
  const constate             = 0;
  const manuel_prevu         = expenses.filter(e => e.statut !== 'annule').reduce((s, e) => s + (e.montant_prevu ?? 0), 0);
  const forecast_fin_annee   = constate + (engage - constate) + manuel_prevu;
  const ecart_budget         = forecast_fin_annee - budget_revise;
  const montant_reaffectable = Math.max(budget_revise - forecast_fin_annee, 0);
  const depassement          = Math.max(forecast_fin_annee - budget_revise, 0);

  const kpis: ITBudgetKPIs = {
    budget_initial, budget_revise, engage, constate,
    reste_a_engager:   budget_revise - engage,
    reste_a_constater: engage - constate,
    forecast_fin_annee, ecart_budget, montant_reaffectable, depassement,
    taux_consommation: budget_revise > 0 ? Math.round((constate / budget_revise) * 100) : 0,
  };

  // Répartition par type_depense pour waterfall
  const byType = ['Opex', 'Capex', 'RH', 'Amortissement'].map(type => ({
    type,
    budget_initial: lines.filter(l => l.type_depense === type).reduce((s, l) => s + (l.montant_budget ?? 0), 0),
    budget_revise:  lines.filter(l => l.type_depense === type).reduce((s, l) => s + (l.montant_budget_revise ?? l.montant_budget ?? 0), 0),
  }));

  // Répartition par catégorie pour graphique
  const byCategorie = Array.from(
    lines.reduce((map, l) => {
      const key = l.categorie?.trim() || 'Sans catégorie';
      const cur = map.get(key) || { categorie: key, budget_initial: 0, budget_revise: 0 };
      cur.budget_initial += l.montant_budget ?? 0;
      cur.budget_revise  += l.montant_budget_revise ?? l.montant_budget ?? 0;
      map.set(key, cur);
      return map;
    }, new Map<string, { categorie: string; budget_initial: number; budget_revise: number }>())
  ).map(([, v]) => v).sort((a, b) => b.budget_revise - a.budget_revise);

  // Répartition par entite
  const byEntite = Array.from(
    lines.reduce((map, l) => {
      const key = l.entite?.trim() || 'Non affecté';
      const cur = map.get(key) || { entite: key, budget: 0 };
      cur.budget += l.montant_budget_revise ?? l.montant_budget ?? 0;
      map.set(key, cur);
      return map;
    }, new Map<string, { entite: string; budget: number }>())
  ).map(([, v]) => v).sort((a, b) => b.budget - a.budget);

  const byFournisseur = Array.from(
    lines.reduce((map, l) => {
      const key = l.fournisseur_prevu?.trim() || 'Sans fournisseur';
      const cur = map.get(key) || { fournisseur: key, budget: 0 };
      cur.budget += l.montant_budget_revise ?? l.montant_budget ?? 0;
      map.set(key, cur);
      return map;
    }, new Map<string, { fournisseur: string; budget: number }>())
  ).map(([, v]) => v)
    .sort((a, b) => b.budget - a.budget)
    .slice(0, 10); // top 10

  const bySousCategorie = Array.from(
    lines.reduce((map, l) => {
      const key = l.sous_categorie?.trim() || 'Sans sous-catégorie';
      const cur = map.get(key) || { sous_categorie: key, budget_initial: 0, budget_revise: 0 };
      cur.budget_initial += l.montant_budget ?? 0;
      cur.budget_revise  += l.montant_budget_revise ?? l.montant_budget ?? 0;
      map.set(key, cur);
      return map;
    }, new Map<string, { sous_categorie: string; budget_initial: number; budget_revise: number }>())
  ).map(([, v]) => v)
    .sort((a, b) => b.budget_revise - a.budget_revise);

  return {
    lines, linesLoading: linesQuery.isLoading,
    expenses, expensesLoading: expensesQuery.isLoading,
    addLine, updateLine, deleteLine, addExpense,
    bulkUpdateLines, bulkDeleteLines, bulkDuplicateLines,
    kpis, byType, byCategorie, byEntite, byFournisseur, bySousCategorie,
  };
}

export interface ITBudgetLineMonth {
  id: string;
  budget_line_id: string;
  mois: number;
  montant_budget: number;
  montant_budget_revise?: number | null;
  ref_commande_divalto?: string | null;
  ref_facture_divalto?: string | null;
  statut_rapprochement: 'non_rapproche' | 'commande_liee' | 'facture_liee' | 'solde';
  pdf_url?: string | null;
  commentaire?: string | null;
  created_at: string;
  updated_at: string;
}

export function useITBudgetLineMonths(lineId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['it-budget-line-months', lineId],
    queryFn: async (): Promise<ITBudgetLineMonth[]> => {
      if (!lineId) return [];
      const { data, error } = await supabase
        .from('it_budget_line_months')
        .select('*')
        .eq('budget_line_id', lineId)
        .order('mois', { ascending: true });
      if (error) throw error;
      return (data as ITBudgetLineMonth[]) ?? [];
    },
    enabled: !!lineId,
  });

  const updateMonth = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ITBudgetLineMonth> }) => {
      const { data, error } = await supabase
        .from('it_budget_line_months')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ITBudgetLineMonth;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it-budget-line-months', lineId] }),
  });

  return { ...query, updateMonth };
}
