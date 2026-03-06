import { Button } from '@/components/ui/button';
import { Loader2, Plus, Workflow } from 'lucide-react';
import { useWorkflowConfig } from '@/hooks/useWorkflowConfig';
import { WfGeneralSection } from './WfGeneralSection';
import { WfStepsSection } from './WfStepsSection';
import { WfTransitionsSection } from './WfTransitionsSection';
import { WfNotificationsSection } from './WfNotificationsSection';
import { WfActionsSection } from './WfActionsSection';

interface Props {
  subProcessId: string;
  subProcessName: string;
  canManage: boolean;
}

export function WorkflowConfigTab({ subProcessId, subProcessName, canManage }: Props) {
  const wf = useWorkflowConfig(subProcessId);

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
          <p className="font-medium">Aucun workflow configuré</p>
          <p className="text-sm text-muted-foreground mt-1">
            Créez un workflow pour définir les étapes, validations et actions de ce sous-processus.
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

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 flex-wrap text-sm">
        {['Paramètres', 'Étapes', 'Transitions', 'Notifications', 'Actions'].map((label, i) => (
          <a
            key={label}
            href={`#wf-section-${i}`}
            className="px-3 py-1.5 rounded-md border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      <div id="wf-section-0">
        <WfGeneralSection
          workflow={wf.workflow}
          canManage={canManage}
          onUpdate={wf.updateWorkflow}
          onPublish={wf.publishWorkflow}
        />
      </div>

      <div id="wf-section-1">
        <WfStepsSection
          steps={wf.steps}
          assignmentRules={wf.assignmentRules}
          canManage={canManage}
          subProcessId={subProcessId}
          onAdd={wf.addStep}
          onUpdate={wf.updateStep}
          onDelete={wf.deleteStep}
          onDuplicate={wf.duplicateStep}
          onReorder={wf.reorderSteps}
        />
      </div>

      <div id="wf-section-2">
        <WfTransitionsSection
          transitions={wf.transitions}
          steps={wf.steps}
          canManage={canManage}
          onAdd={wf.addTransition}
          onUpdate={wf.updateTransition}
          onDelete={wf.deleteTransition}
        />
      </div>

      <div id="wf-section-3">
        <WfNotificationsSection
          notifications={wf.notifications}
          steps={wf.steps}
          canManage={canManage}
          onAdd={wf.addNotification}
          onUpdate={wf.updateNotification}
          onDelete={wf.deleteNotification}
        />
      </div>

      <div id="wf-section-4">
        <WfActionsSection
          actions={wf.actions}
          transitions={wf.transitions}
          steps={wf.steps}
          canManage={canManage}
          onAdd={wf.addAction}
          onUpdate={wf.updateAction}
          onDelete={wf.deleteAction}
        />
      </div>
    </div>
  );
}
