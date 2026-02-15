import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProcessWithTasks, TaskTemplate, VISIBILITY_LABELS, TemplateVisibility } from '@/types/template';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Building2, Briefcase, ListTodo, Eye, Lock, Users, Globe, Workflow, CheckCircle, Layers, ArrowRight, FolderKanban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ProcessCardProps {
  process: ProcessWithTasks;
  onDelete: () => void;
  onEdit: () => void;
  onViewDetails: () => void;
  onAddTask: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteTask: (taskId: string) => void;
  canManage?: boolean;
  compact?: boolean;
}

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

export function ProcessCard({ process, onDelete, onViewDetails, canManage = false, compact = false }: ProcessCardProps) {
  const navigate = useNavigate();
  const [subProcessCount, setSubProcessCount] = useState(0);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>({ status: 'none', nodeCount: 0, hasValidation: false });
  const [serviceGroupName, setServiceGroupName] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch sub-process count and their target departments
      const { data: subProcesses } = await supabase
        .from('sub_process_templates')
        .select('id, target_department_id, departments:target_department_id(name)')
        .eq('process_template_id', process.id);
      
      setSubProcessCount(subProcesses?.length || 0);
      
      // Extract unique department names from sub-processes
      if (subProcesses) {
        const uniqueDepts = new Set<string>();
        subProcesses.forEach(sp => {
          const deptData = sp.departments as any;
          if (deptData?.name) {
            uniqueDepts.add(deptData.name);
          }
        });
        setTargetDepartments(Array.from(uniqueDepts));
      }

      // Fetch workflow status
      const { data: workflowData } = await supabase
        .from('workflow_templates')
        .select('id, status, workflow_nodes(id, type)')
        .eq('process_template_id', process.id)
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

      // Fetch service group name
      if ((process as any).service_group_id) {
        const { data: sgData } = await (supabase as any)
          .from('service_groups')
          .select('name')
          .eq('id', (process as any).service_group_id)
          .maybeSingle();
        if (sgData) setServiceGroupName(sgData.name);
      }
    };
    fetchData();
  }, [process.id]);

  const directTaskCount = process.task_templates.filter(t => !t.sub_process_template_id).length;
  const VisibilityIcon = visibilityIcons[process.visibility_level] || Globe;
  const totalTasks = subProcessCount + directTaskCount;

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

  // Compact list view (horizontal)
  if (compact) {
    return (
      <Card 
        className={cn(
          "group flex items-center gap-4 p-4 cursor-pointer transition-all duration-200",
          "border-l-4 border-l-primary/60 hover:border-l-primary",
          "hover:shadow-lg hover:shadow-primary/5 bg-card"
        )}
        onClick={() => navigate(`/templates/process/${process.id}`)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
              {process.name}
            </span>
            {getWorkflowIndicator()}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1.5">
            {serviceGroupName && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-accent/50 border-accent font-medium">
                <FolderKanban className="h-3 w-3 mr-1" />
                {serviceGroupName}
              </Badge>
            )}
            {process.company && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {process.company}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {subProcessCount} sous-proc.
            </span>
            <span className="flex items-center gap-1">
              <ListTodo className="h-3 w-3" />
              {totalTasks} tâche(s)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="default" 
            size="sm" 
            className="h-8 px-3 text-xs shadow-sm"
            onClick={(e) => { e.stopPropagation(); navigate(`/templates/process/${process.id}`); }}
          >
            Gérer
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0 bg-success/10 border-success/30 text-success hover:bg-success/20"
            onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/process/${process.id}`); }}
          >
            <Workflow className="h-4 w-4" />
          </Button>
          {canManage && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Grid card view (default)
  return (
    <Card 
      className={cn(
        "group relative flex flex-col cursor-pointer transition-all duration-300",
        "border-t-4 border-t-primary/60 hover:border-t-primary",
        "hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1",
        "bg-gradient-to-b from-card to-card/95"
      )}
      onClick={() => navigate(`/templates/process/${process.id}`)}
    >
      {/* Header section */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
            {process.name}
          </h3>
          <div className="shrink-0">
            {getWorkflowIndicator()}
          </div>
        </div>

        {/* Service group badge */}
        {serviceGroupName && (
          <Badge 
            variant="outline" 
            className="bg-accent/50 border-accent text-xs font-medium mb-2"
          >
            <FolderKanban className="h-3 w-3 mr-1" />
            {serviceGroupName}
          </Badge>
        )}

        {/* Department badge if available */}
        {targetDepartments.length > 0 && (
          <Badge 
            variant="secondary" 
            className="bg-info/15 text-info border-info/20 text-xs font-medium mb-3"
          >
            <Briefcase className="h-3 w-3 mr-1" />
            {targetDepartments[0]}
            {targetDepartments.length > 1 && ` +${targetDepartments.length - 1}`}
          </Badge>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 bg-muted/30 rounded-lg p-2.5">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{subProcessCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Sous-proc.</div>
          </div>
          <div className="text-center border-x border-border/50">
            <div className="text-lg font-bold text-foreground">{totalTasks}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Tâches</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center">
              <VisibilityIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {process.visibility_level === 'public' ? 'Public' : 'Privé'}
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
            onClick={(e) => { e.stopPropagation(); navigate(`/templates/process/${process.id}`); }}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            {canManage ? 'Gérer' : 'Voir'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 w-9 p-0 bg-success/10 border-success/30 text-success hover:bg-success/20 hover:border-success/50"
            onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/process/${process.id}`); }}
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
  );
}
