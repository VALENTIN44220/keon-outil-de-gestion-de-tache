import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isWeekend, parseISO, addMonths, addWeeks, addYears, startOfYear, endOfYear, getWeek, getYear, startOfQuarter, endOfQuarter, isSameMonth, isSameWeek, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TeamMemberWorkload, WorkloadSlot, Holiday, UserLeave } from '@/types/workload';
import { Task } from '@/types/task';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Scissors, Trash2, CheckCircle2, ZoomIn, ZoomOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Couleurs pour les collaborateurs - style Teamleader
const USER_COLORS = [
  { bg: 'bg-cyan-500', text: 'text-white', light: 'bg-cyan-100 dark:bg-cyan-900/40', border: 'border-cyan-400' },
  { bg: 'bg-emerald-500', text: 'text-white', light: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-400' },
  { bg: 'bg-amber-500', text: 'text-white', light: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-400' },
  { bg: 'bg-rose-500', text: 'text-white', light: 'bg-rose-100 dark:bg-rose-900/40', border: 'border-rose-400' },
  { bg: 'bg-violet-500', text: 'text-white', light: 'bg-violet-100 dark:bg-violet-900/40', border: 'border-violet-400' },
  { bg: 'bg-blue-500', text: 'text-white', light: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-400' },
  { bg: 'bg-orange-500', text: 'text-white', light: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-400' },
  { bg: 'bg-pink-500', text: 'text-white', light: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-400' },
  { bg: 'bg-teal-500', text: 'text-white', light: 'bg-teal-100 dark:bg-teal-900/40', border: 'border-teal-400' },
  { bg: 'bg-indigo-500', text: 'text-white', light: 'bg-indigo-100 dark:bg-indigo-900/40', border: 'border-indigo-400' },
];

// Types de vue calendrier
type CalendarViewLevel = 'year' | 'quarter' | 'month' | 'week';

interface DropContext {
  task: Task;
  userId: string;
  date: string;
  halfDay: 'morning' | 'afternoon';
  taskDuration: number;
}

interface SegmentContext {
  slot: WorkloadSlot;
  userId: string;
  currentCount: number;
  taskDuration: number;
}

function getValidSegmentOptions(totalHalfDays: number): number[] {
  const options: number[] = [];
  for (let i = 1; i <= totalHalfDays; i++) {
    if (totalHalfDays % i === 0) {
      options.push(i);
    }
  }
  return options;
}

interface WorkloadCalendarViewProps {
  workloadData: TeamMemberWorkload[];
  holidays: Holiday[];
  leaves: UserLeave[];
  selectedUserId: string | null;
  onUserSelect: (userId: string | null) => void;
  viewMode?: 'week' | 'month' | 'quarter';
  startDate?: Date;
  endDate?: Date;
  // Task assignment props
  tasks?: Task[];
  onSlotAdd?: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon') => Promise<void>;
  onSlotRemove?: (slotId: string) => Promise<void>;
  onSlotMove?: (slotId: string, newDate: string, newHalfDay: 'morning' | 'afternoon') => Promise<void>;
  onMultiSlotAdd?: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', count: number) => Promise<void>;
  onSegmentSlot?: (slot: WorkloadSlot, userId: string, segments: number) => Promise<void>;
  isHalfDayAvailable?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
  getTaskSlotsCount?: (taskId: string, userId: string) => number;
  getTaskDuration?: (taskId: string) => number | null;
  getTaskProgress?: (taskId: string) => { completed: number; total: number } | null;
  plannedTaskIds?: string[];
}

export function WorkloadCalendarView({
  workloadData,
  holidays,
  leaves,
  selectedUserId,
  onUserSelect,
  viewMode: externalViewMode = 'month',
  startDate: externalStartDate,
  endDate: externalEndDate,
  tasks = [],
  onSlotAdd,
  onSlotRemove,
  onSlotMove,
  onMultiSlotAdd,
  onSegmentSlot,
  isHalfDayAvailable,
  getTaskSlotsCount,
  getTaskDuration,
  getTaskProgress,
  plannedTaskIds = [],
}: WorkloadCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewLevel, setViewLevel] = useState<CalendarViewLevel>(() => {
    switch (externalViewMode) {
      case 'week': return 'week';
      case 'quarter': return 'quarter';
      case 'month':
      default: return 'month';
    }
  });
  
  // Synchronize viewLevel when external viewMode changes
  useEffect(() => {
    switch (externalViewMode) {
      case 'week': 
        setViewLevel('week');
        break;
      case 'quarter': 
        setViewLevel('quarter');
        break;
      case 'month':
      default: 
        setViewLevel('month');
        break;
    }
  }, [externalViewMode]);
  
  // Drag & drop state
  const [draggedSlot, setDraggedSlot] = useState<WorkloadSlot | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<{ userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null>(null);
  
  // Dialogs state
  const [showMultiSlotDialog, setShowMultiSlotDialog] = useState(false);
  const [multiSlotContext, setMultiSlotContext] = useState<DropContext | null>(null);
  const [halfDayCount, setHalfDayCount] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [segmentContext, setSegmentContext] = useState<SegmentContext | null>(null);
  const [newSegmentCount, setNewSegmentCount] = useState(1);

  // Map user IDs to consistent colors
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
  const { rangeStart, rangeEnd, days, weeks } = useMemo(() => {
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
    
    const allDays = eachDayOfInterval({ start, end });
    
    // Group days by week for year view
    const weeksArr: Date[][] = [];
    let currentWeek: Date[] = [];
    allDays.forEach((day, idx) => {
      currentWeek.push(day);
      if (day.getDay() === 0 || idx === allDays.length - 1) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return {
      rangeStart: start,
      rangeEnd: end,
      days: allDays,
      weeks: weeksArr,
    };
  }, [currentDate, viewLevel]);

  // Group days by month for quarter view
  const monthGroups = useMemo(() => {
    if (viewLevel !== 'quarter') return null;
    
    const groups: { month: Date; days: Date[] }[] = [];
    let currentMonth: Date | null = null;
    let currentMonthDays: Date[] = [];
    
    days.forEach(day => {
      const monthStart = startOfMonth(day);
      if (!currentMonth || !isSameMonth(day, currentMonth)) {
        if (currentMonthDays.length > 0) {
          groups.push({ month: currentMonth!, days: currentMonthDays });
        }
        currentMonth = monthStart;
        currentMonthDays = [];
      }
      currentMonthDays.push(day);
    });
    
    if (currentMonthDays.length > 0 && currentMonth) {
      groups.push({ month: currentMonth, days: currentMonthDays });
    }
    
    return groups;
  }, [days, viewLevel]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const selectedMember = selectedUserId 
    ? workloadData.find(m => m.memberId === selectedUserId) 
    : null;

  // Get all leaves for all users
  const allUserLeaves = useMemo(() => {
    const leavesByDate: Record<string, { userId: string; userName: string; leaveType: string }[]> = {};
    
    leaves.forEach(leave => {
      if (leave.status === 'cancelled') return;
      if (selectedUserId && leave.user_id !== selectedUserId) return;
      
      const member = workloadData.find(m => m.memberId === leave.user_id);
      if (!member) return;
      
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      const leaveDays = eachDayOfInterval({ start, end });
      
      leaveDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (!leavesByDate[dateStr]) {
          leavesByDate[dateStr] = [];
        }
        leavesByDate[dateStr].push({
          userId: leave.user_id,
          userName: member.memberName,
          leaveType: leave.leave_type,
        });
      });
    });
    
    return leavesByDate;
  }, [leaves, workloadData, selectedUserId]);

  const getDayInfo = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const holiday = holidays.find(h => h.date === dateStr);
    const dayLeaves = allUserLeaves[dateStr] || [];
    
    let memberData = null;
    if (selectedMember) {
      memberData = selectedMember.days.find(d => d.date === dateStr);
    }

    return { holiday, memberData, isWeekendDay: isWeekend(date), dayLeaves };
  };

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1;
    switch (viewLevel) {
      case 'year':
        setCurrentDate(prev => addYears(prev, offset));
        break;
      case 'quarter':
        setCurrentDate(prev => addMonths(prev, 3 * offset));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, offset));
        break;
      case 'month':
      default:
        setCurrentDate(prev => addMonths(prev, offset));
        break;
    }
  };

  const getPeriodLabel = () => {
    switch (viewLevel) {
      case 'year':
        return format(currentDate, 'yyyy');
      case 'quarter':
        const q = Math.floor(currentDate.getMonth() / 3) + 1;
        return `T${q} ${format(currentDate, 'yyyy')}`;
      case 'week':
        return `Semaine ${getWeek(currentDate, { locale: fr })} - ${format(currentDate, 'yyyy')}`;
      case 'month':
      default:
        return format(rangeStart, 'MMMM yyyy', { locale: fr });
    }
  };

  // Zoom in: year -> quarter -> month -> week
  const zoomIn = (targetDate?: Date) => {
    const date = targetDate || currentDate;
    switch (viewLevel) {
      case 'year':
        setViewLevel('quarter');
        setCurrentDate(date);
        break;
      case 'quarter':
        setViewLevel('month');
        setCurrentDate(date);
        break;
      case 'month':
        setViewLevel('week');
        setCurrentDate(date);
        break;
    }
  };

  // Zoom out: week -> month -> quarter -> year
  const zoomOut = () => {
    switch (viewLevel) {
      case 'week':
        setViewLevel('month');
        break;
      case 'month':
        setViewLevel('quarter');
        break;
      case 'quarter':
        setViewLevel('year');
        break;
    }
  };

  // Handle click on a day/week cell to drill down
  const handleCellClick = (date: Date) => {
    if (viewLevel !== 'week') {
      zoomIn(date);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, slot: WorkloadSlot) => {
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    const dayDate = parseISO(date);
    if (isWeekend(dayDate)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.preventDefault();
    setDropTarget({ userId, date, halfDay });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const checkDropAvailable = useCallback((userId: string, date: string, halfDay: 'morning' | 'afternoon'): boolean => {
    const dayDate = parseISO(date);
    if (isWeekend(dayDate)) return false;
    if (!isHalfDayAvailable) return true;
    return isHalfDayAvailable(userId, date, halfDay);
  }, [isHalfDayAvailable]);

  const handleDrop = async (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    e.preventDefault();
    setDropTarget(null);

    if (draggedSlot && onSlotMove) {
      if (checkDropAvailable(userId, date, halfDay)) {
        await onSlotMove(draggedSlot.id, date, halfDay);
      }
      setDraggedSlot(null);
    } else if (draggedTask && onSlotAdd) {
      const isAvailable = checkDropAvailable(userId, date, halfDay);
      const taskDuration = getTaskDuration ? getTaskDuration(draggedTask.id) : null;
      
      if (isAvailable && taskDuration === null) {
        await onSlotAdd(draggedTask.id, userId, date, halfDay);
        setDraggedTask(null);
      } else if (isAvailable && taskDuration === 2 && onMultiSlotAdd) {
        await onMultiSlotAdd(draggedTask.id, userId, date, halfDay, 2);
        setDraggedTask(null);
      } else {
        const duration = taskDuration || 2;
        setMultiSlotContext({
          task: draggedTask,
          userId,
          date,
          halfDay,
          taskDuration: duration,
        });
        setHalfDayCount(duration);
        setShowMultiSlotDialog(true);
        setDraggedTask(null);
      }
    }
  };

  const handleConfirmMultiSlot = async () => {
    if (!multiSlotContext || !onMultiSlotAdd) return;
    
    setIsAdding(true);
    try {
      await onMultiSlotAdd(multiSlotContext.task.id, multiSlotContext.userId, multiSlotContext.date, multiSlotContext.halfDay, multiSlotContext.taskDuration);
      setShowMultiSlotDialog(false);
      setMultiSlotContext(null);
    } catch (error: any) {
      console.error('Error adding slots:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSegmentRequest = (slot: WorkloadSlot, userId: string) => {
    const currentCount = getTaskSlotsCount ? getTaskSlotsCount(slot.task_id, userId) : 1;
    const taskDuration = getTaskDuration ? getTaskDuration(slot.task_id) : currentCount;
    setSegmentContext({ slot, userId, currentCount, taskDuration: taskDuration || currentCount });
    setNewSegmentCount(currentCount);
    setShowSegmentDialog(true);
  };

  const handleConfirmSegment = async () => {
    if (!segmentContext || !onSegmentSlot) return;
    
    setIsAdding(true);
    try {
      await onSegmentSlot(segmentContext.slot, segmentContext.userId, newSegmentCount);
      setShowSegmentDialog(false);
      setSegmentContext(null);
    } catch (error: any) {
      console.error('Error segmenting slot:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSlotDelete = async (slot: WorkloadSlot) => {
    if (onSlotRemove) {
      await onSlotRemove(slot.id);
    }
  };

  // Available tasks (not yet planned)
  const availableTasks = tasks.filter(t => 
    t.status !== 'done' && 
    t.status !== 'validated' && 
    t.assignee_id &&
    !plannedTaskIds.includes(t.id)
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-gradient-to-r from-red-500 to-rose-400';
      case 'high': return 'bg-gradient-to-r from-orange-500 to-amber-400';
      case 'medium': return 'bg-gradient-to-r from-purple-500 to-pink-400';
      case 'low': return 'bg-gradient-to-r from-emerald-500 to-teal-400';
      default: return 'bg-gradient-to-r from-slate-500 to-slate-400';
    }
  };

  // Render year view - weeks as rows per member
  const renderYearView = () => {
    // Get all weeks of the year
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const yearDays = eachDayOfInterval({ start: yearStart, end: yearEnd });
    
    // Group by week
    const allWeeks: { weekNum: number; startDate: Date; endDate: Date }[] = [];
    let lastWeekNum = -1;
    yearDays.forEach(day => {
      const weekNum = getWeek(day, { locale: fr });
      if (weekNum !== lastWeekNum) {
        const weekStart = startOfWeek(day, { locale: fr });
        const weekEnd = endOfWeek(day, { locale: fr });
        allWeeks.push({ weekNum, startDate: weekStart, endDate: weekEnd });
        lastWeekNum = weekNum;
      }
    });
    
    // Group weeks by month for headers
    const monthHeaders: { month: string; weekCount: number; startIdx: number }[] = [];
    allWeeks.forEach((week, idx) => {
      const monthKey = format(week.startDate, 'MMM yyyy', { locale: fr });
      const last = monthHeaders[monthHeaders.length - 1];
      if (last && last.month === monthKey) {
        last.weekCount++;
      } else {
        monthHeaders.push({ month: monthKey, weekCount: 1, startIdx: idx });
      }
    });

    return (
      <div className="overflow-x-auto">
        {/* Month headers */}
        <div 
          className="grid gap-0 min-w-[3000px] sticky top-0 bg-background z-20"
          style={{ gridTemplateColumns: `140px repeat(${allWeeks.length}, minmax(50px, 1fr))` }}
        >
          <div className="h-6 border-b border-r" />
          {monthHeaders.map(({ month, weekCount, startIdx }) => (
            <div 
              key={`${month}-${startIdx}`}
              className="h-6 flex items-center justify-center text-[10px] font-semibold border-b border-r bg-muted/30 capitalize"
              style={{ gridColumn: `span ${weekCount}` }}
            >
              {month}
            </div>
          ))}
        </div>
        
        {/* Week number headers */}
        <div 
          className="grid gap-0 min-w-[3000px] sticky top-6 bg-background z-10"
          style={{ gridTemplateColumns: `140px repeat(${allWeeks.length}, minmax(50px, 1fr))` }}
        >
          <div className="h-8 flex items-center font-semibold text-[10px] px-1 border-b border-r">Membres</div>
          {allWeeks.map(({ weekNum, startDate }) => {
            const isCurrentWeek = isSameWeek(startDate, new Date(), { locale: fr });
            
            return (
              <div 
                key={weekNum} 
                className={cn(
                  "h-8 flex flex-col items-center justify-center text-center border-b border-r cursor-pointer hover:bg-muted/50 transition-colors",
                  isCurrentWeek && "bg-primary/10"
                )}
                onClick={() => {
                  setCurrentDate(startDate);
                  setViewLevel('quarter');
                }}
              >
                <span className="text-[10px] font-medium">S{weekNum}</span>
              </div>
            );
          })}
        </div>
        
        {/* Rows per team member */}
        {workloadData.map(member => {
          const color = getUserColor(member.memberId);
          
          return (
            <div 
              key={member.memberId} 
              className="grid gap-0 min-w-[3000px] border-b hover:bg-muted/10"
              style={{ gridTemplateColumns: `140px repeat(${allWeeks.length}, minmax(50px, 1fr))` }}
            >
              {/* Member info */}
              <div 
                className={cn(
                  "flex items-center gap-1 px-1 py-0.5 cursor-pointer hover:bg-muted/50 border-r sticky left-0 bg-background z-10",
                  selectedUserId === member.memberId && "bg-muted"
                )}
                onClick={() => onUserSelect(member.memberId === selectedUserId ? null : member.memberId)}
              >
                <div className={cn("w-1.5 h-6 rounded-full shrink-0", color.bg)} />
                <Avatar className="h-5 w-5">
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className="text-[7px]">
                    {getInitials(member.memberName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[9px] font-medium truncate">{member.memberName.split(' ')[0]}</span>
              </div>
              
              {/* Week cells */}
              {allWeeks.map(({ weekNum, startDate, endDate }) => {
                const weekDays = eachDayOfInterval({ start: startDate, end: endDate });
                let taskCount = 0;
                let leaveCount = 0;
                
                weekDays.forEach(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const memberDay = member.days.find(d => d.date === dateStr);
                  
                  if (memberDay?.morning.slot) taskCount++;
                  if (memberDay?.afternoon.slot) taskCount++;
                  if (memberDay?.morning.isLeave) leaveCount++;
                  if (memberDay?.afternoon.isLeave) leaveCount++;
                });
                
                const isCurrentWeek = isSameWeek(startDate, new Date(), { locale: fr });
                const hasData = taskCount > 0 || leaveCount > 0;
                
                return (
                  <div 
                    key={weekNum}
                    onClick={() => {
                      setCurrentDate(startDate);
                      setViewLevel('quarter');
                    }}
                    className={cn(
                      "min-h-[28px] flex items-center justify-center border-r cursor-pointer hover:bg-muted/30 transition-colors",
                      isCurrentWeek && "bg-primary/5"
                    )}
                  >
                    {taskCount > 0 && (
                      <div className={cn(
                        "w-4 h-4 rounded-sm flex items-center justify-center text-white text-[8px] font-bold",
                        taskCount <= 4 && "bg-emerald-400",
                        taskCount > 4 && taskCount <= 8 && "bg-amber-400",
                        taskCount > 8 && "bg-red-400"
                      )}>
                        {taskCount}
                      </div>
                    )}
                    {leaveCount > 0 && taskCount === 0 && (
                      <div className="w-4 h-4 bg-blue-300 rounded-sm flex items-center justify-center text-[8px]">
                        🌴
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Render quarter view - 3 months with day columns
  const renderQuarterView = () => {
    // Get all days of the quarter
    const quarterStart = startOfQuarter(currentDate);
    const quarterEnd = endOfQuarter(currentDate);
    const quarterDays = eachDayOfInterval({ start: quarterStart, end: quarterEnd });
    
    // Group days by week for display
    const weekGroups: { weekNum: number; days: Date[] }[] = [];
    let currentWeekNum = -1;
    quarterDays.forEach(day => {
      const weekNum = getWeek(day, { locale: fr });
      if (weekNum !== currentWeekNum) {
        weekGroups.push({ weekNum, days: [] });
        currentWeekNum = weekNum;
      }
      weekGroups[weekGroups.length - 1].days.push(day);
    });
    
    return (
      <div className="overflow-x-auto">
        {/* Header row with weeks */}
        <div 
          className="grid gap-0 min-w-[2000px] sticky top-0 bg-background z-10"
          style={{ gridTemplateColumns: `160px repeat(${weekGroups.length}, minmax(80px, 1fr))` }}
        >
          <div className="h-10 flex items-center font-semibold text-xs px-2 border-b border-r">Membres</div>
          {weekGroups.map(({ weekNum, days: weekDays }) => {
            const weekStart = weekDays[0];
            const weekEnd = weekDays[weekDays.length - 1];
            
            return (
              <div 
                key={weekNum} 
                className="h-10 flex flex-col items-center justify-center text-center border-b border-r cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setCurrentDate(weekStart);
                  setViewLevel('week');
                }}
              >
                <span className="text-[10px] font-semibold">S{weekNum}</span>
                <span className="text-[8px] text-muted-foreground">
                  {format(weekStart, 'dd/MM', { locale: fr })} - {format(weekEnd, 'dd/MM', { locale: fr })}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Rows per team member */}
        {workloadData.map(member => {
          const color = getUserColor(member.memberId);
          
          return (
            <div 
              key={member.memberId} 
              className="grid gap-0 min-w-[2000px] border-b hover:bg-muted/10"
              style={{ gridTemplateColumns: `160px repeat(${weekGroups.length}, minmax(80px, 1fr))` }}
            >
              {/* Member info */}
              <div 
                className={cn(
                  "flex items-center gap-1.5 px-1.5 py-1 cursor-pointer hover:bg-muted/50 border-r sticky left-0 bg-background z-10",
                  selectedUserId === member.memberId && "bg-muted"
                )}
                onClick={() => onUserSelect(member.memberId === selectedUserId ? null : member.memberId)}
              >
                <div className={cn("w-1.5 h-8 rounded-full shrink-0", color.bg)} />
                <Avatar className="h-6 w-6">
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {getInitials(member.memberName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] font-medium truncate">{member.memberName.split(' ')[0]}</span>
              </div>
              
              {/* Week cells */}
              {weekGroups.map(({ weekNum, days: weekDays }) => {
                // Count tasks and leaves for this week
                let taskCount = 0;
                let leaveCount = 0;
                let holidayCount = 0;
                
                weekDays.forEach(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const memberDay = member.days.find(d => d.date === dateStr);
                  const holiday = holidays.find(h => h.date === dateStr);
                  
                  if (holiday) holidayCount++;
                  if (memberDay?.morning.slot) taskCount++;
                  if (memberDay?.afternoon.slot) taskCount++;
                  if (memberDay?.morning.isLeave) leaveCount++;
                  if (memberDay?.afternoon.isLeave) leaveCount++;
                });
                
                // Get drop targets for week
                const weekDateStr = format(weekDays[0], 'yyyy-MM-dd');
                const isDropTarget = dropTarget?.userId === member.memberId && weekDays.some(d => format(d, 'yyyy-MM-dd') === dropTarget?.date);
                
                return (
                  <div 
                    key={weekNum}
                    className={cn(
                      "min-h-[40px] flex items-center justify-center gap-1 border-r p-0.5",
                      isDropTarget && "bg-primary/20"
                    )}
                    onDragOver={(e) => {
                      // Find first available slot in week
                      const availableDay = weekDays.find(d => {
                        const ds = format(d, 'yyyy-MM-dd');
                        return !isWeekend(d) && !holidays.find(h => h.date === ds);
                      });
                      if (availableDay) {
                        handleDragOver(e, member.memberId, format(availableDay, 'yyyy-MM-dd'), 'morning');
                      }
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      const availableDay = weekDays.find(d => {
                        const ds = format(d, 'yyyy-MM-dd');
                        return !isWeekend(d) && !holidays.find(h => h.date === ds) && checkDropAvailable(member.memberId, ds, 'morning');
                      });
                      if (availableDay) {
                        handleDrop(e, member.memberId, format(availableDay, 'yyyy-MM-dd'), 'morning');
                      }
                    }}
                  >
                    {taskCount > 0 && (
                      <div className={cn(
                        "h-6 rounded flex items-center justify-center text-white text-[9px] font-medium px-1",
                        "bg-gradient-to-r from-emerald-500 to-teal-400"
                      )}>
                        {taskCount}
                      </div>
                    )}
                    {leaveCount > 0 && (
                      <div className="h-6 bg-blue-200 dark:bg-blue-800 rounded flex items-center justify-center text-blue-700 dark:text-blue-200 text-[9px] px-1">
                        🌴{leaveCount}
                      </div>
                    )}
                    {holidayCount > 0 && taskCount === 0 && leaveCount === 0 && (
                      <span className="text-[8px] text-amber-600">F{holidayCount}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Render month view - full month grid with all days as columns
  const renderMonthView = () => {
    // Get all days of the month
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Calculate column width based on number of days
    const numDays = monthDays.length;
    const colWidth = `minmax(40px, 1fr)`;
    
    return (
      <div className="overflow-x-auto">
        {/* Header row with dates */}
        <div 
          className="grid gap-0.5 min-w-[1200px] sticky top-0 bg-background z-10"
          style={{ gridTemplateColumns: `180px repeat(${numDays}, ${colWidth})` }}
        >
          <div className="h-14 flex items-center font-semibold text-sm px-2 border-b">Membres</div>
          {monthDays.map(day => {
            const isTodayDate = isToday(day);
            const isWeekendDay = isWeekend(day);
            const holiday = holidays.find(h => h.date === format(day, 'yyyy-MM-dd'));
            
            return (
              <div 
                key={day.toISOString()} 
                className={cn(
                  "h-14 flex flex-col items-center justify-center text-center border-b cursor-pointer hover:bg-muted/50 transition-colors",
                  isTodayDate && "bg-primary text-primary-foreground rounded-t",
                  isWeekendDay && !isTodayDate && "bg-muted/40",
                  holiday && !isTodayDate && "bg-amber-100 dark:bg-amber-900/30"
                )}
                onClick={() => handleCellClick(day)}
              >
                <span className="text-[10px] font-medium uppercase">{format(day, 'EEE', { locale: fr })}</span>
                <span className="text-sm font-bold">{format(day, 'd')}</span>
              </div>
            );
          })}
        </div>
        
        {/* Rows per team member */}
        {workloadData.map(member => {
          const color = getUserColor(member.memberId);
          
          return (
            <div 
              key={member.memberId} 
              className="grid gap-0.5 min-w-[1200px] border-b hover:bg-muted/10"
              style={{ gridTemplateColumns: `180px repeat(${numDays}, ${colWidth})` }}
            >
              {/* Member info */}
              <div 
                className={cn(
                  "flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-muted/50 sticky left-0 bg-background z-10",
                  selectedUserId === member.memberId && "bg-muted"
                )}
                onClick={() => onUserSelect(member.memberId === selectedUserId ? null : member.memberId)}
              >
                <div className={cn("w-2 h-10 rounded-full shrink-0", color.bg)} />
                <Avatar className="h-7 w-7">
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(member.memberName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 hidden sm:block">
                  <div className="text-xs font-medium truncate">{member.memberName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{member.jobTitle}</div>
                </div>
              </div>
              
              {/* Day cells */}
              {monthDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const memberDay = member.days.find(d => d.date === dateStr);
                const isWeekendDay = isWeekend(day);
                const holiday = holidays.find(h => h.date === dateStr);
                const isTodayDate = isToday(day);
                
                const isDropTargetMorning = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr && dropTarget?.halfDay === 'morning';
                const isDropTargetAfternoon = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr && dropTarget?.halfDay === 'afternoon';
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={cn(
                      "min-h-[56px] flex flex-col gap-0.5 p-0.5",
                      isWeekendDay && "bg-muted/40",
                      holiday && "bg-amber-50 dark:bg-amber-900/20",
                      isTodayDate && "ring-2 ring-primary ring-inset"
                    )}
                  >
                    {holiday ? (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[8px] text-amber-600 font-medium">Férié</span>
                      </div>
                    ) : isWeekendDay ? null : (
                      <>
                        {/* Morning slot */}
                        <div
                          className={cn(
                            "flex-1 rounded transition-all min-h-[24px]",
                            memberDay?.morning.isLeave && "bg-blue-200 dark:bg-blue-800",
                            !memberDay?.morning.slot && !memberDay?.morning.isLeave && "hover:bg-muted/50",
                            isDropTargetMorning && "bg-primary/20 ring-1 ring-primary"
                          )}
                          onDragOver={(e) => handleDragOver(e, member.memberId, dateStr, 'morning')}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'morning')}
                        >
                          {memberDay?.morning.slot && (
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, memberDay.morning.slot!)}
                                      className={cn(
                                        "w-full h-full rounded cursor-pointer text-white text-[8px] font-medium p-0.5 overflow-hidden",
                                        getPriorityColor(memberDay.morning.slot.task?.priority || 'medium')
                                      )}
                                    >
                                      <span className="truncate block">{memberDay.morning.slot.task?.title?.slice(0, 8)}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>{memberDay.morning.slot.task?.title}</TooltipContent>
                                </Tooltip>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem onClick={() => handleSegmentRequest(memberDay.morning.slot!, member.memberId)}>
                                  <Scissors className="h-4 w-4 mr-2" />Segmenter
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => handleSlotDelete(memberDay.morning.slot!)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />Supprimer
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          )}
                          {memberDay?.morning.isLeave && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-[8px] text-blue-700 text-center">🌴</div>
                              </TooltipTrigger>
                              <TooltipContent>Congé (matin)</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        
                        {/* Afternoon slot */}
                        <div
                          className={cn(
                            "flex-1 rounded transition-all min-h-[24px]",
                            memberDay?.afternoon.isLeave && "bg-blue-200 dark:bg-blue-800",
                            !memberDay?.afternoon.slot && !memberDay?.afternoon.isLeave && "hover:bg-muted/50",
                            isDropTargetAfternoon && "bg-primary/20 ring-1 ring-primary"
                          )}
                          onDragOver={(e) => handleDragOver(e, member.memberId, dateStr, 'afternoon')}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'afternoon')}
                        >
                          {memberDay?.afternoon.slot && (
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, memberDay.afternoon.slot!)}
                                      className={cn(
                                        "w-full h-full rounded cursor-pointer text-white text-[8px] font-medium p-0.5 overflow-hidden",
                                        getPriorityColor(memberDay.afternoon.slot.task?.priority || 'medium')
                                      )}
                                    >
                                      <span className="truncate block">{memberDay.afternoon.slot.task?.title?.slice(0, 8)}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>{memberDay.afternoon.slot.task?.title}</TooltipContent>
                                </Tooltip>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem onClick={() => handleSegmentRequest(memberDay.afternoon.slot!, member.memberId)}>
                                  <Scissors className="h-4 w-4 mr-2" />Segmenter
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => handleSlotDelete(memberDay.afternoon.slot!)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />Supprimer
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          )}
                          {memberDay?.afternoon.isLeave && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-[8px] text-blue-700 text-center">🌴</div>
                              </TooltipTrigger>
                              <TooltipContent>Congé (après-midi)</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Render week view - detailed with times
  const renderWeekView = () => {
    return (
      <div className="overflow-x-auto">
        {/* Header with days */}
        <div className="grid grid-cols-[180px_repeat(7,1fr)] gap-1 min-w-[1000px]">
          <div className="h-12 flex items-center font-semibold text-sm px-2">Membres</div>
          {days.map(day => {
            const isTodayDate = isToday(day);
            const isWeekendDay = isWeekend(day);
            const holiday = holidays.find(h => h.date === format(day, 'yyyy-MM-dd'));
            
            return (
              <div 
                key={day.toISOString()} 
                className={cn(
                  "h-12 flex flex-col items-center justify-center rounded-t-lg",
                  isTodayDate && "bg-primary text-primary-foreground",
                  isWeekendDay && !isTodayDate && "bg-muted/50",
                  holiday && !isTodayDate && "bg-amber-100 dark:bg-amber-900/30"
                )}
              >
                <span className="text-xs font-medium">{format(day, 'EEE', { locale: fr })}</span>
                <span className="text-lg font-bold">{format(day, 'd')}</span>
              </div>
            );
          })}
        </div>
        
        {/* Rows per team member */}
        {workloadData.map(member => {
          const color = getUserColor(member.memberId);
          
          return (
            <div key={member.memberId} className="grid grid-cols-[180px_repeat(7,1fr)] gap-1 min-w-[1000px] border-t">
              {/* Member info */}
              <div 
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-l-lg cursor-pointer hover:bg-muted/50",
                  selectedUserId === member.memberId && "bg-muted"
                )}
                onClick={() => onUserSelect(member.memberId === selectedUserId ? null : member.memberId)}
              >
                <div className={cn("w-2 h-12 rounded-full shrink-0", color.bg)} />
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(member.memberName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{member.memberName}</div>
                  <div className="text-xs text-muted-foreground truncate">{member.jobTitle}</div>
                </div>
              </div>
              
              {/* Day cells */}
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const memberDay = member.days.find(d => d.date === dateStr);
                const isWeekendDay = isWeekend(day);
                const holiday = holidays.find(h => h.date === dateStr);
                
                const isDropTargetMorning = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr && dropTarget?.halfDay === 'morning';
                const isDropTargetAfternoon = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr && dropTarget?.halfDay === 'afternoon';
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={cn(
                      "min-h-[80px] border rounded-lg p-1 flex flex-col gap-1",
                      isWeekendDay && "bg-muted/40",
                      holiday && "bg-amber-50 dark:bg-amber-900/20",
                      isToday(day) && "ring-2 ring-primary"
                    )}
                  >
                    {holiday && (
                      <Badge variant="outline" className="text-[9px] bg-amber-200 dark:bg-amber-800 justify-center">
                        {holiday.name}
                      </Badge>
                    )}
                    
                    {!holiday && !isWeekendDay && (
                      <>
                        {/* Morning */}
                        <div
                          className={cn(
                            "flex-1 rounded p-1 border border-dashed transition-all min-h-[32px]",
                            memberDay?.morning.isLeave && "bg-blue-100 dark:bg-blue-900/30 border-blue-300",
                            !memberDay?.morning.slot && !memberDay?.morning.isLeave && "hover:bg-muted/50 border-transparent hover:border-muted-foreground/20",
                            isDropTargetMorning && "bg-primary/20 ring-2 ring-primary border-primary"
                          )}
                          onDragOver={(e) => handleDragOver(e, member.memberId, dateStr, 'morning')}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'morning')}
                        >
                          <div className="text-[9px] text-muted-foreground mb-0.5">AM</div>
                          {memberDay?.morning.slot && (
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, memberDay.morning.slot!)}
                                  className={cn(
                                    "w-full rounded p-1 cursor-pointer text-white text-[10px] font-medium truncate",
                                    getPriorityColor(memberDay.morning.slot.task?.priority || 'medium')
                                  )}
                                >
                                  {memberDay.morning.slot.task?.title}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem onClick={() => handleSegmentRequest(memberDay.morning.slot!, member.memberId)}>
                                  <Scissors className="h-4 w-4 mr-2" />
                                  Segmenter
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem 
                                  onClick={() => handleSlotDelete(memberDay.morning.slot!)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          )}
                          {memberDay?.morning.isLeave && (
                            <div className="text-[10px] text-blue-600 font-medium">🌴 Congé</div>
                          )}
                        </div>
                        
                        {/* Afternoon */}
                        <div
                          className={cn(
                            "flex-1 rounded p-1 border border-dashed transition-all min-h-[32px]",
                            memberDay?.afternoon.isLeave && "bg-blue-100 dark:bg-blue-900/30 border-blue-300",
                            !memberDay?.afternoon.slot && !memberDay?.afternoon.isLeave && "hover:bg-muted/50 border-transparent hover:border-muted-foreground/20",
                            isDropTargetAfternoon && "bg-primary/20 ring-2 ring-primary border-primary"
                          )}
                          onDragOver={(e) => handleDragOver(e, member.memberId, dateStr, 'afternoon')}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'afternoon')}
                        >
                          <div className="text-[9px] text-muted-foreground mb-0.5">PM</div>
                          {memberDay?.afternoon.slot && (
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, memberDay.afternoon.slot!)}
                                  className={cn(
                                    "w-full rounded p-1 cursor-pointer text-white text-[10px] font-medium truncate",
                                    getPriorityColor(memberDay.afternoon.slot.task?.priority || 'medium')
                                  )}
                                >
                                  {memberDay.afternoon.slot.task?.title}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem onClick={() => handleSegmentRequest(memberDay.afternoon.slot!, member.memberId)}>
                                  <Scissors className="h-4 w-4 mr-2" />
                                  Segmenter
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem 
                                  onClick={() => handleSlotDelete(memberDay.afternoon.slot!)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          )}
                          {memberDay?.afternoon.isLeave && (
                            <div className="text-[10px] text-blue-600 font-medium">🌴 Congé</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex gap-4">
        {/* Tasks sidebar - Tâches à planifier */}
        {(onSlotAdd || onMultiSlotAdd) && (
          <div className="w-72 shrink-0 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-lg">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <div className="w-2 h-5 bg-gradient-to-b from-cyan-500 to-teal-400 rounded-full" />
              Tâches à planifier 
              <span className="ml-auto bg-gradient-to-r from-cyan-500 to-teal-400 text-white text-xs font-bold px-2 py-1 rounded-full">
                {availableTasks.length}
              </span>
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {availableTasks.map(task => {
                const duration = getTaskDuration ? getTaskDuration(task.id) : null;
                const progress = getTaskProgress ? getTaskProgress(task.id) : null;
                const progressPercent = progress && progress.total > 0 
                  ? Math.round((progress.completed / progress.total) * 100) 
                  : 0;
                
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleTaskDragStart(e, task)}
                    className={cn(
                      "p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-md transition-all duration-200 bg-white dark:bg-slate-800",
                      task.priority === 'urgent' && "border-red-300 bg-red-50/50 dark:bg-red-900/10",
                      task.priority === 'high' && "border-orange-300 bg-orange-50/50 dark:bg-orange-900/10",
                      task.priority === 'medium' && "border-purple-300 bg-purple-50/50 dark:bg-purple-900/10",
                      task.priority === 'low' && "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10",
                      !['urgent', 'high', 'medium', 'low'].includes(task.priority) && "border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", getPriorityColor(task.priority))} />
                      <span className="text-sm truncate flex-1">{task.title}</span>
                    </div>
                    
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {duration && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">
                          {duration / 2} jour{duration > 2 ? 's' : ''}
                        </span>
                      )}
                      {progress && progress.total > 0 && (
                        <div className="flex items-center gap-1 flex-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                progressPercent === 100 ? "bg-green-500" : "bg-primary"
                              )}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span>{progressPercent}%</span>
                        </div>
                      )}
                    </div>
                    
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground block mt-1">
                        Échéance: {format(parseISO(task.due_date), 'dd/MM', { locale: fr })}
                      </span>
                    )}
                  </div>
                );
              })}
              {availableTasks.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    Toutes les tâches sont planifiées 🎉
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar */}
        <Card className="flex-1">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={zoomOut}
                disabled={viewLevel === 'year'}
                title="Vue plus large"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base capitalize min-w-[200px] text-center">
                {getPeriodLabel()}
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => zoomIn()}
                disabled={viewLevel === 'week'}
                title="Vue plus détaillée"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigatePeriod('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Aujourd'hui
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigatePeriod('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewLevel === 'year' && renderYearView()}
            {viewLevel === 'quarter' && renderQuarterView()}
            {viewLevel === 'month' && renderMonthView()}
            {viewLevel === 'week' && renderWeekView()}
          </CardContent>
        </Card>
      </div>

      {/* Multi-slot dialog */}
      <Dialog open={showMultiSlotDialog} onOpenChange={setShowMultiSlotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planifier la tâche</DialogTitle>
            <DialogDescription>
              Choisissez comment segmenter cette tâche. Les créneaux seront automatiquement répartis en évitant les weekends, jours fériés et congés.
            </DialogDescription>
          </DialogHeader>
          
          {multiSlotContext && (() => {
            const totalHalfDays = multiSlotContext.taskDuration;
            const totalDays = totalHalfDays / 2;
            const validOptions = getValidSegmentOptions(totalHalfDays);
            
            return (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{multiSlotContext.task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    À partir du {format(parseISO(multiSlotContext.date), 'EEEE d MMMM', { locale: fr })} ({multiSlotContext.halfDay === 'morning' ? 'matin' : 'après-midi'})
                  </p>
                  <div className="mt-2 p-2 bg-primary/10 rounded border border-primary/20">
                    <p className="text-sm font-medium text-primary">
                      Durée totale: {totalHalfDays} demi-journée{totalHalfDays > 1 ? 's' : ''} ({totalDays} jour{totalDays > 1 ? 's' : ''})
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Segmentation</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Divisez la tâche en segments égaux :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {validOptions.map(segments => {
                      const halfDaysPerSegment = totalHalfDays / segments;
                      const daysPerSegment = halfDaysPerSegment / 2;
                      
                      let label = '';
                      if (segments === 1) {
                        label = `1 bloc de ${totalDays} jour${totalDays > 1 ? 's' : ''}`;
                      } else if (halfDaysPerSegment === 1) {
                        label = `${segments} × ½ journée`;
                      } else if (halfDaysPerSegment === 2) {
                        label = `${segments} × 1 jour`;
                      } else {
                        label = `${segments} × ${daysPerSegment} jour${daysPerSegment > 1 ? 's' : ''}`;
                      }
                      
                      return (
                        <Button
                          key={segments}
                          variant={halfDayCount === totalHalfDays ? "default" : "outline"}
                          size="sm"
                          onClick={() => setHalfDayCount(totalHalfDays)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMultiSlotDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmMultiSlot} disabled={isAdding}>
              {isAdding ? 'Planification...' : `Planifier ${multiSlotContext?.taskDuration || 0} créneau${(multiSlotContext?.taskDuration || 0) > 1 ? 'x' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segment dialog */}
      <Dialog open={showSegmentDialog} onOpenChange={setShowSegmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Segmenter la tâche</DialogTitle>
            <DialogDescription>
              Redistribuez les créneaux de cette tâche.
            </DialogDescription>
          </DialogHeader>
          
          {segmentContext && (() => {
            const totalHalfDays = segmentContext.taskDuration;
            const totalDays = totalHalfDays / 2;
            const validOptions = getValidSegmentOptions(totalHalfDays);
            
            return (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{segmentContext.slot.task?.title}</p>
                  <div className="mt-2 p-2 bg-primary/10 rounded border border-primary/20">
                    <p className="text-sm font-medium text-primary">
                      Durée totale: {totalHalfDays} demi-journée{totalHalfDays > 1 ? 's' : ''} ({totalDays} jour{totalDays > 1 ? 's' : ''})
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Actuellement: {segmentContext.currentCount} créneau{segmentContext.currentCount > 1 ? 'x' : ''}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Nouvelle segmentation</Label>
                  <div className="flex flex-wrap gap-2">
                    {validOptions.map(segments => {
                      const halfDaysPerSegment = totalHalfDays / segments;
                      const daysPerSegment = halfDaysPerSegment / 2;
                      const isSelected = newSegmentCount === segments;
                      
                      let label = '';
                      if (segments === 1) {
                        label = `1 bloc de ${totalDays} jour${totalDays > 1 ? 's' : ''}`;
                      } else if (halfDaysPerSegment === 1) {
                        label = `${segments} × ½ journée`;
                      } else if (halfDaysPerSegment === 2) {
                        label = `${segments} × 1 jour`;
                      } else {
                        label = `${segments} × ${daysPerSegment} jour${daysPerSegment > 1 ? 's' : ''}`;
                      }
                      
                      return (
                        <Button
                          key={segments}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewSegmentCount(segments)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSegmentDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmSegment} disabled={isAdding}>
              {isAdding ? 'Application...' : 'Appliquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
