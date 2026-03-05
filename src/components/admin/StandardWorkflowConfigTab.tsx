import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Workflow, Plus, Play, AlertCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStandardWorkflowConfig } from '@/hooks/useStandardWorkflowConfig';
import { WfGeneralSection } from '@/components/workflow-config/WfGeneralSection';
import { WfStepsSection } from '@/components/workflow-config/WfStepsSection';
import { WfTransitionsSection } from '@/components/workflow-config/WfTransitionsSection';
import { WfNotificationsSection } from '@/components/workflow-config/WfNotificationsSection';
import { WfActionsSection } from '@/components/workflow-config/WfActionsSection';

export function StandardWorkflowConfigTab() {
  const wf = useStandardWorkflowConfig();

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
        <Workflow className="h-12 w-12 text-muted-foreground/50" />
        <div className="text-center">
          <p className="font-medium">Aucun workflow standard configuré</p>
          <p className="text-sm text-muted-foreground mt-1">
            Créez un workflow standard pour définir les étapes, validations et actions par défaut.
          </p>
        </div>
        <Button onClick={() => wf.createWorkflow('Workflow Standard')} className="gap-2">
          <Plus className="h-4 w-4" />
          Créer le workflow standard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          Workflow Standard
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Définissez la configuration par défaut appliquée lors de la création ou régénération des workflows.
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex gap-2 flex-wrap text-sm">
        {['Paramètres', 'Étapes', 'Transitions', 'Notifications', 'Actions'].map((label, i) => (
          <a
            key={label}
            href={`#std-wf-section-${i}`}
            className="px-3 py-1.5 rounded-md border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      <div id="std-wf-section-0">
        <WfGeneralSection
          workflow={wf.workflow}
          canManage={true}
          onUpdate={wf.updateWorkflow}
          onPublish={wf.publishWorkflow}
        />
      </div>

      <div id="std-wf-section-1">
        <WfStepsSection
          steps={wf.steps}
          assignmentRules={wf.assignmentRules}
          canManage={true}
          onAdd={wf.addStep}
          onUpdate={wf.updateStep}
          onDelete={wf.deleteStep}
          onDuplicate={wf.duplicateStep}
          onReorder={wf.reorderSteps}
        />
      </div>

      <div id="std-wf-section-2">
        <WfTransitionsSection
          transitions={wf.transitions}
          steps={wf.steps}
          canManage={true}
          onAdd={wf.addTransition}
          onUpdate={wf.updateTransition}
          onDelete={wf.deleteTransition}
        />
      </div>

      <div id="std-wf-section-3">
        <WfNotificationsSection
          notifications={wf.notifications}
          steps={wf.steps}
          canManage={true}
          onAdd={wf.addNotification}
          onUpdate={wf.updateNotification}
          onDelete={wf.deleteNotification}
        />
      </div>

      <div id="std-wf-section-4">
        <WfActionsSection
          actions={wf.actions}
          transitions={wf.transitions}
          steps={wf.steps}
          canManage={true}
          onAdd={wf.addAction}
          onUpdate={wf.updateAction}
          onDelete={wf.deleteAction}
        />
      </div>

      {/* Apply to all sub-processes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Appliquer le workflow standard
          </CardTitle>
          <CardDescription>
            Régénérez les workflows des sous-processus existants avec cette configuration standard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>La régénération écrasera les workflows personnalisés existants.</p>
          </div>
          <ApplyStandardButton workflowId={wf.workflow.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function ApplyStandardButton({ workflowId }: { workflowId: string }) {
  const [isApplying, setIsApplying] = useState(false);
  const [results, setResults] = useState<{ total: number; success: number; errors: number } | null>(null);

  const applyToAll = async () => {
    setIsApplying(true);
    setResults(null);
    try {
      // Get standard workflow steps, transitions, notifications, actions
      const [stepsRes, transRes, notifsRes, actionsRes, spRes] = await Promise.all([
        supabase.from('wf_steps').select('*').eq('workflow_id', workflowId).order('order_index'),
        supabase.from('wf_transitions').select('*').eq('workflow_id', workflowId),
        supabase.from('wf_notifications').select('*').eq('workflow_id', workflowId),
        supabase.from('wf_actions').select('*').eq('workflow_id', workflowId),
        supabase.from('sub_process_templates').select('id, name'),
      ]);

      const templateSteps = stepsRes.data || [];
      const templateTransitions = transRes.data || [];
      const templateNotifications = notifsRes.data || [];
      const templateActions = actionsRes.data || [];
      const subProcesses = spRes.data || [];

      let success = 0;
      let errors = 0;

      for (const sp of subProcesses) {
        try {
          // Delete existing wf_workflow for this sub-process
          const { data: existingWfs } = await supabase
            .from('wf_workflows')
            .select('id')
            .eq('sub_process_template_id', sp.id);

          for (const ewf of existingWfs || []) {
            await Promise.all([
              supabase.from('wf_steps').delete().eq('workflow_id', ewf.id),
              supabase.from('wf_transitions').delete().eq('workflow_id', ewf.id),
              supabase.from('wf_notifications').delete().eq('workflow_id', ewf.id),
              supabase.from('wf_actions').delete().eq('workflow_id', ewf.id),
            ]);
          }
          if (existingWfs && existingWfs.length > 0) {
            await supabase.from('wf_workflows').delete().eq('sub_process_template_id', sp.id);
          }

          // Create new workflow for this sub-process
          const { data: newWf, error: wfErr } = await supabase
            .from('wf_workflows')
            .insert({
              name: `Workflow — ${sp.name}`,
              sub_process_template_id: sp.id,
              is_active: true,
              is_draft: false,
              version: 1,
              published_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (wfErr || !newWf) throw wfErr;

          // Build step_key mapping (old -> new)
          const stepKeyMap = new Map<string, string>();
          const newSteps = templateSteps.map(s => {
            const newKey = `${s.step_key}_${sp.id.slice(0, 8)}`;
            stepKeyMap.set(s.step_key, newKey);
            return {
              workflow_id: newWf.id,
              step_key: newKey,
              name: s.name,
              step_type: s.step_type,
              order_index: s.order_index,
              state_label: s.state_label,
              is_required: s.is_required,
              validation_mode: s.validation_mode,
              n_required: s.n_required,
              assignment_rule_id: s.assignment_rule_id,
              
            };
          });

          if (newSteps.length > 0) {
            await supabase.from('wf_steps').insert(newSteps);
          }

          // Copy transitions with mapped step keys
          const newTransitions = templateTransitions.map(t => ({
            workflow_id: newWf.id,
            from_step_key: stepKeyMap.get(t.from_step_key) || t.from_step_key,
            to_step_key: stepKeyMap.get(t.to_step_key) || t.to_step_key,
            event: t.event,
            condition_json: t.condition_json,
            is_active: t.is_active,
          }));
          if (newTransitions.length > 0) {
            await supabase.from('wf_transitions').insert(newTransitions);
          }

          // Copy notifications with mapped step keys
          const newNotifications = templateNotifications.map(n => ({
            workflow_id: newWf.id,
            step_key: n.step_key ? (stepKeyMap.get(n.step_key) || n.step_key) : null,
            event: n.event,
            channels_json: n.channels_json,
            recipients_rules_json: n.recipients_rules_json,
            subject_template: n.subject_template,
            body_template: n.body_template,
            is_active: n.is_active,
          }));
          if (newNotifications.length > 0) {
            await supabase.from('wf_notifications').insert(newNotifications);
          }

          // Copy actions with mapped step/transition keys
          const newActions = templateActions.map(a => ({
            workflow_id: newWf.id,
            transition_id: a.transition_id,
            step_key: a.step_key ? (stepKeyMap.get(a.step_key) || a.step_key) : null,
            action_type: a.action_type,
            config_json: a.config_json,
            order_index: a.order_index,
            is_active: a.is_active,
          }));
          if (newActions.length > 0) {
            await supabase.from('wf_actions').insert(newActions);
          }

          success++;
        } catch (err) {
          console.error(`Error applying to ${sp.name}:`, err);
          errors++;
        }
      }

      setResults({ total: subProcesses.length, success, errors });
      toast.success(`Workflow standard appliqué à ${success} sous-processus`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'application");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="default" disabled={isApplying} className="gap-2">
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Appliquer à tous les sous-processus
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Appliquer le workflow standard ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va régénérer les workflows de <strong>tous les sous-processus</strong> avec la configuration standard actuelle.
              Les workflows personnalisés seront écrasés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={applyToAll}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {results && (
        <div className="text-sm p-3 bg-muted rounded-lg">
          Résultat : <strong>{results.success}</strong> / {results.total} réussis
          {results.errors > 0 && <span className="text-destructive ml-2">({results.errors} erreurs)</span>}
        </div>
      )}
    </div>
  );
}
