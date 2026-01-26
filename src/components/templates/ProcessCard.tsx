import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProcessWithTasks, TaskTemplate, VISIBILITY_LABELS, TemplateVisibility } from '@/types/template';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Trash2, Building2, Briefcase, ListTodo, Edit, Layers, Eye, Lock, Users, Globe, Workflow } from 'lucide-react';
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

export function ProcessCard({ process, onDelete, onEdit, onViewDetails, onAddTask, onDeleteTask, canManage = false, compact = false }: ProcessCardProps) {
  const navigate = useNavigate();
  const [subProcessCount, setSubProcessCount] = useState(0);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);

  useEffect(() => {
    const fetchSubProcessData = async () => {
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
    };
    fetchSubProcessData();
  }, [process.id]);

  const directTaskCount = process.task_templates.filter(t => !t.sub_process_template_id).length;
  const VisibilityIcon = visibilityIcons[process.visibility_level] || Globe;

  if (compact) {
    return (
      <Card 
        className="flex items-center gap-3 p-3 cursor-pointer hover:shadow-md transition-shadow"
        onClick={onViewDetails}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{process.name}</span>
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
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Card>
    );
  }

  return (
    <Card 
      className="flex flex-col cursor-pointer hover:shadow-md transition-shadow"
      onClick={onViewDetails}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{process.name}</CardTitle>
            {process.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {process.description}
              </CardDescription>
            )}
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
                  <Eye className="h-4 w-4 mr-2" />
                  Voir les détails
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/process/${process.id}`); }}>
                  <Workflow className="h-4 w-4 mr-2" />
                  Éditer le workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className="text-xs">
            <VisibilityIcon className="h-3 w-3 mr-1" />
            {VISIBILITY_LABELS[process.visibility_level as TemplateVisibility]}
          </Badge>
          {process.company && (
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              {process.company}
            </Badge>
          )}
          {targetDepartments.length > 0 && targetDepartments.map(dept => (
            <Badge key={dept} variant="secondary" className="text-xs">
              <Briefcase className="h-3 w-3 mr-1" />
              {dept}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            <span>{subProcessCount} sous-processus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ListTodo className="h-4 w-4" />
            <span>{directTaskCount} tâche(s)</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          >
            <Eye className="h-4 w-4 mr-2" />
            {canManage ? 'Gérer' : 'Voir'}
          </Button>
          {canManage && (
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1"
              onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/process/${process.id}`); }}
            >
              <Workflow className="h-4 w-4 mr-2" />
              Workflow
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
