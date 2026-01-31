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
  rowHeight: number;
  memberColumnWidth: number;
}

interface DayCapacity {
  date: string;
  totalSlots: number;
  usedSlots: number;
  leaveSlots: number;
  holidaySlots: number;
  percentage: number;
}

export function GanttHeatmapOverlay({
  workloadData,
  startDate,
  endDate,
  dayWidth,
  rowHeight,
  memberColumnWidth,
}: GanttHeatmapOverlayProps) {
  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

  // Calculate daily capacity across all team members
  const dailyCapacity = useMemo(() => {
    const capacityMap = new Map<string, DayCapacity>();

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      capacityMap.set(dateStr, {
        date: dateStr,
        totalSlots: 0,
        usedSlots: 0,
        leaveSlots: 0,
        holidaySlots: 0,
        percentage: 0,
      });
    });

    workloadData.forEach(member => {
      member.days.forEach(day => {
        const capacity = capacityMap.get(day.date);
        if (!capacity) return;

        // Add 2 slots per member per day (morning + afternoon)
        capacity.totalSlots += 2;

        // Check morning
        if (day.morning.isHoliday) capacity.holidaySlots++;
        else if (day.morning.isLeave) capacity.leaveSlots++;
        else if (day.morning.slot) capacity.usedSlots++;

        // Check afternoon
        if (day.afternoon.isHoliday) capacity.holidaySlots++;
        else if (day.afternoon.isLeave) capacity.leaveSlots++;
        else if (day.afternoon.slot) capacity.usedSlots++;
      });
    });

    // Calculate percentages
    capacityMap.forEach(capacity => {
      const available = capacity.totalSlots - capacity.leaveSlots - capacity.holidaySlots;
      capacity.percentage = available > 0 
        ? Math.round((capacity.usedSlots / available) * 100)
        : 0;
    });

    return capacityMap;
  }, [workloadData, days]);

  const getHeatmapColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500/30';
    if (percentage >= 80) return 'bg-orange-500/25';
    if (percentage >= 60) return 'bg-amber-500/20';
    if (percentage >= 40) return 'bg-blue-500/15';
    if (percentage >= 20) return 'bg-emerald-500/10';
    return 'bg-transparent';
  };

  const getHeatmapLabel = (percentage: number) => {
    if (percentage >= 100) return 'Surchargé';
    if (percentage >= 80) return 'Charge élevée';
    if (percentage >= 60) return 'Charge moyenne';
    if (percentage >= 40) return 'Charge modérée';
    if (percentage >= 20) return 'Charge légère';
    return 'Peu chargé';
  };

  return (
    <div 
      className="absolute pointer-events-none z-5"
      style={{ 
        left: memberColumnWidth, 
        top: 0,
        bottom: 0,
      }}
    >
      <div className="flex h-full">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const capacity = dailyCapacity.get(dateStr);
          const isWeekendDay = isWeekend(day);

          if (isWeekendDay || !capacity) return (
            <div key={dateStr} style={{ width: dayWidth }} />
          );

          return (
            <Tooltip key={dateStr}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-full transition-colors pointer-events-auto",
                    getHeatmapColor(capacity.percentage)
                  )}
                  style={{ width: dayWidth }}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <p className="font-semibold">{format(day, 'EEEE d MMMM', { locale: require('date-fns/locale/fr').fr })}</p>
                  <p>{getHeatmapLabel(capacity.percentage)} ({capacity.percentage}%)</p>
                  <div className="text-muted-foreground">
                    <p>Utilisés: {capacity.usedSlots}/{capacity.totalSlots - capacity.leaveSlots - capacity.holidaySlots}</p>
                    {capacity.leaveSlots > 0 && <p>Congés: {capacity.leaveSlots} créneaux</p>}
                    {capacity.holidaySlots > 0 && <p>Fériés: {capacity.holidaySlots} créneaux</p>}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// Compact heatmap legend
export function HeatmapLegend() {
  const levels = [
    { color: 'bg-emerald-500', label: '0-20%' },
    { color: 'bg-blue-500', label: '20-40%' },
    { color: 'bg-amber-500', label: '40-60%' },
    { color: 'bg-orange-500', label: '60-80%' },
    { color: 'bg-red-500', label: '80%+' },
  ];

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>Charge:</span>
      <div className="flex items-center gap-0.5">
        {levels.map(({ color, label }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <div className={cn("w-4 h-3 rounded-sm", color)} />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
