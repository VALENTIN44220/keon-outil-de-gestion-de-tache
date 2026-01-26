import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useTemplatePermissions } from '@/hooks/useTemplatePermissions';

export default function WorkflowEditor() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const { processes, isLoading } = useProcessTemplates();
  const { canManageTemplates } = useTemplatePermissions();

  const process = processes.find(p => p.id === processId);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!process) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Processus introuvable</p>
        <Button variant="outline" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux modèles
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{process.name}</h1>
            <p className="text-sm text-muted-foreground">Éditeur de workflow</p>
          </div>
        </div>
      </header>

      {/* Workflow Canvas - Full height */}
      <div className="flex-1 overflow-hidden">
        <WorkflowBuilder
          processTemplateId={processId}
          canManage={canManageTemplates}
        />
      </div>
    </div>
  );
}
