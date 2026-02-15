import { TaskView } from '@/components/tasks/TaskViewSelector';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutGrid, Columns, Calendar, Layers } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type KanbanGroupMode = 'status' | 'category' | 'priority' | 'assignee';

interface DashboardToolbarProps {
  currentView: TaskView;
  onViewChange: (view: TaskView) => void;
  kanbanGroupMode?: KanbanGroupMode;
  onKanbanGroupModeChange?: (mode: KanbanGroupMode) => void;
}

const viewOptions: { value: TaskView; label: string; icon: React.ElementType }[] = [
  { value: 'grid', label: 'Grille', icon: LayoutGrid },
  { value: 'kanban', label: 'Kanban', icon: Columns },
  { value: 'calendar', label: 'Calendrier', icon: Calendar },
];

export function DashboardToolbar({
  currentView,
  onViewChange,
  kanbanGroupMode = 'status',
  onKanbanGroupModeChange,
}: DashboardToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-keon-50 rounded-sm border border-keon-300 mb-4">
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

      {/* Kanban group mode selector */}
      {currentView === 'kanban' && onKanbanGroupModeChange && (
        <>
          <div className="h-6 w-px bg-keon-300 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-keon-700" />
            <Select value={kanbanGroupMode} onValueChange={(v) => onKanbanGroupModeChange(v as KanbanGroupMode)}>
              <SelectTrigger className="h-7 text-xs w-[140px] border-keon-300 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Par statut</SelectItem>
                <SelectItem value="category">Par catégorie</SelectItem>
                <SelectItem value="priority">Par priorité</SelectItem>
                <SelectItem value="assignee">Par assigné</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
