import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Task } from '@/types/task';
import { WorkloadSlot } from '@/types/workload';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Flag,
  ExternalLink,
  Edit,
  Copy,
  Trash2,
  MessageSquare,
} from 'lucide-react';

interface GanttHoverCardProps {
  task: Task;
  slots: WorkloadSlot[];
  children: React.ReactNode;
  progress?: number;
  hasConflict?: boolean;
  conflictMessage?: string;
  onViewDetails?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  todo: { label: 'À faire', color: 'bg-slate-500' },
  'in-progress': { label: 'En cours', color: 'bg-blue-500' },
  done: { label: 'Terminée', color: 'bg-emerald-500' },
  validated: { label: 'Validée', color: 'bg-purple-500' },
  'to_assign': { label: 'À affecter', color: 'bg-amber-500' },
  'pending-validation': { label: 'En validation', color: 'bg-violet-500' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: typeof Flag }> = {
  urgent: { label: 'Urgent', color: 'text-red-500', icon: AlertTriangle },
  high: { label: 'Haute', color: 'text-orange-500', icon: Flag },
  medium: { label: 'Moyenne', color: 'text-blue-500', icon: Flag },
  low: { label: 'Basse', color: 'text-emerald-500', icon: Flag },
};

export function GanttHoverCard({
  task,
  slots,
  children,
  progress = 0,
  hasConflict = false,
  conflictMessage,
  onViewDetails,
  onEdit,
  onDuplicate,
  onDelete,
  side = 'top',
  align = 'center',
}: GanttHoverCardProps) {
  const statusInfo = STATUS_LABELS[task.status] || STATUS_LABELS.todo;
  const priorityInfo = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];

  const isOverdue = useMemo(() => {
    return task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== 'done' && task.status !== 'validated';
  }, [task.due_date, task.status]);

  const durationDays = useMemo(() => {
    return slots.length / 2; // Half-days to days
  }, [slots]);

  const dateRange = useMemo(() => {
    if (slots.length === 0) return null;
    const sortedSlots = [...slots].sort((a, b) => a.date.localeCompare(b.date));
    const startDate = parseISO(sortedSlots[0].date);
    const endDate = parseISO(sortedSlots[sortedSlots.length - 1].date);
    return { startDate, endDate };
  }, [slots]);

  const daysUntilDue = useMemo(() => {
    if (!task.due_date) return null;
    return differenceInDays(parseISO(task.due_date), new Date());
  }, [task.due_date]);

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

  const PriorityIcon = priorityInfo?.icon || Flag;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-80 p-0 overflow-hidden shadow-xl border-0 rounded-xl"
      >
        {/* Header with gradient */}
        <div className={cn(
          "p-4 text-white",
          statusInfo.color
        )}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">
              {task.title}
            </h4>
            {priorityInfo && (
              <Badge 
                variant="secondary" 
                className="shrink-0 text-[10px] bg-white/20 text-white border-0 gap-1"
              >
                <PriorityIcon className="h-3 w-3" />
                {priorityInfo.label}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-xs opacity-90 line-clamp-2">{task.description}</p>
          )}
        </div>

        {/* Content */}
        <div className="p-4 bg-popover space-y-4">
          {/* Conflict warning */}
          {hasConflict && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {conflictMessage || 'Conflit avec un congé'}
              </span>
            </div>
          )}

          {/* Overdue warning */}
          {isOverdue && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                Échéance dépassée de {Math.abs(daysUntilDue || 0)} jour(s)
              </span>
            </div>
          )}

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Avancement</span>
              <span className="font-bold tabular-nums">{displayProgress}%</span>
            </div>
            <Progress value={displayProgress} className="h-2" />
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Duration */}
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground block">Durée</span>
                <span className="font-semibold">
                  {durationDays} jour{durationDays > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground block">Statut</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {statusInfo.label}
                </Badge>
              </div>
            </div>

            {/* Date Range */}
            {dateRange && (
              <div className="flex items-start gap-2 col-span-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground block">Période planifiée</span>
                  <span className="font-semibold">
                    {format(dateRange.startDate, 'd MMM', { locale: fr })}
                    {dateRange.startDate.getTime() !== dateRange.endDate.getTime() && (
                      <> → {format(dateRange.endDate, 'd MMM', { locale: fr })}</>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Due Date */}
            {task.due_date && (
              <div className="flex items-start gap-2 col-span-2">
                <Flag className={cn(
                  "h-4 w-4 shrink-0 mt-0.5",
                  isOverdue ? "text-red-500" : "text-muted-foreground"
                )} />
                <div>
                  <span className="text-muted-foreground block">Échéance</span>
                  <span className={cn(
                    "font-semibold",
                    isOverdue && "text-red-600"
                  )}>
                    {format(parseISO(task.due_date), 'd MMMM yyyy', { locale: fr })}
                    {daysUntilDue !== null && daysUntilDue > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        (dans {daysUntilDue}j)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Comments indicator */}
            {task.description && (
              <div className="flex items-center gap-2 col-span-2 pt-1">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Notes disponibles</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 pt-2 border-t border-border/50">
            {onViewDetails && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex-1 text-xs gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails();
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Voir
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex-1 text-xs gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Edit className="h-3.5 w-3.5" />
                Modifier
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
