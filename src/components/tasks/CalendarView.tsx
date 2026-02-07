import { useState, useMemo } from 'react';
import { Task, TaskStatus } from '@/types/task';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import { ClipboardList, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStatusFilterOptions, matchesStatusFilter, getStatusColor, getStatusLabel } from '@/services/taskStatusService';

interface CalendarViewProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  groupBy?: string;
  groupLabels?: Map<string, string>;
  progressMap?: Record<string, { completed: number; total: number; progress: number }>;
  onTaskUpdated?: () => void;
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

// Get status filter options from centralized service
const statusFilterOptions = getStatusFilterOptions();

export function CalendarView({ tasks, onStatusChange, onDelete, groupBy, groupLabels, progressMap, onTaskUpdated }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter tasks by status
  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter(t => matchesStatusFilter(t.status, statusFilter));
  }, [tasks, statusFilter]);

  const tasksWithDueDate = useMemo(() => 
    filteredTasks.filter(t => t.due_date), 
    [filteredTasks]
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasksWithDueDate.forEach(task => {
      if (task.due_date) {
        const dateKey = task.due_date.split('T')[0];
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(task);
      }
    });
    return map;
  }, [tasksWithDueDate]);

  const selectedDateTasks = useMemo(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return tasksByDate.get(dateKey) || [];
  }, [selectedDate, tasksByDate]);

  const tasksWithoutDueDate = useMemo(() => 
    filteredTasks.filter(t => !t.due_date),
    [filteredTasks]
  );

  // Custom day render to show task indicators
  const modifiers = useMemo(() => {
    const hasTasks: Date[] = [];
    const hasUrgent: Date[] = [];
    
    tasksByDate.forEach((dateTasks, dateKey) => {
      const date = parseISO(dateKey);
      hasTasks.push(date);
      if (dateTasks.some(t => t.priority === 'urgent' || t.priority === 'high')) {
        hasUrgent.push(date);
      }
    });
    
    return { hasTasks, hasUrgent };
  }, [tasksByDate]);

  const modifiersStyles = {
    hasTasks: {
      position: 'relative' as const,
    },
    hasUrgent: {
      fontWeight: 'bold' as const,
    },
  };

  // Status filter bar component
  const StatusFilterBar = () => (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <Filter className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground mr-2">Statut:</span>
      <div className="flex bg-muted rounded-lg p-1 flex-wrap gap-1">
        {statusFilterOptions.map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter(option.value)}
            className={cn(
              "text-xs px-3 py-1 h-auto rounded-md transition-all",
              statusFilter === option.value
                ? "bg-card shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {statusFilter !== 'all' && (
        <Badge variant="secondary" className="ml-2">
          {filteredTasks.length} tâche{filteredTasks.length !== 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );

  if (filteredTasks.length === 0) {
    return (
      <div className="space-y-4">
        <StatusFilterBar />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">Aucune tâche trouvée</h3>
          <p className="text-sm text-muted-foreground">
            {statusFilter !== 'all' 
              ? 'Aucune tâche avec ce statut. Modifiez vos filtres.' 
              : 'Modifiez vos filtres ou créez une nouvelle tâche'}
          </p>
        </div>
      </div>
    );
  }

  // Group tasks if groupBy is set
  const renderGroupedTasks = () => {
    if (!groupBy || groupBy === 'none') return null;

    const groups = new Map<string, Task[]>();
    
    selectedDateTasks.forEach(task => {
      let key = 'Non assigné';
      switch (groupBy) {
        case 'assignee':
          key = task.assignee_id || 'Non assigné';
          break;
        case 'requester':
          key = task.requester_id || 'Non défini';
          break;
        case 'reporter':
          key = task.reporter_id || 'Non défini';
          break;
        case 'category':
          key = task.category_id || 'Sans catégorie';
          break;
        case 'subcategory':
          key = task.subcategory_id || 'Sans sous-catégorie';
          break;
        default:
          key = 'Autre';
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(task);
    });

    return (
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([groupKey, groupTasks]) => (
          <div key={groupKey}>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              {groupLabels?.get(groupKey) || groupKey}
            </h4>
            <div className="space-y-2">
              {groupTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  compact
                  taskProgress={progressMap?.[task.id]}
                  onTaskUpdated={onTaskUpdated}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Status filter bar */}
      <StatusFilterBar />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Calendrier des tâches</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            locale={fr}
            className="rounded-md"
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            components={{
              DayContent: ({ date }) => {
                const dateKey = format(date, 'yyyy-MM-dd');
                const dayTasks = tasksByDate.get(dateKey) || [];
                
                return (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <span>{date.getDate()}</span>
                    {dayTasks.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayTasks.slice(0, 3).map((task, i) => (
                          <div 
                            key={i} 
                            className={cn("w-1.5 h-1.5 rounded-full", priorityColors[task.priority])} 
                          />
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dayTasks.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Selected day tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {selectedDateTasks.length} tâche{selectedDateTasks.length !== 1 ? 's' : ''}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
          {selectedDateTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune tâche pour cette date
            </p>
          ) : groupBy && groupBy !== 'none' ? (
            renderGroupedTasks()
          ) : (
            selectedDateTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                compact
                taskProgress={progressMap?.[task.id]}
                onTaskUpdated={onTaskUpdated}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Tasks without due date */}
      {tasksWithoutDueDate.length > 0 && (
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Tâches sans date d'échéance</CardTitle>
            <p className="text-sm text-muted-foreground">
              {tasksWithoutDueDate.length} tâche{tasksWithoutDueDate.length !== 1 ? 's' : ''}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {tasksWithoutDueDate.slice(0, 8).map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  compact
                  taskProgress={progressMap?.[task.id]}
                  onTaskUpdated={onTaskUpdated}
                />
              ))}
            </div>
            {tasksWithoutDueDate.length > 8 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Et {tasksWithoutDueDate.length - 8} autres tâches...
              </p>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
