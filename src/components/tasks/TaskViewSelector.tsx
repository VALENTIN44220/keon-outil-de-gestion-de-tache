import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutGrid, Columns, Calendar, TableProperties } from 'lucide-react';

export type TaskView = 'grid' | 'kanban' | 'calendar' | 'table';

interface TaskViewSelectorProps {
  currentView: TaskView;
  onViewChange: (view: TaskView) => void;
}

const viewOptions: { value: TaskView; label: string; icon: React.ElementType }[] = [
  { value: 'grid', label: 'Grille', icon: LayoutGrid },
  { value: 'kanban', label: 'Kanban', icon: Columns },
  { value: 'calendar', label: 'Calendrier', icon: Calendar },
  { value: 'table', label: 'Tableau', icon: TableProperties },
];

export function TaskViewSelector({ currentView, onViewChange }: TaskViewSelectorProps) {
  return (
    <div className="flex bg-muted rounded-lg p-1">
      {viewOptions.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            onClick={() => onViewChange(option.value)}
            className={cn(
              "text-xs px-3 py-1 h-auto rounded-md transition-all gap-1.5",
              currentView === option.value 
                ? "bg-card shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
