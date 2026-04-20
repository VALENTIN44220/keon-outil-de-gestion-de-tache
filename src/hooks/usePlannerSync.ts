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
  default_requester_id: string | null;
  default_reporter_id: string | null;
  default_priority: string | null;
  default_status: string | null;
  resolve_assignees: boolean;
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
  diagnostics?: Record<string, unknown> | null;
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
      if (data && data.success === false && data.error) {
        throw new Error(data.error);
      }
      setPlans(Array.isArray(data?.plans) ? data.plans : []);
    } catch (error: any) {
      console.error('Error fetching Planner plans:', error);
      toast.error(`Erreur chargement plans: ${error.message}`);
      setPlans([]);
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

  const syncPlan = async (
    mappingId: string,
    options?: { selectedPlannerTaskIds?: string[]; skipPush?: boolean },
  ): Promise<SyncResult | null> => {
    setIsSyncing(mappingId);
    try {
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: {
          action: 'planner-sync',
          planMappingId: mappingId,
          ...(options?.selectedPlannerTaskIds !== undefined && {
            selectedPlannerTaskIds: options.selectedPlannerTaskIds,
          }),
          ...(options?.skipPush !== undefined && { skipPush: options.skipPush }),
        },
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') {
        throw new Error('Réponse vide du service de synchronisation Planner.');
      }
      // La Edge Function renvoie souvent { success: false, error } en HTTP 200 — invoke ne met pas `error`.
      if (data.success === false) {
        throw new Error((data as { error?: string }).error || 'Synchronisation Planner refusée par le serveur.');
      }

      const result: SyncResult = {
        tasksPulled: data.tasksPulled || 0,
        tasksPushed: data.tasksPushed || 0,
        tasksUpdated: data.tasksUpdated || 0,
        errors: data.errors || 0,
      };

      const total = result.tasksPulled + result.tasksPushed + result.tasksUpdated;
      const diag = data?.diagnostics as
        | {
            plannerTasksFetched?: number;
            pullSkippedAlreadyLinked?: number;
            pullSkippedByState?: number;
            pullSkippedByDefaultRequesterAssignee?: number;
            syncDirection?: string;
            defaultRequesterFilterActive?: boolean;
            graphUsersResolved?: number;
            sampleErrors?: unknown[];
            sampleFirstTask?: {
              derivedState?: string;
              stateFilterIncludes?: boolean;
              alreadyLinkedForUser?: boolean;
            };
          }
        | undefined;

      if (result.errors > 0) {
        const detail = data.error ? ` — ${data.error}` : '';
        const samples = diag?.sampleErrors;
        const samplesStr =
          Array.isArray(samples) && samples.length > 0
            ? ` Ex.: ${samples
                .slice(0, 2)
                .map((x: any) => x?.error || x?.message || JSON.stringify(x))
                .join(' | ')}`
            : '';
        toast.warning(`Sync partielle: ${total} tâches traitées, ${result.errors} erreur(s)${detail}${samplesStr}`, { duration: 14000 });
      } else if (total === 0 && diag) {
        if ((diag.plannerTasksFetched ?? 0) > 0) {
          const sft = diag.sampleFirstTask;
          const firstHint =
            sft && typeof sft.derivedState === 'string'
              ? ` Ex. 1re tâche Planner: état=${sft.derivedState}, passe le filtre d’état=${sft.stateFilterIncludes === true ? 'oui' : 'non'}, déjà liée pour vous=${sft.alreadyLinkedForUser === true ? 'oui' : 'non'}.`
              : '';
          toast.info('Sync Planner — aucun changement (diagnostic)', {
            description:
              `Microsoft a renvoyé ${diag.plannerTasksFetched} tâche(s). Exclues — déjà liées: ${diag.pullSkippedAlreadyLinked ?? 0}, ` +
              `filtre d’état: ${diag.pullSkippedByState ?? 0}, filtre demandeur (assignés résolus mais ≠ demandeur): ${diag.pullSkippedByDefaultRequesterAssignee ?? 0}. ` +
              `Direction: ${diag.syncDirection ?? '?'}. Filtre demandeur actif: ${diag.defaultRequesterFilterActive ? 'oui' : 'non'}. ` +
              `Profils Graph résolus: ${diag.graphUsersResolved ?? 0}.${firstHint}`,
            duration: 14000,
          });
        } else {
          toast.info('Sync Planner — aucun changement (diagnostic)', {
            description:
              `Microsoft Graph n’a renvoyé aucune tâche pour ce plan. Vérifiez le plan, les droits Planner, ou reconnectez Microsoft 365.`,
            duration: 12000,
          });
        }
      } else {
        toast.success(`Sync terminée: ${result.tasksPulled} importées, ${result.tasksPushed} poussées, ${result.tasksUpdated} mises à jour`);
      }

      await fetchMappings();
      await fetchSyncLogs();
      return result;
    } catch (error: any) {
      toast.error(`Erreur sync: ${error.message}`);
      await fetchSyncLogs();
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
