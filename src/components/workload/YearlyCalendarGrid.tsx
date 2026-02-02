import { useMemo, useCallback } from 'react';
import { format, startOfYear, endOfYear, eachWeekOfInterval, startOfWeek, endOfWeek, getWeek, getMonth, isToday, isSameWeek, addYears, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarEvent, getUserColor } from './MonthlyCalendarGrid';

interface YearlyCalendarGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onNavigate?: (direction: 'prev' | 'next') => void;
  onToday?: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  onWeekClick?: (weekStart: Date) => void;
}

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function YearlyCalendarGrid({
  currentDate,
  events,
  onNavigate,
  onToday,
  onEventClick,
  onWeekClick,
}: YearlyCalendarGridProps) {
  const year = currentDate.getFullYear();

  // Generate all weeks of the year grouped by month
  const weeksByMonth = useMemo(() => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    
    // Get all weeks that have at least one day in this year
    const allWeeks = eachWeekOfInterval(
      { start: yearStart, end: yearEnd },
      { weekStartsOn: 1 }
    );

    // Group weeks by the month they primarily belong to
    const grouped: { month: number; weeks: Date[] }[] = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      weeks: [],
    }));

    allWeeks.forEach(weekStart => {
      // Determine which month this week belongs to (by majority of days or by first day)
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      // Count days per month
      const monthCounts: Record<number, number> = {};
      daysInWeek.forEach(day => {
        if (day.getFullYear() === year) {
          const m = day.getMonth();
          monthCounts[m] = (monthCounts[m] || 0) + 1;
        }
      });

      // Find the month with most days
      let primaryMonth = weekStart.getMonth();
      let maxDays = 0;
      Object.entries(monthCounts).forEach(([m, count]) => {
        if (count > maxDays) {
          maxDays = count;
          primaryMonth = parseInt(m);
        }
      });

      if (primaryMonth >= 0 && primaryMonth < 12) {
        grouped[primaryMonth].weeks.push(weekStart);
      }
    });

    return grouped;
  }, [currentDate, year]);

  // Map events to weeks
  const eventsByWeek = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    
    events.forEach(event => {
      const weekStart = startOfWeek(event.startDate, { weekStartsOn: 1 });
      const eventEnd = event.endDate;
      
      // Add event to all weeks it spans
      let current = weekStart;
      while (current <= eventEnd) {
        const weekKey = format(current, 'yyyy-ww');
        if (!map[weekKey]) map[weekKey] = [];
        if (!map[weekKey].find(e => e.id === event.id)) {
          map[weekKey].push(event);
        }
        current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    });
    
    return map;
  }, [events]);

  const getEventsForWeek = useCallback((weekStart: Date) => {
    const weekKey = format(weekStart, 'yyyy-ww');
    return eventsByWeek[weekKey] || [];
  }, [eventsByWeek]);

  // Get intensity color based on event count
  const getIntensityClass = (eventCount: number) => {
    if (eventCount === 0) return 'bg-muted/30';
    if (eventCount === 1) return 'bg-emerald-200 dark:bg-emerald-900/50';
    if (eventCount === 2) return 'bg-emerald-300 dark:bg-emerald-800/60';
    if (eventCount <= 4) return 'bg-amber-300 dark:bg-amber-800/60';
    if (eventCount <= 6) return 'bg-orange-400 dark:bg-orange-700/70';
    return 'bg-red-500 dark:bg-red-700/80';
  };

  // Render week cell
  const renderWeekCell = (weekStart: Date, monthIndex: number) => {
    const weekEvents = getEventsForWeek(weekStart);
    const weekNum = getWeek(weekStart, { locale: fr });
    const isCurrentWeek = isSameWeek(weekStart, new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    // Get unique assignee colors for dots
    const uniqueAssignees = [...new Set(weekEvents.filter(e => e.assigneeId).map(e => e.assigneeId!))];
    const displayDots = uniqueAssignees.slice(0, 3);

    return (
      <TooltipProvider key={weekStart.toISOString()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onWeekClick?.(weekStart)}
              className={cn(
                "w-8 h-8 rounded-md text-[10px] font-medium transition-all relative flex items-center justify-center",
                "hover:ring-2 hover:ring-primary/30 hover:scale-110",
                getIntensityClass(weekEvents.length),
                isCurrentWeek && "ring-2 ring-primary ring-offset-1"
              )}
            >
              <span className={cn(
                "z-10",
                weekEvents.length > 0 && weekEvents.length <= 4 && "text-foreground",
                weekEvents.length > 4 && "text-white"
              )}>
                {weekNum}
              </span>
              
              {/* Colored dots for assignees */}
              {displayDots.length > 0 && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {displayDots.map((assigneeId, idx) => {
                    const color = getUserColor(assigneeId);
                    return (
                      <div
                        key={idx}
                        className={cn("w-1.5 h-1.5 rounded-full", color.bg)}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px]">
            <div className="text-xs space-y-1">
              <p className="font-semibold">
                Semaine {weekNum}: {format(weekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM', { locale: fr })}
              </p>
              {weekEvents.length === 0 ? (
                <p className="text-muted-foreground">Aucun événement</p>
              ) : (
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {weekEvents.slice(0, 5).map(event => (
                    <div key={event.id} className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-sm flex-shrink-0", getUserColor(event.assigneeId).bg)} />
                      <span className="truncate">{event.title}</span>
                    </div>
                  ))}
                  {weekEvents.length > 5 && (
                    <p className="text-muted-foreground">+{weekEvents.length - 5} autres</p>
                  )}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Calculate max weeks in any month for grid alignment
  const maxWeeksPerMonth = Math.max(...weeksByMonth.map(m => m.weeks.length));

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h2 className="text-lg font-semibold">
          Calendrier annuel {year}
        </h2>
        
        <div className="flex items-center gap-2">
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

      {/* Legend */}
      <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Intensité:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-muted/30" />
          <span>0</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-emerald-200 dark:bg-emerald-900/50" />
          <span>1-2</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-amber-300 dark:bg-amber-800/60" />
          <span>3-4</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-orange-400 dark:bg-orange-700/70" />
          <span>5-6</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-500 dark:bg-red-700/80" />
          <span>7+</span>
        </div>
      </div>

      {/* Year grid - 12 months in 3 rows of 4 */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-4">
          {weeksByMonth.map(({ month, weeks }) => (
            <div key={month} className="space-y-2">
              {/* Month header */}
              <div className="text-xs font-semibold text-center text-muted-foreground uppercase tracking-wide">
                {MONTH_NAMES[month]}
              </div>
              
              {/* Weeks grid */}
              <div className="flex flex-wrap gap-1 justify-center">
                {weeks.map((weekStart) => renderWeekCell(weekStart, month))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
