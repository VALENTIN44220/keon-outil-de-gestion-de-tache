import { useMemo } from 'react';
import { format, eachDayOfInterval, isWeekend } from 'date-fns';
import { TeamMemberWorkload } from '@/types/workload';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface GanttHeatmapOverlayProps {
  workloadData: TeamMemberWorkload[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  memberColumnWidth: number;
  visible: boolean;
}

interface DayHeatData {
  date: string;
  totalCapacity: number;
  usedCapacity: number;
  percentage: number;
  level: 'low' | 'medium' | 'high' | 'overload';
}

export function GanttHeatmapOverlay({
  workloadData,
  startDate,
  endDate,
  dayWidth,
  memberColumnWidth,
  visible,
}: GanttHeatmapOverlayProps) {
  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

  // Calculate heatmap data per day
  const heatmapData = useMemo((): DayHeatData[] => {
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isWeekendDay = isWeekend(day);
      
      // Calculate total capacity and usage for this day across all members
      let totalCapacity = 0;
      let usedCapacity = 0;
      
      workloadData.forEach(member => {
        const dayData = member.days.find(d => d.date === dateStr);
        if (dayData) {
          // Each half-day not blocked by weekend/holiday/leave is capacity
          if (!dayData.morning.isWeekend && !dayData.morning.isHoliday && !dayData.morning.isLeave) {
            totalCapacity += 1;
            if (dayData.morning.slot) usedCapacity += 1;
          }
          if (!dayData.afternoon.isWeekend && !dayData.afternoon.isHoliday && !dayData.afternoon.isLeave) {
            totalCapacity += 1;
            if (dayData.afternoon.slot) usedCapacity += 1;
          }
        }
      });
      
      const percentage = totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0;
      
      let level: 'low' | 'medium' | 'high' | 'overload' = 'low';
      if (percentage >= 100) level = 'overload';
      else if (percentage >= 80) level = 'high';
      else if (percentage >= 50) level = 'medium';
      
      return {
        date: dateStr,
        totalCapacity,
        usedCapacity,
        percentage,
        level,
      };
    });
  }, [days, workloadData]);

  if (!visible) return null;

  const getHeatColor = (level: DayHeatData['level'], percentage: number) => {
    switch (level) {
      case 'overload':
        return 'bg-red-500/40';
      case 'high':
        return 'bg-orange-500/30';
      case 'medium':
        return 'bg-blue-500/20';
      case 'low':
        return 'bg-emerald-500/10';
      default:
        return 'bg-transparent';
    }
  };

  return (
    <div 
      className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-5"
      style={{ marginLeft: memberColumnWidth }}
    >
      <div className="flex h-full">
        {heatmapData.map((heat, index) => (
          <Tooltip key={heat.date}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "h-full transition-colors pointer-events-auto cursor-default",
                  getHeatColor(heat.level, heat.percentage)
                )}
                style={{ width: dayWidth }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-1">
                <p className="font-medium">{format(new Date(heat.date), 'EEEE d MMM', { locale: undefined })}</p>
                <p>Charge: <span className="font-semibold">{heat.percentage}%</span></p>
                <p className="text-muted-foreground">
                  {heat.usedCapacity}/{heat.totalCapacity} créneaux utilisés
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
