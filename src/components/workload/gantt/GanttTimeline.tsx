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
    <div className="sticky top-0 z-20 bg-card shadow-sm">
      {/* Month header row */}
      <div className="flex border-b border-border/50">
        <div 
          className="shrink-0 border-r border-border/50 bg-muted/30"
          style={{ width: memberColumnWidth }}
        />
        
        {monthGroups.map((group, idx) => {
          const width = group.days.length * dayWidth;
          const isCurrentMonth = isSameMonth(group.month, new Date());
          
          return (
            <div
              key={`month-${idx}`}
              className={cn(
                "flex items-center justify-center border-r border-border/50 h-8",
                isCurrentMonth ? "bg-primary/5" : "bg-muted/20"
              )}
              style={{ width }}
            >
              <span className={cn(
                "text-xs font-semibold capitalize",
                isCurrentMonth ? "text-primary" : "text-muted-foreground"
              )}>
                {group.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Week row */}
      <div className="flex border-b border-border/40">
        <div 
          className="shrink-0 border-r border-border/50 bg-muted/30"
          style={{ width: memberColumnWidth }}
        />
        
        {weekGroups.map((group, idx) => {
          const isCurrentWeek = group.days.some(d => isSameWeek(d, new Date(), { locale: fr }));
          const width = group.days.length * dayWidth;
          
          return (
            <div
              key={`week-${group.year}-${group.weekNum}-${idx}`}
              className={cn(
                "flex items-center justify-center border-r border-border/30 h-6",
                isCurrentWeek ? "bg-primary/10" : ""
              )}
              style={{ width }}
            >
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                isCurrentWeek 
                  ? "bg-primary/20 text-primary font-semibold" 
                  : "text-muted-foreground"
              )}>
                S{group.weekNum}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Days row */}
      <div className="flex border-b-2 border-border/50">
        <div 
          className="shrink-0 border-r border-border/50 bg-muted/30 flex items-center px-4"
          style={{ width: memberColumnWidth, height: isCompact ? 32 : 40 }}
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Collaborateur
          </span>
        </div>
        
        {days.map(day => {
          const isTodayDay = isToday(day);
          const isWeekendDay = isWeekend(day);
          
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "shrink-0 flex flex-col items-center justify-center border-r border-border/20",
                isCompact ? "h-8" : "h-10",
                isWeekendDay && "bg-muted/60",
                isTodayDay && "bg-primary/10"
              )}
              style={{ width: dayWidth }}
            >
              <span className={cn(
                "text-[9px] font-medium uppercase leading-none",
                isWeekendDay ? "text-muted-foreground/50" :
                isTodayDay ? "text-primary font-bold" : "text-muted-foreground"
              )}>
                {viewMode === 'quarter' 
                  ? format(day, 'EEEEE', { locale: fr }) 
                  : format(day, 'EEE', { locale: fr })}
              </span>
              <span className={cn(
                "text-xs tabular-nums font-medium leading-none mt-0.5",
                isWeekendDay ? "text-muted-foreground/50" :
                isTodayDay ? "text-primary font-bold" : "text-foreground"
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

// Today line indicator component - more prominent
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
      className="absolute top-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.5)]"
      style={{ left, height }}
    >
      {/* Top indicator dot */}
      <div className="absolute -top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-lg ring-2 ring-red-200" />
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full absolute animate-ping opacity-40" />
      </div>
    </div>
  );
}

// Weekend overlay for the grid
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
            className="absolute top-0 bg-muted/40 pointer-events-none"
            style={{ left, width: dayWidth, height }}
          />
        );
      })}
    </>
  );
}
