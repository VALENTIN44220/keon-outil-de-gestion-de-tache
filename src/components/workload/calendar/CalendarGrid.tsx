import { useMemo, useCallback } from 'react';
import { TeamMemberWorkload, WorkloadSlot, Holiday, UserLeave } from '@/types/workload';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Scissors, Trash2, ExternalLink, Calendar, Sun, Umbrella, Clock } from 'lucide-react';
import { format, isToday, isWeekend, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, getWeek, isSameMonth, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// Couleurs pour les collaborateurs
const USER_COLORS = [
  { bg: 'from-cyan-400 to-cyan-500', light: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-300' },
  { bg: 'from-emerald-400 to-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300' },
  { bg: 'from-amber-400 to-amber-500', light: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300' },
  { bg: 'from-rose-400 to-rose-500', light: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-300' },
  { bg: 'from-violet-400 to-violet-500', light: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-300' },
  { bg: 'from-blue-400 to-blue-500', light: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300' },
  { bg: 'from-orange-400 to-orange-500', light: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-300' },
  { bg: 'from-pink-400 to-pink-500', light: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-300' },
  { bg: 'from-teal-400 to-teal-500', light: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-300' },
  { bg: 'from-indigo-400 to-indigo-500', light: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-300' },
];

type ViewLevel = 'year' | 'quarter' | 'month' | 'week';

interface CalendarGridProps {
  workloadData: TeamMemberWorkload[];
  holidays: Holiday[];
  leaves: UserLeave[];
  tasks: Task[];
  currentDate: Date;
  viewLevel: ViewLevel;
  showHeatmap?: boolean;
  dropTarget: { userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null;
  onCellClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
  onDragOver: (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onSlotDragStart: (e: React.DragEvent, slot: WorkloadSlot) => void;
  onSlotDelete: (slot: WorkloadSlot) => void;
  onSlotSegment: (slot: WorkloadSlot, userId: string) => void;
  isHalfDayAvailable?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
}

export function CalendarGrid({
  workloadData,
  holidays,
  leaves,
  tasks,
  currentDate,
  viewLevel,
  showHeatmap = false,
  dropTarget,
  onCellClick,
  onTaskClick,
  onDragOver,
  onDragLeave,
  onDrop,
  onSlotDragStart,
  onSlotDelete,
  onSlotSegment,
  isHalfDayAvailable,
}: CalendarGridProps) {
  // Color mapping for users
  const userColorMap = useMemo(() => {
    const map = new Map<string, typeof USER_COLORS[0]>();
    workloadData.forEach((member, index) => {
      map.set(member.memberId, USER_COLORS[index % USER_COLORS.length]);
    });
    return map;
  }, [workloadData]);

  const getUserColor = useCallback((userId: string) => {
    return userColorMap.get(userId) || USER_COLORS[0];
  }, [userColorMap]);

  // Calculate date range based on view level
  const { days, rangeStart, rangeEnd } = useMemo(() => {
    let start: Date, end: Date;
    
    switch (viewLevel) {
      case 'year':
        start = startOfYear(currentDate);
        end = endOfYear(currentDate);
        break;
      case 'quarter':
        start = startOfQuarter(currentDate);
        end = endOfQuarter(currentDate);
        break;
      case 'week':
        start = startOfWeek(currentDate, { locale: fr });
        end = endOfWeek(currentDate, { locale: fr });
        break;
      case 'month':
      default:
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        break;
    }
    
    return {
      rangeStart: start,
      rangeEnd: end,
      days: eachDayOfInterval({ start, end }),
    };
  }, [currentDate, viewLevel]);

  // Get weeks for year view
  const weeks = useMemo(() => {
    if (viewLevel !== 'year') return [];
    
    const allWeeks: { weekNum: number; startDate: Date; days: Date[] }[] = [];
    let currentWeekDays: Date[] = [];
    let lastWeekNum = -1;
    
    days.forEach((day) => {
      const weekNum = getWeek(day, { locale: fr });
      if (weekNum !== lastWeekNum) {
        if (currentWeekDays.length > 0) {
          allWeeks.push({ 
            weekNum: lastWeekNum, 
            startDate: currentWeekDays[0],
            days: currentWeekDays 
          });
        }
        currentWeekDays = [];
        lastWeekNum = weekNum;
      }
      currentWeekDays.push(day);
    });
    
    if (currentWeekDays.length > 0) {
      allWeeks.push({ 
        weekNum: lastWeekNum, 
        startDate: currentWeekDays[0],
        days: currentWeekDays 
      });
    }
    
    return allWeeks;
  }, [days, viewLevel]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isHoliday = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.some(h => h.date === dateStr);
  }, [holidays]);

  const getHolidayName = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.find(h => h.date === dateStr)?.name || '';
  }, [holidays]);

  const isUserOnLeave = useCallback((userId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return leaves.some(l => 
      l.user_id === userId && 
      l.status !== 'cancelled' &&
      dateStr >= l.start_date && 
      dateStr <= l.end_date
    );
  }, [leaves]);

  const getLeaveType = useCallback((userId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const leave = leaves.find(l => 
      l.user_id === userId && 
      l.status !== 'cancelled' &&
      dateStr >= l.start_date && 
      dateStr <= l.end_date
    );
    return leave?.leave_type || 'Congé';
  }, [leaves]);

  const getHeatmapColor = (usedSlots: number, totalSlots: number) => {
    if (totalSlots === 0) return '';
    const ratio = usedSlots / totalSlots;
    if (ratio === 0) return 'bg-slate-50 dark:bg-slate-900/20';
    if (ratio < 0.5) return 'bg-emerald-50 dark:bg-emerald-900/20';
    if (ratio < 0.8) return 'bg-amber-50 dark:bg-amber-900/20';
    if (ratio < 1) return 'bg-orange-50 dark:bg-orange-900/20';
    return 'bg-red-50 dark:bg-red-900/20';
  };

  // Render week view
  const renderWeekView = () => (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid border-b" style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(120px, 1fr))` }}>
        <div className="p-3 bg-muted/50 font-medium text-sm text-muted-foreground border-r sticky left-0 z-10">
          Collaborateurs
        </div>
        {days.map((day) => (
          <div 
            key={day.toISOString()}
            className={cn(
              "p-3 text-center border-r last:border-r-0",
              isToday(day) && "bg-primary/5",
              isWeekend(day) && "bg-muted/50",
              isHoliday(day) && "bg-amber-50 dark:bg-amber-950/30"
            )}
          >
            <p className={cn(
              "text-xs uppercase font-medium",
              isToday(day) ? "text-primary" : "text-muted-foreground"
            )}>
              {format(day, 'EEE', { locale: fr })}
            </p>
            <p className={cn(
              "text-lg font-semibold",
              isToday(day) && "text-primary"
            )}>
              {format(day, 'd')}
            </p>
            {isHoliday(day) && (
              <p className="text-[10px] text-amber-600 truncate">{getHolidayName(day)}</p>
            )}
          </div>
        ))}
      </div>

      {/* Body - Members */}
      <div className="divide-y">
        {workloadData.map((member) => {
          const color = getUserColor(member.memberId);
          const availableSlots = member.totalSlots - member.leaveSlots - member.holidaySlots;
          const capacityPercent = availableSlots > 0 
            ? Math.round((member.usedSlots / availableSlots) * 100) 
            : 0;

          return (
            <div 
              key={member.memberId}
              className="grid"
              style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(120px, 1fr))` }}
            >
              {/* Member info */}
              <div className="p-3 bg-card border-r sticky left-0 z-10 flex items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0 ring-2 ring-offset-2" style={{ '--tw-ring-color': `hsl(var(--${color.border.replace('border-', '')}))` } as any}>
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className={cn("text-xs font-medium bg-gradient-to-br text-white", color.bg)}>
                    {getInitials(member.memberName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{member.memberName}</p>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min(capacityPercent, 100)} 
                      className="h-1.5 flex-1"
                    />
                    <span className={cn(
                      "text-[10px] font-medium",
                      capacityPercent >= 100 ? "text-red-600" : 
                      capacityPercent >= 80 ? "text-orange-600" : "text-muted-foreground"
                    )}>
                      {capacityPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Day cells */}
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayData = member.days.find(d => d.date === dateStr);
                const isWeekendDay = isWeekend(day);
                const isHolidayDay = isHoliday(day);
                const isLeaveDay = dayData?.morning.isLeave || dayData?.afternoon.isLeave || isUserOnLeave(member.memberId, day);

                if (isWeekendDay || isHolidayDay) {
                  return (
                    <div 
                      key={dateStr}
                      className={cn(
                        "p-2 border-r last:border-r-0 min-h-[80px]",
                        isWeekendDay && "bg-muted/30",
                        isHolidayDay && "bg-amber-50/50 dark:bg-amber-950/20"
                      )}
                    >
                      {isHolidayDay && (
                        <div className="h-full flex items-center justify-center">
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            <Sun className="h-3 w-3 mr-1" />
                            Férié
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div 
                    key={dateStr}
                    className={cn(
                      "p-1.5 border-r last:border-r-0 min-h-[80px] flex flex-col gap-1",
                      isToday(day) && "bg-primary/5",
                      showHeatmap && getHeatmapColor((dayData?.morning.slot ? 1 : 0) + (dayData?.afternoon.slot ? 1 : 0), 2)
                    )}
                  >
                    {/* Morning */}
                    <HalfDayCell
                      member={member}
                      date={day}
                      dateStr={dateStr}
                      halfDay="morning"
                      dayData={dayData}
                      isLeaveDay={isLeaveDay}
                      leaveType={getLeaveType(member.memberId, day)}
                      dropTarget={dropTarget}
                      tasks={tasks}
                      color={color}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      onSlotDragStart={onSlotDragStart}
                      onSlotDelete={onSlotDelete}
                      onSlotSegment={onSlotSegment}
                      onTaskClick={onTaskClick}
                      isHalfDayAvailable={isHalfDayAvailable}
                    />
                    
                    {/* Afternoon */}
                    <HalfDayCell
                      member={member}
                      date={day}
                      dateStr={dateStr}
                      halfDay="afternoon"
                      dayData={dayData}
                      isLeaveDay={isLeaveDay}
                      leaveType={getLeaveType(member.memberId, day)}
                      dropTarget={dropTarget}
                      tasks={tasks}
                      color={color}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      onSlotDragStart={onSlotDragStart}
                      onSlotDelete={onSlotDelete}
                      onSlotSegment={onSlotSegment}
                      onTaskClick={onTaskClick}
                      isHalfDayAvailable={isHalfDayAvailable}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render month view - more compact grid
  const renderMonthView = () => (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid border-b" style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(40px, 1fr))` }}>
        <div className="p-2 bg-muted/50 font-medium text-xs text-muted-foreground border-r sticky left-0 z-10">
          Équipe
        </div>
        {days.map((day) => (
          <div 
            key={day.toISOString()}
            onClick={() => onCellClick(day)}
            className={cn(
              "p-1 text-center border-r last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors",
              isToday(day) && "bg-primary/10",
              isWeekend(day) && "bg-muted/50",
              isHoliday(day) && "bg-amber-50/50 dark:bg-amber-950/20"
            )}
          >
            <p className={cn(
              "text-[10px] uppercase",
              isToday(day) ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              {format(day, 'EEE', { locale: fr })[0]}
            </p>
            <p className={cn(
              "text-sm font-medium",
              isToday(day) && "text-primary"
            )}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="divide-y">
        {workloadData.map((member) => {
          const color = getUserColor(member.memberId);

          return (
            <div 
              key={member.memberId}
              className="grid"
              style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(40px, 1fr))` }}
            >
              {/* Member */}
              <div className="p-2 bg-card border-r sticky left-0 z-10 flex items-center gap-2">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className={cn("text-[10px] font-medium bg-gradient-to-br text-white", color.bg)}>
                    {getInitials(member.memberName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium truncate">{member.memberName}</span>
              </div>

              {/* Days */}
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayData = member.days.find(d => d.date === dateStr);
                const isWeekendDay = isWeekend(day);
                const isHolidayDay = isHoliday(day);
                const isLeaveDay = isUserOnLeave(member.memberId, day);
                const slotsCount = dayData ? (dayData.morning.slot ? 1 : 0) + (dayData.afternoon.slot ? 1 : 0) : 0;

                return (
                  <div 
                    key={dateStr}
                    onClick={() => onCellClick(day)}
                    className={cn(
                      "p-0.5 border-r last:border-r-0 min-h-[36px] cursor-pointer hover:bg-muted/30 transition-colors",
                      isWeekendDay && "bg-muted/30",
                      isHolidayDay && "bg-amber-50/30 dark:bg-amber-950/10",
                      isToday(day) && "bg-primary/5",
                      showHeatmap && !isWeekendDay && !isHolidayDay && getHeatmapColor(slotsCount, 2)
                    )}
                  >
                    {isLeaveDay ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Umbrella className="h-3 w-3 text-slate-500" />
                        </div>
                      </div>
                    ) : slotsCount > 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className={cn(
                          "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br",
                          color.bg
                        )}>
                          {slotsCount > 2 ? `${slotsCount}` : slotsCount === 2 ? '●●' : '●'}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render quarter view - aggregate by week
  const renderQuarterView = () => {
    const quarterWeeks = useMemo(() => {
      const allWeeks: { weekNum: number; startDate: Date; endDate: Date }[] = [];
      let current = rangeStart;
      
      while (current <= rangeEnd) {
        const weekStart = startOfWeek(current, { locale: fr });
        const weekEnd = endOfWeek(current, { locale: fr });
        const weekNum = getWeek(current, { locale: fr });
        
        if (!allWeeks.find(w => w.weekNum === weekNum)) {
          allWeeks.push({ weekNum, startDate: weekStart, endDate: weekEnd });
        }
        current = addDays(weekEnd, 1);
      }
      
      return allWeeks;
    }, [rangeStart, rangeEnd]);

    return (
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid border-b" style={{ gridTemplateColumns: `180px repeat(${quarterWeeks.length}, minmax(60px, 1fr))` }}>
          <div className="p-2 bg-muted/50 font-medium text-xs text-muted-foreground border-r sticky left-0 z-10">
            Équipe
          </div>
          {quarterWeeks.map((week) => (
            <div 
              key={week.weekNum}
              onClick={() => onCellClick(week.startDate)}
              className="p-2 text-center border-r last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <p className="text-[10px] text-muted-foreground">S{week.weekNum}</p>
              <p className="text-xs font-medium">
                {format(week.startDate, 'd', { locale: fr })}-{format(week.endDate, 'd MMM', { locale: fr })}
              </p>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="divide-y">
          {workloadData.map((member) => {
            const color = getUserColor(member.memberId);

            return (
              <div 
                key={member.memberId}
                className="grid"
                style={{ gridTemplateColumns: `180px repeat(${quarterWeeks.length}, minmax(60px, 1fr))` }}
              >
                {/* Member */}
                <div className="p-2 bg-card border-r sticky left-0 z-10 flex items-center gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={member.avatarUrl || undefined} />
                    <AvatarFallback className={cn("text-[10px] font-medium bg-gradient-to-br text-white", color.bg)}>
                      {getInitials(member.memberName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate">{member.memberName}</span>
                </div>

                {/* Weeks */}
                {quarterWeeks.map((week) => {
                  // Count slots in this week
                  const weekDays = eachDayOfInterval({ start: week.startDate, end: week.endDate });
                  let weekSlots = 0;
                  let weekLeave = 0;
                  
                  weekDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayData = member.days.find(d => d.date === dateStr);
                    if (dayData) {
                      weekSlots += (dayData.morning.slot ? 1 : 0) + (dayData.afternoon.slot ? 1 : 0);
                    }
                    if (isUserOnLeave(member.memberId, day)) {
                      weekLeave += 2;
                    }
                  });

                  const loadPercent = weekSlots > 0 ? Math.min((weekSlots / 10) * 100, 100) : 0;

                  return (
                    <div 
                      key={week.weekNum}
                      onClick={() => onCellClick(week.startDate)}
                      className={cn(
                        "p-1.5 border-r last:border-r-0 min-h-[40px] cursor-pointer hover:bg-muted/30 transition-colors",
                        showHeatmap && getHeatmapColor(weekSlots, 10)
                      )}
                    >
                      {weekLeave > 0 && weekSlots === 0 ? (
                        <div className="h-full flex items-center justify-center">
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-slate-50">
                            <Umbrella className="h-3 w-3" />
                          </Badge>
                        </div>
                      ) : weekSlots > 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-1">
                          <div className={cn(
                            "h-5 px-2 rounded flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-r",
                            color.bg
                          )}>
                            {weekSlots / 2}j
                          </div>
                          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full bg-gradient-to-r", color.bg)}
                              style={{ width: `${loadPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render year view - aggregate by week
  const renderYearView = () => (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid border-b" style={{ gridTemplateColumns: `160px repeat(${weeks.length}, minmax(24px, 1fr))` }}>
        <div className="p-2 bg-muted/50 font-medium text-xs text-muted-foreground border-r sticky left-0 z-10">
          Équipe
        </div>
        {weeks.map((week, idx) => {
          const isNewMonth = idx === 0 || !isSameMonth(week.startDate, weeks[idx - 1].startDate);
          return (
            <div 
              key={week.weekNum}
              onClick={() => onCellClick(week.startDate)}
              className={cn(
                "p-1 text-center border-r last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors",
                isNewMonth && "border-l-2 border-l-muted-foreground/20"
              )}
            >
              <p className="text-[9px] text-muted-foreground">{week.weekNum}</p>
              {isNewMonth && (
                <p className="text-[8px] font-medium text-primary truncate">
                  {format(week.startDate, 'MMM', { locale: fr })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="divide-y">
        {workloadData.map((member) => {
          const color = getUserColor(member.memberId);

          return (
            <div 
              key={member.memberId}
              className="grid"
              style={{ gridTemplateColumns: `160px repeat(${weeks.length}, minmax(24px, 1fr))` }}
            >
              {/* Member */}
              <div className="p-1.5 bg-card border-r sticky left-0 z-10 flex items-center gap-1.5">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className={cn("text-[9px] font-medium bg-gradient-to-br text-white", color.bg)}>
                    {getInitials(member.memberName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px] font-medium truncate">{member.memberName}</span>
              </div>

              {/* Weeks */}
              {weeks.map((week) => {
                // Count slots in this week
                let weekSlots = 0;
                week.days.forEach(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayData = member.days.find(d => d.date === dateStr);
                  if (dayData) {
                    weekSlots += (dayData.morning.slot ? 1 : 0) + (dayData.afternoon.slot ? 1 : 0);
                  }
                });

                const loadLevel = weekSlots === 0 ? 0 : weekSlots <= 4 ? 1 : weekSlots <= 8 ? 2 : 3;

                return (
                  <div 
                    key={week.weekNum}
                    onClick={() => onCellClick(week.startDate)}
                    className={cn(
                      "p-0.5 border-r last:border-r-0 min-h-[28px] cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-center"
                    )}
                  >
                    {loadLevel > 0 && (
                      <div className={cn(
                        "h-4 w-4 rounded-sm bg-gradient-to-br",
                        loadLevel === 1 && "opacity-40",
                        loadLevel === 2 && "opacity-70",
                        loadLevel === 3 && "opacity-100",
                        color.bg
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  switch (viewLevel) {
    case 'year':
      return renderYearView();
    case 'quarter':
      return renderQuarterView();
    case 'month':
      return renderMonthView();
    case 'week':
    default:
      return renderWeekView();
  }
}

// Half-day cell component for week view
function HalfDayCell({
  member,
  date,
  dateStr,
  halfDay,
  dayData,
  isLeaveDay,
  leaveType,
  dropTarget,
  tasks,
  color,
  onDragOver,
  onDragLeave,
  onDrop,
  onSlotDragStart,
  onSlotDelete,
  onSlotSegment,
  onTaskClick,
  isHalfDayAvailable,
}: {
  member: TeamMemberWorkload;
  date: Date;
  dateStr: string;
  halfDay: 'morning' | 'afternoon';
  dayData: TeamMemberWorkload['days'][0] | undefined;
  isLeaveDay: boolean;
  leaveType: string;
  dropTarget: { userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null;
  tasks: Task[];
  color: typeof USER_COLORS[0];
  onDragOver: (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onSlotDragStart: (e: React.DragEvent, slot: WorkloadSlot) => void;
  onSlotDelete: (slot: WorkloadSlot) => void;
  onSlotSegment: (slot: WorkloadSlot, userId: string) => void;
  onTaskClick: (task: Task) => void;
  isHalfDayAvailable?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
}) {
  const slot = halfDay === 'morning' ? dayData?.morning.slot : dayData?.afternoon.slot;
  const isDropTarget = dropTarget?.userId === member.memberId && 
                       dropTarget?.date === dateStr && 
                       dropTarget?.halfDay === halfDay;
  const isAvailable = !slot && !isLeaveDay && (!isHalfDayAvailable || isHalfDayAvailable(member.memberId, dateStr, halfDay));

  if (isLeaveDay) {
    return (
      <div className="flex-1 rounded-md bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-[10px] text-slate-500 gap-1">
        <Umbrella className="h-3 w-3" />
        {halfDay === 'morning' && <span className="hidden sm:inline truncate">{leaveType}</span>}
      </div>
    );
  }

  if (slot) {
    const task = tasks.find(t => t.id === slot.task_id);
    
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  draggable
                  onDragStart={(e) => onSlotDragStart(e, slot)}
                  onClick={() => task && onTaskClick(task)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 cursor-grab active:cursor-grabbing",
                    "bg-gradient-to-r text-white text-[10px] font-medium truncate",
                    "shadow-sm hover:shadow-md transition-all duration-200",
                    "flex items-center gap-1",
                    color.bg
                  )}
                >
                  <Clock className="h-3 w-3 shrink-0 opacity-70" />
                  <span className="truncate">{task?.title || 'Tâche'}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">{task?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {halfDay === 'morning' ? 'Matin (8h-12h)' : 'Après-midi (14h-18h)'}
                  </p>
                  {task?.description && (
                    <p className="text-xs">{task.description}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => task && onTaskClick(task)}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Voir les détails
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onSlotSegment(slot, member.memberId)}>
            <Scissors className="h-4 w-4 mr-2" />
            Segmenter
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem 
            onClick={() => onSlotDelete(slot)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <div
      onDragOver={(e) => onDragOver(e, member.memberId, dateStr, halfDay)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, member.memberId, dateStr, halfDay)}
      className={cn(
        "flex-1 rounded-md border border-dashed transition-all duration-200",
        isDropTarget 
          ? "border-primary bg-primary/10 scale-[1.02]" 
          : isAvailable 
            ? "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30" 
            : "border-transparent bg-muted/20"
      )}
    />
  );
}
