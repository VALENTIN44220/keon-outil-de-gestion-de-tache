import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMicrosoftConnection } from '@/hooks/useMicrosoftConnection';
import { toast } from 'sonner';

export interface PlannerPlan {
  id: string;
  title: string;
  groupId: string;
  groupName: string;
  createdDateTime?: string;
}

export interface PlanMapping {
  id: string;
  user_id: string;
  planner_plan_id: string;
  planner_plan_title: string;
  planner_group_id: string | null;
  planner_group_name: string | null;
  mapped_category_id: string | null;
  mapped_process_template_id: string | null;
  sync_enabled: boolean;
  sync_direction: 'to_planner' | 'from_planner' | 'both';
  import_states: string[];
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  direction: string;
  tasks_pushed: number;
  tasks_pulled: number;
  tasks_updated: number;
  errors: any[];
  status: string;
  created_at: string;
}

export interface SyncResult {
  tasksPulled: number;
  tasksPushed: number;
  tasksUpdated: number;
  errors: number;
}

export function usePlannerSync() {
  const { user } = useAuth();
  const { connection } = useMicrosoftConnection();
  const [plans, setPlans] = useState<PlannerPlan[]>([]);
  const [mappings, setMappings] = useState<PlanMapping[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null); // mapping id being synced

  const fetchPlans = useCallback(async () => {
    if (!connection.connected) return;
    setIsLoadingPlans(true);
    try {
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'planner-get-plans' },
      });
      if (error) throw error;
      if (data.plans) setPlans(data.plans);
    } catch (error: any) {
      console.error('Error fetching Planner plans:', error);
      toast.error(`Erreur chargement plans: ${error.message}`);
    } finally {
      setIsLoadingPlans(false);
    }
  }, [connection.connected]);

  const fetchMappings = useCallback(async () => {
    if (!user) return;
    setIsLoadingMappings(true);
    try {
      const { data, error } = await supabase
        .from('planner_plan_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMappings((data || []) as PlanMapping[]);
    } catch (error: any) {
      console.error('Error fetching mappings:', error);
    } finally {
      setIsLoadingMappings(false);
    }
  }, [user]);

  const fetchSyncLogs = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('planner_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setSyncLogs((data || []) as SyncLog[]);
    } catch (error: any) {
      console.error('Error fetching sync logs:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchMappings();
    fetchSyncLogs();
  }, [fetchMappings, fetchSyncLogs]);

  const addMapping = async (plan: PlannerPlan, categoryId?: string, processTemplateId?: string, direction: 'to_planner' | 'from_planner' | 'both' = 'both') => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('planner_plan_mappings')
        .upsert({
          user_id: user.id,
          planner_plan_id: plan.id,
          planner_plan_title: plan.title,
          planner_group_id: plan.groupId,
          planner_group_name: plan.groupName,
          mapped_category_id: categoryId || null,
          mapped_process_template_id: processTemplateId || null,
          sync_direction: direction,
          sync_enabled: true,
        }, { onConflict: 'user_id,planner_plan_id' });

      if (error) throw error;
      toast.success(`Plan "${plan.title}" configuré`);
      await fetchMappings();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const updateMapping = async (id: string, updates: Partial<Pick<PlanMapping, 'sync_enabled' | 'sync_direction' | 'mapped_category_id' | 'mapped_process_template_id'>>) => {
    try {
      const { error } = await supabase
        .from('planner_plan_mappings')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      await fetchMappings();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const removeMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from('planner_plan_mappings')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Mapping supprimé');
      await fetchMappings();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const syncPlan = async (mappingId: string): Promise<SyncResult | null> => {
    setIsSyncing(mappingId);
    try {
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'planner-sync', planMappingId: mappingId },
      });
      if (error) throw error;
      
      const result: SyncResult = {
        tasksPulled: data.tasksPulled || 0,
        tasksPushed: data.tasksPushed || 0,
        tasksUpdated: data.tasksUpdated || 0,
        errors: data.errors || 0,
      };

      const total = result.tasksPulled + result.tasksPushed + result.tasksUpdated;
      if (result.errors > 0) {
        toast.warning(`Sync partielle: ${total} tâches traitées, ${result.errors} erreurs`);
      } else {
        toast.success(`Sync terminée: ${result.tasksPulled} importées, ${result.tasksPushed} poussées, ${result.tasksUpdated} mises à jour`);
      }

      await fetchMappings();
      await fetchSyncLogs();
      return result;
    } catch (error: any) {
      toast.error(`Erreur sync: ${error.message}`);
      return null;
    } finally {
      setIsSyncing(null);
    }
  };

  const syncAll = async () => {
    const enabledMappings = mappings.filter(m => m.sync_enabled);
    for (const mapping of enabledMappings) {
      await syncPlan(mapping.id);
    }
  };

  return {
    plans,
    mappings,
    syncLogs,
    isLoadingPlans,
    isLoadingMappings,
    isSyncing,
    isConnected: connection.connected,
    fetchPlans,
    addMapping,
    updateMapping,
    removeMapping,
    syncPlan,
    syncAll,
    refreshLogs: fetchSyncLogs,
  };
}
