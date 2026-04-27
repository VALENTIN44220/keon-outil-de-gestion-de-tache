import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  ITSolution,
  ITSolutionLienType,
  ITSolutionLink,
  ITSolutionProjectLink,
} from '@/types/itSolution';

const SOLUTIONS_KEY = ['it-solutions'];
const LINKS_KEY = ['it-solution-projects'];
const SOLUTION_LINKS_KEY = ['it-solution-links'];

/**
 * Catalogue des solutions IT (cartographie) + jonction avec les projets IT.
 */
export function useITSolutions() {
  const qc = useQueryClient();

  const solutionsQuery = useQuery({
    queryKey: SOLUTIONS_KEY,
    queryFn: async (): Promise<ITSolution[]> => {
      // SELECT * pour rester resilient si une migration de colonnes n'a pas
      // encore ete appliquee (logo_url / position_x / etc.). Les jointures
      // owner_metier / owner_it sont conservees explicitement.
      const { data, error } = await supabase
        .from('it_solutions')
        .select('*, owner_metier:profiles!it_solutions_owner_metier_id_fkey(id,display_name,avatar_url), owner_it:profiles!it_solutions_owner_it_id_fkey(id,display_name,avatar_url)')
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

  /**
   * Met à jour position et taille d'un nœud dans le graphe (drag / resize).
   * Persistance silencieuse — pas de toast, on n'invalide que la query
   * solutions pour rafraîchir le cache.
   */
  const updateSolutionLayout = useMutation({
    mutationFn: async (payload: {
      id: string;
      position_x?: number | null;
      position_y?: number | null;
      width?: number | null;
      height?: number | null;
    }) => {
      const { id, ...patch } = payload;
      const { error } = await supabase.from('it_solutions').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SOLUTIONS_KEY }),
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

  // ── Liens entre solutions (cartographie graphe) ───────────────────────
  const solutionLinksQuery = useQuery({
    queryKey: SOLUTION_LINKS_KEY,
    queryFn: async (): Promise<ITSolutionLink[]> => {
      const { data, error } = await supabase
        .from('it_solution_links')
        .select('*');
      if (error) throw error;
      return (data as ITSolutionLink[]) ?? [];
    },
  });

  const invalidateLinks = () => qc.invalidateQueries({ queryKey: SOLUTION_LINKS_KEY });

  type SolutionLinkPayload = Omit<ITSolutionLink, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

  const createSolutionLink = useMutation({
    mutationFn: async (payload: SolutionLinkPayload) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('it_solution_links')
        .insert({ ...payload, created_by: auth.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as ITSolutionLink;
    },
    onSuccess: invalidateLinks,
  });

  const updateSolutionLink = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SolutionLinkPayload> }) => {
      const { error } = await supabase.from('it_solution_links').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateLinks,
  });

  const deleteSolutionLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_solution_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateLinks,
  });

  return {
    solutions: solutionsQuery.data ?? [],
    links: linksQuery.data ?? [],
    solutionLinks: solutionLinksQuery.data ?? [],
    isLoading: solutionsQuery.isLoading || linksQuery.isLoading,
    isLoadingSolutionLinks: solutionLinksQuery.isLoading,
    createSolution,
    updateSolution,
    deleteSolution,
    updateSolutionLayout,
    linkProject,
    unlinkProject,
    createSolutionLink,
    updateSolutionLink,
    deleteSolutionLink,
  };
}
