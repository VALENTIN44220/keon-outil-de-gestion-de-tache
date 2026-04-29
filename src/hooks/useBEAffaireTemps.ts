import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  BEAffaireTempsBudget,
  BEAffaireTempsKPI,
  BEPoste,
  BETjmReferentiel,
} from '@/types/beTemps';

const sb = supabase as any;

export interface UpsertBudgetTempsLine {
  poste: BEPoste;
  jours_budgetes: number;
  commentaire?: string | null;
}

/**
 * Suivi du temps budgete par affaire BE (par poste) + KPIs croises
 * (budgete / planifie via plan de charge / declare via Lucca).
 */
export function useBEAffaireTemps(affaireId: string | undefined) {
  const qc = useQueryClient();

  const budgetLinesQuery = useQuery({
    queryKey: ['be-affaire-temps-budget', affaireId],
    queryFn: async (): Promise<BEAffaireTempsBudget[]> => {
      if (!affaireId) return [];
      const { data, error } = await sb
        .from('be_affaire_temps_budget')
        .select('*')
        .eq('be_affaire_id', affaireId)
        .order('poste', { ascending: true });
      if (error) throw error;
      return (data as BEAffaireTempsBudget[]) ?? [];
    },
    enabled: !!affaireId,
  });

  const kpiQuery = useQuery({
    queryKey: ['be-affaire-temps-kpi', affaireId],
    queryFn: async (): Promise<BEAffaireTempsKPI | null> => {
      if (!affaireId) return null;
      const { data, error } = await sb
        .from('v_be_affaire_temps_kpi')
        .select('*')
        .eq('be_affaire_id', affaireId)
        .maybeSingle();
      if (error) throw error;
      return (data as BEAffaireTempsKPI | null) ?? null;
    },
    enabled: !!affaireId,
  });

  /**
   * Upsert en batch des lignes de budget temps (1 ligne par poste).
   * Pour les lignes avec jours = 0, on supprime l'entree (proprete).
   */
  const upsertBudgetLines = useMutation({
    mutationFn: async (lines: UpsertBudgetTempsLine[]) => {
      if (!affaireId) throw new Error('affaireId manquant');

      const toUpsert = lines.filter((l) => l.jours_budgetes > 0);
      const toDelete = lines.filter((l) => l.jours_budgetes <= 0);

      if (toUpsert.length > 0) {
        const { error } = await sb.from('be_affaire_temps_budget').upsert(
          toUpsert.map((l) => ({
            be_affaire_id: affaireId,
            poste: l.poste,
            jours_budgetes: l.jours_budgetes,
            commentaire: l.commentaire ?? null,
          })),
          { onConflict: 'be_affaire_id,poste' },
        );
        if (error) throw error;
      }

      if (toDelete.length > 0) {
        const { error } = await sb
          .from('be_affaire_temps_budget')
          .delete()
          .eq('be_affaire_id', affaireId)
          .in('poste', toDelete.map((l) => l.poste));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-affaire-temps-budget', affaireId] });
      qc.invalidateQueries({ queryKey: ['be-affaire-temps-kpi', affaireId] });
    },
  });

  return {
    budgetLines: budgetLinesQuery.data ?? [],
    isLoading: budgetLinesQuery.isLoading,
    kpi: kpiQuery.data,
    kpiLoading: kpiQuery.isLoading,
    upsertBudgetLines,
  };
}

/**
 * Lecture du referentiel TJM (lecture seule pour l'affaire detail).
 * L'admin BE le maintient depuis une autre page.
 */
export function useBETjmReferentiel() {
  return useQuery({
    queryKey: ['be-tjm-referentiel'],
    queryFn: async (): Promise<Record<BEPoste, number>> => {
      const { data, error } = await sb
        .from('be_tjm_referentiel')
        .select('*');
      if (error) throw error;
      const map: Partial<Record<BEPoste, number>> = {};
      for (const row of (data as BETjmReferentiel[]) ?? []) {
        map[row.poste] = row.tjm;
      }
      return map as Record<BEPoste, number>;
    },
  });
}
