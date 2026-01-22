import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Task } from '@/types/task';
import { WorkloadSlot } from '@/types/workload';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

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

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'todo':
      return { bg: 'bg-slate-500', trackBg: 'bg-slate-200', label: 'À faire', progressBg: 'bg-slate-600' };
    case 'in-progress':
      return { bg: 'bg-blue-500', trackBg: 'bg-blue-200', label: 'En cours', progressBg: 'bg-blue-600' };
    case 'done':
      return { bg: 'bg-emerald-500', trackBg: 'bg-emerald-200', label: 'Terminé', progressBg: 'bg-emerald-600' };
    case 'validated':
      return { bg: 'bg-purple-500', trackBg: 'bg-purple-200', label: 'Validé', progressBg: 'bg-purple-600' };
    case 'to_assign':
      return { bg: 'bg-amber-500', trackBg: 'bg-amber-200', label: 'À affecter', progressBg: 'bg-amber-600' };
    default:
      return { bg: 'bg-slate-500', trackBg: 'bg-slate-200', label: status, progressBg: 'bg-slate-600' };
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return { gradient: 'from-red-500 to-rose-400', track: 'bg-red-100', fill: 'bg-red-600' };
    case 'high': return { gradient: 'from-orange-500 to-amber-400', track: 'bg-orange-100', fill: 'bg-orange-600' };
    case 'medium': return { gradient: 'from-blue-500 to-indigo-400', track: 'bg-blue-100', fill: 'bg-blue-600' };
    case 'low': return { gradient: 'from-emerald-500 to-teal-400', track: 'bg-emerald-100', fill: 'bg-emerald-600' };
    default: return { gradient: 'from-slate-500 to-slate-400', track: 'bg-slate-100', fill: 'bg-slate-600' };
  }
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
  const statusConfig = getStatusConfig(task.status);
  const priorityConfig = getPriorityColor(task.priority);
  
  // Calculate bar position and width based on slots
  const barMetrics = useMemo(() => {
    if (slots.length === 0) return null;
    
    // Sort slots by date
    const sortedSlots = [...slots].sort((a, b) => a.date.localeCompare(b.date) || (a.half_day === 'morning' ? -1 : 1));
    
    // Find the first and last slot dates
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    const firstDate = parseISO(firstSlot.date);
    const lastDate = parseISO(lastSlot.date);
    
    // Calculate position from start date
    const daysFromStart = Math.floor((firstDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const halfDayOffset = firstSlot.half_day === 'afternoon' ? 0.5 : 0;
    const left = (daysFromStart + halfDayOffset) * dayWidth;
    
    // Calculate width based on slot count
    const totalHalfDays = slots.length;
    const width = (totalHalfDays / 2) * dayWidth;
    
    return { left, width, totalDays: totalHalfDays / 2 };
  }, [slots, startDate, dayWidth]);
  
  if (!barMetrics) return null;
  
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== 'done' && task.status !== 'validated';
  const isDone = task.status === 'done' || task.status === 'validated';
  
  // Calculate progress from checklistProgress or status-based default
  const displayProgress = useMemo(() => {
    if (progress > 0) return progress;
    switch (task.status) {
      case 'done': return 100;
      case 'validated': return 100;
      case 'in-progress': return 50;
      case 'to_assign': return 0;
      case 'todo': return 0;
      default: return 0;
    }
  }, [progress, task.status]);
  
  const barHeight = isCompact ? 24 : 36;
  const showProgressText = barMetrics.width >= 60 && !isCompact;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute cursor-pointer transition-all duration-200 group",
            "hover:z-20 hover:scale-[1.02]"
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
          {/* Main bar container */}
          <div
            className={cn(
              "relative w-full h-full rounded-full overflow-hidden shadow-md",
              "border-2 transition-all duration-200",
              isOverdue && "border-red-500 ring-2 ring-red-200",
              !isOverdue && isDone && "border-emerald-400",
              !isOverdue && !isDone && "border-white/30",
              "group-hover:shadow-lg group-hover:ring-2 group-hover:ring-primary/30"
            )}
          >
            {/* Track (background) */}
            <div className={cn(
              "absolute inset-0 rounded-full",
              priorityConfig.track,
              "opacity-60"
            )} />
            
            {/* Progress fill */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                `bg-gradient-to-r ${priorityConfig.gradient}`,
                isDone && "opacity-100",
                !isDone && "opacity-90"
              )}
              style={{ width: `${displayProgress}%` }}
            />
            
            {/* Content overlay */}
            <div className="absolute inset-0 flex items-center px-2 gap-1.5">
              {/* Status indicator */}
              {isDone && (
                <div className="shrink-0 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
              )}
              
              {isOverdue && !isDone && (
                <div className="shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <AlertTriangle className="h-3 w-3 text-white" />
                </div>
              )}
              
              {/* Task title */}
              {!isCompact && (
                <span className={cn(
                  "text-xs font-semibold truncate flex-1",
                  displayProgress > 50 ? "text-white" : "text-slate-800",
                  isDone && "line-through opacity-70"
                )}>
                  {task.title}
                </span>
              )}
              
              {/* Progress percentage */}
              {showProgressText && (
                <span className={cn(
                  "text-xs font-bold shrink-0 px-1.5 py-0.5 rounded-full",
                  displayProgress > 50 
                    ? "text-white/90 bg-black/20" 
                    : "text-slate-700 bg-white/70"
                )}>
                  {displayProgress}%
                </span>
              )}
            </div>
          </div>
          
          {/* Resize handles (visible on hover) */}
          <div className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-4 rounded-full",
            "bg-white border-2 border-slate-300 shadow-sm cursor-ew-resize",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )} />
          <div className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-4 rounded-full",
            "bg-white border-2 border-slate-300 shadow-sm cursor-ew-resize",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )} />
        </div>
      </TooltipTrigger>
      
      <TooltipContent 
        side="top" 
        className="p-0 w-72 overflow-hidden rounded-xl shadow-xl border-0"
      >
        <div className={cn(
          "p-3 text-white",
          `bg-gradient-to-r ${priorityConfig.gradient}`
        )}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-sm leading-tight">{task.title}</h4>
            <Badge variant="secondary" className="shrink-0 text-[10px] bg-white/20 text-white border-0">
              {statusConfig.label}
            </Badge>
          </div>
          {task.description && (
            <p className="text-xs opacity-90 line-clamp-2">{task.description}</p>
          )}
        </div>
        
        <div className="p-3 bg-popover space-y-2">
          {/* Progress bar in tooltip */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avancement</span>
              <span className="font-semibold">{displayProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", `bg-gradient-to-r ${priorityConfig.gradient}`)}
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Durée</span>
              <p className="font-medium">{barMetrics.totalDays} jour{barMetrics.totalDays > 1 ? 's' : ''}</p>
            </div>
            {task.due_date && (
              <div>
                <span className="text-muted-foreground">Échéance</span>
                <p className={cn("font-medium", isOverdue && "text-red-600")}>
                  {format(parseISO(task.due_date), 'd MMM yyyy', { locale: fr })}
                </p>
              </div>
            )}
          </div>
          
          <p className="text-[10px] text-muted-foreground pt-1 border-t">
            Clic pour détails • Glisser pour déplacer
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}