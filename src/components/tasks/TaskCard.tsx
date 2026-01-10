import { Clock, User, MoreVertical, Trash2, Edit } from 'lucide-react';
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

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
}

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
};

const priorityLabels = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
};

const statusColors = {
  todo: 'bg-muted',
  in_progress: 'bg-info',
  done: 'bg-success',
};

const statusLabels = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
};

export function TaskCard({ task, onStatusChange, onDelete }: TaskCardProps) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';

  return (
    <div className="bg-card rounded-xl p-4 shadow-card hover:shadow-card-hover transition-all duration-200 animate-slide-up border border-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className={cn("w-2 h-2 rounded-full", statusColors[task.status])} />
            <Badge variant="outline" className={cn("text-xs", priorityColors[task.priority])}>
              {priorityLabels[task.priority]}
            </Badge>
          </div>

          {/* Title */}
          <h3 className={cn(
            "font-medium text-foreground mb-1",
            task.status === 'done' && "line-through text-muted-foreground"
          )}>
            {task.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {task.description}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {task.assignee && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{task.assignee}</span>
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
            <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
              <div className={cn("w-2 h-2 rounded-full mr-2", statusColors.in_progress)} />
              {statusLabels.in_progress}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(task.id, 'done')}>
              <div className={cn("w-2 h-2 rounded-full mr-2", statusColors.done)} />
              {statusLabels.done}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task.id)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
