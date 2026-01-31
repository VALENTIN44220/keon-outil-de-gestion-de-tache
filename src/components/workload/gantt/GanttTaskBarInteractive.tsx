import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Task } from '@/types/task';
import { WorkloadSlot, UserLeave } from '@/types/workload';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Flag, 
  GripVertical, 
  AlertCircle,
  Eye,
  Calendar,
  UserPlus,
  Copy,
  MoreHorizontal,
  ClipboardList,
  PlayCircle,
  Hourglass,
  Link2
} from 'lucide-react';

interface GanttTaskBarInteractiveProps {
  task: Task;
  slots: WorkloadSlot[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  progress?: number;
  onClick?: () => void;
  onDragStart?: (e: React.MouseEvent, mode: 'move' | 'resize-start' | 'resize-end') => void;
  isCompact?: boolean;
  isDragging?: boolean;
  dragOffset?: { x: number; y: number };
  hasConflict?: boolean;
  conflictMessage?: string;
}

// Premium color palette for task statuses
const STATUS_CONFIG = {
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

const PRIORITY_CONFIG = {
  urgent: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500', ring: 'ring-red-300' },
  high: { icon: Flag, color: 'text-orange-500', bg: 'bg-orange-500', ring: 'ring-orange-300' },
  medium: { icon: Flag, color: 'text-blue-500', bg: 'bg-blue-500', ring: 'ring-blue-300' },
  low: { icon: Flag, color: 'text-emerald-500', bg: 'bg-emerald-500', ring: 'ring-emerald-300' },
};

export function GanttTaskBarInteractive({
  task,
  slots,
  startDate,
  endDate,
  dayWidth,
  progress = 0,
  onClick,
  onDragStart,
  isCompact = false,
  isDragging = false,
  dragOffset,
  hasConflict = false,
  conflictMessage,
}: GanttTaskBarInteractiveProps) {
  const [isHovered, setIsHovered] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.todo;
  const priorityConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  
  // Calculate bar position and width based on slots
  const barMetrics = useMemo(() => {
    if (slots.length === 0) return null;
    
    // Sort slots by date
    const sortedSlots = [...slots].sort((a, b) => a.date.localeCompare(b.date) || (a.half_day === 'morning' ? -1 : 1));
    
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    const firstDate = parseISO(firstSlot.date);
    
    // Calculate position from start date
    const daysFromStart = Math.floor((firstDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const halfDayOffset = firstSlot.half_day === 'afternoon' ? 0.5 : 0;
    const left = (daysFromStart + halfDayOffset) * dayWidth;
    
    // Calculate width based on slot count
    const totalHalfDays = slots.length;
    const width = Math.max((totalHalfDays / 2) * dayWidth, 50); // Minimum width increased
    
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
  
  const barHeight = isCompact ? 32 : 44;
  const showTitle = barMetrics.width >= 70;
  const showProgress = barMetrics.width >= 100 && !isCompact;
  const showBadges = barMetrics.width >= 120 && !isCompact;
  const showQuickActions = isHovered && !isDragging && barMetrics.width >= 100;
  const showResizeHandles = isHovered && !isDragging && barMetrics.width >= 60;
  
  // Apply drag offset
  const transform = dragOffset 
    ? `translateY(-50%) translate(${dragOffset.x}px, ${dragOffset.y}px)`
    : 'translateY(-50%)';
  
  const StatusIcon = statusConfig.icon;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={barRef}
          className={cn(
            "absolute cursor-grab transition-all duration-150 group select-none",
            isDragging && "cursor-grabbing z-50 opacity-95 shadow-2xl scale-[1.03]",
            !isDragging && "hover:z-30",
            isHovered && !isDragging && "scale-[1.02]"
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
            // Check if clicking on resize handle or quick action
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
        >
          {/* Main bar - Premium pill design */}
          <div
            className={cn(
              "workload-task-bar relative w-full h-full rounded-xl overflow-hidden",
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
            {/* Track background with subtle pattern */}
            <div className={cn(
              "absolute inset-0 rounded-xl",
              statusConfig.track,
              "opacity-40"
            )} />
            
            {/* Progress fill with gradient */}
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
              
              {/* Dependencies badge - show if task has category (as proxy for linked tasks) */}
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
                  >
                    <Eye className="h-3 w-3 text-slate-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 bg-white/80 hover:bg-white shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Edit dates action - could be handled by parent
                    }}
                  >
                    <Calendar className="h-3 w-3 text-slate-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 bg-white/80 hover:bg-white shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // More actions
                    }}
                  >
                    <MoreHorizontal className="h-3 w-3 text-slate-600" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Resize handles - Premium style */}
            {showResizeHandles && (
              <>
                {/* Left resize handle */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center bg-gradient-to-r from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onDragStart?.(e, 'resize-start');
                  }}
                >
                  <div className="w-1 h-6 rounded-full bg-slate-400/70" />
                </div>
                
                {/* Right resize handle */}
                <div 
                  className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center bg-gradient-to-l from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onDragStart?.(e, 'resize-end');
                  }}
                >
                  <div className="w-1 h-6 rounded-full bg-slate-400/70" />
                </div>
              </>
            )}
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
          `bg-gradient-to-r ${statusConfig.gradient}`
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
          {/* Conflict warning */}
          {hasConflict && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {conflictMessage || 'Conflit avec un congé'}
              </span>
            </div>
          )}
          
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Avancement</span>
              <span className="font-bold">{displayProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", `bg-gradient-to-r ${statusConfig.gradient}`)}
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
          <p className="text-[10px] text-muted-foreground pt-2 border-t flex items-center gap-1 flex-wrap">
            <span>Glisser pour déplacer</span>
            <span className="mx-1">•</span>
            <span>Bords pour redimensionner</span>
            <span className="mx-1">•</span>
            <span>Clic pour détails</span>
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Quick add selection overlay
interface QuickAddSelectionProps {
  startDate: string;
  endDate: string;
  dayWidth: number;
  gridStartDate: Date;
  height: number;
}

export function QuickAddSelection({
  startDate: selStartDate,
  endDate: selEndDate,
  dayWidth,
  gridStartDate,
  height,
}: QuickAddSelectionProps) {
  const start = parseISO(selStartDate);
  const end = parseISO(selEndDate);
  
  const daysFromStart = Math.floor((start.getTime() - gridStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  const left = daysFromStart * dayWidth;
  const width = duration * dayWidth;
  
  return (
    <div
      className="absolute bg-primary/20 border-2 border-dashed border-primary rounded-lg pointer-events-none animate-pulse"
      style={{
        left,
        width,
        height: height - 16,
        top: 8,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold text-primary bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded">
          + Nouvelle tâche ({duration}j)
        </span>
      </div>
    </div>
  );
}
