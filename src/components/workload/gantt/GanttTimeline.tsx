import { useMemo } from 'react';
import { format, isToday, isWeekend, getWeek, isSameWeek, isSameMonth, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface GanttTimelineProps {
  days: Date[];
  dayWidth: number;
  viewMode: 'week' | 'month' | 'quarter';
  isCompact?: boolean;
  memberColumnWidth?: number;
}

export function GanttTimeline({ 
  days, 
  dayWidth, 
  viewMode, 
  isCompact = false,
  memberColumnWidth = 260 
}: GanttTimelineProps) {
  // Group days by month for the month header row
  const monthGroups = useMemo(() => {
    const groups: { month: Date; days: Date[]; label: string }[] = [];
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
  const weekGroups = useMemo(() => {
    const groups: { weekNum: number; year: number; days: Date[] }[] = [];
    let currentGroup: { weekNum: number; year: number; days: Date[] } | null = null;
    
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
    <div className="workload-timeline-header">
      {/* Month header row */}
      <div className="flex">
        <div 
          className="shrink-0 bg-card"
          style={{ width: memberColumnWidth }}
        />
        
        {monthGroups.map((group, idx) => {
          const width = group.days.length * dayWidth;
          const isCurrentMonth = isSameMonth(group.month, new Date());
          
          return (
            <div
              key={`month-${idx}`}
              className={cn(
                "flex items-center justify-center h-9 border-r",
                isCurrentMonth ? "workload-month-label-current" : "workload-month-label"
              )}
              style={{ width, borderColor: 'hsl(var(--keon-gray-200))' }}
            >
              <span className="text-xs font-semibold capitalize tracking-wide">
                {group.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Week row */}
      <div className="flex border-t" style={{ borderColor: 'hsl(var(--keon-gray-100))' }}>
        <div 
          className="shrink-0 bg-card"
          style={{ width: memberColumnWidth }}
        />
        
        {weekGroups.map((group, idx) => {
          const isCurrentWeek = group.days.some(d => isSameWeek(d, new Date(), { locale: fr }));
          const width = group.days.length * dayWidth;
          
          return (
            <div
              key={`week-${group.year}-${group.weekNum}-${idx}`}
              className="flex items-center justify-center h-7 border-r"
              style={{ width, borderColor: 'hsl(var(--keon-gray-100))' }}
            >
              <span className={cn(
                isCurrentWeek 
                  ? "workload-week-label-current" 
                  : "workload-week-label"
              )}>
                S{group.weekNum}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Days row */}
      <div className="flex border-t" style={{ borderColor: 'hsl(var(--keon-gray-200))' }}>
        <div 
          className="shrink-0 bg-card flex items-center px-4 border-r"
          style={{ 
            width: memberColumnWidth, 
            height: isCompact ? 36 : 44,
            borderColor: 'hsl(var(--keon-gray-200))'
          }}
        >
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Collaborateur
          </span>
        </div>
        
        {days.map((day, idx) => {
          const isTodayDay = isToday(day);
          const isWeekendDay = isWeekend(day);
          // Check if this is the first day of a week (Monday)
          const isWeekStart = day.getDay() === 1 && idx > 0;
          
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "workload-day-header shrink-0 border-r",
                isCompact ? "h-9" : "h-11",
                isWeekendDay && "workload-day-header-weekend",
                isTodayDay && "workload-day-header-today",
                isWeekStart && "workload-week-separator"
              )}
              style={{ 
                width: dayWidth,
                borderColor: 'hsl(var(--keon-gray-100))'
              }}
            >
              <span className={cn(
                "text-[9px] font-medium uppercase leading-none",
                isWeekendDay && "opacity-50",
                isTodayDay && "font-bold"
              )}>
                {viewMode === 'quarter' 
                  ? format(day, 'EEEEE', { locale: fr }) 
                  : format(day, 'EEE', { locale: fr })}
              </span>
              <span className={cn(
                "text-xs tabular-nums font-semibold leading-none mt-0.5",
                isWeekendDay && "opacity-50",
                isTodayDay && "font-bold"
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

// Today line indicator component - premium design
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
      className="workload-today-line"
      style={{ left, height }}
    />
  );
}

// Weekend overlay for the grid - premium striped pattern
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
            className="absolute top-0 workload-weekend-bg pointer-events-none opacity-60"
            style={{ left, width: dayWidth, height }}
          />
        );
      })}
    </>
  );
}

// Week separator lines
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
            className="absolute top-0 pointer-events-none"
            style={{ 
              left, 
              height,
              width: 2,
              background: 'repeating-linear-gradient(to bottom, hsl(var(--keon-gray-300)) 0, hsl(var(--keon-gray-300)) 4px, transparent 4px, transparent 8px)'
            }}
          />
        );
      })}
    </>
  );
}

// Today column highlight
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
      className="absolute top-0 workload-today-column pointer-events-none"
      style={{ left, width: dayWidth, height }}
    />
  );
}
