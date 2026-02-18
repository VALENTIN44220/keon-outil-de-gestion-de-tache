import { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ClipboardList, 
  MoreHorizontal, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Circle,
  PlayCircle,
  UserPlus,
  Calendar,
  Flag,
  Trash2,
  Pencil,
  Eye,
  GripVertical,
  Plus,
  Tag,
} from 'lucide-react';
import { TaskEditDialog } from './TaskEditDialog';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { KanbanGroupMode } from '@/components/dashboard/DashboardToolbar';

export interface KanbanColumn {
  key: string;
  label: string;
  icon: React.ReactNode;
  headerBg: string;
  headerText: string;
  dotColor: string;
}

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  groupBy?: string;
  groupLabels?: Map<string, string>;
  progressMap?: Record<string, { completed: number; total: number; progress: number }>;
  onTaskUpdated?: () => void;
  assigneeMap?: Map<string, { display_name: string; avatar_url?: string }>;
  kanbanGroupMode?: KanbanGroupMode;
  categoryMap?: Map<string, string>;
}

const statusColumns: { 
  status: TaskStatus; 
  label: string; 
  icon: React.ReactNode;
  headerBg: string;
  headerText: string;
  dotColor: string;
}[] = [
  { 
    status: 'to_assign', 
    label: 'À affecter', 
    icon: <UserPlus className="h-4 w-4" />,
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    dotColor: 'bg-amber-500',
  },
  { 
    status: 'todo', 
    label: 'À faire', 
    icon: <Circle className="h-4 w-4" />,
    headerBg: 'bg-slate-500',
    headerText: 'text-white',
    dotColor: 'bg-slate-500',
  },
  { 
    status: 'in-progress', 
    label: 'En cours', 
    icon: <PlayCircle className="h-4 w-4" />,
    headerBg: 'bg-blue-500',
    headerText: 'text-white',
    dotColor: 'bg-blue-500',
  },
  { 
    status: 'done', 
    label: 'Terminé', 
    icon: <CheckCircle2 className="h-4 w-4" />,
    headerBg: 'bg-green-500',
    headerText: 'text-white',
    dotColor: 'bg-green-500',
  },
];

const priorityConfig = {
  low: { label: 'Basse', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
  medium: { label: 'Moyenne', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  high: { label: 'Haute', color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', dot: 'bg-orange-500' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
};

interface KanbanTaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  taskProgress?: { completed: number; total: number; progress: number };
  onTaskUpdated?: () => void;
  assignee?: { display_name: string; avatar_url?: string };
}

function KanbanTaskCard({ task, onStatusChange, onDelete, taskProgress, onTaskUpdated, assignee }: KanbanTaskCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && task.status !== 'done' && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);
  const isDueTomorrow = dueDate && isTomorrow(dueDate);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDueDate = () => {
    if (!dueDate) return null;
    if (isToday(dueDate)) return "Aujourd'hui";
    if (isTomorrow(dueDate)) return "Demain";
    return format(dueDate, 'd MMM', { locale: fr });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="menuitem"]')) return;
    setIsEditOpen(true);
  };

  const priority = priorityConfig[task.priority];

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('taskId', task.id);
          setIsDragging(true);
        }}
        onDragEnd={() => setIsDragging(false)}
        onClick={handleCardClick}
        className={cn(
          "group bg-card rounded-lg border border-border/60 p-3 cursor-pointer",
          "hover:border-primary/30 hover:shadow-md transition-all duration-200",
          "active:cursor-grabbing",
          isDragging && "opacity-50 rotate-2 scale-105 shadow-xl",
          task.status === 'done' && "opacity-70"
        )}
      >
        {/* Header row with priority and actions */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className={cn("w-2 h-2 rounded-full shrink-0", priority.dot)} />
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-5 font-medium", priority.color)}>
              {priority.label}
            </Badge>
            {task.task_number && (
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                {task.task_number}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in-progress')}>
                <PlayCircle className="h-3.5 w-3.5 mr-2" />
                Démarrer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'done')}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                Terminer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title */}
        <h4 className={cn(
          "text-sm font-medium leading-snug mb-2 line-clamp-2",
          task.status === 'done' && "line-through text-muted-foreground"
        )}>
          {task.title}
        </h4>

        {/* Progress bar if available */}
        {taskProgress && taskProgress.total > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Progression</span>
              <span>{taskProgress.completed}/{taskProgress.total}</span>
            </div>
            <Progress value={taskProgress.progress} className="h-1.5" />
          </div>
        )}

        {/* Footer with due date and assignee */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40">
          {/* Due date */}
          {dueDate ? (
            <div className={cn(
              "flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded",
              isOverdue && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              isDueToday && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
              isDueTomorrow && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              !isOverdue && !isDueToday && !isDueTomorrow && "text-muted-foreground"
            )}>
              {isOverdue && <AlertTriangle className="h-3 w-3" />}
              {!isOverdue && <Calendar className="h-3 w-3" />}
              <span className="font-medium">{formatDueDate()}</span>
            </div>
          ) : (
            <div />
          )}

          {/* Assignee avatar */}
          {assignee ? (
            <Avatar className="h-6 w-6 border-2 border-background shadow-sm">
              <AvatarImage src={assignee.avatar_url} />
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-medium">
                {getInitials(assignee.display_name)}
              </AvatarFallback>
            </Avatar>
          ) : task.status === 'to_assign' ? (
            <div className="h-6 w-6 rounded-full border-2 border-dashed border-amber-400 flex items-center justify-center bg-amber-50 dark:bg-amber-900/20">
              <UserPlus className="h-3 w-3 text-amber-500" />
            </div>
          ) : null}
        </div>
      </div>

      <TaskEditDialog
        task={task}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onTaskUpdated={onTaskUpdated || (() => {})}
      />
    </>
  );
}

