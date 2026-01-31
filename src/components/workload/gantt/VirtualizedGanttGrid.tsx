import { useMemo, useRef, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format, isWeekend, isToday, parseISO } from 'date-fns';
import { TeamMemberWorkload, WorkloadSlot, UserLeave } from '@/types/workload';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { GanttRowCollaborator } from './GanttRowCollaborator';
import { GanttEventBar, GanttLeaveBar, GanttHolidayCell } from './GanttEventBar';
import { GanttHoverCard } from './GanttHoverCard';
import { Badge } from '@/components/ui/badge';

export interface VirtualizedGanttGridProps {
  workloadData: TeamMemberWorkload[];
  days: Date[];
  dayWidth: number;
  rowHeight: number;
  memberColumnWidth: number;
  isCompact: boolean;
  startDate: Date;
  endDate: Date;
  tasks: Task[];
  tasksByUser: Map<string, { task: Task; slots: WorkloadSlot[] }[]>;
  getTaskProgress?: (taskId: string) => { completed: number; total: number } | null;
  onTaskClick: (task: Task, slots: WorkloadSlot[]) => void;
  onDragStart: (e: React.MouseEvent, mode: 'move' | 'resize-start' | 'resize-end', taskId: string, slots: WorkloadSlot[], userId: string) => void;
  onQuickAddStart: (e: React.MouseEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onDropZoneEnter: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onDropZoneLeave: () => void;
  onDrop: (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  dropTarget: { userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null;
  quickAddSelection: { userId: string | null; startDate: string | null; endDate: string | null } | null;
  leaves: UserLeave[];
  checkConflict: (userId: string, slots: WorkloadSlot[]) => { hasConflict: boolean; message?: string };
  containerHeight?: number;
  // Multi-select
  isSelecting?: boolean;
  selectedTasks?: Set<string>;
  onTaskSelect?: (taskId: string) => void;
}

export interface VirtualizedGanttGridRef {
  scrollToMember: (memberId: string) => void;
  scrollToToday: () => void;
}

// Memoized row component for performance
const GanttRow = memo(function GanttRow({
  member,
  memberTasks,
  days,
  dayWidth,
  rowHeight,
  memberColumnWidth,
  isCompact,
  startDate,
  getTaskProgress,
  onTaskClick,
  onDragStart,
  onQuickAddStart,
  onDropZoneEnter,
  onDropZoneLeave,
  onDrop,
  dropTarget,
  quickAddSelection,
  checkConflict,
  style,
  isEven,
}: {
  member: TeamMemberWorkload;
  memberTasks: { task: Task; slots: WorkloadSlot[] }[];
  days: Date[];
  dayWidth: number;
  rowHeight: number;
  memberColumnWidth: number;
  isCompact: boolean;
  startDate: Date;
  getTaskProgress?: (taskId: string) => { completed: number; total: number } | null;
  onTaskClick: (task: Task, slots: WorkloadSlot[]) => void;
  onDragStart: (e: React.MouseEvent, mode: 'move' | 'resize-start' | 'resize-end', taskId: string, slots: WorkloadSlot[], userId: string) => void;
  onQuickAddStart: (e: React.MouseEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onDropZoneEnter: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onDropZoneLeave: () => void;
  onDrop: (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  dropTarget: { userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null;
  quickAddSelection: { userId: string | null; startDate: string | null; endDate: string | null } | null;
  checkConflict: (userId: string, slots: WorkloadSlot[]) => { hasConflict: boolean; message?: string };
  style: React.CSSProperties;
  isEven: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute left-0 right-0 flex border-b border-border/30",
        isEven ? "bg-card" : "bg-muted/10"
      )}
      style={style}
      role="row"
    >
      {/* Member Info Column - Sticky */}
      <GanttRowCollaborator
        member={member}
        isCompact={isCompact}
        columnWidth={memberColumnWidth}
      />

      {/* Timeline Area */}
      <div
        className="relative flex-1"
        style={{ width: days.length * dayWidth }}
        role="gridcell"
      >
        {/* Day cells (background grid) */}
        <div className="absolute inset-0 flex">
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayData = member.days.find(d => d.date === dateStr);
            const isWeekendDay = isWeekend(day);
            const isTodayDay = isToday(day);
            const isHoliday = dayData?.morning.isHoliday || dayData?.afternoon.isHoliday;
            const isLeave = dayData?.morning.isLeave || dayData?.afternoon.isLeave;
            const leaveType = dayData?.morning.leaveType || dayData?.afternoon.leaveType;

            const isDropTargetHere = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr;
            const isQuickAddSelected = quickAddSelection?.userId === member.memberId &&
              quickAddSelection.startDate && quickAddSelection.endDate &&
              dateStr >= quickAddSelection.startDate && dateStr <= quickAddSelection.endDate;

            return (
              <div
                key={dateStr}
                className={cn(
                  "shrink-0 border-r border-border/20 flex relative",
                  isWeekendDay && "bg-muted/30",
                  isTodayDay && "bg-primary/5",
                  isHoliday && "workload-holiday-column",
                  isLeave && !isHoliday && "bg-cyan-50/50 dark:bg-cyan-900/10",
                  isQuickAddSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
                )}
                style={{ width: dayWidth, height: '100%' }}
                role="gridcell"
                aria-label={format(day, 'EEEE d MMMM', { locale: 'fr' as any })}
              >
                {/* Leave/Holiday indicators */}
                {isHoliday && (
                  <GanttHolidayCell isCompact={isCompact} />
                )}
                {isLeave && !isHoliday && (
                  <GanttLeaveBar leaveType={leaveType} isCompact={isCompact} />
                )}

                {/* Drop zones (only if not holiday/leave) */}
                {!isHoliday && !isLeave && (
                  <>
                    <div
                      className={cn(
                        "flex-1 transition-colors",
                        isDropTargetHere && dropTarget?.halfDay === 'morning' &&
                          "bg-primary/20 ring-2 ring-primary ring-inset"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!isWeekendDay) {
                          onDropZoneEnter(member.memberId, dateStr, 'morning');
                        }
                      }}
                      onDragLeave={onDropZoneLeave}
                      onDrop={(e) => onDrop(e, member.memberId, dateStr, 'morning')}
                      onMouseDown={(e) => {
                        if (!isWeekendDay && e.button === 0) {
                          onQuickAddStart(e, member.memberId, dateStr, 'morning');
                        }
                      }}
                    />
                    <div
                      className={cn(
                        "flex-1 border-l border-dashed border-border/20 transition-colors",
                        isDropTargetHere && dropTarget?.halfDay === 'afternoon' &&
                          "bg-primary/20 ring-2 ring-primary ring-inset"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!isWeekendDay) {
                          onDropZoneEnter(member.memberId, dateStr, 'afternoon');
                        }
                      }}
                      onDragLeave={onDropZoneLeave}
                      onDrop={(e) => onDrop(e, member.memberId, dateStr, 'afternoon')}
                      onMouseDown={(e) => {
                        if (!isWeekendDay && e.button === 0) {
                          onQuickAddStart(e, member.memberId, dateStr, 'afternoon');
                        }
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Task Bars */}
        {memberTasks.map(({ task, slots }) => {
          const progress = getTaskProgress ? getTaskProgress(task.id) : null;
          const progressPercent = progress && progress.total > 0
            ? Math.round((progress.completed / progress.total) * 100)
            : 0;
          const conflictInfo = checkConflict(member.memberId, slots);

          return (
            <GanttHoverCard
              key={task.id}
              task={task}
              slots={slots}
              progress={progressPercent}
              hasConflict={conflictInfo.hasConflict}
              conflictMessage={conflictInfo.message}
              onViewDetails={() => onTaskClick(task, slots)}
            >
              <GanttEventBar
                task={task}
                slots={slots}
                startDate={startDate}
                dayWidth={dayWidth}
                progress={progressPercent}
                onClick={() => onTaskClick(task, slots)}
                onDragStart={(e, mode) => onDragStart(e, mode, task.id, slots, member.memberId)}
                isCompact={isCompact}
                hasConflict={conflictInfo.hasConflict}
              />
            </GanttHoverCard>
          );
        })}
      </div>
    </div>
  );
});

export const VirtualizedGanttGrid = forwardRef<VirtualizedGanttGridRef, VirtualizedGanttGridProps>(
  function VirtualizedGanttGrid(props, ref) {
    const {
      workloadData,
      days,
      dayWidth,
      rowHeight,
      memberColumnWidth,
      isCompact,
      startDate,
      endDate,
      tasks,
      tasksByUser,
      getTaskProgress,
      onTaskClick,
      onDragStart,
      onQuickAddStart,
      onDropZoneEnter,
      onDropZoneLeave,
      onDrop,
      dropTarget,
      quickAddSelection,
      leaves,
      checkConflict,
      containerHeight = 600,
    } = props;

    const parentRef = useRef<HTMLDivElement>(null);

    // Virtualize rows - with increased overscan for smoother scrolling
    const rowVirtualizer = useVirtualizer({
      count: workloadData.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => rowHeight,
      overscan: 10, // Increased for smoother scrolling with many rows
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      scrollToMember: (memberId: string) => {
        const index = workloadData.findIndex(m => m.memberId === memberId);
        if (index >= 0) {
          rowVirtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' });
        }
      },
      scrollToToday: () => {
        const todayIndex = days.findIndex(d => isToday(d));
        if (todayIndex >= 0 && parentRef.current) {
          const scrollLeft = (todayIndex * dayWidth) - (parentRef.current.clientWidth / 2) + memberColumnWidth;
          parentRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
      },
    }), [workloadData, days, dayWidth, memberColumnWidth, rowVirtualizer]);

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
      <div
        ref={parentRef}
        className="overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{ height: containerHeight }}
        tabIndex={0}
        role="grid"
        aria-label="Grille de planification"
        aria-rowcount={workloadData.length}
      >
        <div
          className="relative"
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: memberColumnWidth + (days.length * dayWidth),
          }}
        >
          {virtualItems.map((virtualRow) => {
            const member = workloadData[virtualRow.index];
            const memberTasks = tasksByUser.get(member.memberId) || [];

            return (
              <GanttRow
                key={member.memberId}
                member={member}
                memberTasks={memberTasks}
                days={days}
                dayWidth={dayWidth}
                rowHeight={rowHeight}
                memberColumnWidth={memberColumnWidth}
                isCompact={isCompact}
                startDate={startDate}
                getTaskProgress={getTaskProgress}
                onTaskClick={onTaskClick}
                onDragStart={onDragStart}
                onQuickAddStart={onQuickAddStart}
                onDropZoneEnter={onDropZoneEnter}
                onDropZoneLeave={onDropZoneLeave}
                onDrop={onDrop}
                dropTarget={dropTarget}
                quickAddSelection={quickAddSelection}
                checkConflict={checkConflict}
                style={{
                  top: virtualRow.start,
                  height: rowHeight,
                }}
                isEven={virtualRow.index % 2 === 0}
              />
            );
          })}
        </div>
      </div>
    );
  }
);
