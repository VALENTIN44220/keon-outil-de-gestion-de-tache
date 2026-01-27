import React, { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
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
import { useOutlookCalendar, OutlookEvent } from '@/hooks/useOutlookCalendar';
import { useMicrosoftConnection } from '@/hooks/useMicrosoftConnection';
import { useTasks } from '@/hooks/useTasks';
import { Task } from '@/types/task';

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

export function UnifiedCalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'month'>('month');
  const [includeSubordinates, setIncludeSubordinates] = useState(false);

  const startDate = startOfMonth(subMonths(currentMonth, 1));
  const endDate = endOfMonth(addMonths(currentMonth, 1));

  const { events: outlookEvents, isLoading: isLoadingOutlook, refetch: refetchOutlook } = useOutlookCalendar(
    startDate,
    endDate,
    includeSubordinates
  );
  
  const { connection, isSyncing, syncCalendar } = useMicrosoftConnection();
  const { allTasks, isLoading: isLoadingTasks } = useTasks();

  // Convert to unified format
  const calendarEvents: CalendarEvent[] = [
    // Outlook events
    ...outlookEvents.map(event => ({
      id: `outlook-${event.id}`,
      title: event.subject,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      type: 'outlook' as const,
      color: 'bg-[#0078D4]', // Microsoft blue
      location: event.location,
      isAllDay: event.is_all_day,
      source: 'Outlook',
    })),
    // App tasks with due dates
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
  ];

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return calendarEvents.filter(event => isSameDay(event.start, date));
  };

  const handleSync = async () => {
    await syncCalendar(startDate.toISOString(), endDate.toISOString());
    refetchOutlook();
  };

  // Calendar grid
  const renderCalendarGrid = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: JSX.Element[] = [];
    let day = weekStart;

    while (day <= weekEnd) {
      const currentDay = day;
      const dayEvents = getEventsForDate(currentDay);
      const isToday = isSameDay(currentDay, new Date());
      const isCurrentMonth = isSameMonth(currentDay, currentMonth);
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
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="flex gap-4 h-full">
      {/* Calendar */}
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
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
          {/* Week days header */}
          <div className="grid grid-cols-7 border-l border-t">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} className="text-center text-xs font-medium py-2 border-b border-r bg-muted/50">
                {day}
              </div>
            ))}
            {/* Calendar days */}
            {renderCalendarGrid()}
          </div>

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
          <div className="flex gap-1 mt-2">
            {['today', 'week', 'month'].map(mode => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'secondary' : 'ghost'}
                size="sm"
                className="text-xs px-2 h-7"
                onClick={() => setViewMode(mode as any)}
              >
                {mode === 'today' ? "Aujourd'hui" : mode === 'week' ? 'Semaine' : 'Mois'}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {(isLoadingOutlook || isLoadingTasks) ? (
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
