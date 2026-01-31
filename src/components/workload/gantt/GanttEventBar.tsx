import { useMemo, useState, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Task } from '@/types/task';
import { WorkloadSlot } from '@/types/workload';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  AlertCircle,
  Eye,
  Calendar,
  MoreHorizontal,
  ClipboardList,
  PlayCircle,
  Hourglass,
  UserPlus,
  Link2,
  Palmtree,
  Sun,
} from 'lucide-react';

// Status configuration
const STATUS_CONFIG: Record<string, {
  gradient: string;
  track: string;
  border: string;
  glow: string;
  icon: typeof ClipboardList;
  label: string;
}> = {
  'todo': {
    gradient: 'from-slate-500 via-slate-450 to-slate-400',
    track: 'bg-slate-100',
    border: 'border-slate-300',
    glow: 'shadow-slate-200',
    icon: ClipboardList,
    label: 'À faire'
  },
  'in-progress': {
    gradient: 'from-blue-600 via-blue-500 to-blue-400',
    track: 'bg-blue-100',
    border: 'border-blue-300',
    glow: 'shadow-blue-200',
    icon: PlayCircle,
    label: 'En cours'
  },
  'done': {
    gradient: 'from-emerald-600 via-emerald-500 to-emerald-400',
    track: 'bg-emerald-100',
    border: 'border-emerald-300',
    glow: 'shadow-emerald-200',
    icon: CheckCircle2,
    label: 'Terminée'
  },
  'validated': {
    gradient: 'from-purple-600 via-purple-500 to-purple-400',
    track: 'bg-purple-100',
    border: 'border-purple-300',
    glow: 'shadow-purple-200',
    icon: CheckCircle2,
    label: 'Validée'
  },
  'to_assign': {
    gradient: 'from-amber-500 via-amber-450 to-amber-400',
    track: 'bg-amber-100',
    border: 'border-amber-300',
    glow: 'shadow-amber-200',
    icon: UserPlus,
    label: 'À affecter'
  },
  'pending-validation': {
    gradient: 'from-violet-600 via-violet-500 to-violet-400',
    track: 'bg-violet-100',
    border: 'border-violet-300',
    glow: 'shadow-violet-200',
    icon: Hourglass,
    label: 'En validation'
  },
};

const PRIORITY_CONFIG: Record<string, { icon: typeof Flag; color: string }> = {
  urgent: { icon: AlertTriangle, color: 'text-red-500' },
  high: { icon: Flag, color: 'text-orange-500' },
  medium: { icon: Flag, color: 'text-blue-500' },
  low: { icon: Flag, color: 'text-emerald-500' },
};

interface GanttEventBarProps {
  task: Task;
  slots: WorkloadSlot[];
  startDate: Date;
  dayWidth: number;
  progress?: number;
  onClick?: () => void;
  onDragStart?: (e: React.MouseEvent, mode: 'move' | 'resize-start' | 'resize-end') => void;
  isCompact?: boolean;
  isDragging?: boolean;
  dragOffset?: { x: number; y: number };
  hasConflict?: boolean;
  isSelected?: boolean;
}

