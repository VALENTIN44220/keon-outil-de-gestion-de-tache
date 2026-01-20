import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutGrid, Columns } from 'lucide-react';

export type ProjectView = 'table' | 'kanban';

interface ProjectViewSelectorProps {
  currentView: ProjectView;
  onViewChange: (view: ProjectView) => void;
}

const viewOptions: { value: ProjectView; label: string; icon: React.ElementType }[] = [
  { value: 'table', label: 'Tableau', icon: LayoutGrid },
  { value: 'kanban', label: 'Kanban', icon: Columns },
];

export function ProjectViewSelector({ currentView, onViewChange }: ProjectViewSelectorProps) {
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
