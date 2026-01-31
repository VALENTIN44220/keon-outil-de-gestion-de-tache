import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubProcessWithTasks, TaskTemplate, VISIBILITY_LABELS, TemplateVisibility } from '@/types/template';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, Users, User, UserCog, Workflow, ListTodo, 
  Lock, Building2, Globe, Eye, CheckCircle, Layers
} from 'lucide-react';
import { SubProcessConfigView } from './SubProcessConfigView';
import { supabase } from '@/integrations/supabase/client';

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

const assignmentTypeLabels: Record<string, { label: string; icon: any }> = {
  manager: { label: 'Par manager', icon: Users },
  role: { label: 'Par poste', icon: UserCog },
  user: { label: 'Utilisateur', icon: User },
  group: { label: 'Groupe', icon: Users },
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

  const AssignmentIcon = assignmentTypeLabels[subProcess.assignment_type]?.icon || Users;
  const VisibilityIcon = visibilityIcons[subProcess.visibility_level] || Globe;

  // Get workflow status badge
  const getWorkflowBadge = () => {
    if (workflowStatus.status === 'active') {
      return <Badge className="bg-success/20 text-success border-success/30 text-[10px] px-1.5 py-0">Actif</Badge>;
    } else if (workflowStatus.status === 'draft') {
      return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0">Brouillon</Badge>;
    }
    return null;
  };

  const handleOpenConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfigOpen(true);
  };

  return (
    <>
      <Card 
        className="flex flex-col cursor-pointer hover:shadow-md transition-all hover:border-primary/30 bg-card"
        onClick={handleOpenConfig}
      >
        <CardContent className="p-3 space-y-2">
          {/* Header: Name + Workflow Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{subProcess.name}</h3>
                {getWorkflowBadge()}
                {subProcess.is_mandatory && (
                  <Badge variant="default" className="bg-primary/80 text-[10px] px-1.5 py-0">
                    <Lock className="h-3 w-3 mr-0.5" />
                    Obligatoire
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Meta info row */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <AssignmentIcon className="h-3 w-3" />
              {assignmentTypeLabels[subProcess.assignment_type]?.label}
            </span>
            <span className="flex items-center gap-1">
              <ListTodo className="h-3 w-3" />
              {subProcess.task_templates.length} tâche(s)
            </span>
            <span className="flex items-center gap-1">
              <VisibilityIcon className="h-3 w-3" />
              {subProcess.visibility_level === 'public' ? 'Public' : 'Privé'}
            </span>
            {workflowStatus.hasValidation && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle className="h-3 w-3" />
                Validation
              </span>
            )}
          </div>

          {/* Action buttons - MAX 3 buttons like ProcessCard */}
          <div className="flex items-center gap-1.5 pt-1">
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 px-2.5 text-xs"
              onClick={handleOpenConfig}
            >
              <Eye className="h-3 w-3 mr-1" />
              {canManage ? 'Gérer' : 'Voir'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2.5 text-xs bg-success/10 border-success/30 text-success hover:bg-success/20"
              onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/subprocess/${subProcess.id}`); }}
            >
              <Workflow className="h-3 w-3 mr-1" />
              Workflow
            </Button>
            {canManage && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
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
