import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Plus, Workflow, ListOrdered, ArrowRightLeft,
  Bell, Zap, Eye as EyeIcon, ListTodo, ShieldCheck,
  ShieldAlert, Play,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkflowConfig } from '@/hooks/useWorkflowConfig';
import { useWorkflowTasksAndValidations } from '@/hooks/useWorkflowTasksAndValidations';
import { WfGeneralSection } from './WfGeneralSection';
import { WfStepsSection } from './WfStepsSection';
import { WfTransitionsSection } from './WfTransitionsSection';
import { WfNotificationsSection } from './WfNotificationsSection';
import { WfActionsSection } from './WfActionsSection';
import { WfTasksSection } from './WfTasksSection';
import { WfValidationsSection } from './WfValidationsSection';
import { WfFlowPreview } from './WfFlowPreview';
import { WfCoherencePanel } from './WfCoherencePanel';
import { WfSimulation } from './WfSimulation';
import { WfModeSelector } from './WfModeSelector';
import { WfStandardModePanel } from './WfStandardModePanel';
import { runCoherenceChecks } from '@/lib/workflowCoherenceChecks';
import { DEFAULT_STANDARD_OPTIONS, generateStandardStructure } from '@/lib/standardWorkflowTemplate';
import type { StandardWorkflowOptions } from '@/lib/standardWorkflowTemplate';

interface Props {
  subProcessId: string;
  subProcessName: string;
  canManage: boolean;
}

