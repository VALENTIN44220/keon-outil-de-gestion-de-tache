import { useState, useMemo } from 'react';
import { Task, TaskStatus } from '@/types/task';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { getStatusFilterOptions, matchesStatusFilter } from '@/services/taskStatusService';

interface CalendarViewProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  groupBy?: string;
  groupLabels?: Map<string, string>;
  progressMap?: Record<string, { completed: number; total: number; progress: number }>;
  onTaskUpdated?: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-destructive',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-green-400',
};

const STATUS_BG: Record<string, string> = {
  todo: 'bg-muted text-muted-foreground border-border',
  'in-progress': 'bg-blue-50 text-blue-700 border-blue-200',
  done: 'bg-green-50 text-green-700 border-green-200 line-through opacity-60',
  validated: 'bg-emerald-50 text-emerald-700 border-emerald-200 opacity-60',
  refused: 'bg-red-50 text-red-700 border-red-200 opacity-60',
  pending_validation_1: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_validation_2: 'bg-amber-50 text-amber-700 border-amber-200',
};

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MAX_VISIBLE_PER_DAY = 3;

const statusFilterOptions = getStatusFilterOptions();

export function CalendarView({ tasks, onStatusChange, onDelete, progressMap, onTaskUpdated }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter(t => matchesStatusFilter(t.status, statusFilter));
  }, [tasks, statusFilter]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach(task => {
      if (task.due_date) {
        const key = task.due_date.split('T')[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
    });
    return map;
  }, [filteredTasks]);

  const tasksWithoutDate = useMemo(() => filteredTasks.filter(t => !t.due_date), [filteredTasks]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  return (
    <div className="flex flex-col h-full">
      {/* Header toolbar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentMonth(new Date())}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-base font-semibold capitalize text-foreground ml-2">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </span>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {statusFilterOptions.map(opt => (
            <Button
              key={opt.value}
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "text-xs h-7 px-2.5 rounded-md",
                statusFilter === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </Button>
          ))}
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="text-[10px] ml-1">
              {filteredTasks.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 border-r border-border last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 border-l border-border">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border" style={{ minHeight: '110px' }}>
            {week.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDate.get(key) || [];
              const visible = dayTasks.slice(0, MAX_VISIBLE_PER_DAY);
              const overflow = dayTasks.length - MAX_VISIBLE_PER_DAY;
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={key}
                  className={cn(
                    "border-r border-border p-1 flex flex-col gap-0.5 transition-colors",
                    !isCurrentMonth && "bg-muted/30",
                    isTodayDate && "bg-primary/5"
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    "text-xs font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full mx-auto",
                    isTodayDate && "bg-primary text-primary-foreground",
                    !isCurrentMonth && !isTodayDate && "text-muted-foreground/50",
                    isCurrentMonth && !isTodayDate && "text-foreground"
                  )}>
                    {format(day, 'd')}
                  </div>

                  {/* Tasks */}
                  {visible.map(task => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        "w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer",
                        STATUS_BG[task.status] || 'bg-muted text-muted-foreground border-border'
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_COLORS[task.priority] || 'bg-muted-foreground')} />
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}

                  {/* Overflow */}
                  {overflow > 0 && (
                    <span className="text-[9px] text-muted-foreground px-1.5 cursor-default">
                      +{overflow} autre{overflow > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Tasks without due date */}
      {tasksWithoutDate.length > 0 && (
        <div className="mt-4 border border-border rounded-lg p-3 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Tâches sans date d'échéance ({tasksWithoutDate.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tasksWithoutDate.slice(0, 12).map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className="text-[10px] px-2 py-0.5 rounded border border-border bg-card hover:bg-accent truncate max-w-[180px] cursor-pointer"
              >
                {t.title}
              </button>
            ))}
            {tasksWithoutDate.length > 12 && (
              <span className="text-[10px] text-muted-foreground px-2 py-0.5">
                +{tasksWithoutDate.length - 12} autres
              </span>
            )}
          </div>
        </div>
      )}

      {/* Task detail dialog */}
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={onStatusChange}
        />

      )}
    </div>
  );
}
