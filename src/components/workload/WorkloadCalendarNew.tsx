import { useState, useMemo, useCallback } from 'react';
import { format, addMonths, addWeeks, addYears, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Task } from '@/types/task';
import { TeamMemberWorkload, Holiday, UserLeave } from '@/types/workload';
import { MonthlyCalendarGrid, CalendarEvent, getUserColor } from './MonthlyCalendarGrid';
import { SemesterCalendarGrid } from './SemesterCalendarGrid';
import { WeeklyCalendarGrid } from './WeeklyCalendarGrid';
import { YearlyCalendarGrid } from './YearlyCalendarGrid';
import { UnifiedTaskDrawer } from './UnifiedTaskDrawer';
import { Users } from 'lucide-react';

type CalendarViewMode = 'week' | 'month' | 'quarter' | 'year';

interface WorkloadCalendarNewProps {
  workloadData: TeamMemberWorkload[];
  holidays: Holiday[];
  leaves: UserLeave[];
  tasks: Task[];
  onTaskUpdate?: () => void;
  viewMode?: CalendarViewMode;
  currentDate?: Date;
  onNavigate?: (direction: 'prev' | 'next') => void;
  onToday?: () => void;
}

export function WorkloadCalendarNew({
  workloadData,
  holidays,
  leaves,
  tasks,
  onTaskUpdate,
  viewMode = 'month',
  currentDate: externalDate,
  onNavigate: externalNavigate,
  onToday: externalToday,
}: WorkloadCalendarNewProps) {
  const [internalDate, setInternalDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Use external controls if provided, otherwise use internal state
  const currentDate = externalDate || internalDate;

  // Convert tasks, leaves, and holidays to CalendarEvent format
  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];

    // Add tasks
    tasks.forEach(task => {
      if (!task.due_date) return;
      
      const member = workloadData.find(m => m.memberId === task.assignee_id);
      const dueDate = parseISO(task.due_date);
      const startDate = task.start_date ? parseISO(task.start_date) : dueDate;
      
      result.push({
        id: task.id,
        title: task.title,
        startDate: startDate,
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

  // Navigation handlers - use external if provided
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (externalNavigate) {
      externalNavigate(direction);
      return;
    }
    
    const offset = direction === 'prev' ? -1 : 1;
    if (viewMode === 'quarter') {
      setInternalDate(prev => addMonths(prev, 3 * offset));
    } else if (viewMode === 'week') {
      setInternalDate(prev => addWeeks(prev, offset));
    } else if (viewMode === 'year') {
      setInternalDate(prev => addYears(prev, offset));
    } else {
      setInternalDate(prev => addMonths(prev, offset));
    }
  }, [viewMode, externalNavigate]);

  const handleToday = useCallback(() => {
    if (externalToday) {
      externalToday();
      return;
    }
    setInternalDate(new Date());
  }, [externalToday]);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    if (event.type === 'task') {
      const task = tasks.find(t => t.id === event.id);
      if (task) {
        setSelectedTask(task);
      }
    }
  }, [tasks]);

  const handleMonthClick = useCallback((month: Date) => {
    setInternalDate(month);
  }, []);

  // Build legend for all team members with any events (tasks or leaves)
  const visibleAssignees = useMemo(() => {
    const assigneeIds = new Set(events.filter(e => e.assigneeId).map(e => e.assigneeId!));
    return workloadData.filter(m => assigneeIds.has(m.memberId));
  }, [events, workloadData]);

  return (
    <div className="space-y-4">
      {/* Legend - Collaborators (only shown if there are assignees) */}
      {visibleAssignees.length > 0 && (
        <div className="bg-card rounded-xl border p-4 shadow-sm">
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

      {/* Calendar content based on view mode */}
      {viewMode === 'week' ? (
        <WeeklyCalendarGrid
          currentDate={currentDate}
          events={events}
          onNavigate={handleNavigate}
          onToday={handleToday}
          onEventClick={handleEventClick}
        />
      ) : viewMode === 'month' ? (
        <MonthlyCalendarGrid
          currentDate={currentDate}
          events={events}
          onNavigate={handleNavigate}
          onToday={handleToday}
          onEventClick={handleEventClick}
          showHeader
          showNavigation
        />
      ) : viewMode === 'year' ? (
        <YearlyCalendarGrid
          currentDate={currentDate}
          events={events}
          onNavigate={handleNavigate}
          onToday={handleToday}
          onEventClick={handleEventClick}
          onWeekClick={(weekStart) => {
            // Could switch to week view on click
          }}
        />
      ) : (
        <SemesterCalendarGrid
          currentDate={currentDate}
          events={events}
          onNavigate={handleNavigate}
          onToday={handleToday}
          onEventClick={handleEventClick}
          onMonthClick={handleMonthClick}
          monthCount={3}
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
