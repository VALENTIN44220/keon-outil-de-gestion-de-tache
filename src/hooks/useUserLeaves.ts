import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserLeave } from '@/types/workload';
import { toast } from 'sonner';

export function useUserLeaves(userId?: string) {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<UserLeave[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetUserId = userId || profile?.id;

  const fetchLeaves = useCallback(async () => {
    if (!targetUserId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_leaves')
        .select('*')
        .eq('user_id', targetUserId)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      setLeaves((data || []) as UserLeave[]);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast.error('Erreur lors du chargement des congés');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const addLeave = async (leave: Omit<UserLeave, 'id' | 'created_at' | 'updated_at' | 'status' | 'id_lucca'>) => {
    try {
      const { data, error } = await supabase
        .from('user_leaves')
        .insert({
          ...leave,
          status: 'declared',
        })
        .select()
        .single();
      
      if (error) throw error;
      toast.success('Congé déclaré avec succès');
      await fetchLeaves();
      return data;
    } catch (error) {
      console.error('Error adding leave:', error);
      toast.error('Erreur lors de la déclaration du congé');
      throw error;
    }
  };

  const updateLeave = async (id: string, updates: Partial<UserLeave>) => {
    try {
      const { error } = await supabase
        .from('user_leaves')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Congé mis à jour');
      await fetchLeaves();
    } catch (error) {
      console.error('Error updating leave:', error);
      toast.error('Erreur lors de la mise à jour du congé');
      throw error;
    }
  };

  const cancelLeave = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_leaves')
        .update({ status: 'cancelled' })
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Congé annulé');
      await fetchLeaves();
    } catch (error) {
      console.error('Error cancelling leave:', error);
      toast.error('Erreur lors de l\'annulation du congé');
      throw error;
    }
  };

  const deleteLeave = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_leaves')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Congé supprimé');
      await fetchLeaves();
    } catch (error) {
      console.error('Error deleting leave:', error);
      toast.error('Erreur lors de la suppression du congé');
      throw error;
    }
  };

  return {
    leaves,
    isLoading,
    addLeave,
    updateLeave,
    cancelLeave,
    deleteLeave,
    refetch: fetchLeaves,
  };
}
