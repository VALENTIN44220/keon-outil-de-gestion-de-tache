import React, { useState, useMemo, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  addDays,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Users, Filter, Palmtree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar';
import { useMicrosoftConnection } from '@/hooks/useMicrosoftConnection';
import { useTasks } from '@/hooks/useTasks';
import { useUserLeaves } from '@/hooks/useUserLeaves';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { Task } from '@/types/task';
import { getStatusFilterOptions, matchesStatusFilter, getStatusCalendarColor, getStatusShortLabel } from '@/services/taskStatusService';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'outlook' | 'task' | 'leave';
  color: string;
  location?: string;
  isAllDay?: boolean;
  source?: string;
  taskData?: Task;
}

type ViewMode = 'week' | 'month';

// Get status filter options from centralized service
const statusFilterOptions = getStatusFilterOptions();

export function UnifiedCalendarView() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [includeSubordinates, setIncludeSubordinates] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Sync range = full current year
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    return {
      startDate: startOfYear(now),
      endDate: endOfYear(now),
    };
  }, []);

  const { events: outlookEvents, isLoading: isLoadingOutlook, refetch: refetchOutlook } = useOutlookCalendar(
    startDate,
    endDate,
    includeSubordinates
  );
  
  const { connection, isSyncing, syncCalendar } = useMicrosoftConnection();
  const { allTasks, isLoading: isLoadingTasks, updateTaskStatus, deleteTask, refetch: refetchTasks } = useTasks();
  const { leaves, isLoading: isLoadingLeaves } = useUserLeaves();

  // Filter tasks by status
  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return allTasks;
    return allTasks.filter(t => matchesStatusFilter(t.status, statusFilter));
  }, [allTasks, statusFilter]);

  // Build leave events (expand each leave into individual days)
  const leaveEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];
    const leaveTypeLabels: Record<string, string> = {
      paid: 'Congé payé',
      unpaid: 'Congé sans solde',
      sick: 'Maladie',
      rtt: 'RTT',
      other: 'Autre absence',
    };
    
    leaves
      .filter(l => l.status === 'declared')
      .forEach(leave => {
        try {
          const start = parseISO(leave.start_date);
          const end = parseISO(leave.end_date);
          const days = eachDayOfInterval({ start, end });
          const label = leaveTypeLabels[leave.leave_type] || 'Congé';
          
          days.forEach(day => {
            events.push({
              id: `leave-${leave.id}-${format(day, 'yyyy-MM-dd')}`,
              title: leave.description ? `${label} - ${leave.description}` : label,
              start: day,
              end: day,
              type: 'leave',
              color: 'bg-amber-500',
              isAllDay: true,
              source: 'Congé',
            });
          });
        } catch {
          // skip invalid dates
        }
      });
    return events;
  }, [leaves]);

  // Memoize calendar events to prevent flickering
  const calendarEvents = useMemo<CalendarEvent[]>(() => [
    ...outlookEvents.map(event => ({
      id: `outlook-${event.id}`,
      title: event.subject,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      type: 'outlook' as const,
      color: 'bg-[#0078D4]',
      location: event.location || undefined,
      isAllDay: event.is_all_day || undefined,
      source: 'Outlook',
    })),
    ...filteredTasks
      .filter(task => task.due_date && task.type === 'task')
      .map(task => ({
        id: `task-${task.id}`,
        title: task.title,
        start: new Date(task.due_date!),
        end: new Date(task.due_date!),
        type: 'task' as const,
        color: getStatusCalendarColor(task.status),
        source: getStatusShortLabel(task.status),
        taskData: task,
      })),
    ...leaveEvents,
  ], [outlookEvents, filteredTasks, leaveEvents]);

  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    return calendarEvents.filter(event => isSameDay(event.start, date));
  }, [calendarEvents]);

  const handleSync = useCallback(async () => {
    const yearStart = startOfYear(new Date());
    const yearEnd = endOfYear(new Date());
    await syncCalendar(yearStart.toISOString(), yearEnd.toISOString());
    refetchOutlook();
  }, [syncCalendar, refetchOutlook]);

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    }
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.type === 'task' && event.taskData) {
      setSelectedTask(event.taskData);
    }
  }, []);

  const handleTaskUpdated = useCallback(() => {
    refetchTasks();
    setSelectedTask(null);
  }, [refetchTasks]);

  // Memoize the title
  const periodTitle = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(weekStart, 'd MMM', { locale: fr })} - ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: fr });
  }, [currentDate, viewMode]);

  // Render week view
  const renderWeekView = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days: JSX.Element[] = [];

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayEvents = getEventsForDate(day);
      const isToday = isSameDay(day, new Date());
      const isSelected = selectedDate && isSameDay(day, selectedDate);

      days.push(
        <div
          key={day.toISOString()}
          className={cn(
            'min-h-[300px] p-2 border-r cursor-pointer transition-colors flex-1',
            isSelected && 'bg-primary/5',
            'hover:bg-muted/50'
          )}
          onClick={() => setSelectedDate(day)}
        >
          <div className="text-center mb-2">
            <div className="text-xs text-muted-foreground uppercase">
              {format(day, 'EEE', { locale: fr })}
            </div>
            <div className={cn(
              'w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-medium mt-1',
              isToday && 'bg-primary text-primary-foreground',
              isSelected && !isToday && 'bg-primary/20'
            )}>
              {format(day, 'd')}
            </div>
          </div>
          <div className="space-y-1">
            {dayEvents.map(event => (
              <div
                key={event.id}
                className={cn(
                  'text-xs px-2 py-1.5 rounded text-white cursor-pointer hover:opacity-90 transition-opacity',
                  event.color
                )}
                title={event.title}
                onClick={(e) => handleEventClick(event, e)}
              >
                <div className="font-medium truncate">{event.title}</div>
                {!event.isAllDay && (
                  <div className="text-[10px] opacity-80">{format(event.start, 'HH:mm')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex border-l border-t border-b">
        {days}
      </div>
    );
  }, [currentDate, selectedDate, getEventsForDate, handleEventClick]);

  // Render month view - memoized
  const renderMonthView = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: JSX.Element[] = [];
    let day = weekStart;

    while (day <= weekEnd) {
      const currentDay = day;
      const dayEvents = getEventsForDate(currentDay);
      const isToday = isSameDay(currentDay, new Date());
      const isCurrentMonth = isSameMonth(currentDay, currentDate);
      const isSelected = selectedDate && isSameDay(currentDay, selectedDate);

      days.push(
        <div
          key={currentDay.toISOString()}
          className={cn(
            'min-h-[80px] p-1 border-b border-r cursor-pointer transition-colors',
            !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
            isSelected && 'bg-primary/10',
            'hover:bg-muted/50'
          )}
          onClick={() => setSelectedDate(currentDay)}
        >
          <div className={cn(
            'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1',
            isToday && 'bg-primary text-primary-foreground',
            isSelected && !isToday && 'bg-primary/20'
          )}>
            {format(currentDay, 'd')}
          </div>
          <div className="space-y-0.5">
            {dayEvents.slice(0, 3).map(event => (
              <div
                key={event.id}
                className={cn(
                  'text-[10px] px-1 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-90 transition-opacity',
                  event.color
                )}
                title={event.title}
                onClick={(e) => handleEventClick(event, e)}
              >
                {event.title}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-[10px] text-muted-foreground px-1">
                +{dayEvents.length - 3} autres
              </div>
            )}
          </div>
        </div>
      );

      day = addDays(day, 1);
    }

    return days;
  }, [currentDate, selectedDate, getEventsForDate, handleEventClick]);

  // Memoize selected date events
  const selectedDateEvents = useMemo(() => {
    return selectedDate ? getEventsForDate(selectedDate) : [];
  }, [selectedDate, getEventsForDate]);

  const isLoading = isLoadingOutlook || isLoadingTasks || isLoadingLeaves;

  // Count filtered tasks
  const filteredTaskCount = filteredTasks.filter(t => t.due_date && t.type === 'task').length;

  return (
    <>
      <div className="flex flex-col gap-4 h-full">
        {/* Status filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
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
              {filteredTaskCount} tâche{filteredTaskCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="flex gap-4 flex-1">
          {/* Calendar */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleNavigate('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleToday} className="text-xs">
                    Aujourd'hui
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleNavigate('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-lg capitalize ml-2">
                    {periodTitle}
                  </CardTitle>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* View mode selector */}
                  <div className="flex bg-muted rounded-lg p-0.5">
                    <Button
                      variant={viewMode === 'week' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="text-xs h-7 px-3"
                      onClick={() => setViewMode('week')}
                    >
                      Semaine
                    </Button>
                    <Button
                      variant={viewMode === 'month' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="text-xs h-7 px-3"
                      onClick={() => setViewMode('month')}
                    >
                      Mois
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="subordinates"
                      checked={includeSubordinates}
                      onCheckedChange={setIncludeSubordinates}
                    />
                    <Label htmlFor="subordinates" className="text-sm flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Équipe
                    </Label>
                  </div>

                  {connection.connected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="gap-2"
                    >
                      <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                      Sync
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              {viewMode === 'week' ? (
                renderWeekView
              ) : (
                <>
                  {/* Week days header */}
                  <div className="grid grid-cols-7 border-l border-t">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                      <div key={day} className="text-center text-xs font-medium py-2 border-b border-r bg-muted/50">
                        {day}
                      </div>
                    ))}
                    {renderMonthView}
                  </div>
                </>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs flex-wrap">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-[#0078D4]" />
                  <span>Outlook</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-slate-500" />
                  <span>À faire</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span>En cours</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-violet-500" />
                  <span>Validation</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>Terminé</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span>Validé</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-500" />
                  <span>À corriger</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span>Congé</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event list sidebar */}
          <Card className="w-80 shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate ? (
                  <span>
                    {format(selectedDate, 'EEEE d MMM', { locale: fr })}
                  </span>
                ) : (
                  <span>Événements</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : selectedDateEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                    <CalendarIcon className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Aucun événement</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {selectedDateEvents.map(event => (
                      <div
                        key={event.id}
                        className={cn(
                          'p-3 rounded-lg text-white cursor-pointer hover:opacity-90 transition-opacity',
                          event.color
                        )}
                        onClick={(e) => handleEventClick(event, e)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{event.title}</p>
                            {event.location && (
                              <p className="text-xs opacity-80 truncate">{event.location}</p>
                            )}
                          </div>
                          <span className="text-xs opacity-80 shrink-0">
                            {event.isAllDay ? 'Journée' : format(event.start, 'HH:mm')}
                          </span>
                        </div>
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white/20">
                            {event.source}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task detail dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={(taskId, status) => {
          updateTaskStatus(taskId, status);
          handleTaskUpdated();
        }}
      />
    </>
  );
}
