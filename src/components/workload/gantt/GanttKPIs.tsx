import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TeamMemberWorkload } from '@/types/workload';
import { Task } from '@/types/task';
import { ListTodo, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

interface GanttKPIsProps {
  workloadData: TeamMemberWorkload[];
  tasks: Task[];
  plannedTaskIds: string[];
}

export function GanttKPIs({ workloadData, tasks, plannedTaskIds }: GanttKPIsProps) {
  const metrics = useMemo(() => {
    // Count planned tasks
    const plannedCount = plannedTaskIds.length;
    const pendingCount = tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'validated' && 
      !plannedTaskIds.includes(t.id)
    ).length;
    
    // Calculate total capacity and usage
    let totalAvailable = 0;
    let totalUsed = 0;
    let overloadedMembers = 0;
    
    workloadData.forEach(member => {
      const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
      totalAvailable += available;
      totalUsed += member.usedSlots;
      
      if (member.usedSlots > available) {
        overloadedMembers++;
      }
    });
    
    const capacityPercent = totalAvailable > 0 
      ? Math.round((totalUsed / totalAvailable) * 100) 
      : 0;
    
    return {
      plannedCount,
      pendingCount,
      capacityPercent,
      overloadedMembers,
      totalDays: totalUsed / 2, // Convert half-days to days
    };
  }, [workloadData, tasks, plannedTaskIds]);
  
  const kpis = [
    {
      label: 'Tâches planifiées',
      value: metrics.plannedCount,
      icon: ListTodo,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      label: 'Charge totale',
      value: `${metrics.totalDays}j`,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    {
      label: 'Capacité',
      value: `${metrics.capacityPercent}%`,
      icon: TrendingUp,
      color: metrics.capacityPercent > 90 ? 'text-amber-600' : 'text-emerald-600',
      bgColor: metrics.capacityPercent > 90 
        ? 'bg-amber-50 dark:bg-amber-900/20' 
        : 'bg-emerald-50 dark:bg-emerald-900/20',
      borderColor: metrics.capacityPercent > 90 
        ? 'border-amber-200 dark:border-amber-800'
        : 'border-emerald-200 dark:border-emerald-800',
    },
    ...(metrics.overloadedMembers > 0 ? [{
      label: 'Surcharges',
      value: metrics.overloadedMembers,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
    }] : []),
  ];
  
  return (
    <div className="flex items-center gap-2">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
              kpi.bgColor,
              kpi.borderColor
            )}
          >
            <Icon className={cn("h-4 w-4", kpi.color)} />
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-sm font-bold tabular-nums", kpi.color)}>
                {kpi.value}
              </span>
              <span className="text-[10px] text-muted-foreground hidden xl:inline">
                {kpi.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}