import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CollaboratorGroup {
  id: string;
  name: string;
  description: string | null;
  company_id: string | null;
  department_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollaboratorGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  user?: {
    id: string;
    display_name: string | null;
  };
}

export interface CollaboratorGroupWithMembers extends CollaboratorGroup {
  members: CollaboratorGroupMember[];
}

export function useCollaboratorGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<CollaboratorGroupWithMembers[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('collaborator_groups')
        .select('*')
        .order('name');

      if (groupsError) throw groupsError;

      // Fetch members for each group
      const groupsWithMembers = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { data: membersData } = await supabase
            .from('collaborator_group_members')
            .select(`
              id,
              group_id,
              user_id,
              created_at,
              profiles:user_id (id, display_name)
            `)
            .eq('group_id', group.id);

          return {
            ...group,
            members: (membersData || []).map(m => ({
              ...m,
              user: (m as any).profiles,
            })),
          };
        })
      );

      setGroups(groupsWithMembers);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Erreur lors du chargement des groupes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const addGroup = async (
    name: string, 
    description?: string, 
    companyId?: string, 
    departmentId?: string
  ): Promise<CollaboratorGroup | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('collaborator_groups')
        .insert({
          name,
          description: description || null,
          company_id: companyId || null,
          department_id: departmentId || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setGroups(prev => [...prev, { ...data, members: [] }]);
      toast.success('Groupe créé avec succès');
      return data;
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Erreur lors de la création du groupe');
      return null;
    }
  };

  const updateGroup = async (
    id: string, 
    updates: Partial<Pick<CollaboratorGroup, 'name' | 'description' | 'company_id' | 'department_id'>>
  ) => {
    try {
      const { error } = await supabase
        .from('collaborator_groups')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
      toast.success('Groupe mis à jour');
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      const { error } = await supabase
        .from('collaborator_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setGroups(prev => prev.filter(g => g.id !== id));
      toast.success('Groupe supprimé');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const addMember = async (groupId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('collaborator_group_members')
        .insert({ group_id: groupId, user_id: userId })
        .select(`
          id,
          group_id,
          user_id,
          created_at,
          profiles:user_id (id, display_name)
        `)
        .single();

      if (error) throw error;

      const newMember = {
        ...data,
        user: (data as any).profiles,
      };

      setGroups(prev => 
        prev.map(g => 
          g.id === groupId 
            ? { ...g, members: [...g.members, newMember] } 
            : g
        )
      );
      toast.success('Membre ajouté');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Ce membre fait déjà partie du groupe');
      } else {
        console.error('Error adding member:', error);
        toast.error('Erreur lors de l\'ajout du membre');
      }
    }
  };

  const removeMember = async (groupId: string, memberId: string) => {
    try {
      const { error } = await supabase
        .from('collaborator_group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setGroups(prev => 
        prev.map(g => 
          g.id === groupId 
            ? { ...g, members: g.members.filter(m => m.id !== memberId) } 
            : g
        )
      );
      toast.success('Membre retiré');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erreur lors du retrait du membre');
    }
  };

  return {
    groups,
    isLoading,
    refetch: fetchGroups,
    addGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
  };
}
