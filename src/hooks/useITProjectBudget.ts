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
