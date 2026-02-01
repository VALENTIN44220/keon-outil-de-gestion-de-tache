import React, { useState, useMemo, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isSameWeek,
  addMonths,
  subMonths,
  isWithinInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Users } from 'lucide-react';
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

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'outlook' | 'task';
  color: string;
  location?: string;
  isAllDay?: boolean;
  source?: string;
}

type ViewMode = 'week' | 'month';

export function UnifiedCalendarView() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [includeSubordinates, setIncludeSubordinates] = useState(false);

  // Compute date range based on view mode - memoized
  const { startDate, endDate } = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        startDate: subWeeks(weekStart, 1),
        endDate: addWeeks(weekEnd, 1),
      };
    }
    return {
      startDate: startOfMonth(subMonths(currentDate, 1)),
      endDate: endOfMonth(addMonths(currentDate, 1)),
    };
  }, [currentDate, viewMode]);

  const { events: outlookEvents, isLoading: isLoadingOutlook, refetch: refetchOutlook } = useOutlookCalendar(
    startDate,
    endDate,
    includeSubordinates
  );
  
  const { connection, isSyncing, syncCalendar } = useMicrosoftConnection();
  const { allTasks, isLoading: isLoadingTasks } = useTasks();

  // Memoize calendar events to prevent flickering
  const calendarEvents = useMemo<CalendarEvent[]>(() => [
    ...outlookEvents.map(event => ({
      id: `outlook-${event.id}`,
      title: event.subject,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      type: 'outlook' as const,
      color: 'bg-[#0078D4]',
      location: event.location,
      isAllDay: event.is_all_day,
      source: 'Outlook',
    })),
    ...allTasks
      .filter(task => task.due_date && task.type === 'task')
      .map(task => ({
        id: `task-${task.id}`,
        title: task.title,
        start: new Date(task.due_date!),
        end: new Date(task.due_date!),
        type: 'task' as const,
        color: task.priority === 'high' ? 'bg-destructive' : 
               task.priority === 'medium' ? 'bg-warning' : 'bg-primary',
        source: 'Tâche',
      })),
  ], [outlookEvents, allTasks]);

  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    return calendarEvents.filter(event => isSameDay(event.start, date));
  }, [calendarEvents]);

  const handleSync = useCallback(async () => {
    await syncCalendar(startDate.toISOString(), endDate.toISOString());
    refetchOutlook();
  }, [syncCalendar, startDate, endDate, refetchOutlook]);

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
                  'text-xs px-2 py-1.5 rounded text-white',
                  event.color
                )}
                title={event.title}
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
  }, [currentDate, selectedDate, getEventsForDate]);

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
                  'text-[10px] px-1 py-0.5 rounded truncate text-white',
                  event.color
                )}
                title={event.title}
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
  }, [currentDate, selectedDate, getEventsForDate]);

  // Memoize selected date events
  const selectedDateEvents = useMemo(() => {
    return selectedDate ? getEventsForDate(selectedDate) : [];
  }, [selectedDate, getEventsForDate]);

  const isLoading = isLoadingOutlook || isLoadingTasks;

  return (
    <div className="flex gap-4 h-full">
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
          <div className="flex items-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[#0078D4]" />
              <span>Outlook</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-primary" />
              <span>Tâches</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-warning" />
              <span>Priorité moyenne</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-destructive" />
              <span>Priorité haute</span>
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
                      'p-3 rounded-lg text-white',
                      event.color
                    )}
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
  );
}
