import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  ITSolution,
  ITSolutionLienType,
  ITSolutionProjectLink,
} from '@/types/itSolution';

const SOLUTIONS_KEY = ['it-solutions'];
const LINKS_KEY = ['it-solution-projects'];

/**
 * Catalogue des solutions IT (cartographie) + jonction avec les projets IT.
 */
export function useITSolutions() {
  const qc = useQueryClient();

  const solutionsQuery = useQuery({
    queryKey: SOLUTIONS_KEY,
    queryFn: async (): Promise<ITSolution[]> => {
      const { data, error } = await supabase
        .from('it_solutions')
        .select(
          'id, nom, categorie, type, usage_principal, domaine_metier, visible_dans_schema, connecte_datalake, flux_principaux, statut_temporalite, owner_metier_id, owner_it_id, perimetre, criticite, commentaires, created_at, updated_at, created_by, owner_metier:profiles!it_solutions_owner_metier_id_fkey(id,display_name,avatar_url), owner_it:profiles!it_solutions_owner_it_id_fkey(id,display_name,avatar_url)'
        )
        .order('nom', { ascending: true });
      if (error) throw error;
      return (data as ITSolution[]) ?? [];
    },
  });

  const linksQuery = useQuery({
    queryKey: LINKS_KEY,
    queryFn: async (): Promise<ITSolutionProjectLink[]> => {
      const { data, error } = await supabase
        .from('it_solution_projects')
        .select('solution_id, project_id, type_lien, commentaire, created_at, created_by');
      if (error) throw error;
      return (data as ITSolutionProjectLink[]) ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: SOLUTIONS_KEY });
    qc.invalidateQueries({ queryKey: LINKS_KEY });
  };

  type CreatePayload = Omit<ITSolution, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'owner_metier' | 'owner_it'>;

  const createSolution = useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('it_solutions')
        .insert({ ...payload, created_by: auth.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as ITSolution;
    },
    onSuccess: invalidate,
  });

  const updateSolution = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreatePayload> }) => {
      const { error } = await supabase.from('it_solutions').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSolution = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_solutions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const linkProject = useMutation({
    mutationFn: async (payload: { solution_id: string; project_id: string; type_lien?: ITSolutionLienType | null; commentaire?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('it_solution_projects').upsert(
        {
          solution_id: payload.solution_id,
          project_id: payload.project_id,
          type_lien: payload.type_lien ?? null,
          commentaire: payload.commentaire ?? null,
          created_by: auth.user?.id ?? null,
        },
        { onConflict: 'solution_id,project_id' }
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const unlinkProject = useMutation({
    mutationFn: async (payload: { solution_id: string; project_id: string }) => {
      const { error } = await supabase
        .from('it_solution_projects')
        .delete()
        .eq('solution_id', payload.solution_id)
        .eq('project_id', payload.project_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    solutions: solutionsQuery.data ?? [],
    links: linksQuery.data ?? [],
    isLoading: solutionsQuery.isLoading || linksQuery.isLoading,
    createSolution,
    updateSolution,
    deleteSolution,
    linkProject,
    unlinkProject,
  };
}
