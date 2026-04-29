import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  BEAffaireBudgetLine,
  BEAffaireBudgetKPI,
} from '@/types/beAffaire';

const sb = supabase as any;

export interface BEAffaireBudgetKPIs {
  budget_initial: number;
  budget_revise: number;
  /** Total HT engage (somme CCN+CFN rattachees au code_affaire). */
  engage: number;
  /** Total HT constate (somme FCN+FFN rattachees au code_affaire). */
  constate: number;
  /** CA engage (CCN). */
  ca_engage: number;
  /** CA constate (FCN). */
  ca_constate: number;
  /** COGS engage (CFN). */
  cogs_engage: number;
  /** COGS constate (FFN). */
  cogs_constate: number;
  /** Marge constatee = CA constate - COGS constate. */
  marge_constatee: number;
  reste_a_engager: number;
  reste_a_constater: number;
  taux_consommation: number;
  depassement: number;
  forecast_fin_annee: number;
  ecart_budget: number;
}

export interface AddBEBudgetLineInput {
  be_affaire_id: string;
  poste: string;
  fournisseur_prevu?: string | null;
  description?: string | null;
  montant_budget: number;
  montant_budget_revise?: number | null;
  type_depense?: string | null;
  exercice?: number | null;
  statut?: BEAffaireBudgetLine['statut'];
  commentaire?: string | null;
}

/**
 * Lignes budget d'une affaire BE + KPIs consolides.
 * - budget_initial / revise : somme des lignes saisies
 * - engage / constate       : viennent de la vue v_be_affaire_budget_kpi,
 *   eux-memes calcules sur TOUS les mouvements Divalto du code_affaire
 *   (montant brut : HT pour gescom, TTC pour compta -- pas de re-estimation
 *   ici, on s'aligne sur le pattern IT en attendant la passe HT consolide).
 */
export function useBEAffaireBudget(affaireId: string | undefined) {
  const qc = useQueryClient();

  const linesQuery = useQuery({
    queryKey: ['be-affaire-budget-lines', affaireId],
    queryFn: async (): Promise<BEAffaireBudgetLine[]> => {
      if (!affaireId) return [];
      const { data, error } = await sb
        .from('be_affaire_budget_lines')
        .select('*')
        .eq('be_affaire_id', affaireId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as BEAffaireBudgetLine[]) ?? [];
    },
    enabled: !!affaireId,
  });

  const kpiRawQuery = useQuery({
    queryKey: ['be-affaire-budget-kpi-raw', affaireId],
    queryFn: async (): Promise<BEAffaireBudgetKPI | null> => {
      if (!affaireId) return null;
      const { data, error } = await sb
        .from('v_be_affaire_budget_kpi')
        .select('*')
        .eq('be_affaire_id', affaireId)
        .maybeSingle();
      if (error) throw error;
      return (data as BEAffaireBudgetKPI | null) ?? null;
    },
    enabled: !!affaireId,
  });

  const addLine = useMutation({
    mutationFn: async (input: AddBEBudgetLineInput) => {
      const payload = {
        ...input,
        statut: input.statut ?? 'brouillon',
      };
      const { data, error } = await sb
        .from('be_affaire_budget_lines')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as BEAffaireBudgetLine;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['be-affaire-budget-lines', affaireId] }),
  });

  const updateLine = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<BEAffaireBudgetLine>;
    }) => {
      const { data, error } = await sb
        .from('be_affaire_budget_lines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BEAffaireBudgetLine;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['be-affaire-budget-lines', affaireId] }),
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('be_affaire_budget_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['be-affaire-budget-lines', affaireId] }),
  });

  const lines = linesQuery.data ?? [];
  const raw = kpiRawQuery.data;

  const budget_initial = lines.reduce((s, l) => s + (l.montant_budget ?? 0), 0);
  const budget_revise = lines.reduce(
    (s, l) => s + (l.montant_budget_revise ?? l.montant_budget ?? 0),
    0,
  );
  const engage = raw?.engage_montant_brut ?? 0;
  const constate = raw?.constate_montant_brut ?? 0;
  const ca_engage = raw?.ca_engage_brut ?? 0;
  const ca_constate = raw?.ca_constate_brut ?? 0;
  const cogs_engage = raw?.cogs_engage_brut ?? 0;
  const cogs_constate = raw?.cogs_constate_brut ?? 0;
  const marge_constatee = raw?.marge_constatee_brut ?? (ca_constate - cogs_constate);
  const forecast_fin_annee = constate + Math.max(engage - constate, 0);
  const ecart_budget = forecast_fin_annee - budget_revise;

  const kpis: BEAffaireBudgetKPIs = {
    budget_initial,
    budget_revise,
    engage,
    constate,
    ca_engage,
    ca_constate,
    cogs_engage,
    cogs_constate,
    marge_constatee,
    reste_a_engager: budget_revise - engage,
    reste_a_constater: engage - constate,
    taux_consommation: budget_revise > 0 ? Math.round((constate / budget_revise) * 100) : 0,
    depassement: Math.max(constate - budget_revise, 0),
    forecast_fin_annee,
    ecart_budget,
  };

  return {
    lines,
    linesLoading: linesQuery.isLoading,
    addLine,
    updateLine,
    deleteLine,
    kpis,
    nb_commandes: raw?.nb_commandes ?? 0,
    nb_factures: raw?.nb_factures ?? 0,
  };
}