export function WorkflowConfigTab({ subProcessId, subProcessName, canManage }: Props) {
  const wf = useWorkflowConfig(subProcessId);
  const tv = useWorkflowTasksAndValidations(wf.workflow?.id);
  const [activeTab, setActiveTab] = useState('steps');
  const [isApplyingStandard, setIsApplyingStandard] = useState(false);

  // Determine config mode from workflow data
  const configMode: 'standard' | 'advanced' = (wf.workflow as any)?.config_mode === 'advanced' ? 'advanced' : 'standard';
  const standardOptionsRaw = (wf.workflow as any)?.standard_options;
  const customizedAt = (wf.workflow as any)?.customized_at;

  const [standardOptions, setStandardOptions] = useState<StandardWorkflowOptions>(
    () => {
      if (standardOptionsRaw && typeof standardOptionsRaw === 'object' && 'request_validation' in standardOptionsRaw) {
        return standardOptionsRaw as StandardWorkflowOptions;
      }
      return DEFAULT_STANDARD_OPTIONS;
    }
  );

  // Sync standard options when workflow data changes
  useEffect(() => {
    if (standardOptionsRaw && typeof standardOptionsRaw === 'object' && 'request_validation' in standardOptionsRaw) {
      setStandardOptions(standardOptionsRaw as StandardWorkflowOptions);
    }
  }, [standardOptionsRaw]);

  useEffect(() => {
    if (wf.workflow?.id) tv.fetchTasksAndValidations();
  }, [wf.workflow?.id]);

  const coherenceErrors = useMemo(() => {
    if (!wf.workflow) return 0;
    const checks = runCoherenceChecks(wf.steps, wf.transitions, wf.actions, wf.notifications, tv.taskConfigs, tv.validationConfigs);
    return checks.filter(c => c.severity === 'error').length;
  }, [wf.steps, wf.transitions, wf.actions, wf.notifications, tv.taskConfigs, tv.validationConfigs, wf.workflow]);

  // Apply standard template: delete existing + create from template
  const applyStandardTemplate = useCallback(async (options: StandardWorkflowOptions) => {
    if (!wf.workflow) return;
    setIsApplyingStandard(true);
    try {
      const wfId = wf.workflow.id;
      const structure = generateStandardStructure(options);

      // Delete existing config
      await Promise.all([
        supabase.from('wf_steps').delete().eq('workflow_id', wfId),
        supabase.from('wf_transitions').delete().eq('workflow_id', wfId),
        supabase.from('wf_notifications').delete().eq('workflow_id', wfId),
        supabase.from('wf_actions').delete().eq('workflow_id', wfId),
        supabase.from('wf_task_configs').delete().eq('workflow_id', wfId),
        supabase.from('wf_validation_configs').delete().eq('workflow_id', wfId),
      ]);

      // Insert new structure
      if (structure.steps.length > 0) {
        await supabase.from('wf_steps').insert(structure.steps.map(s => ({ ...s, workflow_id: wfId, step_type: s.step_type as any, validation_mode: (s.validation_mode || 'none') as any })));
      }
      if (structure.transitions.length > 0) {
        await supabase.from('wf_transitions').insert(structure.transitions.map(t => ({ ...t, workflow_id: wfId })));
      }
      if (structure.notifications.length > 0) {
        await supabase.from('wf_notifications').insert(structure.notifications.map(n => ({ ...n, workflow_id: wfId })));
      }
      if (structure.taskConfigs.length > 0) {
        await supabase.from('wf_task_configs').insert(structure.taskConfigs.map(tc => ({ ...tc, workflow_id: wfId })));
      }
      if (structure.validationConfigs.length > 0) {
        await supabase.from('wf_validation_configs').insert(structure.validationConfigs.map(vc => ({ ...vc, workflow_id: wfId })));
      }

      // Save options + mode
      await supabase.from('wf_workflows').update({
        config_mode: 'standard',
        standard_options: options as any,
        customized_at: null,
      }).eq('id', wfId);

      toast.success('Configuration standard appliquée');
      await wf.refetch();
      tv.fetchTasksAndValidations();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'application de la configuration standard");
    } finally {
      setIsApplyingStandard(false);
    }
  }, [wf.workflow]);

  const switchToAdvanced = useCallback(async () => {
    if (!wf.workflow) return;
    await supabase.from('wf_workflows').update({
      config_mode: 'advanced',
      customized_at: new Date().toISOString(),
    }).eq('id', wf.workflow.id);
    toast.success('Mode avancé activé');
    await wf.refetch();
  }, [wf.workflow]);

  const switchToStandard = useCallback(async () => {
    if (!wf.workflow) return;
    await applyStandardTemplate(standardOptions);
  }, [wf.workflow, standardOptions, applyStandardTemplate]);

  if (wf.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!wf.workflow) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
          <Workflow className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div className="text-center">
          <p className="font-medium text-lg">Aucun workflow configuré</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Créez un workflow pour définir les étapes, tâches, validations et actions automatiques de ce sous-processus.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => wf.createWorkflow(`Workflow — ${subProcessName}`)} className="gap-2">
            <Plus className="h-4 w-4" />
            Créer le workflow
          </Button>
        )}
      </div>
    );
  }

  const stepCount = wf.steps.filter(s => s.step_type !== 'start' && s.step_type !== 'end').length;
  const transitionCount = wf.transitions.length;
  const notifCount = wf.notifications.length;
  const actionCount = wf.actions.length;
  const taskCount = tv.taskConfigs.length;
  const validationCount = tv.validationConfigs.length;

  const subTabs = [
    { id: 'steps', label: 'Étapes', icon: ListOrdered, count: stepCount },
    { id: 'tasks', label: 'Tâches', icon: ListTodo, count: taskCount },
    { id: 'validations', label: 'Validations', icon: ShieldCheck, count: validationCount },
    { id: 'transitions', label: 'Transitions', icon: ArrowRightLeft, count: transitionCount },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: notifCount },
    { id: 'actions', label: 'Actions auto.', icon: Zap, count: actionCount },
    { id: 'preview', label: 'Aperçu', icon: EyeIcon, count: null },
    { id: 'checks', label: 'Contrôles', icon: ShieldAlert, count: coherenceErrors > 0 ? coherenceErrors : null, badgeVariant: coherenceErrors > 0 ? 'destructive' as const : undefined },
    { id: 'simulation', label: 'Simulation', icon: Play, count: null },
  ];

  return (
    <div className="space-y-5">
      {/* Mode Selector */}
      <WfModeSelector
        mode={configMode}
        canManage={canManage}
        customizedAt={customizedAt}
        onSwitchToAdvanced={switchToAdvanced}
        onSwitchToStandard={switchToStandard}
      />

      {/* General Section */}
      <WfGeneralSection
        workflow={wf.workflow}
        canManage={canManage}
        onUpdate={wf.updateWorkflow}
        onPublish={wf.publishWorkflow}
        coherenceErrors={coherenceErrors}
      />

      {/* Standard Mode */}
      {configMode === 'standard' && (
        <WfStandardModePanel
          options={standardOptions}
          canManage={canManage}
          onOptionsChange={setStandardOptions}
          onApply={applyStandardTemplate}
          isApplying={isApplyingStandard}
        />
      )}

      {/* Advanced Mode - full tabs */}
      {configMode === 'advanced' && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-2"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <Badge
                      variant={(tab as any).badgeVariant || 'secondary'}
                      className="h-4 min-w-[16px] px-1 text-[10px] ml-0.5"
                    >
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="steps" className="mt-4">
            <WfStepsSection
              steps={wf.steps} transitions={wf.transitions} notifications={wf.notifications}
              actions={wf.actions} assignmentRules={wf.assignmentRules} canManage={canManage}
              subProcessId={subProcessId} taskConfigs={tv.taskConfigs} validationConfigs={tv.validationConfigs}
              onAdd={wf.addStep} onUpdate={wf.updateStep} onDelete={wf.deleteStep}
              onDuplicate={wf.duplicateStep} onReorder={wf.reorderSteps}
            />
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <WfTasksSection
              taskConfigs={tv.taskConfigs} validationConfigs={tv.validationConfigs}
              steps={wf.steps} canManage={canManage}
              onAdd={tv.addTaskConfig} onUpdate={tv.updateTaskConfig} onDelete={tv.deleteTaskConfig}
            />
          </TabsContent>

          <TabsContent value="validations" className="mt-4">
            <WfValidationsSection
              validationConfigs={tv.validationConfigs} steps={wf.steps} canManage={canManage}
              onAdd={tv.addValidationConfig} onUpdate={tv.updateValidationConfig} onDelete={tv.deleteValidationConfig}
            />
          </TabsContent>

          <TabsContent value="transitions" className="mt-4">
            <WfTransitionsSection
              transitions={wf.transitions} steps={wf.steps} canManage={canManage}
              onAdd={wf.addTransition} onUpdate={wf.updateTransition} onDelete={wf.deleteTransition}
            />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <WfNotificationsSection
              notifications={wf.notifications} steps={wf.steps} canManage={canManage}
              onAdd={wf.addNotification} onUpdate={wf.updateNotification} onDelete={wf.deleteNotification}
            />
          </TabsContent>

          <TabsContent value="actions" className="mt-4">
            <WfActionsSection
              actions={wf.actions} transitions={wf.transitions} steps={wf.steps}
              canManage={canManage} subProcessId={subProcessId}
              onAdd={wf.addAction} onUpdate={wf.updateAction} onDelete={wf.deleteAction}
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <WfFlowPreview
              steps={wf.steps} transitions={wf.transitions} actions={wf.actions}
              notifications={wf.notifications} taskConfigs={tv.taskConfigs} validationConfigs={tv.validationConfigs}
            />
          </TabsContent>

          <TabsContent value="checks" className="mt-4">
            <WfCoherencePanel
              steps={wf.steps} transitions={wf.transitions} actions={wf.actions}
              notifications={wf.notifications} taskConfigs={tv.taskConfigs} validationConfigs={tv.validationConfigs}
            />
          </TabsContent>

          <TabsContent value="simulation" className="mt-4">
            <WfSimulation
              steps={wf.steps} transitions={wf.transitions} actions={wf.actions}
              taskConfigs={tv.taskConfigs} validationConfigs={tv.validationConfigs}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
