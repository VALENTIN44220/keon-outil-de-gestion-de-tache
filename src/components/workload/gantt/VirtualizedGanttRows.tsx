import { useRef, useCallback, useMemo, memo, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format, isWeekend, isToday, parseISO } from 'date-fns';
import { TeamMemberWorkload, WorkloadSlot, UserLeave } from '@/types/workload';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { GanttMemberRow } from './GanttMemberRow';
import { GanttTaskBarInteractive, QuickAddSelection } from './GanttTaskBarInteractive';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface VirtualizedGanttRowsProps {
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
  dragState: { taskId: string | null; mode: string | null } | null;
  getDragOffset: (taskId: string) => { x: number; y: number } | null;
  quickAddSelection: { userId: string | null; startDate: string | null; endDate: string | null } | null;
  leaves: UserLeave[];
  checkConflict: (userId: string, slots: WorkloadSlot[]) => { hasConflict: boolean; message?: string };
  containerHeight?: number;
}

export interface VirtualizedGanttRowsRef {
  scrollToMember: (memberId: string) => void;
  scrollToToday: () => void;
}

// Memoized row component for better performance
const GanttRowMemoized = memo(function GanttRowMemoized({
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
  dragState,
  getDragOffset,
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
  dragState: { taskId: string | null; mode: string | null } | null;
  getDragOffset: (taskId: string) => { x: number; y: number } | null;
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
      <div 
        className="sticky left-0 z-10 shrink-0"
        style={{ width: memberColumnWidth }}
      >
        <GanttMemberRow 
          member={member} 
          isCompact={isCompact}
          memberColumnWidth={memberColumnWidth}
        />
      </div>
      
      {/* Timeline Area */}
      <div 
        className="relative flex-1"
        style={{ width: days.length * dayWidth }}
        role="gridcell"
      >
        {/* Day cells (background grid) - optimized for performance */}
        <DayGridCells
          days={days}
          member={member}
          dayWidth={dayWidth}
          isCompact={isCompact}
          dropTarget={dropTarget}
          quickAddSelection={quickAddSelection}
          onDropZoneEnter={onDropZoneEnter}
          onDropZoneLeave={onDropZoneLeave}
          onDrop={onDrop}
          onQuickAddStart={onQuickAddStart}
        />
        
        {/* Quick Add Selection Overlay */}
        {quickAddSelection?.userId === member.memberId && 
         quickAddSelection.startDate && quickAddSelection.endDate && (
          <QuickAddSelection
            startDate={quickAddSelection.startDate}
            endDate={quickAddSelection.endDate}
            dayWidth={dayWidth}
            gridStartDate={startDate}
            height={rowHeight}
          />
        )}
        
        {/* Task Bars */}
        {memberTasks.map(({ task, slots }) => {
          const progress = getTaskProgress ? getTaskProgress(task.id) : null;
          const progressPercent = progress && progress.total > 0 
            ? Math.round((progress.completed / progress.total) * 100) 
            : 0;
          
          const isDragging = dragState?.taskId === task.id && dragState?.mode !== null;
          const dragOffset = getDragOffset(task.id);
          const conflictInfo = checkConflict(member.memberId, slots);
          
          return (
            <GanttTaskBarInteractive
              key={task.id}
              task={task}
              slots={slots}
              startDate={startDate}
              endDate={startDate} // not used for calculation
              dayWidth={dayWidth}
              progress={progressPercent}
              onClick={() => onTaskClick(task, slots)}
              onDragStart={(e, mode) => onDragStart(e, mode, task.id, slots, member.memberId)}
              isCompact={isCompact}
              isDragging={isDragging}
              dragOffset={dragOffset || undefined}
              hasConflict={conflictInfo.hasConflict}
              conflictMessage={conflictInfo.message}
            />
          );
        })}
      </div>
    </div>
  );
});

