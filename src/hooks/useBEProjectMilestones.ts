/**
 * useBEProjectMilestones — Jalons d'un projet BE.
 *
 * Source : table `be_project_milestones` (alimentée automatiquement par
 * les triggers SQL trg_be_task_milestone_on_start et _on_complete quand
 * une tâche flaggée jalon est prise en charge / complétée).
 *
 * Mutations possibles côté UI :
 *   - updateDates : édition manuelle de date_prevue et/ou date_reelle
 *     (utile pour rattrapage : tâche validée en retard sur l'app, etc.)
 *   - updateStatut : passage manuel de statut
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BEProjectMilestone {
  id: string;
  be_project_id: string;
  titre: string;
  description: string | null;
  date_prevue: string | null;
  date_reelle: string | null;
  statut: 'a_venir' | 'en_cours' | 'termine' | 'retarde';
  ordre: number | null;
  source_task_id: string | null;
  is_auto_delayed: boolean;
  created_at: string;
  updated_at: string;
}

export function useBEProjectMilestones(beProjectId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['be-project-milestones', beProjectId],
    queryFn: async (): Promise<BEProjectMilestone[]> => {
      if (!beProjectId) return [];
      const { data, error } = await (supabase as any)
        .from('be_project_milestones')
        .select('*')
        .eq('be_project_id', beProjectId)
        .order('date_prevue', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as BEProjectMilestone[];
    },
    enabled: !!beProjectId,
    staleTime: 30_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['be-project-milestones', beProjectId] });

  const updateDates = async (id: string, patch: { date_prevue?: string | null; date_reelle?: string | null }) => {
    const payload: any = {};
    if (patch.date_prevue !== undefined) payload.date_prevue = patch.date_prevue || null;
    if (patch.date_reelle !== undefined) {
      payload.date_reelle = patch.date_reelle || null;
      // Auto-set statut à 'termine' si on saisit une date réelle
      if (patch.date_reelle) payload.statut = 'termine';
    }
    const { error } = await (supabase as any)
      .from('be_project_milestones')
      .update(payload)
      .eq('id', id);
    if (error) { toast.error(`Erreur : ${error.message}`); return false; }
    toast.success('Jalon mis à jour');
    invalidate();
    return true;
  };

  /** Ajout manuel d'un jalon (affaires anciennes, ou jalon hors workflow). */
  const addMilestone = async (payload: { titre: string; date_prevue?: string | null; date_reelle?: string | null; ordre?: number | null }) => {
    if (!beProjectId) return false;
    const statut = payload.date_reelle ? 'termine' : 'a_venir';
    const { error } = await (supabase as any).from('be_project_milestones').insert({
      be_project_id: beProjectId,
      titre: payload.titre,
      date_prevue: payload.date_prevue || null,
      date_reelle: payload.date_reelle || null,
      statut,
      ordre: payload.ordre ?? null,
      source_task_id: null,
    });
    if (error) { toast.error(`Erreur : ${error.message}`); return false; }
    toast.success('Jalon ajouté');
    invalidate();
    return true;
  };

  const deleteMilestone = async (id: string) => {
    const { error } = await (supabase as any).from('be_project_milestones').delete().eq('id', id);
    if (error) { toast.error(`Erreur : ${error.message}`); return false; }
    toast.success('Jalon supprimé');
    invalidate();
    return true;
  };

  const updateStatut = async (id: string, statut: BEProjectMilestone['statut']) => {
    const { error } = await (supabase as any)
      .from('be_project_milestones')
      .update({ statut })
      .eq('id', id);
    if (error) { toast.error(`Erreur : ${error.message}`); return false; }
    invalidate();
    return true;
  };

  return {
    milestones: query.data ?? [],
    isLoading: query.isLoading,
    refetch: invalidate,
    updateDates,
    updateStatut,
    addMilestone,
    deleteMilestone,
  };
}
