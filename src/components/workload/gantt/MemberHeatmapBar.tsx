import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamMemberWorkload, WorkloadDay } from '@/types/workload';
import { eachDayOfInterval, format, isWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MemberHeatmapBarProps {
  member: TeamMemberWorkload;
  startDate: Date;
  endDate: Date;
  dayWidth: number;
}

interface DayLoad {
  date: string;
  morning: boolean;
  afternoon: boolean;
  hasLeave: boolean;
  hasHoliday: boolean;
  capacityPercent: number; // 0, 50, or 100
}

export function MemberHeatmapBar({
  member,
  startDate,
  endDate,
  dayWidth,
}: MemberHeatmapBarProps) {
  const days = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // Calculate daily load for each day
  const dailyLoads = useMemo(() => {
    const loads: DayLoad[] = [];
    
    // Create a map from member.days array for quick lookup
    const daysMap = new Map<string, WorkloadDay>();
    member.days?.forEach(d => daysMap.set(d.date, d));
    
    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const workloadDay = daysMap.get(dateStr);
      
      const morning = workloadDay?.morning?.slot !== null && workloadDay?.morning?.slot !== undefined;
      const afternoon = workloadDay?.afternoon?.slot !== null && workloadDay?.afternoon?.slot !== undefined;
      const hasLeave = workloadDay?.morning?.isLeave || workloadDay?.afternoon?.isLeave || false;
      const hasHoliday = workloadDay?.morning?.isHoliday || workloadDay?.afternoon?.isHoliday || false;
      
      // Calculate capacity usage (0%, 50%, or 100%)
      let capacityPercent = 0;
      if (morning && afternoon) capacityPercent = 100;
      else if (morning || afternoon) capacityPercent = 50;
      
      // If on leave or holiday, capacity is not applicable
      if (hasLeave || hasHoliday) capacityPercent = -1;
      
      loads.push({
        date: dateStr,
        morning,
        afternoon,
        hasLeave,
        hasHoliday,
        capacityPercent,
      });
    }
    
    return loads;
  }, [days, member.days]);

  const getHeatmapColor = (load: DayLoad, isWeekendDay: boolean) => {
    if (isWeekendDay) return 'bg-slate-100/50';
    if (load.hasHoliday) return 'bg-amber-200/80';
    if (load.hasLeave) return 'bg-violet-200/80';
    
    if (load.capacityPercent === 100) return 'bg-red-400';
    if (load.capacityPercent === 50) return 'bg-orange-300';
    return 'bg-emerald-200';
  };

  return (
    <div 
      className="absolute left-0 bottom-0 h-1 flex z-10"
      style={{ width: days.length * dayWidth }}
    >
      {dailyLoads.map((load, index) => {
        const day = days[index];
        const isWeekendDay = isWeekend(day);
        
        return (
          <Tooltip key={load.date}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "h-full transition-colors",
                  getHeatmapColor(load, isWeekendDay)
                )}
                style={{ width: dayWidth }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="font-medium">
                {format(day, 'EEEE d MMMM', { locale: fr })}
              </div>
              <div className="text-muted-foreground">
                {load.hasHoliday ? 'Jour férié' : 
                 load.hasLeave ? 'Congé' :
                 load.capacityPercent === 100 ? 'Journée complète' :
                 load.capacityPercent === 50 ? 'Demi-journée' :
                 'Disponible'}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// Summary capacity indicator for member row
interface CapacityIndicatorProps {
  percentage: number;
  className?: string;
}

export function CapacityIndicator({ percentage, className }: CapacityIndicatorProps) {
  const getColor = () => {
    if (percentage > 100) return { bar: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-500/20' };
    if (percentage >= 80) return { bar: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-500/20' };
    if (percentage >= 50) return { bar: 'bg-blue-500', text: 'text-blue-600', ring: 'ring-blue-500/20' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-500/20' };
  };

  const colors = getColor();
  const cappedWidth = Math.min(100, percentage);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "flex-1 h-2 bg-muted rounded-full overflow-hidden ring-1",
        colors.ring
      )}>
        <div 
          className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
          style={{ width: `${cappedWidth}%` }}
        />
      </div>
      <span className={cn(
        "text-[11px] font-bold tabular-nums min-w-[36px] text-right",
        colors.text
      )}>
        {percentage}%
      </span>
    </div>
  );
}

// Workload summary chip for group headers
interface WorkloadSummaryChipProps {
  taskCount: number;
  leaveCount: number;
  overloadedCount: number;
}

export function WorkloadSummaryChip({ taskCount, leaveCount, overloadedCount }: WorkloadSummaryChipProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
        <span className="font-semibold">{taskCount}</span>
        <span className="text-blue-600">tâches</span>
      </div>
      {leaveCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
          <span className="font-semibold">{leaveCount}</span>
          <span className="text-violet-600">congés</span>
        </div>
      )}
      {overloadedCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700">
          <span className="font-semibold">{overloadedCount}</span>
          <span className="text-red-600">surchargés</span>
        </div>
      )}
    </div>
  );
}
