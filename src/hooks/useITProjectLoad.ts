import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITProjectLoad } from '@/types/fdr';

// it_project_load_months n'est pas dans les types générés → cast du client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export function useITProjectLoad(projectId: string | undefined) {
  return useQuery<ITProjectLoad[]>({
    queryKey: ['it-project-load', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_project_load')
        .select('*, profil:fdr_profils(*)')
        .eq('it_project_id', projectId!)
        .order('profil(ordre)');
      if (error) throw error;
      const loads = (data ?? []) as ITProjectLoad[];

      // Détail mensuel optionnel → attaché par profil_id
      const { data: monthRows } = await db()
        .from('it_project_load_months')
        .select('profil_id, ym, j_mois')
        .eq('it_project_id', projectId!);
      const byProfil: Record<string, Record<string, number>> = {};
      for (const m of (monthRows ?? []) as Array<{ profil_id: string; ym: string; j_mois: number }>) {
        (byProfil[m.profil_id] ??= {})[m.ym] = Number(m.j_mois) || 0;
      }
      for (const l of loads) {
        if (byProfil[l.profil_id]) l.months = byProfil[l.profil_id];
      }
      return loads;
    },
    staleTime: 30_000,
  });
}

/** Upsert complet de la ventilation build (uniforme + détail mensuel). */
export function useUpsertITProjectLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      loads,
    }: {
      projectId: string;
      loads: Array<{ profil_id: string; j_mois: number; months?: Record<string, number> | null }>;
    }) => {
      // 1. Ligne uniforme (it_project_load) : remplace tout
      const { error: delErr } = await supabase
        .from('it_project_load')
        .delete()
        .eq('it_project_id', projectId);
      if (delErr) throw delErr;

      // On garde une ligne si j_mois > 0 OU si un détail mensuel existe (pour conserver le profil détaillé)
      const rows = loads
        .filter(l => l.j_mois > 0 || (l.months && Object.values(l.months).some(v => (Number(v) || 0) > 0)))
        .map(l => ({ it_project_id: projectId, profil_id: l.profil_id, j_mois: l.j_mois }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('it_project_load').insert(rows);
        if (insErr) throw insErr;
      }

      // 2. Détail mensuel (it_project_load_months) : remplace tout
      const { error: delMErr } = await db()
        .from('it_project_load_months')
        .delete()
        .eq('it_project_id', projectId);
      if (delMErr) throw delMErr;

      const monthRows: Array<{ it_project_id: string; profil_id: string; ym: string; j_mois: number }> = [];
      for (const l of loads) {
        if (!l.months) continue;
        for (const [ym, v] of Object.entries(l.months)) {
          const val = Number(v) || 0;
          if (val > 0) monthRows.push({ it_project_id: projectId, profil_id: l.profil_id, ym, j_mois: val });
        }
      }
      if (monthRows.length > 0) {
        const { error: insMErr } = await db().from('it_project_load_months').insert(monthRows);
        if (insMErr) throw insMErr;
      }
    },
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['it-project-load', projectId] });
      qc.invalidateQueries({ queryKey: ['fdr-capacity-matrix'] });
      qc.invalidateQueries({ queryKey: ['fdr-project-inputs'] });
      qc.invalidateQueries({ queryKey: ['fdr-projects'] });
    },
  });
}
