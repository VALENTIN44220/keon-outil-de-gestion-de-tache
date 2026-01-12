import { useState, useEffect } from 'react';
import { ProcessWithTasks, TaskTemplate } from '@/types/template';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Trash2, Building2, Briefcase, ListTodo, Edit, Layers, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProcessCardProps {
  process: ProcessWithTasks;
  onDelete: () => void;
  onEdit: () => void;
  onViewDetails: () => void;
  onAddTask: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteTask: (taskId: string) => void;
  canManage?: boolean;
}

export function ProcessCard({ process, onDelete, onEdit, onViewDetails, onAddTask, onDeleteTask, canManage = false }: ProcessCardProps) {
  const [subProcessCount, setSubProcessCount] = useState(0);

  useEffect(() => {
    const fetchSubProcessCount = async () => {
      const { count } = await supabase
        .from('sub_process_templates')
        .select('*', { count: 'exact', head: true })
        .eq('process_template_id', process.id);
      
      setSubProcessCount(count || 0);
    };
    fetchSubProcessCount();
  }, [process.id]);

  // Count direct tasks (not in sub-processes)
  const directTaskCount = process.task_templates.filter(t => !t.sub_process_template_id).length;

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
          {process.company && (
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              {process.company}
            </Badge>
          )}
          {process.department && (
            <Badge variant="outline" className="text-xs">
              <Briefcase className="h-3 w-3 mr-1" />
              {process.department}
            </Badge>
          )}
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

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-4"
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
        >
          <Eye className="h-4 w-4 mr-2" />
          {canManage ? 'Gérer le processus' : 'Voir le processus'}
        </Button>
      </CardContent>
    </Card>
  );
}
