import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Task } from '@/types/task';
import { WorkloadSlot } from '@/types/workload';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, Flag, Link2 } from 'lucide-react';

interface GanttTaskBarProps {
  task: Task;
  slots: WorkloadSlot[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  progress?: number; // 0-100
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  isCompact?: boolean;
}

// Use centralized status colors
const STATUS_COLORS = {
  'todo': { bg: 'from-slate-500 to-slate-400', track: 'bg-slate-100', border: 'border-slate-300' },
  'in-progress': { bg: 'from-blue-500 to-blue-400', track: 'bg-blue-100', border: 'border-blue-300' },
  'done': { bg: 'from-green-500 to-green-400', track: 'bg-green-100', border: 'border-green-300' },
  'validated': { bg: 'from-emerald-500 to-emerald-400', track: 'bg-emerald-100', border: 'border-emerald-300' },
  'to_assign': { bg: 'from-amber-500 to-amber-400', track: 'bg-amber-100', border: 'border-amber-300' },
  'pending_validation_1': { bg: 'from-violet-500 to-violet-400', track: 'bg-violet-100', border: 'border-violet-300' },
  'pending_validation_2': { bg: 'from-violet-500 to-violet-400', track: 'bg-violet-100', border: 'border-violet-300' },
  'review': { bg: 'from-purple-500 to-purple-400', track: 'bg-purple-100', border: 'border-purple-300' },
  'cancelled': { bg: 'from-gray-400 to-gray-300', track: 'bg-gray-100', border: 'border-gray-300' },
};

const PRIORITY_INDICATORS = {
  urgent: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500' },
  high: { icon: Flag, color: 'text-orange-500', bg: 'bg-orange-500' },
  medium: { icon: Flag, color: 'text-blue-500', bg: 'bg-blue-500' },
  low: { icon: Flag, color: 'text-emerald-500', bg: 'bg-emerald-500' },
};

export function GanttTaskBar({
  task,
  slots,
  startDate,
  endDate,
  dayWidth,
  progress = 0,
  onClick,
  onDragStart,
  isCompact = false,
}: GanttTaskBarProps) {
  const statusConfig = STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.todo;
  const priorityConfig = PRIORITY_INDICATORS[task.priority as keyof typeof PRIORITY_INDICATORS];
  
  // Calculate bar position and width based on slots
  const barMetrics = useMemo(() => {
    if (slots.length === 0) return null;
    
    // Sort slots by date
    const sortedSlots = [...slots].sort((a, b) => a.date.localeCompare(b.date) || (a.half_day === 'morning' ? -1 : 1));
    
    // Find the first and last slot dates
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    const firstDate = parseISO(firstSlot.date);
    
    // Calculate position from start date
    const daysFromStart = Math.floor((firstDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const halfDayOffset = firstSlot.half_day === 'afternoon' ? 0.5 : 0;
    const left = (daysFromStart + halfDayOffset) * dayWidth;
    
    // Calculate width based on slot count
    const totalHalfDays = slots.length;
    const width = Math.max((totalHalfDays / 2) * dayWidth, 40); // Minimum width
    
    return { left, width, totalDays: totalHalfDays / 2 };
  }, [slots, startDate, dayWidth]);
  
  if (!barMetrics) return null;
  
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== 'done' && task.status !== 'validated';
  const isDone = task.status === 'done' || task.status === 'validated';
  
  // Calculate progress
  const displayProgress = useMemo(() => {
    if (progress > 0) return progress;
    switch (task.status) {
      case 'done': return 100;
      case 'validated': return 100;
      case 'in-progress': return 50;
      default: return 0;
    }
  }, [progress, task.status]);
  
  const barHeight = isCompact ? 28 : 40;
  const showTitle = barMetrics.width >= 60;
  const showProgress = barMetrics.width >= 80 && !isCompact;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute cursor-pointer transition-all duration-200 group",
            "hover:z-20"
          )}
          style={{
            left: barMetrics.left,
            width: barMetrics.width,
            height: barHeight,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
          onClick={onClick}
          draggable
          onDragStart={onDragStart}
        >
          {/* Main bar - Monday.com style with rounded ends */}
          <div
            className={cn(
              "relative w-full h-full rounded-full overflow-hidden",
              "shadow-md hover:shadow-lg transition-shadow duration-200",
              "border-2 bg-white dark:bg-slate-800",
              statusConfig.border,
              isOverdue && "ring-2 ring-red-400 ring-offset-1",
              "group-hover:scale-[1.02] group-hover:z-10 transition-transform"
            )}
          >
            {/* Track background */}
            <div className={cn(
              "absolute inset-0 rounded-full",
              statusConfig.track,
              "opacity-50"
            )} />
            
            {/* Progress fill */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                `bg-gradient-to-r ${statusConfig.bg}`,
              )}
              style={{ width: `${displayProgress}%` }}
            />
            
            {/* Content overlay */}
            <div className="absolute inset-0 flex items-center px-2.5 gap-2">
              {/* Priority/Status indicator */}
              {isOverdue && !isDone && (
                <div className="shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                  <AlertTriangle className="h-3 w-3 text-white" />
                </div>
              )}
              
              {isDone && (
                <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
              )}
              
              {!isOverdue && !isDone && priorityConfig && task.priority !== 'medium' && task.priority !== 'low' && (
                <div className={cn("shrink-0 w-1.5 h-5 rounded-full", priorityConfig.bg)} />
              )}
              
              {/* Task title */}
              {showTitle && (
                <span className={cn(
                  "text-xs font-semibold truncate flex-1",
                  displayProgress > 40 ? "text-white drop-shadow-sm" : "text-slate-700 dark:text-slate-200",
                  isDone && "line-through opacity-70"
                )}>
                  {task.title}
                </span>
              )}
              
              {/* Progress badge */}
              {showProgress && displayProgress > 0 && displayProgress < 100 && (
                <span className={cn(
                  "text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full",
                  displayProgress > 40 
                    ? "text-white/90 bg-black/20" 
                    : "text-slate-600 bg-white/80"
                )}>
                  {displayProgress}%
                </span>
              )}
            </div>
          </div>
        </div>
      </TooltipTrigger>
      
      {/* Rich Tooltip */}
      <TooltipContent 
        side="top" 
        className="p-0 w-80 overflow-hidden rounded-xl shadow-xl border-0"
        sideOffset={8}
      >
        {/* Header with gradient */}
        <div className={cn(
          "p-4 text-white",
          `bg-gradient-to-r ${statusConfig.bg}`
        )}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold text-sm leading-tight">{task.title}</h4>
            {priorityConfig && (
              <Badge variant="secondary" className="shrink-0 text-[10px] bg-white/20 text-white border-0 gap-1">
                <priorityConfig.icon className="h-3 w-3" />
                {task.priority}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-xs opacity-90 line-clamp-2">{task.description}</p>
          )}
        </div>
        
        {/* Details */}
        <div className="p-4 bg-popover space-y-3">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Avancement</span>
              <span className="font-bold">{displayProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", `bg-gradient-to-r ${statusConfig.bg}`)}
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>
          
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Durée
              </span>
              <p className="font-semibold">
                {barMetrics.totalDays} jour{barMetrics.totalDays > 1 ? 's' : ''}
              </p>
            </div>
            
            {task.due_date && (
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Échéance</span>
                <p className={cn("font-semibold", isOverdue && "text-red-600")}>
                  {format(parseISO(task.due_date), 'd MMM yyyy', { locale: fr })}
                </p>
              </div>
            )}
          </div>
          
          {/* Warning if overdue */}
          {isOverdue && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                En retard de {Math.abs(differenceInDays(parseISO(task.due_date!), new Date()))} jours
              </span>
            </div>
          )}
          
          {/* Actions hint */}
          <p className="text-[10px] text-muted-foreground pt-2 border-t flex items-center gap-1">
            <span>Clic pour détails</span>
            <span className="mx-1">•</span>
            <span>Glisser pour déplacer</span>
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Leave bar component - distinct stripe pattern
interface GanttLeaveBarProps {
  userName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  slotStartDate: Date;
  dayWidth: number;
  onClick?: () => void;
  isCompact?: boolean;
}

const LEAVE_COLORS = {
  paid: 'bg-cyan-400',
  unpaid: 'bg-slate-400',
  sick: 'bg-red-400',
  rtt: 'bg-purple-400',
  other: 'bg-gray-400',
};

const LEAVE_LABELS = {
  paid: 'Congés payés',
  unpaid: 'Sans solde',
  sick: 'Maladie',
  rtt: 'RTT',
  other: 'Autre',
};

export function GanttLeaveBar({
  userName,
  leaveType,
  startDate,
  endDate,
  slotStartDate,
  dayWidth,
  onClick,
  isCompact = false,
}: GanttLeaveBarProps) {
  const barMetrics = useMemo(() => {
    const daysFromStart = Math.floor((startDate.getTime() - slotStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      left: Math.max(0, daysFromStart * dayWidth),
      width: duration * dayWidth,
    };
  }, [startDate, endDate, slotStartDate, dayWidth]);

  const leaveColor = LEAVE_COLORS[leaveType as keyof typeof LEAVE_COLORS] || LEAVE_COLORS.other;
  const leaveLabel = LEAVE_LABELS[leaveType as keyof typeof LEAVE_LABELS] || 'Congé';
  const barHeight = isCompact ? 24 : 32;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute cursor-pointer transition-all duration-200 group",
            "hover:z-20"
          )}
          style={{
            left: barMetrics.left,
            width: barMetrics.width,
            height: barHeight,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
          onClick={onClick}
        >
          {/* Striped pattern bar */}
          <div
            className={cn(
              "relative w-full h-full rounded-lg overflow-hidden",
              "border-2 border-dashed",
              leaveType === 'paid' && "border-cyan-400",
              leaveType === 'sick' && "border-red-400",
              leaveType === 'rtt' && "border-purple-400",
              !['paid', 'sick', 'rtt'].includes(leaveType) && "border-gray-400",
              "group-hover:scale-[1.02] transition-transform"
            )}
            style={{
              background: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 4px,
                ${leaveType === 'paid' ? 'rgb(34, 211, 238, 0.3)' : 
                  leaveType === 'sick' ? 'rgb(248, 113, 113, 0.3)' : 
                  leaveType === 'rtt' ? 'rgb(192, 132, 252, 0.3)' : 
                  'rgb(156, 163, 175, 0.3)'} 4px,
                ${leaveType === 'paid' ? 'rgb(34, 211, 238, 0.3)' : 
                  leaveType === 'sick' ? 'rgb(248, 113, 113, 0.3)' : 
                  leaveType === 'rtt' ? 'rgb(192, 132, 252, 0.3)' : 
                  'rgb(156, 163, 175, 0.3)'} 8px
              )`
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              {barMetrics.width >= 80 && (
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-800/90",
                  leaveType === 'paid' && "text-cyan-700",
                  leaveType === 'sick' && "text-red-700",
                  leaveType === 'rtt' && "text-purple-700",
                  !['paid', 'sick', 'rtt'].includes(leaveType) && "text-gray-700"
                )}>
                  {leaveLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </TooltipTrigger>
      
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold text-sm">{leaveLabel}</p>
          <p className="text-xs text-muted-foreground">
            {format(startDate, 'd MMM', { locale: fr })} → {format(endDate, 'd MMM yyyy', { locale: fr })}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
