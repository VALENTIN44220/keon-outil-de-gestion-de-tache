import { TaskScope } from '@/hooks/useTaskScope';
import { TaskView } from '@/components/tasks/TaskViewSelector';
import { TaskStatus, TaskPriority } from '@/types/task';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { User, Users, Building2, LayoutGrid, Columns, Calendar, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ScopeOption {
  value: TaskScope;
  label: string;
}

interface DashboardToolbarProps {
  // Scope
  scope: TaskScope;
  availableScopes: ScopeOption[];
  onScopeChange: (scope: TaskScope) => void;
  // View
  currentView: TaskView;
  onViewChange: (view: TaskView) => void;
  // Status & Priority filters
  statusFilter: TaskStatus | 'all';
  priorityFilter: TaskPriority | 'all';
  onStatusChange: (status: TaskStatus | 'all') => void;
  onPriorityChange: (priority: TaskPriority | 'all') => void;
  // Toggle advanced filters
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  hasActiveAdvancedFilters: boolean;
}

const scopeIcons: Record<TaskScope, React.ElementType> = {
  my_tasks: User,
  department_tasks: Users,
  all_tasks: Building2,
};

const viewOptions: { value: TaskView; label: string; icon: React.ElementType }[] = [
  { value: 'grid', label: 'Grille', icon: LayoutGrid },
  { value: 'kanban', label: 'Kanban', icon: Columns },
  { value: 'calendar', label: 'Calendrier', icon: Calendar },
];

const statusOptions: { value: TaskStatus | 'all'; label: string; color?: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'todo', label: 'À faire', color: 'bg-keon-orange' },
  { value: 'in-progress', label: 'En cours', color: 'bg-keon-blue' },
  { value: 'done', label: 'Terminé', color: 'bg-keon-green' },
];

const priorityOptions: { value: TaskPriority | 'all'; label: string; color?: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-500' },
  { value: 'high', label: 'Haute', color: 'bg-keon-terose' },
  { value: 'medium', label: 'Moyenne', color: 'bg-keon-orange' },
  { value: 'low', label: 'Basse', color: 'bg-keon-500' },
];

export function DashboardToolbar({
  scope,
  availableScopes,
  onScopeChange,
  currentView,
  onViewChange,
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  hasActiveAdvancedFilters,
}: DashboardToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-keon-50 rounded-sm border border-keon-300 mb-4">
      {/* Scope selector */}
      {availableScopes.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-keon-700 hidden sm:inline">Périmètre:</span>
          <div className="flex bg-white rounded-sm border border-keon-300 p-0.5">
            {availableScopes.map((option) => {
              const Icon = scopeIcons[option.value];
              return (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => onScopeChange(option.value)}
                  className={cn(
                    "text-xs px-2 py-1 h-7 rounded-sm transition-all gap-1",
                    scope === option.value 
                      ? "bg-keon-900 text-white shadow-keon-sm" 
                      : "text-keon-700 hover:text-keon-900 hover:bg-keon-100"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="h-6 w-px bg-keon-300 hidden sm:block" />

      {/* View selector */}
      <div className="flex bg-white rounded-sm border border-keon-300 p-0.5">
        {viewOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => onViewChange(option.value)}
              className={cn(
                "text-xs px-2 py-1 h-7 rounded-sm transition-all gap-1",
                currentView === option.value 
                  ? "bg-keon-blue text-white shadow-keon-sm" 
                  : "text-keon-700 hover:text-keon-900 hover:bg-keon-100"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{option.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-keon-300 hidden sm:block" />

      {/* Status filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-keon-700 hidden lg:inline">Statut:</span>
        <div className="flex bg-white rounded-sm border border-keon-300 p-0.5">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(option.value)}
              className={cn(
                "text-xs px-2 py-1 h-7 rounded-sm transition-all gap-1",
                statusFilter === option.value 
                  ? "bg-keon-900 text-white shadow-keon-sm" 
                  : "text-keon-700 hover:text-keon-900 hover:bg-keon-100"
              )}
            >
              {option.color && <span className={cn("w-2 h-2 rounded-full", option.color)} />}
              <span className="hidden xl:inline">{option.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-keon-700 hidden lg:inline">Priorité:</span>
        <div className="flex bg-white rounded-sm border border-keon-300 p-0.5">
          {priorityOptions.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => onPriorityChange(option.value)}
              className={cn(
                "text-xs px-2 py-1 h-7 rounded-sm transition-all gap-1",
                priorityFilter === option.value 
                  ? "bg-keon-900 text-white shadow-keon-sm" 
                  : "text-keon-700 hover:text-keon-900 hover:bg-keon-100"
              )}
            >
              {option.color && <span className={cn("w-2 h-2 rounded-full", option.color)} />}
              <span className="hidden xl:inline">{option.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Advanced filters toggle */}
      <Button
        variant={showAdvancedFilters ? "default" : "outline"}
        size="sm"
        onClick={onToggleAdvancedFilters}
        className={cn(
          "h-7 text-xs gap-1.5",
          showAdvancedFilters 
            ? "bg-keon-blue text-white hover:bg-keon-blue/90" 
            : "border-keon-300 text-keon-700 hover:bg-keon-100"
        )}
      >
        {showAdvancedFilters ? <X className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
        Filtres
        {hasActiveAdvancedFilters && !showAdvancedFilters && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-keon-orange text-white">
            •
          </Badge>
        )}
      </Button>
    </div>
  );
}
