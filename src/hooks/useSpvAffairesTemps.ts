import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface SpvAffaireTempsKpi {
  code_affaire: string;
  heures_declarees: number;
  jours_declares: number;
  cout_rh_declare: number;
  nb_collaborateurs: number;
  premiere_saisie: string | null;
  derniere_saisie: string | null;
}

export interface SpvAffaireTempsUser {
  code_affaire: string;
  user_id: string | null;
  display_name: string | null;
  job_title: string | null;
  taux_horaire: number;
  heures: number;
  jours: number;
  cout_rh: number;
}

/**
 * Suivi des temps SPV — affaires dont le code commence par 'M'.
 * Source : vues v_spv_affaire_temps_kpi / v_spv_affaire_temps_par_user
 * (alimentées par lucca_saisie_temps, tous salariés confondus).
 */
export function useSpvAffairesTemps() {
  return useQuery({
    queryKey: ['spv-affaires-temps-kpi'],
    queryFn: async (): Promise<SpvAffaireTempsKpi[]> => {
      const { data, error } = await sb
        .from('v_spv_affaire_temps_kpi')
        .select('*')
        .order('heures_declarees', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpvAffaireTempsKpi[];
    },
  });
}

/** Détail par collaborateur pour une affaire M donnée. */
export function useSpvAffaireTempsByUser(codeAffaire: string | null) {
  return useQuery({
    queryKey: ['spv-affaire-temps-user', codeAffaire],
    enabled: !!codeAffaire,
    queryFn: async (): Promise<SpvAffaireTempsUser[]> => {
      const { data, error } = await sb
        .from('v_spv_affaire_temps_par_user')
        .select('*')
        .eq('code_affaire', codeAffaire)
        .order('heures', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpvAffaireTempsUser[];
    },
  });
}

// ── Budget SPV : KPI CA/COGS/marges + lignes de budget ──────────────────────

export interface SpvAffaireBudgetKpi {
  spv_affaire_id: string;
  code_affaire: string;
  affaire_libelle: string | null;
  affaire_status: string;
  ca_engage_brut: number;
  ca_constate_brut: number;
  cogs_engage_brut: number;
  cogs_constate_brut: number;
  marge_brute: number;
  marge_directe: number;
  nb_commandes: number;
  nb_factures: number;
  jours_declares: number;
  cout_rh_declare: number;
  budget_total: number;
}

export interface SpvBudgetLine {
  id: string;
  spv_affaire_id: string;
  poste: string;
  fournisseur_prevu: string | null;
  description: string | null;
  montant_budget: number;
  montant_budget_revise: number | null;
  type_depense: string | null;
  exercice: number | null;
  statut: string;
  commentaire: string | null;
}

/** KPI budget (CA/COGS/marges + temps + budget) de toutes les affaires SPV. */
export function useSpvAffairesBudgetKpi() {
  return useQuery({
    queryKey: ['spv-affaires-budget-kpi'],
    queryFn: async (): Promise<SpvAffaireBudgetKpi[]> => {
      const { data, error } = await sb
        .from('v_spv_affaire_budget_kpi')
        .select('*')
        .order('code_affaire');
      if (error) throw error;
      return (data ?? []) as SpvAffaireBudgetKpi[];
    },
  });
}

/** Lignes de budget d'une affaire SPV + mutations CRUD. */
export function useSpvBudgetLines(spvAffaireId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['spv-budget-lines', spvAffaireId] });
    qc.invalidateQueries({ queryKey: ['spv-affaires-budget-kpi'] });
  };

  const query = useQuery({
    queryKey: ['spv-budget-lines', spvAffaireId],
    enabled: !!spvAffaireId,
    queryFn: async (): Promise<SpvBudgetLine[]> => {
      const { data, error } = await sb
        .from('spv_affaire_budget_lines')
        .select('*')
        .eq('spv_affaire_id', spvAffaireId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpvBudgetLine[];
    },
  });

  const upsertLine = useMutation({
    mutationFn: async (line: Partial<SpvBudgetLine> & { spv_affaire_id: string }) => {
      if (line.id) {
        const { error } = await sb.from('spv_affaire_budget_lines').update(line).eq('id', line.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('spv_affaire_budget_lines').insert(line);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('spv_affaire_budget_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, upsertLine, deleteLine };
}
