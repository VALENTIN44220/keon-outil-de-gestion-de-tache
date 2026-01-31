import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Task } from '@/types/task';
import { WorkloadSlot } from '@/types/workload';
import { 
  CheckSquare, 
  Square, 
  X, 
  MoveHorizontal, 
  UserPlus,
  Play,
  CheckCircle2,
  Trash2,
  MoreHorizontal,
  Calendar,
  Copy,
  ArrowRight
} from 'lucide-react';

interface SelectedTask {
  task: Task;
  slots: WorkloadSlot[];
  userId: string;
}

interface GanttMultiSelectContextValue {
  selectedTasks: Map<string, SelectedTask>;
  isSelecting: boolean;
  toggleSelection: (task: Task, slots: WorkloadSlot[], userId: string) => void;
  selectAll: (tasks: SelectedTask[]) => void;
  clearSelection: () => void;
  isSelected: (taskId: string) => boolean;
  startSelecting: () => void;
  stopSelecting: () => void;
}

export function useGanttMultiSelect(): GanttMultiSelectContextValue {
  const [selectedTasks, setSelectedTasks] = useState<Map<string, SelectedTask>>(new Map());
  const [isSelecting, setIsSelecting] = useState(false);
  
  const toggleSelection = useCallback((task: Task, slots: WorkloadSlot[], userId: string) => {
    setSelectedTasks(prev => {
      const newMap = new Map(prev);
      if (newMap.has(task.id)) {
        newMap.delete(task.id);
      } else {
        newMap.set(task.id, { task, slots, userId });
      }
      return newMap;
    });
  }, []);
  
  const selectAll = useCallback((tasks: SelectedTask[]) => {
    setSelectedTasks(new Map(tasks.map(t => [t.task.id, t])));
  }, []);
  
  const clearSelection = useCallback(() => {
    setSelectedTasks(new Map());
    setIsSelecting(false);
  }, []);
  
  const isSelected = useCallback((taskId: string) => {
    return selectedTasks.has(taskId);
  }, [selectedTasks]);
  
  const startSelecting = useCallback(() => {
    setIsSelecting(true);
  }, []);
  
  const stopSelecting = useCallback(() => {
    setIsSelecting(false);
    setSelectedTasks(new Map());
  }, []);
  
  return {
    selectedTasks,
    isSelecting,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    startSelecting,
    stopSelecting,
  };
}

// Floating action bar for multi-selection
interface GanttMultiSelectBarProps {
  selectedTasks: Map<string, SelectedTask>;
  onClearSelection: () => void;
  onBulkMove: (offset: number) => Promise<void>;
  onBulkReassign: (newUserId: string) => Promise<void>;
  onBulkStatusChange: (newStatus: string) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  isProcessing: boolean;
}

export function GanttMultiSelectBar({
  selectedTasks,
  onClearSelection,
  onBulkMove,
  onBulkReassign,
  onBulkStatusChange,
  onBulkDelete,
  isProcessing,
}: GanttMultiSelectBarProps) {
  if (selectedTasks.size === 0) return null;
  
  const taskCount = selectedTasks.size;
  
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-4">
        {/* Selection count */}
        <div className="flex items-center gap-2 pr-4 border-r border-white/20">
          <Badge className="bg-primary text-white font-bold">
            {taskCount}
          </Badge>
          <span className="text-sm font-medium">
            tâche{taskCount > 1 ? 's' : ''} sélectionnée{taskCount > 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Quick actions */}
        <div className="flex items-center gap-1.5">
          {/* Move actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
                disabled={isProcessing}
              >
                <MoveHorizontal className="h-4 w-4" />
                <span className="text-xs">Déplacer</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuItem onClick={() => onBulkMove(-7)}>
                <Calendar className="h-4 w-4 mr-2" />
                -1 semaine
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkMove(-1)}>
                <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                -1 jour
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onBulkMove(1)}>
                <ArrowRight className="h-4 w-4 mr-2" />
                +1 jour
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkMove(7)}>
                <Calendar className="h-4 w-4 mr-2" />
                +1 semaine
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Status change */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
                disabled={isProcessing}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">Statut</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuItem onClick={() => onBulkStatusChange('todo')}>
                <div className="w-3 h-3 rounded-full bg-slate-500 mr-2" />
                À faire
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkStatusChange('in-progress')}>
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                En cours
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkStatusChange('done')}>
                <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2" />
                Terminée
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Delete */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/20 gap-1.5"
            disabled={isProcessing}
            onClick={onBulkDelete}
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-xs">Retirer</span>
          </Button>
        </div>
        
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 ml-2 text-white/60 hover:text-white hover:bg-white/10"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Checkbox overlay for task selection
interface TaskSelectionCheckboxProps {
  isSelected: boolean;
  isSelecting: boolean;
  onToggle: () => void;
}

export function TaskSelectionCheckbox({
  isSelected,
  isSelecting,
  onToggle,
}: TaskSelectionCheckboxProps) {
  if (!isSelecting) return null;
  
  return (
    <button
      className={cn(
        "absolute -left-1 -top-1 z-10 w-5 h-5 rounded flex items-center justify-center transition-all",
        isSelected 
          ? "bg-primary text-white shadow-md" 
          : "bg-white border border-keon-300 text-transparent hover:border-primary"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {isSelected ? (
        <CheckSquare className="h-3.5 w-3.5" />
      ) : (
        <Square className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
