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
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
      {/* Status filter */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground shrink-0">Statut:</span>
        <div className="flex flex-wrap bg-muted rounded-lg p-1 gap-0.5">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => {
                const filterValue = option.value === 'pending_validation' 
                  ? 'pending_validation_1' as TaskStatus 
                  : option.value as TaskStatus | 'all';
                onStatusChange(filterValue);
              }}
              className={cn(
                "text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 h-auto rounded-md transition-all",
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
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground shrink-0">Priorité:</span>
        <div className="flex flex-wrap bg-muted rounded-lg p-1 gap-0.5">
          {priorityOptions.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => onPriorityChange(option.value)}
              className={cn(
                "text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 h-auto rounded-md transition-all",
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
