import { useMemo, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isWeekend, isSameDay, addDays, getWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Sun, Umbrella } from 'lucide-react';
import { CalendarEvent, getUserColor } from './MonthlyCalendarGrid';

interface WeeklyCalendarGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onNavigate?: (direction: 'prev' | 'next') => void;
  onToday?: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  maxEventsPerDay?: number;
}

export function WeeklyCalendarGrid({
  currentDate,
  events,
  onNavigate,
  onToday,
  onEventClick,
  maxEventsPerDay = 6,
}: WeeklyCalendarGridProps) {
  // Generate week days (Monday to Sunday)
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  // Map events to days
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    
    events.forEach(event => {
      let current = new Date(event.startDate);
      const end = new Date(event.endDate);
      
      while (current <= end) {
        const dateKey = format(current, 'yyyy-MM-dd');
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(event);
        current = addDays(current, 1);
      }
    });
    
    return map;
  }, [events]);

  const getEventsForDay = useCallback((day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return eventsByDay[dateKey] || [];
  }, [eventsByDay]);

  // Render event chip
  const renderEventChip = (event: CalendarEvent, day: Date, isStart: boolean, isEnd: boolean) => {
    const color = event.type === 'holiday' 
      ? { bg: 'bg-amber-400', text: 'text-amber-900', light: 'bg-amber-100' }
      : getUserColor(event.assigneeId);
    
    return (
      <TooltipProvider key={`${event.id}-${format(day, 'yyyy-MM-dd')}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEventClick?.(event);
              }}
              className={cn(
                "w-full text-left truncate text-xs font-medium px-2 py-1.5 cursor-pointer transition-all hover:opacity-80 hover:shadow-sm",
                color.bg,
                color.text,
                isStart && isEnd && "rounded-md",
                isStart && !isEnd && "rounded-l-md",
                !isStart && isEnd && "rounded-r-md",
                !isStart && !isEnd && "rounded-none"
              )}
            >
              {isStart && (
                <div className="flex items-center gap-1">
                  {event.type === 'holiday' && <Sun className="h-3 w-3 flex-shrink-0" />}
                  {event.type === 'leave' && <Umbrella className="h-3 w-3 flex-shrink-0" />}
                  <span className="truncate">{event.title}</span>
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <div className="text-xs">
              <p className="font-medium">{event.title}</p>
              {event.assigneeName && (
                <p className="text-muted-foreground">{event.assigneeName}</p>
              )}
              <p className="text-muted-foreground">
                {format(event.startDate, 'd MMM', { locale: fr })}
                {!isSameDay(event.startDate, event.endDate) && (
                  <> - {format(event.endDate, 'd MMM', { locale: fr })}</>
                )}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Render day column
  const renderDayColumn = (day: Date) => {
    const dayEvents = getEventsForDay(day);
    const isTodayDate = isToday(day);
    const isWeekendDay = isWeekend(day);
    const visibleEvents = dayEvents.slice(0, maxEventsPerDay);
    const hiddenCount = dayEvents.length - maxEventsPerDay;

    return (
      <div
        key={day.toISOString()}
        className={cn(
          "flex-1 border-r last:border-r-0 min-h-[400px] flex flex-col",
          isWeekendDay && "bg-muted/30",
          isTodayDate && "bg-primary/5 ring-1 ring-inset ring-primary/20"
        )}
      >
        {/* Day header */}
        <div className={cn(
          "p-3 border-b text-center",
          isTodayDate && "bg-primary/10"
        )}>
          <div className={cn(
            "text-xs uppercase tracking-wide font-medium",
            isWeekendDay ? "text-muted-foreground" : "text-muted-foreground"
          )}>
            {format(day, 'EEEE', { locale: fr })}
          </div>
          <div className={cn(
            "text-2xl font-bold mt-1",
            isTodayDate && "text-primary",
            isWeekendDay && !isTodayDate && "text-muted-foreground"
          )}>
            {format(day, 'd')}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {format(day, 'MMM', { locale: fr })}
          </div>
        </div>

        {/* Events */}
        <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
          {visibleEvents.map((event) => {
            const isStart = isSameDay(event.startDate, day);
            const isEnd = isSameDay(event.endDate, day);
            return renderEventChip(event, day, isStart, isEnd);
          })}
          
          {/* +N more indicator */}
          {hiddenCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 w-full text-left hover:bg-muted rounded transition-colors">
                  +{hiddenCount} événement{hiddenCount > 1 ? 's' : ''}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="text-xs font-medium mb-2">
                  {format(day, 'EEEE d MMMM', { locale: fr })}
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className={cn(
                        "w-full text-left p-2 rounded text-xs hover:bg-muted transition-colors",
                        getUserColor(event.assigneeId).light
                      )}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      {event.assigneeName && (
                        <div className="text-muted-foreground truncate">{event.assigneeName}</div>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          
          {/* Empty state */}
          {dayEvents.length === 0 && (
            <div className="text-xs text-muted-foreground/50 text-center py-4">
              Aucun événement
            </div>
          )}
        </div>
      </div>
    );
  };

  const weekNumber = getWeek(currentDate, { locale: fr });
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div>
          <h3 className="font-semibold text-lg">
            Semaine {weekNumber}
          </h3>
          <p className="text-sm text-muted-foreground">
            {format(weekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM yyyy', { locale: fr })}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNavigate?.('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={onToday}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNavigate?.('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Week grid - 7 columns */}
      <div className="flex">
        {weekDays.map((day) => renderDayColumn(day))}
      </div>
    </div>
  );
}
