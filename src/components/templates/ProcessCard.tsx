import { useState } from 'react';
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
import { MoreVertical, Plus, Trash2, Building2, Briefcase, ListTodo, Edit, ChevronDown, ChevronRight } from 'lucide-react';
import { AddTaskTemplateDialog } from './AddTaskTemplateDialog';
import { TemplateChecklistEditor } from './TemplateChecklistEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ProcessCardProps {
  process: ProcessWithTasks;
  onDelete: () => void;
  onEdit: () => void;
  onAddTask: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteTask: (taskId: string) => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export function ProcessCard({ process, onDelete, onEdit, onAddTask, onDeleteTask }: ProcessCardProps) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  return (
    <>
      <Card className="flex flex-col">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <Badge variant="secondary" className="text-xs">
              <ListTodo className="h-3 w-3 mr-1" />
              {process.task_templates.length} tâche(s)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1">
          <div className="space-y-2">
            {process.task_templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune tâche modèle
              </p>
            ) : (
              process.task_templates.slice(0, 6).map((task, index) => (
                <Collapsible
                  key={task.id}
                  open={expandedTasks.has(task.id)}
                  onOpenChange={() => toggleTaskExpanded(task.id)}
                >
                  <div className="rounded-lg bg-muted/50 overflow-hidden">
                    <div className="flex items-center justify-between p-2">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 flex-1 text-left hover:bg-muted/50 rounded transition-colors">
                          {expandedTasks.has(task.id) ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground w-4">
                            {index + 1}.
                          </span>
                          <span className="text-sm truncate max-w-[120px]">{task.title}</span>
                        </button>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${priorityColors[task.priority]}`}
                        >
                          {task.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onDeleteTask(task.id)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="px-2 pb-2">
                        <TemplateChecklistEditor taskTemplateId={task.id} />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            )}
            {process.task_templates.length > 6 && (
              <p className="text-xs text-muted-foreground text-center">
                +{process.task_templates.length - 6} autres tâches
              </p>
            )}
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-4"
            onClick={() => setIsAddTaskOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une tâche
          </Button>
        </CardContent>
      </Card>

      <AddTaskTemplateDialog
        open={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={onAddTask}
        orderIndex={process.task_templates.length}
      />
    </>
  );
}
