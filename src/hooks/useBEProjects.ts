import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BEProject } from '@/types/beProject';
import { toast } from '@/hooks/use-toast';

export function useBEProjects() {
  const [projects, setProjects] = useState<BEProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('be_projects')
        .select('*')
        .order('code_projet', { ascending: true });

      if (searchQuery) {
        query = query.or(`nom_projet.ilike.%${searchQuery}%,code_projet.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProjects((data as BEProject[]) || []);
    } catch (error) {
      console.error('Error fetching BE projects:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les projets BE',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addProject = async (project: Omit<BEProject, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('be_projects')
        .insert(project)
        .select()
        .single();

      if (error) throw error;

      setProjects(prev => [...prev, data as BEProject]);
      toast({
        title: 'Projet créé',
        description: `Le projet ${data.nom_projet} a été créé avec le code ${data.code_projet}`,
      });
      return data as BEProject;
    } catch (error: any) {
      console.error('Error creating BE project:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le projet',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateProject = async (id: string, updates: Partial<BEProject>) => {
    try {
      const { data, error } = await supabase
        .from('be_projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setProjects(prev => prev.map(p => p.id === id ? (data as BEProject) : p));
      toast({
        title: 'Projet mis à jour',
        description: 'Les modifications ont été enregistrées',
      });
      return data as BEProject;
    } catch (error: any) {
      console.error('Error updating BE project:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour le projet',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('be_projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Projet supprimé',
        description: 'Le projet a été supprimé',
      });
      return true;
    } catch (error: any) {
      console.error('Error deleting BE project:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer le projet',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    projects,
    isLoading,
    searchQuery,
    setSearchQuery,
    fetchProjects,
    addProject,
    updateProject,
    deleteProject,
  };
}