export const GanttEventBar = memo(function GanttEventBar({
  task,
  slots,
  startDate,
  dayWidth,
  progress = 0,
  onClick,
  onDragStart,
  isCompact = false,
  isDragging = false,
  dragOffset,
  hasConflict = false,
  isSelected = false,
}: GanttEventBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.todo;
  const priorityConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];

  // Calculate bar position and width based on slots
  const barMetrics = useMemo(() => {
    if (slots.length === 0) return null;

    const sortedSlots = [...slots].sort((a, b) => 
      a.date.localeCompare(b.date) || (a.half_day === 'morning' ? -1 : 1)
    );

    const firstSlot = sortedSlots[0];
    const firstDate = parseISO(firstSlot.date);
    const daysFromStart = Math.floor((firstDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const halfDayOffset = firstSlot.half_day === 'afternoon' ? 0.5 : 0;
    const left = (daysFromStart + halfDayOffset) * dayWidth;
    const totalHalfDays = slots.length;
    const width = Math.max((totalHalfDays / 2) * dayWidth, 50);

    return { left, width, totalDays: totalHalfDays / 2 };
  }, [slots, startDate, dayWidth]);

  if (!barMetrics) return null;

  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== 'done' && task.status !== 'validated';
  const isDone = task.status === 'done' || task.status === 'validated';

  const displayProgress = useMemo(() => {
    if (progress > 0) return progress;
    switch (task.status) {
      case 'done': 
      case 'validated': 
        return 100;
      case 'in-progress': 
        return 50;
      default: 
        return 0;
    }
  }, [progress, task.status]);

  const barHeight = isCompact ? 32 : 44;
  const showTitle = barMetrics.width >= 70;
  const showProgress = barMetrics.width >= 100 && !isCompact;
  const showBadges = barMetrics.width >= 120 && !isCompact;
  const showQuickActions = isHovered && !isDragging && barMetrics.width >= 100;
  const showResizeHandles = isHovered && !isDragging && barMetrics.width >= 60;

  const transform = dragOffset
    ? `translateY(-50%) translate(${dragOffset.x}px, ${dragOffset.y}px)`
    : 'translateY(-50%)';

  const StatusIcon = statusConfig.icon;

  return (
    <div
      ref={barRef}
      className={cn(
        "absolute cursor-grab transition-all duration-150 group select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isDragging && "cursor-grabbing z-50 opacity-95 shadow-2xl scale-[1.03]",
        !isDragging && "hover:z-30",
        isHovered && !isDragging && "scale-[1.02]",
        isSelected && "ring-2 ring-primary ring-offset-1"
      )}
      style={{
        left: barMetrics.left,
        width: barMetrics.width,
        height: barHeight,
        top: '50%',
        transform,
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-quick-action]')) return;

        const rect = barRef.current?.getBoundingClientRect();
        if (rect) {
          const relativeX = e.clientX - rect.left;
          if (relativeX < 12 && showResizeHandles) {
            onDragStart?.(e, 'resize-start');
          } else if (relativeX > rect.width - 12 && showResizeHandles) {
            onDragStart?.(e, 'resize-end');
          } else {
            onDragStart?.(e, 'move');
          }
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}, ${statusConfig.label}, ${displayProgress}% complété`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Main bar */}
      <div
        className={cn(
          "relative w-full h-full rounded-xl overflow-hidden",
          "border-2 bg-white dark:bg-slate-900",
          statusConfig.border,
          isHovered && statusConfig.glow,
          isOverdue && "ring-2 ring-red-400 ring-offset-1 animate-pulse",
          hasConflict && "ring-2 ring-amber-400 ring-offset-1",
          isDragging && "ring-2 ring-primary ring-offset-2",
          task.priority === 'urgent' && !isOverdue && "ring-1 ring-red-300",
          task.priority === 'high' && !isOverdue && "ring-1 ring-orange-300"
        )}
      >
        {/* Track background */}
        <div className={cn(
          "absolute inset-0 rounded-xl",
          statusConfig.track,
          "opacity-40"
        )} />

        {/* Progress fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ease-out",
            `bg-gradient-to-r ${statusConfig.gradient}`,
          )}
          style={{ width: `${displayProgress}%` }}
        />

        {/* Shimmer effect on hover */}
        {isHovered && !isDragging && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer pointer-events-none" />
        )}

        {/* Content overlay */}
        <div className="absolute inset-0 flex items-center px-3 gap-2">
          {/* Status icon */}
          <div className={cn(
            "shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all",
            displayProgress > 30
              ? "bg-white/20"
              : "bg-slate-100 dark:bg-slate-800",
            hasConflict && "bg-amber-500",
            isOverdue && !isDone && "bg-red-500"
          )}>
            {hasConflict ? (
              <AlertCircle className="h-3.5 w-3.5 text-white" />
            ) : isOverdue && !isDone ? (
              <AlertTriangle className="h-3.5 w-3.5 text-white" />
            ) : (
              <StatusIcon className={cn(
                "h-3.5 w-3.5",
                displayProgress > 30 ? "text-white" : "text-slate-600"
              )} />
            )}
          </div>

          {/* Task title */}
          {showTitle && (
            <span className={cn(
              "text-xs font-semibold truncate flex-1 transition-colors",
              displayProgress > 40 ? "text-white drop-shadow-sm" : "text-slate-700 dark:text-slate-200",
              isDone && "line-through opacity-70"
            )}>
              {task.title}
            </span>
          )}

          {/* Priority badge */}
          {showBadges && priorityConfig && (task.priority === 'urgent' || task.priority === 'high') && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 h-4 shrink-0 border-0",
                task.priority === 'urgent' && "bg-red-100 text-red-700",
                task.priority === 'high' && "bg-orange-100 text-orange-700"
              )}
            >
              <priorityConfig.icon className="h-2.5 w-2.5 mr-0.5" />
              {task.priority === 'urgent' ? 'Urgent' : 'Haute'}
            </Badge>
          )}

          {/* Dependencies badge */}
          {showBadges && task.category_id && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 shrink-0 border-0 bg-indigo-100 text-indigo-700"
            >
              <Link2 className="h-2.5 w-2.5" />
            </Badge>
          )}

          {/* Progress badge */}
          {showProgress && displayProgress > 0 && displayProgress < 100 && (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] font-bold shrink-0 px-1.5 py-0 h-5",
                displayProgress > 40
                  ? "bg-white/20 text-white border-white/30"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              {displayProgress}%
            </Badge>
          )}

          {/* Quick actions on hover */}
          {showQuickActions && (
            <div
              className="flex items-center gap-0.5 shrink-0 animate-in fade-in slide-in-from-right-2 duration-150"
              data-quick-action
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 bg-white/80 hover:bg-white shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
                aria-label="Voir les détails"
              >
                <Eye className="h-3 w-3 text-slate-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 bg-white/80 hover:bg-white shadow-sm"
                aria-label="Modifier les dates"
              >
                <Calendar className="h-3 w-3 text-slate-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 bg-white/80 hover:bg-white shadow-sm"
                aria-label="Plus d'options"
              >
                <MoreHorizontal className="h-3 w-3 text-slate-600" />
              </Button>
            </div>
          )}
        </div>

        {/* Resize handles */}
        {showResizeHandles && (
          <>
            <div
              className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center bg-gradient-to-r from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => {
                e.stopPropagation();
                onDragStart?.(e, 'resize-start');
              }}
              aria-label="Redimensionner début"
            >
              <div className="w-1 h-6 rounded-full bg-slate-400/70" />
            </div>
            <div
              className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center bg-gradient-to-l from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => {
                e.stopPropagation();
                onDragStart?.(e, 'resize-end');
              }}
              aria-label="Redimensionner fin"
            >
              <div className="w-1 h-6 rounded-full bg-slate-400/70" />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// Leave bar component
interface GanttLeaveBarProps {
  leaveType?: string;
  isCompact?: boolean;
}

export function GanttLeaveBar({ leaveType, isCompact = false }: GanttLeaveBarProps) {
  const getLeaveConfig = () => {
    switch (leaveType) {
      case 'paid':
        return { label: isCompact ? 'CP' : 'Congés payés', bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700' };
      case 'sick':
        return { label: isCompact ? 'M' : 'Maladie', bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' };
      case 'rtt':
        return { label: 'RTT', bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' };
      default:
        return { label: isCompact ? 'C' : 'Congé', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' };
    }
  };

  const config = getLeaveConfig();

  return (
    <div className="h-full w-full flex items-center justify-center relative">
      {/* Stripe pattern background */}
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
      <Badge 
        variant="outline" 
        className={cn("text-[9px] relative z-10", config.bg, config.border, config.text)}
      >
        <Palmtree className="h-2.5 w-2.5 mr-0.5" />
        {config.label}
      </Badge>
    </div>
  );
}

// Holiday cell component
interface GanttHolidayCellProps {
  isCompact?: boolean;
  holidayName?: string;
}

export function GanttHolidayCell({ isCompact = false, holidayName }: GanttHolidayCellProps) {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <Badge 
        variant="outline" 
        className="text-[9px] bg-amber-100 border-amber-300 text-amber-700"
      >
        <Sun className="h-2.5 w-2.5 mr-0.5" />
        {isCompact ? 'F' : (holidayName || 'Férié')}
      </Badge>
    </div>
  );
}

// Quick add selection overlay
interface QuickAddSelectionOverlayProps {
  startDate: string;
  endDate: string;
  dayWidth: number;
  gridStartDate: Date;
  height: number;
}

export function QuickAddSelectionOverlay({
  startDate,
  endDate,
  dayWidth,
  gridStartDate,
  height,
}: QuickAddSelectionOverlayProps) {
  const metrics = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysFromStart = Math.floor((start.getTime() - gridStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      left: daysFromStart * dayWidth,
      width: duration * dayWidth,
    };
  }, [startDate, endDate, dayWidth, gridStartDate]);

  return (
    <div
      className="absolute top-0 bg-primary/20 border-2 border-dashed border-primary rounded-lg pointer-events-none z-20"
      style={{
        left: metrics.left,
        width: metrics.width,
        height,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Badge className="bg-primary text-primary-foreground shadow-lg">
          Nouvelle tâche
        </Badge>
      </div>
    </div>
  );
}
