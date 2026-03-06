import { Button } from '@/components/ui/button';
import { Loader2, Workflow, Plus } from 'lucide-react';
import { useStandardWorkflowConfig } from '@/hooks/useStandardWorkflowConfig';
import { WfGeneralSection } from '@/components/workflow-config/WfGeneralSection';
import { WfStepsSection } from '@/components/workflow-config/WfStepsSection';
import { WfTransitionsSection } from '@/components/workflow-config/WfTransitionsSection';
import { WfNotificationsSection } from '@/components/workflow-config/WfNotificationsSection';
import { WfActionsSection } from '@/components/workflow-config/WfActionsSection';
import { ApplyStandardWorkflowSection } from './ApplyStandardWorkflowSection';

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
          subProcessId=""
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

      <ApplyStandardWorkflowSection workflowId={wf.workflow.id} />
    </div>
  );
}
