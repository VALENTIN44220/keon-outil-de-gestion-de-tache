import { useMemo } from 'react';
import { TeamMemberWorkload, WorkloadSlot, Holiday, UserLeave } from '@/types/workload';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar,
  Clock,
  Zap,
  Activity,
  PieChart,
  Target,
} from 'lucide-react';
import { format, differenceInBusinessDays, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface InsightsPanelProps {
  workloadData: TeamMemberWorkload[];
  slots: WorkloadSlot[];
  tasks: Task[];
  holidays: Holiday[];
  leaves: UserLeave[];
  startDate: Date;
  endDate: Date;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function InsightsPanel({
  workloadData,
  slots,
  tasks,
  holidays,
  leaves,
  startDate,
  endDate,
  isCollapsed = false,
  onToggleCollapse,
}: InsightsPanelProps) {
  // Calculate metrics
  const metrics = useMemo(() => {
    const businessDays = differenceInBusinessDays(endDate, startDate) + 1;
    const totalCapacity = workloadData.length * businessDays * 2; // half-days
    const usedSlots = slots.length;
    const leaveSlots = workloadData.reduce((acc, m) => acc + m.leaveSlots, 0);
    const holidaySlots = workloadData.reduce((acc, m) => acc + m.holidaySlots, 0);
    const availableCapacity = totalCapacity - leaveSlots - holidaySlots;
    const utilizationPercent = availableCapacity > 0 ? Math.round((usedSlots / availableCapacity) * 100) : 0;
    
    // Overloaded members (>100% capacity)
    const overloadedMembers = workloadData.filter(m => {
      const memberDays = m.days.length;
      const memberUsed = m.usedSlots;
      const memberAvailable = (memberDays * 2) - m.leaveSlots - m.holidaySlots;
      return memberAvailable > 0 && (memberUsed / memberAvailable) > 1;
    });

    // Tasks by priority
    const tasksByPriority = {
      urgent: tasks.filter(t => t.priority === 'urgent').length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    };

    // Upcoming deadlines
    const upcomingDeadlines = tasks
      .filter(t => t.due_date && t.status !== 'done' && t.status !== 'validated')
      .filter(t => {
        const dueDate = parseISO(t.due_date!);
        return isWithinInterval(dueDate, { start: startDate, end: endDate });
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 5);

    return {
      totalCapacity,
      usedSlots,
      availableCapacity,
      utilizationPercent,
      overloadedMembers,
      tasksByPriority,
      upcomingDeadlines,
      leaveSlots,
      holidaySlots,
    };
  }, [workloadData, slots, tasks, startDate, endDate]);

  const getUtilizationColor = (percent: number) => {
    if (percent < 50) return 'text-emerald-600';
    if (percent < 80) return 'text-blue-600';
    if (percent < 100) return 'text-orange-600';
    return 'text-red-600';
  };

  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'bg-emerald-500';
    if (percent < 80) return 'bg-blue-500';
    if (percent < 100) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-card border-l flex flex-col items-center py-4 gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
                <Activity className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Insights & Analytics</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="w-72 bg-card border-l flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-muted/30 to-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Insights</h3>
              <p className="text-xs text-muted-foreground">Vue d'ensemble</p>
            </div>
          </div>
          {onToggleCollapse && (
            <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Capacity Gauge */}
          <div className="bg-gradient-to-br from-background to-muted/30 rounded-xl p-4 border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Capacité utilisée
              </span>
              <span className={cn("text-2xl font-bold", getUtilizationColor(metrics.utilizationPercent))}>
                {metrics.utilizationPercent}%
              </span>
            </div>
            
            {/* Circular gauge simulation */}
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("absolute left-0 top-0 h-full transition-all duration-500", getProgressColor(metrics.utilizationPercent))}
                style={{ width: `${Math.min(metrics.utilizationPercent, 100)}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Planifié: {metrics.usedSlots / 2}j</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-muted" />
                <span className="text-muted-foreground">Dispo: {(metrics.availableCapacity - metrics.usedSlots) / 2}j</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {metrics.overloadedMembers.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  Surcharge détectée
                </span>
              </div>
              <div className="space-y-2">
                {metrics.overloadedMembers.slice(0, 3).map((member) => (
                  <div key={member.memberId} className="flex items-center justify-between text-xs">
                    <span className="text-red-700 dark:text-red-400">{member.memberName}</span>
                    <Badge variant="destructive" className="h-5 text-[10px]">
                      +{Math.round(((member.usedSlots / (member.totalSlots - member.leaveSlots - member.holidaySlots)) - 1) * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-background rounded-lg p-3 border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Users className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase font-medium">Équipe</span>
              </div>
              <p className="text-xl font-bold">{workloadData.length}</p>
            </div>
            <div className="bg-background rounded-lg p-3 border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase font-medium">Tâches</span>
              </div>
              <p className="text-xl font-bold">{new Set(slots.map(s => s.task_id)).size}</p>
            </div>
            <div className="bg-background rounded-lg p-3 border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase font-medium">Congés</span>
              </div>
              <p className="text-xl font-bold">{metrics.leaveSlots / 2}j</p>
            </div>
            <div className="bg-background rounded-lg p-3 border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase font-medium">Fériés</span>
              </div>
              <p className="text-xl font-bold">{metrics.holidaySlots / 2}j</p>
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="bg-background rounded-xl p-4 border">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Par priorité</span>
            </div>
            <div className="space-y-2">
              {[
                { key: 'urgent', label: 'Urgent', color: 'bg-red-500', count: metrics.tasksByPriority.urgent },
                { key: 'high', label: 'Haute', color: 'bg-orange-500', count: metrics.tasksByPriority.high },
                { key: 'medium', label: 'Moyenne', color: 'bg-blue-500', count: metrics.tasksByPriority.medium },
                { key: 'low', label: 'Basse', color: 'bg-emerald-500', count: metrics.tasksByPriority.low },
              ].map(item => {
                const total = Object.values(metrics.tasksByPriority).reduce((a, b) => a + b, 0);
                const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.key} className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", item.color)} />
                    <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                    <span className="text-xs font-medium">{item.count}</span>
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full", item.color)}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          {metrics.upcomingDeadlines.length > 0 && (
            <div className="bg-background rounded-xl p-4 border">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Échéances à venir</span>
              </div>
              <div className="space-y-2">
                {metrics.upcomingDeadlines.map(task => (
                  <div key={task.id} className="flex items-center justify-between text-xs">
                    <span className="truncate flex-1 pr-2">{task.title}</span>
                    <Badge variant="outline" className="h-5 text-[10px] shrink-0">
                      {format(parseISO(task.due_date!), 'd MMM', { locale: fr })}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Color Legend */}
          <div className="bg-muted/50 rounded-xl p-4">
            <span className="text-xs font-medium text-muted-foreground uppercase mb-3 block">
              Légende
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-gradient-to-r from-cyan-400 to-cyan-500" />
                <span className="text-muted-foreground">Tâche planifiée</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-gradient-to-r from-slate-300 to-slate-400" />
                <span className="text-muted-foreground">Congé</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-amber-100 border border-amber-200" />
                <span className="text-muted-foreground">Jour férié</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-muted" />
                <span className="text-muted-foreground">Week-end</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
