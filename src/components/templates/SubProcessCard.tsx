import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubProcessWithTasks, TaskTemplate, VISIBILITY_LABELS, TemplateVisibility } from '@/types/template';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, Users, User, UserCog, Workflow, ListTodo, 
  Lock, Building2, Globe, Eye, CheckCircle, ArrowRight
} from 'lucide-react';
import { SubProcessConfigView } from './SubProcessConfigView';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SubProcessCardProps {
  subProcess: SubProcessWithTasks;
  processId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'sub_process_template_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteTask: (taskId: string) => void;
  onRefresh?: () => void;
  canManage?: boolean;
  onMandatoryChange?: (id: string, isMandatory: boolean) => void;
}

const assignmentTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
  manager: { label: 'Manager', icon: Users, color: 'text-info' },
  role: { label: 'Par poste', icon: UserCog, color: 'text-warning' },
  user: { label: 'Utilisateur', icon: User, color: 'text-success' },
  group: { label: 'Groupe', icon: Users, color: 'text-primary' },
};

const visibilityIcons: Record<string, any> = {
  private: Lock,
  internal_department: Users,
  internal_company: Building2,
  public: Globe,
};

interface WorkflowStatus {
  status: 'active' | 'draft' | 'none';
  nodeCount: number;
  hasValidation: boolean;
}

export function SubProcessCard({ 
  subProcess, 
  processId,
  onEdit, 
  onDelete, 
  onAddTask, 
  onDeleteTask,
  onRefresh,
  canManage = false,
  onMandatoryChange
}: SubProcessCardProps) {
  const navigate = useNavigate();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>({ status: 'none', nodeCount: 0, hasValidation: false });

  useEffect(() => {
    const fetchWorkflowStatus = async () => {
      const { data: workflowData } = await supabase
        .from('workflow_templates')
        .select('id, status, workflow_nodes(id, type)')
        .eq('sub_process_template_id', subProcess.id)
        .maybeSingle();

      if (workflowData) {
        const nodes = (workflowData as any).workflow_nodes || [];
        const hasValidation = nodes.some((n: any) => n.type === 'validation');
        const status = workflowData.status;
        const isActive = status !== 'draft' && status !== 'archived' && status !== 'inactive';
        setWorkflowStatus({
          status: isActive ? 'active' : (status === 'draft' ? 'draft' : 'none'),
          nodeCount: nodes.length,
          hasValidation
        });
      }
    };
    fetchWorkflowStatus();
  }, [subProcess.id]);

  const assignmentInfo = assignmentTypeLabels[subProcess.assignment_type] || assignmentTypeLabels.manager;
  const AssignmentIcon = assignmentInfo.icon;
  const VisibilityIcon = visibilityIcons[subProcess.visibility_level] || Globe;

  // Get workflow status indicator
  const getWorkflowIndicator = () => {
    if (workflowStatus.status === 'active') {
      return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-success">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Actif
        </div>
      );
    } else if (workflowStatus.status === 'draft') {
      return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
          <div className="w-2 h-2 rounded-full bg-warning" />
          Brouillon
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-muted" />
        Non configuré
      </div>
    );
  };

  const handleOpenConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfigOpen(true);
  };

  return (
    <>
      <Card 
        className={cn(
          "group relative flex flex-col cursor-pointer transition-all duration-300",
          "border-l-4",
          subProcess.is_mandatory ? "border-l-warning" : "border-l-secondary",
          "hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1",
          "bg-gradient-to-b from-card to-card/95"
        )}
        onClick={handleOpenConfig}
      >
        {/* Mandatory ribbon */}
        {subProcess.is_mandatory && (
          <div className="absolute -top-0 -right-0 overflow-hidden w-16 h-16">
            <div className="absolute top-3 right-[-20px] bg-warning text-warning-foreground text-[9px] font-bold py-0.5 px-5 rotate-45 shadow-sm">
              REQUIS
            </div>
          </div>
        )}

        {/* Header section */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight pr-4">
              {subProcess.name}
            </h3>
            <div className="shrink-0">
              {getWorkflowIndicator()}
            </div>
          </div>

          {/* Assignment type badge */}
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs font-medium mb-3",
              assignmentInfo.color,
              "border-current/30 bg-current/5"
            )}
          >
            <AssignmentIcon className="h-3 w-3 mr-1" />
            {assignmentInfo.label}
          </Badge>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2 bg-muted/30 rounded-lg p-2.5">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{subProcess.task_templates.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Tâches</div>
            </div>
            <div className="text-center border-l border-border/50">
              <div className="flex justify-center">
                <VisibilityIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {subProcess.visibility_level === 'public' ? 'Public' : 'Privé'}
              </div>
            </div>
          </div>

          {/* Features indicators */}
          {workflowStatus.hasValidation && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-success">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Validation intégrée</span>
            </div>
          )}
        </div>

        {/* Action buttons footer */}
        <div className="mt-auto border-t border-border/50 p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 h-9 text-xs font-medium shadow-sm"
              onClick={handleOpenConfig}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              {canManage ? 'Gérer' : 'Voir'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 w-9 p-0 bg-success/10 border-success/30 text-success hover:bg-success/20 hover:border-success/50"
              onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/subprocess/${subProcess.id}`); }}
              title="Modifier le workflow"
            >
              <Workflow className="h-4 w-4" />
            </Button>
            {canManage && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      <SubProcessConfigView
        subProcessId={subProcess.id}
        open={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onUpdate={() => { onRefresh?.(); }}
        canManage={canManage}
      />
    </>
  );
}