export function KanbanBoard({ tasks, onStatusChange, onDelete, groupBy, groupLabels, progressMap, onTaskUpdated, assigneeMap, kanbanGroupMode = 'status', categoryMap }: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Build dynamic columns based on kanbanGroupMode
  const dynamicColumns = useMemo((): KanbanColumn[] => {
    if (kanbanGroupMode === 'status') {
      return statusColumns.map(c => ({ ...c, key: c.status }));
    }

    if (kanbanGroupMode === 'category') {
      const catKeys = new Set<string>();
      tasks.forEach(t => catKeys.add(t.category_id || '__none__'));
      const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'];
      const cols: KanbanColumn[] = [];
      let i = 0;
      catKeys.forEach(key => {
        const label = key === '__none__' ? 'Sans catégorie' : (categoryMap?.get(key) || groupLabels?.get(key) || key);
        const color = colors[i % colors.length];
        cols.push({ key, label, icon: <Tag className="h-4 w-4" />, headerBg: color, headerText: 'text-white', dotColor: color });
        i++;
      });
      return cols;
    }

    if (kanbanGroupMode === 'priority') {
      const priorities: { key: TaskPriority; label: string; color: string }[] = [
        { key: 'urgent', label: 'Urgente', color: 'bg-red-500' },
        { key: 'high', label: 'Haute', color: 'bg-orange-500' },
        { key: 'medium', label: 'Moyenne', color: 'bg-amber-500' },
        { key: 'low', label: 'Basse', color: 'bg-slate-500' },
      ];
      return priorities.map(p => ({
        key: p.key,
        label: p.label,
        icon: <Flag className="h-4 w-4" />,
        headerBg: p.color,
        headerText: 'text-white',
        dotColor: p.color,
      }));
    }

    if (kanbanGroupMode === 'assignee') {
      const assigneeKeys = new Set<string>();
      tasks.forEach(t => assigneeKeys.add(t.assignee_id || '__unassigned__'));
      const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
      const cols: KanbanColumn[] = [];
      let i = 0;
      assigneeKeys.forEach(key => {
        const label = key === '__unassigned__' ? 'Non assigné' : (assigneeMap?.get(key)?.display_name || groupLabels?.get(key) || key);
        const color = colors[i % colors.length];
        cols.push({ key, label, icon: <UserPlus className="h-4 w-4" />, headerBg: color, headerText: 'text-white', dotColor: color });
        i++;
      });
      return cols;
    }

    return statusColumns.map(c => ({ ...c, key: c.status }));
  }, [kanbanGroupMode, tasks, categoryMap, assigneeMap, groupLabels]);

  // Get task's column key based on group mode
  const getTaskColumnKey = (task: Task): string => {
    switch (kanbanGroupMode) {
      case 'category': return task.category_id || '__none__';
      case 'priority': return task.priority;
      case 'assignee': return task.assignee_id || '__unassigned__';
      default: return task.status;
    }
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(columnKey);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && kanbanGroupMode === 'status') {
      // Only allow drag-drop status changes in status mode
      onStatusChange(taskId, columnKey as TaskStatus);
    }
  };

  const getAssignee = (task: Task) => {
    if (!task.assignee_id || !assigneeMap) return undefined;
    return assigneeMap.get(task.assignee_id);
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ClipboardList className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Aucune tâche trouvée</h3>
        <p className="text-sm text-muted-foreground">
          Modifiez vos filtres ou créez une nouvelle tâche
        </p>
      </div>
    );
  }

  const renderColumn = (column: KanbanColumn, columnTasks: Task[]) => {
    const isDropTarget = dragOverColumn === column.key;
    const canDrop = kanbanGroupMode === 'status';
    
    return (
      <div
        key={column.key}
        className={cn(
          "flex flex-col rounded-xl bg-muted/30 border border-border/50 min-h-[400px] transition-all duration-200",
          isDropTarget && canDrop && "ring-2 ring-primary/50 bg-primary/5"
        )}
        onDragOver={(e) => handleDragOver(e, column.key)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.key)}
      >
        {/* Column header */}
        <div className={cn(
          "flex items-center justify-between px-3 py-2.5 rounded-t-xl",
          column.headerBg, column.headerText
        )}>
          <div className="flex items-center gap-2">
            {column.icon}
            <span className="font-semibold text-sm truncate">{column.label}</span>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs font-bold px-2">
            {columnTasks.length}
          </Badge>
        </div>

        {/* Tasks list */}
        <ScrollArea className="flex-1 px-2 py-2">
          <div className="space-y-2 pb-2">
            {columnTasks.map(task => (
              <KanbanTaskCard
                key={task.id}
                task={task}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                taskProgress={progressMap?.[task.id]}
                onTaskUpdated={onTaskUpdated}
                assignee={getAssignee(task)}
              />
            ))}
            
            {/* Empty state for column */}
            {columnTasks.length === 0 && (
              <div className={cn(
                "flex flex-col items-center justify-center py-8 text-center rounded-lg border-2 border-dashed",
                isDropTarget && canDrop ? "border-primary bg-primary/5" : "border-border/50"
              )}>
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", column.headerBg + "/10")}>
                  {column.icon}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isDropTarget && canDrop ? "Déposer ici" : "Aucune tâche"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // Default: dynamic columns based on group mode
  const gridCols = dynamicColumns.length <= 4 
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' 
    : dynamicColumns.length <= 6 
      ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-6'
      : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';

  return (
    <div className={cn("grid gap-4", gridCols)}>
      {dynamicColumns.map((column) => {
        const columnTasks = tasks.filter(t => getTaskColumnKey(t) === column.key);
        return renderColumn(column, columnTasks);
      })}
    </div>
  );
}
