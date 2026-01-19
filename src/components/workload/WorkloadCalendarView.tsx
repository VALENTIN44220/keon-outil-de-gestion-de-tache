import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isWeekend, parseISO, addMonths, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TeamMemberWorkload } from '@/types/workload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Holiday, UserLeave } from '@/types/workload';

interface WorkloadCalendarViewProps {
  workloadData: TeamMemberWorkload[];
  holidays: Holiday[];
  leaves: UserLeave[];
  selectedUserId: string | null;
  onUserSelect: (userId: string | null) => void;
  viewMode?: 'week' | 'month' | 'quarter';
  startDate?: Date;
  endDate?: Date;
}

export function WorkloadCalendarView({
  workloadData,
  holidays,
  leaves,
  selectedUserId,
  onUserSelect,
  viewMode = 'month',
  startDate: externalStartDate,
  endDate: externalEndDate,
}: WorkloadCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate date range based on view mode and external dates
  const { rangeStart, rangeEnd, days } = useMemo(() => {
    let start: Date, end: Date;
    
    if (externalStartDate && externalEndDate) {
      start = externalStartDate;
      end = externalEndDate;
    } else {
      switch (viewMode) {
        case 'week':
          start = startOfWeek(currentDate, { locale: fr });
          end = endOfWeek(currentDate, { locale: fr });
          break;
        case 'quarter':
          start = startOfMonth(currentDate);
          end = endOfMonth(addMonths(currentDate, 2));
          break;
        case 'month':
        default:
          start = startOfMonth(currentDate);
          end = endOfMonth(currentDate);
          break;
      }
    }
    
    return {
      rangeStart: start,
      rangeEnd: end,
      days: eachDayOfInterval({ start, end }),
    };
  }, [currentDate, viewMode, externalStartDate, externalEndDate]);

  // Group days by month for quarter view
  const monthGroups = useMemo(() => {
    if (viewMode !== 'quarter') return null;
    
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
  }, [days, viewMode]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const selectedMember = selectedUserId 
    ? workloadData.find(m => m.memberId === selectedUserId) 
    : null;

  // Get all leaves for all users (for "Tous" view)
  const allUserLeaves = useMemo(() => {
    const leavesByDate: Record<string, { userId: string; userName: string; leaveType: string }[]> = {};
    
    leaves.forEach(leave => {
      if (leave.status === 'cancelled') return;
      
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
  }, [leaves, workloadData]);

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
    switch (viewMode) {
      case 'week':
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + (7 * offset)));
        break;
      case 'month':
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
        break;
      case 'quarter':
        setCurrentDate(prev => addMonths(prev, 3 * offset));
        break;
    }
  };

  const getPeriodLabel = () => {
    switch (viewMode) {
      case 'week':
        return `${format(rangeStart, 'dd MMM', { locale: fr })} - ${format(rangeEnd, 'dd MMM yyyy', { locale: fr })}`;
      case 'quarter':
        return `${format(rangeStart, 'MMMM', { locale: fr })} - ${format(rangeEnd, 'MMMM yyyy', { locale: fr })}`;
      case 'month':
      default:
        return format(rangeStart, 'MMMM yyyy', { locale: fr });
    }
  };

  // Calculate cell size based on view mode
  const getCellClass = () => {
    switch (viewMode) {
      case 'week':
        return 'min-h-[140px]';
      case 'quarter':
        return 'min-h-[60px] text-[9px]';
      case 'month':
      default:
        return 'min-h-[100px]';
    }
  };

  // Get first day offset (Monday = 0)
  const firstDayOfRange = rangeStart.getDay();
  const startOffset = firstDayOfRange === 0 ? 6 : firstDayOfRange - 1;

  const renderDayCell = (day: Date, compact = false) => {
    const { holiday, memberData, isWeekendDay, dayLeaves } = getDayInfo(day);
    const isTodayDate = isToday(day);
    const cellClass = compact ? 'min-h-[60px]' : getCellClass();

    return (
      <div
        key={day.toISOString()}
        className={cn(
          "border rounded p-1",
          cellClass,
          isWeekendDay && "bg-muted/30",
          isTodayDate && "ring-2 ring-primary",
          holiday && "bg-amber-50 dark:bg-amber-900/20"
        )}
      >
        <div className={cn(
          "text-sm font-medium mb-1",
          isTodayDate && "text-primary",
          compact && "text-xs"
        )}>
          {format(day, 'd')}
        </div>

        {holiday && (
          <Badge variant="outline" className={cn(
            "bg-amber-200 dark:bg-amber-800 w-full justify-center mb-1",
            compact ? "text-[8px] p-0" : "text-[10px]"
          )}>
            {compact ? holiday.name.slice(0, 6) + '...' : holiday.name}
          </Badge>
        )}

        {/* Show leaves when a specific member is selected */}
        {memberData && !isWeekendDay && !holiday && !compact && (
          <div className="space-y-1">
            {/* Morning */}
            <div className={cn(
              "text-[10px] p-1 rounded",
              memberData.morning.isLeave && "bg-blue-100 dark:bg-blue-900/30",
              memberData.morning.slot && "bg-green-100 dark:bg-green-900/30"
            )}>
              <span className="font-medium">AM:</span>{' '}
              {memberData.morning.isLeave && "Congé"}
              {memberData.morning.slot && memberData.morning.slot.task?.title}
              {!memberData.morning.isLeave && !memberData.morning.slot && (
                <span className="text-muted-foreground">Libre</span>
              )}
            </div>
            {/* Afternoon */}
            <div className={cn(
              "text-[10px] p-1 rounded",
              memberData.afternoon.isLeave && "bg-blue-100 dark:bg-blue-900/30",
              memberData.afternoon.slot && "bg-green-100 dark:bg-green-900/30"
            )}>
              <span className="font-medium">PM:</span>{' '}
              {memberData.afternoon.isLeave && "Congé"}
              {memberData.afternoon.slot && memberData.afternoon.slot.task?.title}
              {!memberData.afternoon.isLeave && !memberData.afternoon.slot && (
                <span className="text-muted-foreground">Libre</span>
              )}
            </div>
          </div>
        )}

        {/* Show all users' leaves when "Tous" is selected */}
        {!selectedUserId && !isWeekendDay && !holiday && !compact && (
          <div className="space-y-1">
            {/* Display slots count */}
            <div className="text-[10px] text-muted-foreground">
              {workloadData.reduce((count, m) => {
                const d = m.days.find(dd => dd.date === format(day, 'yyyy-MM-dd'));
                return count + (d?.morning.slot ? 1 : 0) + (d?.afternoon.slot ? 1 : 0);
              }, 0)} créneaux
            </div>
            {/* Display leaves for all users */}
            {dayLeaves.length > 0 && (
              <div className="mt-1">
                {dayLeaves.slice(0, 3).map((leave, idx) => (
                  <div key={`${leave.userId}-${idx}`} className="text-[9px] bg-blue-100 dark:bg-blue-900/30 rounded px-1 truncate">
                    {leave.userName.split(' ')[0]}
                  </div>
                ))}
                {dayLeaves.length > 3 && (
                  <div className="text-[9px] text-muted-foreground">
                    +{dayLeaves.length - 3} autre{dayLeaves.length - 3 > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Compact view for quarter */}
        {compact && !isWeekendDay && !holiday && (
          <div className="space-y-0.5">
            {dayLeaves.length > 0 && (
              <div className="text-[8px] text-blue-600 dark:text-blue-400">
                {dayLeaves.length} congé{dayLeaves.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Team member selector */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Collaborateurs</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            <Button
              variant={!selectedUserId ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => onUserSelect(null)}
            >
              Tous
            </Button>
            {workloadData.map(member => (
              <Button
                key={member.memberId}
                variant={selectedUserId === member.memberId ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => onUserSelect(member.memberId)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(member.memberName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{member.memberName}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card className="lg:col-span-3">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base capitalize">
            {getPeriodLabel()}
          </CardTitle>
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
          {/* Quarter view - multiple months */}
          {viewMode === 'quarter' && monthGroups ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {monthGroups.map(({ month, days: monthDays }) => {
                const monthStartDay = month.getDay();
                const monthOffset = monthStartDay === 0 ? 6 : monthStartDay - 1;
                
                return (
                  <div key={month.toISOString()}>
                    <h4 className="text-sm font-medium mb-2 capitalize">
                      {format(month, 'MMMM', { locale: fr })}
                    </h4>
                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {weekDays.map(day => (
                        <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                          {day.slice(0, 1)}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                      {Array.from({ length: monthOffset }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[60px] bg-muted/20 rounded" />
                      ))}
                      {monthDays.map(day => renderDayCell(day, true))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for offset (only for month view) */}
                {viewMode === 'month' && Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className={cn("bg-muted/20 rounded", getCellClass())} />
                ))}

                {/* Day cells */}
                {days.map(day => renderDayCell(day))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
