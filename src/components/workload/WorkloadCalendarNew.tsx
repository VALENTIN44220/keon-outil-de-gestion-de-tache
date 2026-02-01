import { useState, useMemo, useCallback } from 'react';
import { format, addMonths, subMonths, startOfMonth, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Task } from '@/types/task';
import { TeamMemberWorkload, Holiday, UserLeave, WorkloadSlot } from '@/types/workload';
import { MonthlyCalendarGrid, CalendarEvent, getUserColor } from './MonthlyCalendarGrid';
import { SemesterCalendarGrid } from './SemesterCalendarGrid';
import { UnifiedTaskDrawer, DrawerItem } from './UnifiedTaskDrawer';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Users } from 'lucide-react';

type CalendarViewMode = 'month' | 'semester';

interface WorkloadCalendarNewProps {
  workloadData: TeamMemberWorkload[];
  holidays: Holiday[];
  leaves: UserLeave[];
  tasks: Task[];
  onTaskUpdate?: () => void;
}

export function WorkloadCalendarNew({
  workloadData,
  holidays,
  leaves,
  tasks,
  onTaskUpdate,
}: WorkloadCalendarNewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Convert tasks, leaves, and holidays to CalendarEvent format
  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];

    // Add tasks
    tasks.forEach(task => {
      if (!task.due_date) return;
      
      const member = workloadData.find(m => m.memberId === task.assignee_id);
      const dueDate = parseISO(task.due_date);
      
      result.push({
        id: task.id,
        title: task.title,
        startDate: dueDate,
        endDate: dueDate,
        assigneeId: task.assignee_id || undefined,
        assigneeName: member?.memberName,
        type: 'task',
        status: task.status,
        priority: task.priority,
      });
    });

    // Add holidays
    holidays.forEach(holiday => {
      result.push({
        id: `holiday-${holiday.id}`,
        title: holiday.name,
        startDate: parseISO(holiday.date),
        endDate: parseISO(holiday.date),
        type: 'holiday',
      });
    });

    // Add leaves
    leaves.forEach(leave => {
      if (leave.status === 'cancelled') return;
      
      const member = workloadData.find(m => m.memberId === leave.user_id);
      
      result.push({
        id: `leave-${leave.id}`,
        title: `Congé - ${member?.memberName || 'Inconnu'}`,
        startDate: parseISO(leave.start_date),
        endDate: parseISO(leave.end_date),
        assigneeId: leave.user_id,
        assigneeName: member?.memberName,
        type: 'leave',
      });
    });

    return result;
  }, [tasks, holidays, leaves, workloadData]);

  // Navigation handlers
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1;
    if (viewMode === 'semester') {
      setCurrentDate(prev => addMonths(prev, 6 * offset));
    } else {
      setCurrentDate(prev => addMonths(prev, offset));
    }
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    if (event.type === 'task') {
      const task = tasks.find(t => t.id === event.id);
      if (task) {
        setSelectedTask(task);
      }
    }
  }, [tasks]);

  const handleMonthClick = useCallback((month: Date) => {
    setCurrentDate(month);
    setViewMode('month');
  }, []);

  // Build legend for all team members with any events (tasks or leaves)
  const visibleAssignees = useMemo(() => {
    const assigneeIds = new Set(events.filter(e => e.assigneeId).map(e => e.assigneeId!));
    return workloadData.filter(m => assigneeIds.has(m.memberId));
  }, [events, workloadData]);

  return (
    <div className="space-y-4">
      {/* View mode selector */}
      <div className="flex flex-col gap-4 bg-card rounded-xl border p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as CalendarViewMode)}>
            <TabsList>
              <TabsTrigger value="month" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Mois
              </TabsTrigger>
              <TabsTrigger value="semester" className="gap-2">
                <CalendarRange className="h-4 w-4" />
                Semestre
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Legend - Collaborators */}
        {visibleAssignees.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Collaborateurs</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {visibleAssignees.map(member => {
                const color = getUserColor(member.memberId);
                return (
                  <div
                    key={member.memberId}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50"
                  >
                    <div className={`w-3 h-3 rounded-sm ${color.bg}`} />
                    <span className="text-xs font-medium">{member.memberName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Calendar content */}
      {viewMode === 'month' ? (
        <MonthlyCalendarGrid
          currentDate={currentDate}
          events={events}
          onNavigate={handleNavigate}
          onToday={handleToday}
          onEventClick={handleEventClick}
          showHeader
          showNavigation
        />
      ) : (
        <SemesterCalendarGrid
          currentDate={currentDate}
          events={events}
          onNavigate={handleNavigate}
          onToday={handleToday}
          onEventClick={handleEventClick}
          onMonthClick={handleMonthClick}
        />
      )}

      {/* Task Drawer */}
      <UnifiedTaskDrawer
        item={selectedTask ? { type: 'task', task: selectedTask } : null}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
