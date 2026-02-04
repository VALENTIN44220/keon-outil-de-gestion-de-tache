import { TaskStatus, TaskPriority } from '@/types/task';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getStatusFilterOptions } from '@/services/taskStatusService';

interface TaskFiltersProps {
  statusFilter: TaskStatus | 'all';
  priorityFilter: TaskPriority | 'all';
  onStatusChange: (status: TaskStatus | 'all') => void;
  onPriorityChange: (priority: TaskPriority | 'all') => void;
}

// Use centralized filter options from taskStatusService
const statusOptions = getStatusFilterOptions();

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
              onClick={() => {
                // Map filter values to TaskStatus | 'all'
                const filterValue = option.value === 'pending_validation' 
                  ? 'pending_validation_1' as TaskStatus 
                  : option.value as TaskStatus | 'all';
                onStatusChange(filterValue);
              }}
              className={cn(
                "text-xs px-3 py-1 h-auto rounded-md transition-all",
                // Check if current filter matches this option
                (statusFilter === option.value || 
                 (option.value === 'pending_validation' && 
                  (statusFilter === 'pending_validation_1' || statusFilter === 'pending_validation_2')))
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
