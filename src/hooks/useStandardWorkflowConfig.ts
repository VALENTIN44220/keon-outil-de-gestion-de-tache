import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchEnrichedWorkflowAssignmentRules } from '@/lib/workflowAssignmentRules';
import type { EnrichedAssignmentRule } from '@/lib/workflowAssignmentRules';
import type {
  WfWorkflow, WfStep, WfTransition, WfNotification, WfAction,
  WfAssignmentRule, WfWorkflowInsert, WfStepInsert, WfTransitionInsert,
  WfNotificationInsert, WfActionInsert, WfStepUpdate, WfTransitionUpdate,
  WfNotificationUpdate, WfActionUpdate, WfWorkflowUpdate,
} from '@/types/workflow';

/**
 * Hook identical to useWorkflowConfig but for the standard workflow template
 * (is_standard_template = true, sub_process_template_id IS NULL).
 */
export function useStandardWorkflowConfig() {
  const [workflow, setWorkflow] = useState<WfWorkflow | null>(null);
  const [steps, setSteps] = useState<WfStep[]>([]);
  const [transitions, setTransitions] = useState<WfTransition[]>([]);
  const [notifications, setNotifications] = useState<WfNotification[]>([]);
  const [actions, setActions] = useState<WfAction[]>([]);
  const [assignmentRules, setAssignmentRules] = useState<EnrichedAssignmentRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: wfData } = await supabase
        .from('wf_workflows')
        .select('*')
        .eq('is_standard_template', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!wfData) {
        setWorkflow(null);
        setSteps([]);
        setTransitions([]);
        setNotifications([]);
        setActions([]);
        setIsLoading(false);
        return;
      }

      setWorkflow(wfData);
      const wfId = wfData.id;

      const [stepsRes, transRes, notifsRes, actionsRes, enrichedRules] = await Promise.all([
        supabase.from('wf_steps').select('*').eq('workflow_id', wfId).order('order_index'),
        supabase.from('wf_transitions').select('*').eq('workflow_id', wfId).order('created_at'),
        supabase.from('wf_notifications').select('*').eq('workflow_id', wfId).order('created_at'),
        supabase.from('wf_actions').select('*').eq('workflow_id', wfId).order('order_index'),
        fetchEnrichedWorkflowAssignmentRules(),
      ]);

      setSteps(stepsRes.data || []);
      setTransitions(transRes.data || []);
      setNotifications(notifsRes.data || []);
      setActions(actionsRes.data || []);
      setAssignmentRules(enrichedRules);
    } catch (error) {
      console.error('Error fetching standard workflow config:', error);
      toast.error('Erreur lors du chargement du workflow standard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // === WORKFLOW ===
  const createWorkflow = async (name: string) => {
    const insert: WfWorkflowInsert = {
      name,
      is_active: true,
      is_draft: true,
      version: 1,
      is_standard_template: true,
    };
    const { data, error } = await supabase.from('wf_workflows').insert(insert).select().single();
    if (error) { toast.error('Erreur création workflow'); return null; }
    setWorkflow(data);
    toast.success('Workflow standard créé');

    const startStep: WfStepInsert = {
      workflow_id: data.id,
      step_key: `start_${Date.now()}`,
      name: 'Début',
      step_type: 'start',
      order_index: 0,
      state_label: 'Nouvelle demande',
      is_required: true,
    };
    const endStep: WfStepInsert = {
      workflow_id: data.id,
      step_key: `end_${Date.now()}`,
      name: 'Fin',
      step_type: 'end',
      order_index: 999,
      state_label: 'Clôturé',
      is_required: true,
    };
    const { data: stepsData } = await supabase.from('wf_steps').insert([startStep, endStep]).select();
    if (stepsData) setSteps(stepsData);
    return data;
  };

  const updateWorkflow = async (updates: WfWorkflowUpdate) => {
    if (!workflow) return;
    const { error } = await supabase.from('wf_workflows').update(updates).eq('id', workflow.id);
    if (error) { toast.error('Erreur mise à jour workflow'); return; }
    setWorkflow(prev => prev ? { ...prev, ...updates } : null);
    toast.success('Workflow mis à jour');
  };

  const publishWorkflow = async () => {
    if (!workflow) return;
    await updateWorkflow({ is_draft: false, published_at: new Date().toISOString() });
  };

  // === STEPS ===
  const addStep = async (step: Omit<WfStepInsert, 'workflow_id'>) => {
    if (!workflow) return null;
    const insert: WfStepInsert = { ...step, workflow_id: workflow.id };
    const { data, error } = await supabase.from('wf_steps').insert(insert).select().single();
    if (error) { toast.error('Erreur ajout étape'); return null; }
    setSteps(prev => [...prev, data].sort((a, b) => a.order_index - b.order_index));

    // Auto-create transitions
    const prevSteps = steps.filter(s => s.order_index < data.order_index && s.step_type !== 'end');
    const nextSteps = steps.filter(s => s.order_index > data.order_index && s.step_type !== 'start');
    const prevStep = prevSteps.length > 0 ? prevSteps[prevSteps.length - 1] : null;
    const nextStep = nextSteps.length > 0 ? nextSteps[0] : null;
    const newTransitions: WfTransitionInsert[] = [];
    if (prevStep) {
      if (nextStep) {
        await supabase.from('wf_transitions').delete()
          .eq('workflow_id', workflow.id)
          .eq('from_step_key', prevStep.step_key)
          .eq('to_step_key', nextStep.step_key);
      }
      newTransitions.push({ workflow_id: workflow.id, from_step_key: prevStep.step_key, to_step_key: data.step_key, event: data.step_type === 'validation' ? 'approved' : 'done' });
    }
    if (nextStep) {
      newTransitions.push({ workflow_id: workflow.id, from_step_key: data.step_key, to_step_key: nextStep.step_key, event: data.step_type === 'validation' ? 'approved' : 'done' });
    }
    if (newTransitions.length > 0) {
      const { data: tData } = await supabase.from('wf_transitions').insert(newTransitions).select();
      if (tData) setTransitions(prev => [...prev.filter(t => {
        if (prevStep && nextStep && t.from_step_key === prevStep.step_key && t.to_step_key === nextStep.step_key) return false;
        return true;
      }), ...tData]);
    }
    toast.success('Étape ajoutée');
    return data;
  };

  const updateStep = async (id: string, updates: WfStepUpdate) => {
    const { error } = await supabase.from('wf_steps').update(updates).eq('id', id);
    if (error) { toast.error('Erreur mise à jour étape'); return; }
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } as WfStep : s));
    toast.success('Étape mise à jour');
  };

  const reorderSteps = async (reorderedSteps: { id: string; order_index: number }[]) => {
    setSteps(prev => {
      const updated = [...prev];
      for (const r of reorderedSteps) {
        const idx = updated.findIndex(s => s.id === r.id);
        if (idx >= 0) updated[idx] = { ...updated[idx], order_index: r.order_index };
      }
      return updated.sort((a, b) => a.order_index - b.order_index);
    });
    const promises = reorderedSteps.map(r => supabase.from('wf_steps').update({ order_index: r.order_index }).eq('id', r.id));
    const results = await Promise.all(promises);
    if (results.some(r => r.error)) { toast.error('Erreur réordonnancement'); await fetchAll(); }
    else toast.success('Ordre mis à jour');
  };

  const deleteStep = async (id: string) => {
    const step = steps.find(s => s.id === id);
    if (!step || step.step_type === 'start' || step.step_type === 'end') { toast.error('Impossible de supprimer cette étape'); return; }
    if (workflow) {
      await supabase.from('wf_transitions').delete()
        .eq('workflow_id', workflow.id)
        .or(`from_step_key.eq.${step.step_key},to_step_key.eq.${step.step_key}`);
    }
    const { error } = await supabase.from('wf_steps').delete().eq('id', id);
    if (error) { toast.error('Erreur suppression étape'); return; }
    setSteps(prev => prev.filter(s => s.id !== id));
    setTransitions(prev => prev.filter(t => t.from_step_key !== step.step_key && t.to_step_key !== step.step_key));
    toast.success('Étape supprimée');
  };

  const duplicateStep = async (id: string) => {
    const step = steps.find(s => s.id === id);
    if (!step) return;
    await addStep({
      step_key: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${step.name} (copie)`,
      step_type: step.step_type,
      order_index: step.order_index + 1,
      state_label: step.state_label,
      is_required: step.is_required,
      validation_mode: step.validation_mode,
      n_required: step.n_required,
      assignment_rule_id: step.assignment_rule_id,
    });
  };

  // === TRANSITIONS ===
  const addTransition = async (t: Omit<WfTransitionInsert, 'workflow_id'>) => {
    if (!workflow) return null;
    const { data, error } = await supabase.from('wf_transitions').insert({ ...t, workflow_id: workflow.id }).select().single();
    if (error) { toast.error('Erreur ajout transition'); return null; }
    setTransitions(prev => [...prev, data]);
    toast.success('Transition ajoutée');
    return data;
  };

  const updateTransition = async (id: string, updates: WfTransitionUpdate) => {
    const { error } = await supabase.from('wf_transitions').update(updates).eq('id', id);
    if (error) { toast.error('Erreur mise à jour transition'); return; }
    setTransitions(prev => prev.map(t => t.id === id ? { ...t, ...updates } as WfTransition : t));
  };

  const deleteTransition = async (id: string) => {
    const { error } = await supabase.from('wf_transitions').delete().eq('id', id);
    if (error) { toast.error('Erreur suppression transition'); return; }
    setTransitions(prev => prev.filter(t => t.id !== id));
    toast.success('Transition supprimée');
  };

  // === NOTIFICATIONS ===
  const addNotification = async (n: Omit<WfNotificationInsert, 'workflow_id'>) => {
    if (!workflow) return null;
    const { data, error } = await supabase.from('wf_notifications').insert({ ...n, workflow_id: workflow.id }).select().single();
    if (error) { toast.error('Erreur ajout notification'); return null; }
    setNotifications(prev => [...prev, data]);
    toast.success('Notification ajoutée');
    return data;
  };

  const updateNotification = async (id: string, updates: WfNotificationUpdate) => {
    const { error } = await supabase.from('wf_notifications').update(updates).eq('id', id);
    if (error) { toast.error('Erreur mise à jour notification'); return; }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...updates } as WfNotification : n));
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('wf_notifications').delete().eq('id', id);
    if (error) { toast.error('Erreur suppression notification'); return; }
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success('Notification supprimée');
  };

  // === ACTIONS ===
  const addAction = async (a: Omit<WfActionInsert, 'workflow_id'>) => {
    if (!workflow) return null;
    const { data, error } = await supabase.from('wf_actions').insert({ ...a, workflow_id: workflow.id }).select().single();
    if (error) { toast.error('Erreur ajout action'); return null; }
    setActions(prev => [...prev, data]);
    toast.success('Action ajoutée');
    return data;
  };

  const updateAction = async (id: string, updates: WfActionUpdate) => {
    const { error } = await supabase.from('wf_actions').update(updates).eq('id', id);
    if (error) { toast.error('Erreur mise à jour action'); return; }
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } as WfAction : a));
  };

  const deleteAction = async (id: string) => {
    const { error } = await supabase.from('wf_actions').delete().eq('id', id);
    if (error) { toast.error('Erreur suppression action'); return; }
    setActions(prev => prev.filter(a => a.id !== id));
    toast.success('Action supprimée');
  };

  return {
    workflow, steps, transitions, notifications, actions, assignmentRules,
    isLoading, refetch: fetchAll,
    createWorkflow, updateWorkflow, publishWorkflow,
    addStep, updateStep, reorderSteps, deleteStep, duplicateStep,
    addTransition, updateTransition, deleteTransition,
    addNotification, updateNotification, deleteNotification,
    addAction, updateAction, deleteAction,
  };
}
