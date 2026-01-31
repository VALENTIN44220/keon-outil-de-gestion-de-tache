import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProcessWithTasks, TaskTemplate, VISIBILITY_LABELS, TemplateVisibility } from '@/types/template';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Building2, Briefcase, ListTodo, Eye, Lock, Users, Globe, Workflow, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
    };
    fetchData();
  }, [process.id]);

  const directTaskCount = process.task_templates.filter(t => !t.sub_process_template_id).length;
  const VisibilityIcon = visibilityIcons[process.visibility_level] || Globe;

  // Get workflow status badge
  const getWorkflowBadge = () => {
    if (workflowStatus.status === 'active') {
      return <Badge className="bg-success/20 text-success border-success/30 text-[10px] px-1.5 py-0">Actif</Badge>;
    } else if (workflowStatus.status === 'draft') {
      return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0">Brouillon</Badge>;
    }
    return null;
  };

  // Compact list view (horizontal) - Simplified to 3 buttons max
  if (compact) {
    return (
      <Card 
        className="flex items-center gap-3 p-3 cursor-pointer hover:shadow-md transition-shadow"
        onClick={onViewDetails}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{process.name}</span>
            {getWorkflowBadge()}
            <Badge variant="outline" className="text-xs shrink-0">
              <VisibilityIcon className="h-3 w-3 mr-1" />
              {VISIBILITY_LABELS[process.visibility_level as TemplateVisibility]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {process.company && <span>{process.company}</span>}
            <span>{subProcessCount} sous-proc.</span>
            <span>{directTaskCount} tâche(s)</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="default" 
            size="sm" 
            className="h-7 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          >
            <Eye className="h-3 w-3 mr-1" />
            Gérer
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 px-2 text-xs bg-success/10 border-success/30 text-success hover:bg-success/20"
            onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/process/${process.id}`); }}
          >
            <Workflow className="h-3 w-3" />
          </Button>
          {canManage && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Grid card view (default) - Simplified to 3 action buttons max
  return (
    <Card 
      className="flex flex-col cursor-pointer hover:shadow-md transition-all hover:border-primary/30 bg-card"
      onClick={onViewDetails}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: Name + Workflow Badge + Target Dept */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{process.name}</h3>
              {getWorkflowBadge()}
              {targetDepartments.length > 0 && (
                <Badge variant="secondary" className="bg-info/20 text-info border-info/30 text-[10px] px-1.5 py-0 shrink-0">
                  {targetDepartments[0]}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Meta info row */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          {process.department && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Par {process.department.toLowerCase()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ListTodo className="h-3 w-3" />
            {subProcessCount + directTaskCount} tâche(s)
          </span>
          <span className="flex items-center gap-1">
            <VisibilityIcon className="h-3 w-3" />
            {process.visibility_level === 'public' ? 'Public' : 'Privé'}
          </span>
          {workflowStatus.hasValidation && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle className="h-3 w-3" />
              Validation
            </span>
          )}
        </div>

        {/* Action buttons - MAX 3 buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <Button 
            variant="default" 
            size="sm" 
            className="h-7 px-2.5 text-xs"
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          >
            <Eye className="h-3 w-3 mr-1" />
            {canManage ? 'Gérer' : 'Voir'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 px-2.5 text-xs bg-success/10 border-success/30 text-success hover:bg-success/20"
            onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/process/${process.id}`); }}
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
  );
}
