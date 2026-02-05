import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Clock, User, MoreVertical, Trash2, ChevronDown, ChevronRight, ListChecks, FileText, Eye, Building2, Pencil } from 'lucide-react';
import { Task, TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { TaskChecklist } from './TaskChecklist';
import { TaskProgressBadge } from './TaskProgressBadge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CreateTemplateFromTaskDialog } from './CreateTemplateFromTaskDialog';
import { TaskDetailDialog } from './TaskDetailDialog';
import { TaskEditDialog } from './TaskEditDialog';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  compact?: boolean;
  taskProgress?: { completed: number; total: number; progress: number };
  onTaskUpdated?: () => void;
}

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  urgent: 'bg-destructive text-destructive-foreground',
};

const priorityLabels = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

const statusColors: Record<string, string> = {
  to_assign: 'bg-orange-500/20',
  todo: 'bg-muted',
  'in-progress': 'bg-info',
  done: 'bg-success',
};

const statusLabels: Record<string, string> = {
  to_assign: 'À affecter',
  todo: 'À faire',
  'in-progress': 'En cours',
  done: 'Terminé',
};

export function TaskCard({ task, onStatusChange, onDelete, compact = false, taskProgress, onTaskUpdated }: TaskCardProps) {
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';
  const isRequest = task.type === 'request';
  const isAssignmentTask = task.is_assignment_task;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open edit if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="menuitem"]') || target.closest('input') || target.closest('a')) {
      return;
    }
    setIsEditOpen(true);
  };

  return (
    <div 
      className={cn(
        "bg-card rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200 animate-slide-up border border-border/50 cursor-pointer",
        compact ? "p-3" : "p-4"
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className={cn("w-2 h-2 rounded-full", statusColors[task.status])} />
            {/* Display task number if available */}
            {task.task_number && (
              <Badge variant="outline" className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                {task.task_number}
              </Badge>
            )}
            {/* Display request number if this is a request without task_number */}
            {!task.task_number && task.request_number && (
              <Badge variant="outline" className="text-[10px] font-mono bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-600">
                {task.request_number}
              </Badge>
            )}
            {isAssignmentTask && (
              <Badge className="text-xs flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white">
                <UserPlus className="h-3 w-3" />
                À affecter
              </Badge>
            )}
            {isRequest && !isAssignmentTask && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Demande
              </Badge>
            )}
            <Badge variant="outline" className={cn("text-xs", priorityColors[task.priority])}>
              {priorityLabels[task.priority]}
            </Badge>
            {taskProgress && taskProgress.total > 0 && (
              <TaskProgressBadge 
                progress={taskProgress.progress} 
                completed={taskProgress.completed} 
                total={taskProgress.total} 
              />
            )}
          </div>

          {/* Title */}
          <h3 
            className={cn(
              "font-medium text-foreground",
              compact ? "text-sm mb-0.5" : "mb-1",
              task.status === 'done' && "line-through text-muted-foreground"
            )}
          >
            {task.title}
            <Pencil className="inline-block ml-2 h-3 w-3 opacity-30" />
          </h3>

          {/* Description */}
          {task.description && !compact && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {task.description}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {task.category && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{task.category}</span>
              </div>
            )}
            {dueDate && (
              <div className={cn(
                "flex items-center gap-1.5",
                isOverdue && "text-destructive"
              )}>
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {dueDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
            {!compact && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setIsChecklistOpen(!isChecklistOpen)}
              >
                <ListChecks className="w-3.5 h-3.5 mr-1" />
                Sous-actions
                {isChecklistOpen ? (
                  <ChevronDown className="w-3 h-3 ml-1" />
                ) : (
                  <ChevronRight className="w-3 h-3 ml-1" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onStatusChange(task.id, 'todo')}>
              <div className={cn("w-2 h-2 rounded-full mr-2", statusColors.todo)} />
              {statusLabels.todo}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in-progress')}>
              <div className={cn("w-2 h-2 rounded-full mr-2", statusColors['in-progress'])} />
              {statusLabels['in-progress']}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(task.id, 'done')}>
              <div className={cn("w-2 h-2 rounded-full mr-2", statusColors.done)} />
              {statusLabels.done}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsTemplateDialogOpen(true)}>
              <FileText className="w-4 h-4 mr-2" />
              Créer un modèle
            </DropdownMenuItem>
            {isRequest && (
              <DropdownMenuItem onClick={() => setIsDetailOpen(true)}>
                <Eye className="w-4 h-4 mr-2" />
                Voir les détails
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task.id)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Checklist section */}
      {!compact && isChecklistOpen && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <TaskChecklist taskId={task.id} />
        </div>
      )}

      {/* Create template dialog */}
      <CreateTemplateFromTaskDialog
        open={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        task={task}
      />

      {/* Task detail dialog for requests */}
      <TaskDetailDialog
        task={task}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onStatusChange={onStatusChange}
      />

      {/* Task edit dialog */}
      <TaskEditDialog
        task={task}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onTaskUpdated={onTaskUpdated || (() => {})}
      />
    </div>
  );
}
