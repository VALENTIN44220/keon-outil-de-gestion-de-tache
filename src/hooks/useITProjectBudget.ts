import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ITBudgetLine,
  ITManualExpense,
  ITBudgetReallocation,
  ITBudgetKPIs,
  itManualExpenseAnnualEquivalent,
} from '@/types/itProject';
import { lineAnnualBudget, lineAnnualBudgetRevise } from '@/lib/itBudgetTotals';
import { aggregateCanonOverLines, computeBudgetCanon } from '@/lib/itBudgetCanon';
import { useITBudgetEngageConstate } from './useITBudgetEngageConstate';
import { useITBudgetLineSupplierEntriesAgg } from './useSupplierAccountingEntries';
import { useMemo } from 'react';

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

  // ── KPIs canoniques ─────────────────────────────────────────────────
  // engage/constate alimentés depuis v_it_budget_engage_constate (CF/FF Divalto)
  // + v_it_budget_line_supplier_entries_agg (HT estimé écritures comptables).
  // Les vues sont globales : on fetch sans filtre puis on indexe par budget_line_id —
  // le scoping projet vient de la liste `lines` (filtrée par it_project_id).
  const lines    = linesQuery.data    ?? [];
  const expenses = expensesQuery.data ?? [];

  const { data: engageConstateData, isLoading: engageLoading } = useITBudgetEngageConstate({});
  const { data: supplierAggRows = [], isLoading: supplierLoading } = useITBudgetLineSupplierEntriesAgg();

  const engageByLine = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of engageConstateData?.rows ?? []) m.set(r.budget_line_id, Number(r.engage ?? 0));
    return m;
  }, [engageConstateData]);
  const constateByLine = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of engageConstateData?.rows ?? []) m.set(r.budget_line_id, Number(r.constate ?? 0));
    return m;
  }, [engageConstateData]);
  const supplierAggByLine = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of supplierAggRows) m.set(r.budget_line_id, Number(r.supplier_ht_amount ?? 0));
    return m;
  }, [supplierAggRows]);

  const canonTotals = aggregateCanonOverLines(lines, engageByLine, constateByLine, supplierAggByLine);
  const budget_initial = canonTotals.budget_initial;
  const budget_revise  = canonTotals.budget_revise;
  const engage         = canonTotals.engage;
  const constate       = canonTotals.constate;

  const manuel_prevu = expenses
    .filter((e) => e.statut !== 'annule')
    .reduce((s, e) => s + itManualExpenseAnnualEquivalent(e), 0);
  // Forecast = engagé (contient déjà le constaté) + manuel prévu.
  // Math.max() couvre le cas marginal d'une facture sans CF (constate > engage).
  const forecast_fin_annee   = Math.max(engage, constate) + manuel_prevu;
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
    canonLoading: engageLoading || supplierLoading,
    // Maps exposées pour les écrans qui veulent un canon par ligne (ex: chart par catégorie)
    engageByLine, constateByLine, supplierAggByLine,
  };
}

/**
 * Inputs canoniques optionnels — maps budget_line_id → montant.
 * Si fournis, les KPI et les breakdowns intègrent engage/constate ; sinon ils restent à 0
 * (compat. ascendante pour appelants qui ne consomment que budget_initial/budget_revise).
 */
export interface ITBudgetGlobalCanonInputs {
  engageByLine?: Map<string, number>;
  constateByLine?: Map<string, number>;
  supplierAggByLine?: Map<string, number>;
}

export function useITBudgetGlobal(
  filters: { annee?: number; entite?: string; type_depense?: string; categorie?: string },
  canonInputs?: ITBudgetGlobalCanonInputs,
) {
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

  // KPIs globaux — canon ligne par ligne (engage = CF Divalto ou fallback statut=engage_total ;
  // constate = FF Divalto + écritures comptables HT estimées TVA 20%).
  const canonTotals = aggregateCanonOverLines(
    lines,
    canonInputs?.engageByLine,
    canonInputs?.constateByLine,
    canonInputs?.supplierAggByLine,
  );
  const budget_initial = canonTotals.budget_initial;
  const budget_revise  = canonTotals.budget_revise;
  const engage         = canonTotals.engage;
  const constate       = canonTotals.constate;
  const manuel_prevu = expenses
    .filter((e) => e.statut !== 'annule')
    .reduce((s, e) => s + itManualExpenseAnnualEquivalent(e), 0);
  // Forecast = ce qui sortira en cash d'ici fin d'année :
  // engagé (CF/déclaratif, contient déjà le constaté) + dépenses manuelles prévues.
  const forecast_fin_annee   = engage + manuel_prevu;
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

  // ─── Breakdowns canoniques uniformes ──────────────────────────────────
  // Chaque ligne est convertie en {budget_initial, budget_revise, engage, constate}
  // via le canon, puis bucketée. Garantit cohérence avec les KPI globaux.
  type Bucket = {
    budget_initial: number;
    budget_revise: number;
    engage: number;
    constate: number;
  };
  const emptyBucket = (): Bucket => ({ budget_initial: 0, budget_revise: 0, engage: 0, constate: 0 });
  const accBucket = (b: Bucket, line: ITBudgetLine) => {
    const canon = computeBudgetCanon(line, {
      cf_amount: canonInputs?.engageByLine?.get(line.id) ?? 0,
      ff_amount: canonInputs?.constateByLine?.get(line.id) ?? 0,
      supplier_ht_amount: canonInputs?.supplierAggByLine?.get(line.id) ?? 0,
    });
    b.budget_initial += canon.budget_initial;
    b.budget_revise  += canon.budget_revise;
    b.engage         += canon.engage;
    b.constate       += canon.constate;
  };
  const bucketBy = <K extends string>(keyFn: (l: ITBudgetLine) => K) => {
    const m = new Map<K, Bucket>();
    for (const l of lines) {
      const k = keyFn(l);
      let b = m.get(k);
      if (!b) { b = emptyBucket(); m.set(k, b); }
      accBucket(b, l);
    }
    return m;
  };

  // Répartition par type_depense pour waterfall
  const byType = ['Opex', 'Capex', 'RH', 'Amortissement'].map(type => {
    const b = emptyBucket();
    for (const l of lines) if (l.type_depense === type) accBucket(b, l);
    return { type, ...b };
  });

  // Répartition par catégorie pour graphique
  const byCategorie = Array.from(bucketBy(l => l.categorie?.trim() || 'Sans catégorie'))
    .map(([categorie, v]) => ({ categorie, ...v }))
    .sort((a, b) => b.budget_revise - a.budget_revise);

  // Répartition par entite
  const byEntite = Array.from(bucketBy(l => l.entite?.trim() || 'Non affecté'))
    .map(([entite, v]) => ({ entite, ...v }))
    .sort((a, b) => b.budget_revise - a.budget_revise);

  const byFournisseur = Array.from(bucketBy(l => l.fournisseur_prevu?.trim() || 'Sans fournisseur'))
    .map(([fournisseur, v]) => ({ fournisseur, ...v }))
    .sort((a, b) => b.budget_revise - a.budget_revise)
    .slice(0, 10); // top 10

  const bySousCategorie = Array.from(bucketBy(l => l.sous_categorie?.trim() || 'Sans sous-catégorie'))
    .map(([sous_categorie, v]) => ({ sous_categorie, ...v }))
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