// Memoized day grid cells for performance
const DayGridCells = memo(function DayGridCells({
  days,
  member,
  dayWidth,
  isCompact,
  dropTarget,
  quickAddSelection,
  onDropZoneEnter,
  onDropZoneLeave,
  onDrop,
  onQuickAddStart,
}: {
  days: Date[];
  member: TeamMemberWorkload;
  dayWidth: number;
  isCompact: boolean;
  dropTarget: { userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null;
  quickAddSelection: { userId: string | null; startDate: string | null; endDate: string | null } | null;
  onDropZoneEnter: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onDropZoneLeave: () => void;
  onDrop: (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
  onQuickAddStart: (e: React.MouseEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
}) {
  return (
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
              isWeekendDay && "bg-muted/40",
              isTodayDay && "bg-primary/5",
              isHoliday && "bg-amber-50 dark:bg-amber-900/20",
              isLeave && !isHoliday && "bg-cyan-50 dark:bg-cyan-900/20"
            )}
            style={{ width: dayWidth, height: '100%' }}
            role="gridcell"
            aria-label={`${format(day, 'EEEE d MMMM')}`}
          >
            {/* Leave/Holiday stripe pattern */}
            {isLeave && !isHoliday && (
              <div 
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  background: `repeating-linear-gradient(
                    -45deg,
                    transparent,
                    transparent 4px,
                    rgb(6, 182, 212, 0.3) 4px,
                    rgb(6, 182, 212, 0.3) 8px
                  )`
                }}
              />
            )}
            
            {/* Morning drop zone */}
            <div
              className={cn(
                "flex-1 transition-colors relative",
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
                if (!isWeekendDay && !isHoliday && !isLeave && e.button === 0) {
                  onQuickAddStart(e, member.memberId, dateStr, 'morning');
                }
              }}
            >
              {isHoliday && (
                <div className="h-full flex items-center justify-center">
                  <Badge variant="outline" className="text-[9px] bg-amber-100 border-amber-300 text-amber-700">
                    {isCompact ? 'F' : 'Férié'}
                  </Badge>
                </div>
              )}
              {isLeave && !isHoliday && (
                <div className="h-full flex items-center justify-center">
                  <Badge variant="outline" className={cn(
                    "text-[9px]",
                    leaveType === 'paid' && "bg-cyan-100 border-cyan-300 text-cyan-700",
                    leaveType === 'sick' && "bg-red-100 border-red-300 text-red-700",
                    leaveType === 'rtt' && "bg-purple-100 border-purple-300 text-purple-700",
                    !['paid', 'sick', 'rtt'].includes(leaveType || '') && "bg-slate-100 border-slate-300 text-slate-700"
                  )}>
                    {isCompact ? 'C' : 
                      leaveType === 'paid' ? 'CP' :
                      leaveType === 'sick' ? 'Maladie' :
                      leaveType === 'rtt' ? 'RTT' : 'Congé'
                    }
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Afternoon drop zone */}
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
                if (!isWeekendDay && !isHoliday && !isLeave && e.button === 0) {
                  onQuickAddStart(e, member.memberId, dateStr, 'afternoon');
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

export const VirtualizedGanttRows = forwardRef<VirtualizedGanttRowsRef, VirtualizedGanttRowsProps>(
  function VirtualizedGanttRows(props, ref) {
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
      dragState,
      getDragOffset,
      quickAddSelection,
      leaves,
      checkConflict,
      containerHeight = 600,
    } = props;

    const parentRef = useRef<HTMLDivElement>(null);

    // Virtualize rows with higher overscan for smooth scrolling
    const rowVirtualizer = useVirtualizer({
      count: workloadData.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => rowHeight,
      overscan: 15, // Higher overscan for smoother scrolling with 200+ members
    });

    // Expose scroll methods via ref
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
        className="overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{ height: containerHeight }}
        tabIndex={0}
        role="grid"
        aria-label="Grille de planification des tâches"
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
              <GanttRowMemoized
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
                dragState={dragState}
                getDragOffset={getDragOffset}
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

// Overload heatmap indicator
interface OverloadIndicatorProps {
  percentage: number;
  className?: string;
}

export function OverloadIndicator({ percentage, className }: OverloadIndicatorProps) {
  if (percentage <= 100) return null;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
      "bg-red-100 text-red-700 border border-red-200",
      "animate-pulse",
      className
    )}>
      <AlertTriangle className="h-3 w-3" />
      <span>{percentage}%</span>
    </div>
  );
}
