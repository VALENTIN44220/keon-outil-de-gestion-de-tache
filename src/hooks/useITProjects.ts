import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ITProject } from '@/types/itProject';
import { toast } from '@/hooks/use-toast';

export function useITProjects() {
  const [projects, setProjects] = useState<ITProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('it_projects')
        .select(`*, responsable_it:profiles!it_projects_responsable_it_id_fkey(id,display_name,avatar_url), chef_projet:profiles!it_projects_chef_projet_id_fkey(id,display_name,avatar_url), sponsor:profiles!it_projects_sponsor_id_fkey(id,display_name,avatar_url), company:companies!it_projects_company_id_fkey(id,name), chef_projet_metier:profiles!it_projects_chef_projet_metier_id_fkey(id,display_name,avatar_url), chef_projet_it:profiles!it_projects_chef_projet_it_id_fkey(id,display_name,avatar_url), groupe_service:departments!it_projects_groupe_service_id_fkey(id,name), directeur:profiles!it_projects_directeur_id_fkey(id,display_name,avatar_url)`)
        .order('code_projet_digital', { ascending: true });
      if (searchQuery) {
        query = query.or(`nom_projet.ilike.%${searchQuery}%,code_projet_digital.ilike.%${searchQuery}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setProjects((data as ITProject[]) || []);
    } catch (error) {
      console.error('Error fetching IT projects:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les projets IT', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const addProject = async (project: Omit<ITProject, 'id' | 'created_at' | 'updated_at' | 'responsable_it' | 'chef_projet' | 'sponsor'>) => {
    try {
      const payload = { ...project, date_debut: project.date_debut || new Date().toISOString().split('T')[0] };
      const { data, error } = await supabase.from('it_projects').insert(payload).select().single();
      if (error) throw error;

      // Auto-create standard milestones
      const milestones = [
        { titre: 'Cadrage validé',        phase: 'cadrage',       ordre: 1 },
        { titre: 'Conception approuvée',  phase: 'analyse',       ordre: 2 },
        { titre: 'Développement terminé', phase: 'developpement', ordre: 3 },
        { titre: 'Recette validée',       phase: 'recette',       ordre: 4 },
        { titre: 'Mise en production',    phase: 'deploiement',   ordre: 5 },
      ].map(m => ({ ...m, it_project_id: data.id, statut: 'a_venir', date_prevue: null }));

      await supabase.from('it_project_milestones').insert(milestones);

      setProjects(prev => [...prev, data as ITProject]);
      toast({ title: 'Projet créé', description: `${data.nom_projet} — ${data.code_projet_digital}` });
      return data as ITProject;
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Impossible de créer le projet', variant: 'destructive' });
      return null;
    }
  };

  const updateProject = async (id: string, updates: Partial<ITProject>) => {
    try {
      const { data, error } = await supabase.from('it_projects').update(updates).eq('id', id).select().single();
      if (error) throw error;
      setProjects(prev => prev.map(p => p.id === id ? (data as ITProject) : p));
      toast({ title: 'Projet mis à jour' });
      return data as ITProject;
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from('it_projects').delete().eq('id', id);
      if (error) throw error;
      setProjects(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Projet supprimé' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  return { projects, isLoading, searchQuery, setSearchQuery, fetchProjects, addProject, updateProject, deleteProject };
}
