import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  WfWorkflow, WfStep, WfTransition, WfNotification, WfAction,
  WfAssignmentRule, WfWorkflowInsert, WfStepInsert, WfTransitionInsert,
  WfNotificationInsert, WfActionInsert, WfStepUpdate, WfTransitionUpdate,
  WfNotificationUpdate, WfActionUpdate, WfWorkflowUpdate,
  WfStepPoolValidator, WfStepSequenceValidator,
} from '@/types/workflow';

export function useWorkflowConfig(subProcessTemplateId: string | undefined) {
  const [workflow, setWorkflow] = useState<WfWorkflow | null>(null);
  const [steps, setSteps] = useState<WfStep[]>([]);
  const [transitions, setTransitions] = useState<WfTransition[]>([]);
  const [notifications, setNotifications] = useState<WfNotification[]>([]);
  const [actions, setActions] = useState<WfAction[]>([]);
  const [assignmentRules, setAssignmentRules] = useState<WfAssignmentRule[]>([]);
  const [poolValidators, setPoolValidators] = useState<WfStepPoolValidator[]>([]);
  const [sequenceValidators, setSequenceValidators] = useState<WfStepSequenceValidator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!subProcessTemplateId) return;
    setIsLoading(true);
    try {
      // Fetch workflow for this sub-process
      const { data: wfData } = await supabase
        .from('wf_workflows')
        .select('*')
        .eq('sub_process_template_id', subProcessTemplateId)
        .eq('is_active', true)
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

      // Fetch all related data in parallel
      const [stepsRes, transRes, notifsRes, actionsRes, rulesRes, poolRes, seqRes] = await Promise.all([
        supabase.from('wf_steps').select('*').eq('workflow_id', wfId).order('order_index'),
        supabase.from('wf_transitions').select('*').eq('workflow_id', wfId).order('created_at'),
        supabase.from('wf_notifications').select('*').eq('workflow_id', wfId).order('created_at'),
        supabase.from('wf_actions').select('*').eq('workflow_id', wfId).order('order_index'),
        supabase.from('wf_assignment_rules').select('*').order('name'),
        supabase.from('wf_step_pool_validators').select('*'),
        supabase.from('wf_step_sequence_validators').select('*').order('order_index'),
      ]);

      setSteps(stepsRes.data || []);
      setTransitions(transRes.data || []);
      setNotifications(notifsRes.data || []);
      setActions(actionsRes.data || []);
      setAssignmentRules(rulesRes.data || []);
      setPoolValidators(poolRes.data || []);
      setSequenceValidators(seqRes.data || []);
    } catch (error) {
      console.error('Error fetching workflow config:', error);
      toast.error('Erreur lors du chargement du workflow');
    } finally {
      setIsLoading(false);
    }
  }, [subProcessTemplateId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // === WORKFLOW ===
  const createWorkflow = async (name: string) => {
    if (!subProcessTemplateId) return null;
    const insert: WfWorkflowInsert = {
      name,
      sub_process_template_id: subProcessTemplateId,
      is_active: true,
      is_draft: true,
      version: 1,
    };
    const { data, error } = await supabase.from('wf_workflows').insert(insert).select().single();
    if (error) { toast.error('Erreur création workflow'); return null; }
    setWorkflow(data);
    toast.success('Workflow créé');

    // Create default start/end steps
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

    // Auto-create default transitions
    const prevSteps = steps.filter(s => s.order_index < data.order_index && s.step_type !== 'end');
    const nextSteps = steps.filter(s => s.order_index > data.order_index && s.step_type !== 'start');
    const prevStep = prevSteps.length > 0 ? prevSteps[prevSteps.length - 1] : null;
    const nextStep = nextSteps.length > 0 ? nextSteps[0] : null;

    const newTransitions: WfTransitionInsert[] = [];
    if (prevStep) {
      // Remove existing transition from prev to next
      if (nextStep) {
        await supabase.from('wf_transitions').delete()
          .eq('workflow_id', workflow.id)
          .eq('from_step_key', prevStep.step_key)
          .eq('to_step_key', nextStep.step_key);
      }
      newTransitions.push({
        workflow_id: workflow.id,
        from_step_key: prevStep.step_key,
        to_step_key: data.step_key,
        event: data.step_type === 'validation' ? 'approved' : 'done',
      });
    }
    if (nextStep) {
      newTransitions.push({
        workflow_id: workflow.id,
        from_step_key: data.step_key,
        to_step_key: nextStep.step_key,
        event: data.step_type === 'validation' ? 'approved' : 'done',
      });
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

  const deleteStep = async (id: string) => {
    const step = steps.find(s => s.id === id);
    if (!step || step.step_type === 'start' || step.step_type === 'end') {
      toast.error('Impossible de supprimer cette étape');
      return;
    }
    // Check if used in transitions
    const usedInTransitions = transitions.filter(
      t => t.from_step_key === step.step_key || t.to_step_key === step.step_key
    );
    // Delete related transitions
    if (usedInTransitions.length > 0) {
      await supabase.from('wf_transitions').delete()
        .eq('workflow_id', workflow!.id)
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
    const newStep: Omit<WfStepInsert, 'workflow_id'> = {
      step_key: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${step.name} (copie)`,
      step_type: step.step_type,
      order_index: step.order_index + 1,
      state_label: step.state_label,
      is_required: step.is_required,
      validation_mode: step.validation_mode,
      n_required: step.n_required,
      assignment_rule_id: step.assignment_rule_id,
    };
    await addStep(newStep);
  };

  // === TRANSITIONS ===
  const addTransition = async (t: Omit<WfTransitionInsert, 'workflow_id'>) => {
    if (!workflow) return null;
    const insertData: WfTransitionInsert = { ...t, workflow_id: workflow.id };
    const { data, error } = await supabase.from('wf_transitions').insert(insertData).select().single();
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
    const insertData: WfNotificationInsert = { ...n, workflow_id: workflow.id };
    const { data, error } = await supabase.from('wf_notifications').insert(insertData).select().single();
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
    const insertData: WfActionInsert = { ...a, workflow_id: workflow.id };
    const { data, error } = await supabase.from('wf_actions').insert(insertData).select().single();
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
    workflow,
    steps,
    transitions,
    notifications,
    actions,
    assignmentRules,
    poolValidators,
    sequenceValidators,
    isLoading,
    refetch: fetchAll,
    // Workflow
    createWorkflow,
    updateWorkflow,
    publishWorkflow,
    // Steps
    addStep,
    updateStep,
    deleteStep,
    duplicateStep,
    // Transitions
    addTransition,
    updateTransition,
    deleteTransition,
    // Notifications
    addNotification,
    updateNotification,
    deleteNotification,
    // Actions
    addAction,
    updateAction,
    deleteAction,
  };
}
