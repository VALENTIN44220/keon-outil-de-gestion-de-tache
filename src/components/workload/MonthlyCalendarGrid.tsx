import { useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isWeekend, parseISO, isSameDay, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Sun, Umbrella } from 'lucide-react';

// Types
export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  assigneeId?: string;
  assigneeName?: string;
  type: 'task' | 'leave' | 'holiday';
  status?: string;
  priority?: string;
}

interface MonthlyCalendarGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onNavigate?: (direction: 'prev' | 'next') => void;
  onToday?: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  compact?: boolean;
  showHeader?: boolean;
  showNavigation?: boolean;
  maxEventsPerDay?: number;
}

// Palette de couleurs pour les personnes
const USER_COLORS = [
  { bg: 'bg-cyan-500', text: 'text-white', light: 'bg-cyan-100' },
  { bg: 'bg-emerald-500', text: 'text-white', light: 'bg-emerald-100' },
  { bg: 'bg-amber-500', text: 'text-white', light: 'bg-amber-100' },
  { bg: 'bg-rose-500', text: 'text-white', light: 'bg-rose-100' },
  { bg: 'bg-violet-500', text: 'text-white', light: 'bg-violet-100' },
  { bg: 'bg-blue-500', text: 'text-white', light: 'bg-blue-100' },
  { bg: 'bg-orange-500', text: 'text-white', light: 'bg-orange-100' },
  { bg: 'bg-pink-500', text: 'text-white', light: 'bg-pink-100' },
  { bg: 'bg-teal-500', text: 'text-white', light: 'bg-teal-100' },
  { bg: 'bg-indigo-500', text: 'text-white', light: 'bg-indigo-100' },
];

// Hash function for stable color assignment
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getUserColor(assigneeId: string | undefined): typeof USER_COLORS[0] {
  if (!assigneeId) return USER_COLORS[0];
  const index = hashString(assigneeId) % USER_COLORS.length;
  return USER_COLORS[index];
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function MonthlyCalendarGrid({
  currentDate,
  events,
  onNavigate,
  onToday,
  onEventClick,
  compact = false,
  showHeader = true,
  showNavigation = true,
  maxEventsPerDay = 3,
}: MonthlyCalendarGridProps) {
  // Generate calendar grid (weeks x days)
  const calendarGrid = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Start from Monday of the week containing month start
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    // End on Sunday of the week containing month end
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    // Split into weeks (7 days each)
    const weeks: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }
    
    return weeks;
  }, [currentDate]);

  // Map events to days
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    
    events.forEach(event => {
      // For multi-day events, add to each day
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

  // Render event bar/chip
  const renderEventChip = (event: CalendarEvent, day: Date, isStart: boolean, isEnd: boolean) => {
    // Holidays use a fixed amber color, but tasks and leaves use assignee-based colors
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
                "w-full text-left truncate text-[10px] font-medium px-1.5 py-0.5 cursor-pointer transition-opacity hover:opacity-80",
                color.bg,
                color.text,
                isStart && "rounded-l",
                isEnd && "rounded-r",
                !isStart && !isEnd && "rounded-none",
                compact && "text-[8px] py-0"
              )}
            >
              {isStart && (
                <>
                  {event.type === 'holiday' && <Sun className="inline h-2.5 w-2.5 mr-0.5" />}
                  {event.type === 'leave' && <Umbrella className="inline h-2.5 w-2.5 mr-0.5" />}
                  {event.title}
                </>
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

  // Render day cell
  const renderDayCell = (day: Date) => {
    const dayEvents = getEventsForDay(day);
    const isCurrentMonth = isSameMonth(day, currentDate);
    const isTodayDate = isToday(day);
    const isWeekendDay = isWeekend(day);
    const visibleEvents = dayEvents.slice(0, maxEventsPerDay);
    const hiddenCount = dayEvents.length - maxEventsPerDay;

    return (
      <div
        key={day.toISOString()}
        className={cn(
          "min-h-[80px] border-r border-b p-1 transition-colors",
          compact && "min-h-[60px]",
          !isCurrentMonth && "bg-muted/30 text-muted-foreground",
          isWeekendDay && isCurrentMonth && "bg-muted/20",
          isTodayDate && "bg-primary/5 ring-1 ring-inset ring-primary/20"
        )}
      >
        {/* Day number */}
        <div className="flex items-center justify-between mb-1">
          <span
            className={cn(
              "text-sm font-medium",
              compact && "text-xs",
              isTodayDate && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center",
              !isCurrentMonth && "text-muted-foreground/50"
            )}
          >
            {format(day, 'd')}
          </span>
        </div>

        {/* Events */}
        <div className="space-y-0.5">
          {visibleEvents.map((event) => {
            const isStart = isSameDay(event.startDate, day);
            const isEnd = isSameDay(event.endDate, day);
            return renderEventChip(event, day, isStart, isEnd);
          })}
          
          {/* +N more indicator */}
          {hiddenCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-[10px] text-muted-foreground hover:text-foreground font-medium px-1">
                  +{hiddenCount} plus
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
                        "w-full text-left p-1.5 rounded text-xs hover:bg-muted transition-colors",
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
        </div>
      </div>
    );
  };

  return (
    <div className={cn("bg-card rounded-xl border shadow-sm overflow-hidden", compact && "rounded-lg")}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <h3 className={cn("font-semibold capitalize", compact ? "text-sm" : "text-lg")}>
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </h3>
          
          {showNavigation && (
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
                className="h-8 px-2 text-xs"
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
          )}
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={cn(
              "p-2 text-center font-medium text-muted-foreground border-r last:border-r-0",
              compact ? "text-[10px] p-1" : "text-xs"
            )}
          >
            {compact ? day[0] : day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarGrid.map((week, weekIndex) => (
          week.map((day) => renderDayCell(day))
        ))}
      </div>
    </div>
  );
}
