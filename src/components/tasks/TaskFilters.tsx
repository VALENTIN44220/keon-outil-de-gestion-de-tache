import { TaskStatus, TaskPriority } from '@/types/task';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TaskFiltersProps {
  statusFilter: TaskStatus | 'all';
  priorityFilter: TaskPriority | 'all';
  onStatusChange: (status: TaskStatus | 'all') => void;
  onPriorityChange: (priority: TaskPriority | 'all') => void;
}

const statusOptions: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'to_assign', label: 'À affecter' },
  { value: 'todo', label: 'À faire' },
  { value: 'in-progress', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
];

const priorityOptions: { value: TaskPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Haute' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Basse' },
];

export function TaskFilters({ 
  statusFilter, 
  priorityFilter, 
  onStatusChange, 
  onPriorityChange 
}: TaskFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Statut:</span>
        <div className="flex bg-muted rounded-lg p-1">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(option.value)}
              className={cn(
                "text-xs px-3 py-1 h-auto rounded-md transition-all",
                statusFilter === option.value 
                  ? "bg-card shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Priorité:</span>
        <div className="flex bg-muted rounded-lg p-1">
          {priorityOptions.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => onPriorityChange(option.value)}
              className={cn(
                "text-xs px-3 py-1 h-auto rounded-md transition-all",
                priorityFilter === option.value 
                  ? "bg-card shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
