import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isWeekend, parseISO } from 'date-fns';
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
}

export function WorkloadCalendarView({
  workloadData,
  holidays,
  leaves,
  selectedUserId,
  onUserSelect,
}: WorkloadCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const selectedMember = selectedUserId 
    ? workloadData.find(m => m.memberId === selectedUserId) 
    : null;

  const getDayInfo = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const holiday = holidays.find(h => h.date === dateStr);
    
    let memberData = null;
    if (selectedMember) {
      memberData = selectedMember.days.find(d => d.date === dateStr);
    }

    return { holiday, memberData, isWeekendDay: isWeekend(date) };
  };

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Get first day offset (Monday = 0)
  const firstDayOfMonth = monthStart.getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

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
          <CardTitle className="text-base">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
            {/* Empty cells for offset */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] bg-muted/20 rounded" />
            ))}

            {/* Day cells */}
            {days.map(day => {
              const { holiday, memberData, isWeekendDay } = getDayInfo(day);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[100px] border rounded p-1",
                    isWeekendDay && "bg-muted/30",
                    isTodayDate && "ring-2 ring-primary",
                    holiday && "bg-amber-50 dark:bg-amber-900/20"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isTodayDate && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>

                  {holiday && (
                    <Badge variant="outline" className="text-[10px] bg-amber-200 dark:bg-amber-800 w-full justify-center mb-1">
                      {holiday.name}
                    </Badge>
                  )}

                  {memberData && !isWeekendDay && !holiday && (
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

                  {!selectedUserId && !isWeekendDay && !holiday && (
                    <div className="text-[10px] text-muted-foreground">
                      {workloadData.reduce((count, m) => {
                        const d = m.days.find(dd => dd.date === format(day, 'yyyy-MM-dd'));
                        return count + (d?.morning.slot ? 1 : 0) + (d?.afternoon.slot ? 1 : 0);
                      }, 0)} créneaux
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
