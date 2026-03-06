import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WfTaskConfig, WfTaskConfigInsert, WfTaskConfigUpdate, WfValidationConfig, WfValidationConfigInsert, WfValidationConfigUpdate } from '@/types/workflowTaskConfig';

/**
 * Hook for managing wf_task_configs and wf_validation_configs for a given workflow.
 */
export function useWorkflowTasksAndValidations(workflowId: string | undefined) {
  const [taskConfigs, setTaskConfigs] = useState<WfTaskConfig[]>([]);
  const [validationConfigs, setValidationConfigs] = useState<WfValidationConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!workflowId) return;
    setIsLoading(true);
    try {
      const [tasksRes, valsRes] = await Promise.all([
        supabase.from('wf_task_configs').select('*').eq('workflow_id', workflowId).order('order_index'),
        supabase.from('wf_validation_configs').select('*').eq('workflow_id', workflowId).order('order_index'),
      ]);
      setTaskConfigs((tasksRes.data as unknown as WfTaskConfig[]) || []);
      setValidationConfigs((valsRes.data as unknown as WfValidationConfig[]) || []);
    } catch (error) {
      console.error('Error fetching task/validation configs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  // === TASK CONFIGS ===
  const addTaskConfig = async (data: Omit<WfTaskConfigInsert, 'workflow_id'>): Promise<WfTaskConfig | null> => {
    if (!workflowId) return null;
    const insert = { ...data, workflow_id: workflowId };
    const { data: result, error } = await supabase.from('wf_task_configs').insert(insert as any).select().single();
    if (error) { toast.error('Erreur ajout tâche'); return null; }
    const typed = result as unknown as WfTaskConfig;
    setTaskConfigs(prev => [...prev, typed].sort((a, b) => a.order_index - b.order_index));
    toast.success('Tâche ajoutée');
    return typed;
  };

  const updateTaskConfig = async (id: string, updates: WfTaskConfigUpdate) => {
    const { error } = await supabase.from('wf_task_configs').update(updates as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour tâche'); return; }
    setTaskConfigs(prev => prev.map(t => t.id === id ? { ...t, ...updates } as WfTaskConfig : t));
    toast.success('Tâche mise à jour');
  };

  const deleteTaskConfig = async (id: string) => {
    const { error } = await supabase.from('wf_task_configs').delete().eq('id', id);
    if (error) { toast.error('Erreur suppression tâche'); return; }
    setTaskConfigs(prev => prev.filter(t => t.id !== id));
    toast.success('Tâche supprimée');
  };

  // === VALIDATION CONFIGS ===
  const addValidationConfig = async (data: Omit<WfValidationConfigInsert, 'workflow_id'>): Promise<WfValidationConfig | null> => {
    if (!workflowId) return null;
    const insert = { ...data, workflow_id: workflowId };
    const { data: result, error } = await supabase.from('wf_validation_configs').insert(insert as any).select().single();
    if (error) { toast.error('Erreur ajout validation'); return null; }
    const typed = result as unknown as WfValidationConfig;
    setValidationConfigs(prev => [...prev, typed].sort((a, b) => a.order_index - b.order_index));
    toast.success('Validation ajoutée');
    return typed;
  };

  const updateValidationConfig = async (id: string, updates: WfValidationConfigUpdate) => {
    const { error } = await supabase.from('wf_validation_configs').update(updates as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour validation'); return; }
    setValidationConfigs(prev => prev.map(v => v.id === id ? { ...v, ...updates } as WfValidationConfig : v));
    toast.success('Validation mise à jour');
  };

  const deleteValidationConfig = async (id: string) => {
    const { error } = await supabase.from('wf_validation_configs').delete().eq('id', id);
    if (error) { toast.error('Erreur suppression validation'); return; }
    setValidationConfigs(prev => prev.filter(v => v.id !== id));
    toast.success('Validation supprimée');
  };

  return {
    taskConfigs, validationConfigs, isLoading,
    fetchTasksAndValidations: fetchAll,
    addTaskConfig, updateTaskConfig, deleteTaskConfig,
    addValidationConfig, updateValidationConfig, deleteValidationConfig,
  };
}
