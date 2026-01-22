import { useMemo } from 'react';
import { format, isToday, isWeekend, getWeek, startOfWeek, isSameWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface GanttTimelineProps {
  days: Date[];
  dayWidth: number;
  viewMode: 'week' | 'month' | 'quarter';
  isCompact?: boolean;
}

export function GanttTimeline({ days, dayWidth, viewMode, isCompact = false }: GanttTimelineProps) {
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
    <div className="sticky top-0 z-20 bg-card border-b-2 border-border/50">
      {/* Week row */}
      <div className="flex border-b border-border/30">
        <div className={cn(
          "shrink-0 border-r-2 border-border/50 bg-muted/30",
          isCompact ? "w-48" : "w-60"
        )} />
        
        {weekGroups.map((group, idx) => {
          const isCurrentWeek = group.days.some(d => isSameWeek(d, new Date(), { locale: fr }));
          const width = group.days.length * dayWidth;
          
          return (
            <div
              key={`week-${group.year}-${group.weekNum}-${idx}`}
              className={cn(
                "flex items-center justify-center border-r border-border/30",
                "text-xs font-semibold",
                isCurrentWeek ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}
              style={{ width }}
            >
              <span className={cn(
                "px-2 py-1 rounded",
                isCurrentWeek && "bg-primary/20"
              )}>
                S{group.weekNum}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Days row */}
      <div className="flex">
        <div className={cn(
          "shrink-0 border-r-2 border-border/50 bg-muted/30 flex items-center px-4",
          isCompact ? "w-48 h-8" : "w-60 h-10"
        )}>
          <span className="text-xs font-medium text-muted-foreground">Collaborateur</span>
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
                isWeekendDay && "bg-muted/50",
                isTodayDay && "bg-primary/10"
              )}
              style={{ width: dayWidth }}
            >
              <span className={cn(
                "text-[10px] font-medium uppercase",
                isWeekendDay ? "text-muted-foreground/60" :
                isTodayDay ? "text-primary font-bold" : "text-muted-foreground"
              )}>
                {viewMode === 'quarter' 
                  ? format(day, 'E', { locale: fr }).charAt(0) 
                  : format(day, 'EEE', { locale: fr })}
              </span>
              <span className={cn(
                "text-xs tabular-nums",
                isWeekendDay ? "text-muted-foreground/60" :
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

// Today line indicator component
export function TodayLine({ 
  days, 
  dayWidth, 
  headerOffset 
}: { 
  days: Date[]; 
  dayWidth: number;
  headerOffset: number;
}) {
  const todayIndex = days.findIndex(d => isToday(d));
  if (todayIndex === -1) return null;
  
  const left = headerOffset + (todayIndex * dayWidth) + (dayWidth / 2);
  
  return (
    <div 
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
      style={{ left }}
    >
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow-lg" />
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-50" />
    </div>
  );
}