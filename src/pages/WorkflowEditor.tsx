import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useAllSubProcessTemplates } from '@/hooks/useAllSubProcessTemplates';
import { useTemplatePermissions } from '@/hooks/useTemplatePermissions';

export default function WorkflowEditor() {
  const { processId, subProcessId } = useParams<{ processId?: string; subProcessId?: string }>();
  const navigate = useNavigate();
  const { processes, isLoading: isLoadingProcesses } = useProcessTemplates();
  const { subProcesses, isLoading: isLoadingSubProcesses } = useAllSubProcessTemplates();
  const { canManageTemplates } = useTemplatePermissions();

  const isLoading = isLoadingProcesses || isLoadingSubProcesses;
  
  // Find process or subprocess
  const process = processId ? processes.find(p => p.id === processId) : null;
  const subProcess = subProcessId ? subProcesses.find(sp => sp.id === subProcessId) : null;
  
  // Get parent process for subprocess
  const parentProcess = subProcess 
    ? processes.find(p => p.id === subProcess.process_template_id)
    : null;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!process && !subProcess) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {processId ? 'Processus introuvable' : 'Sous-processus introuvable'}
        </p>
        <Button variant="outline" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux modèles
        </Button>
      </div>
    );
  }

  const title = process?.name || subProcess?.name || 'Workflow';
  const subtitle = subProcess && parentProcess 
    ? `Sous-processus de ${parentProcess.name}`
    : 'Éditeur de workflow';

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </header>

      {/* Workflow Canvas - Full height */}
      <div className="flex-1 overflow-hidden">
        <WorkflowBuilder
          processTemplateId={processId || null}
          subProcessTemplateId={subProcessId || null}
          canManage={canManageTemplates}
        />
      </div>
    </div>
  );
}
