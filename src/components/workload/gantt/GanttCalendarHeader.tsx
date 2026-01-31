import { useMemo, useRef, useEffect } from 'react';
import { format, isToday, isWeekend, getWeek, isSameWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type ViewMode = 'day' | 'week' | 'month' | 'quarter';

interface GanttCalendarHeaderProps {
  days: Date[];
  dayWidth: number;
  viewMode: ViewMode;
  isCompact?: boolean;
  memberColumnWidth?: number;
  onScrollToToday?: () => void;
}

interface MonthGroup {
  month: Date;
  days: Date[];
  label: string;
}

interface WeekGroup {
  weekNum: number;
  year: number;
  days: Date[];
}

export function GanttCalendarHeader({
  days,
  dayWidth,
  viewMode,
  isCompact = false,
  memberColumnWidth = 260,
}: GanttCalendarHeaderProps) {
  const todayRef = useRef<HTMLDivElement>(null);

  // Group days by month for the month header row
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups: MonthGroup[] = [];
    let currentMonth: Date | null = null;
    let currentMonthDays: Date[] = [];

    days.forEach(day => {
      const monthStart = startOfMonth(day);
      if (!currentMonth || !isSameMonth(day, currentMonth)) {
        if (currentMonthDays.length > 0 && currentMonth) {
          groups.push({
            month: currentMonth,
            days: currentMonthDays,
            label: format(currentMonth, 'MMMM yyyy', { locale: fr })
          });
        }
        currentMonth = monthStart;
        currentMonthDays = [];
      }
      currentMonthDays.push(day);
    });

    if (currentMonthDays.length > 0 && currentMonth) {
      groups.push({
        month: currentMonth,
        days: currentMonthDays,
        label: format(currentMonth, 'MMMM yyyy', { locale: fr })
      });
    }

    return groups;
  }, [days]);

  // Group days by week for week labels
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const groups: WeekGroup[] = [];
    let currentGroup: WeekGroup | null = null;

    days.forEach(day => {
      const weekNum = getWeek(day, { locale: fr });
      const year = day.getFullYear();

      if (!currentGroup || currentGroup.weekNum !== weekNum || currentGroup.year !== year) {
        currentGroup = { weekNum, year, days: [] };
        groups.push(currentGroup);
      }
      currentGroup.days.push(day);
    });

    return groups;
  }, [days]);

  return (
    <div 
      className="sticky top-0 z-20 bg-card border-b-2 border-border/50"
      role="rowgroup"
      aria-label="En-tête du calendrier"
    >
      {/* Month header row */}
      <div className="flex" role="row">
        <div
          className="shrink-0 bg-card border-r-2 border-border/50"
          style={{ width: memberColumnWidth }}
          role="columnheader"
          aria-label="Mois"
        />

        {monthGroups.map((group, idx) => {
          const width = group.days.length * dayWidth;
          const isCurrentMonth = isSameMonth(group.month, new Date());

          return (
            <div
              key={`month-${idx}`}
              className={cn(
                "flex items-center justify-center h-9 border-r transition-colors",
                isCurrentMonth
                  ? "bg-primary/10 text-primary font-bold"
                  : "bg-muted/30 text-foreground/80"
              )}
              style={{ width, borderColor: 'hsl(var(--border))' }}
              role="columnheader"
              aria-current={isCurrentMonth ? 'date' : undefined}
            >
              <span className="text-xs font-semibold capitalize tracking-wide truncate px-2">
                {group.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Week row */}
      <div 
        className="flex border-t" 
        style={{ borderColor: 'hsl(var(--border) / 0.5)' }}
        role="row"
      >
        <div
          className="shrink-0 bg-card border-r-2 border-border/50"
          style={{ width: memberColumnWidth }}
          role="columnheader"
          aria-label="Semaine"
        />

        {weekGroups.map((group, idx) => {
          const isCurrentWeek = group.days.some(d => isSameWeek(d, new Date(), { locale: fr }));
          const width = group.days.length * dayWidth;

          return (
            <div
              key={`week-${group.year}-${group.weekNum}-${idx}`}
              className={cn(
                "flex items-center justify-center h-7 border-r transition-colors",
                isCurrentWeek
                  ? "bg-primary/5 text-primary font-bold"
                  : "text-muted-foreground"
              )}
              style={{ width, borderColor: 'hsl(var(--border) / 0.3)' }}
              role="columnheader"
              aria-current={isCurrentWeek ? 'date' : undefined}
            >
              <span className="text-[10px] font-medium tabular-nums">
                S{group.weekNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Days row */}
      <div 
        className="flex border-t" 
        style={{ borderColor: 'hsl(var(--border))' }}
        role="row"
      >
        <div
          className={cn(
            "shrink-0 bg-card flex items-center px-4 border-r-2 border-border/50",
            "font-semibold text-muted-foreground uppercase tracking-widest"
          )}
          style={{
            width: memberColumnWidth,
            height: isCompact ? 36 : 44,
          }}
          role="columnheader"
        >
          <span className="text-[11px]">Collaborateur</span>
        </div>

        {days.map((day, idx) => {
          const isTodayDay = isToday(day);
          const isWeekendDay = isWeekend(day);
          const isWeekStart = day.getDay() === 1 && idx > 0;

          return (
            <div
              key={day.toISOString()}
              ref={isTodayDay ? todayRef : undefined}
              className={cn(
                "shrink-0 flex flex-col items-center justify-center border-r transition-colors",
                isCompact ? "h-9" : "h-11",
                isWeekendDay && "bg-muted/30",
                isTodayDay && "bg-primary/10 ring-1 ring-primary ring-inset",
                isWeekStart && "border-l-2 border-l-border"
              )}
              style={{
                width: dayWidth,
                borderColor: 'hsl(var(--border) / 0.3)'
              }}
              role="columnheader"
              aria-current={isTodayDay ? 'date' : undefined}
              aria-label={format(day, 'EEEE d MMMM yyyy', { locale: fr })}
              tabIndex={isTodayDay ? 0 : -1}
            >
              <span className={cn(
                "text-[9px] font-medium uppercase leading-none",
                isWeekendDay && "opacity-50",
                isTodayDay && "text-primary font-bold"
              )}>
                {viewMode === 'month' || viewMode === 'quarter'
                  ? format(day, 'EEEEE', { locale: fr })
                  : format(day, 'EEE', { locale: fr })}
              </span>
              <span className={cn(
                "text-xs tabular-nums font-semibold leading-none mt-0.5",
                isWeekendDay && "opacity-50",
                isTodayDay && "text-primary font-bold"
              )}>
                {format(day, 'd', { locale: fr })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Export TodayLine and other overlays for use in grid
export function TodayLine({
  days,
  dayWidth,
  headerOffset,
  height = '100%'
}: {
  days: Date[];
  dayWidth: number;
  headerOffset: number;
  height?: string | number;
}) {
  const todayIndex = days.findIndex(d => isToday(d));
  if (todayIndex === -1) return null;

  const left = headerOffset + (todayIndex * dayWidth) + (dayWidth / 2);

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg shadow-primary/50 z-30 pointer-events-none"
      style={{ left, height }}
      role="presentation"
      aria-hidden="true"
    >
      {/* Pulsing dot at top */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-lg animate-pulse" />
    </div>
  );
}

export function TodayColumnHighlight({
  days,
  dayWidth,
  headerOffset,
  height = '100%'
}: {
  days: Date[];
  dayWidth: number;
  headerOffset: number;
  height?: string | number;
}) {
  const todayIndex = days.findIndex(d => isToday(d));
  if (todayIndex === -1) return null;

  const left = headerOffset + (todayIndex * dayWidth);

  return (
    <div
      className="absolute top-0 bg-primary/5 pointer-events-none z-0"
      style={{ left, width: dayWidth, height }}
      role="presentation"
      aria-hidden="true"
    />
  );
}

export function WeekendOverlay({
  days,
  dayWidth,
  headerOffset,
  height = '100%'
}: {
  days: Date[];
  dayWidth: number;
  headerOffset: number;
  height?: string | number;
}) {
  return (
    <>
      {days.map((day, idx) => {
        if (!isWeekend(day)) return null;
        const left = headerOffset + (idx * dayWidth);

        return (
          <div
            key={day.toISOString()}
            className="absolute top-0 pointer-events-none opacity-40"
            style={{
              left,
              width: dayWidth,
              height,
              background: `repeating-linear-gradient(
                -45deg,
                hsl(var(--muted)),
                hsl(var(--muted)) 3px,
                transparent 3px,
                transparent 6px
              )`
            }}
            role="presentation"
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

export function WeekSeparators({
  days,
  dayWidth,
  headerOffset,
  height = '100%'
}: {
  days: Date[];
  dayWidth: number;
  headerOffset: number;
  height?: string | number;
}) {
  return (
    <>
      {days.map((day, idx) => {
        // Show separator at the start of each week (Monday)
        if (day.getDay() !== 1 || idx === 0) return null;
        const left = headerOffset + (idx * dayWidth);

        return (
          <div
            key={`week-sep-${day.toISOString()}`}
            className="absolute top-0 pointer-events-none z-10"
            style={{
              left,
              height,
              width: 2,
              background: 'repeating-linear-gradient(to bottom, hsl(var(--border)) 0, hsl(var(--border)) 4px, transparent 4px, transparent 8px)'
            }}
            role="presentation"
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}
