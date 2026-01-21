import { TaskScope } from '@/hooks/useTaskScope';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { User, Users, Building2 } from 'lucide-react';

interface ScopeOption {
  value: TaskScope;
  label: string;
}

interface TaskScopeSelectorProps {
  scope: TaskScope;
  availableScopes: ScopeOption[];
  onScopeChange: (scope: TaskScope) => void;
}

const scopeIcons: Record<TaskScope, React.ElementType> = {
  my_tasks: User,
  department_tasks: Users,
  all_tasks: Building2,
};

export function TaskScopeSelector({ scope, availableScopes, onScopeChange }: TaskScopeSelectorProps) {
  // Don't show if only one scope available
  if (availableScopes.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Périmètre:</span>
      <div className="flex bg-muted rounded-lg p-1">
        {availableScopes.map((option) => {
          const Icon = scopeIcons[option.value];
          return (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => onScopeChange(option.value)}
              className={cn(
                "text-xs px-3 py-1 h-auto rounded-md transition-all gap-1.5",
                scope === option.value 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
