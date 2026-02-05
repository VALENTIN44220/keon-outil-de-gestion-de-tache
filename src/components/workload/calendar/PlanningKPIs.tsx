 import { useMemo } from 'react';
 import { cn } from '@/lib/utils';
 import { TeamMemberWorkload } from '@/types/workload';
 import { Task } from '@/types/task';
 import { ListTodo, Clock, AlertTriangle, TrendingUp, CalendarX } from 'lucide-react';
 
 interface PlanningKPIsProps {
   workloadData: TeamMemberWorkload[];
   tasks: Task[];
   plannedTaskIds: string[];
   conflictCount?: number;
 }
 
 export function PlanningKPIs({ workloadData, tasks, plannedTaskIds, conflictCount = 0 }: PlanningKPIsProps) {
   const metrics = useMemo(() => {
     const plannedCount = plannedTaskIds.length;
     const pendingCount = tasks.filter(t => 
       t.status !== 'done' && 
       t.status !== 'validated' && 
       !plannedTaskIds.includes(t.id)
     ).length;
     
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
       totalDays: totalUsed / 2,
     };
   }, [workloadData, tasks, plannedTaskIds]);
   
   const kpis = [
     {
       label: 'Tâches planifiées',
       value: metrics.plannedCount,
       icon: ListTodo,
       color: 'text-blue-600',
       bgColor: 'bg-blue-50 dark:bg-blue-900/20',
     },
     {
       label: 'Charge totale',
       value: `${metrics.totalDays}j`,
       icon: Clock,
       color: 'text-purple-600',
       bgColor: 'bg-purple-50 dark:bg-purple-900/20',
     },
     {
       label: 'Capacité',
       value: `${metrics.capacityPercent}%`,
       icon: TrendingUp,
       color: metrics.capacityPercent > 90 ? 'text-amber-600' : 'text-emerald-600',
       bgColor: metrics.capacityPercent > 90 
         ? 'bg-amber-50 dark:bg-amber-900/20' 
         : 'bg-emerald-50 dark:bg-emerald-900/20',
     },
     ...(conflictCount > 0 ? [{
       label: 'Conflits',
       value: conflictCount,
       icon: AlertTriangle,
       color: 'text-orange-600',
       bgColor: 'bg-orange-50 dark:bg-orange-900/20',
     }] : []),
     ...(metrics.pendingCount > 0 ? [{
       label: 'Non planifiées',
       value: metrics.pendingCount,
       icon: CalendarX,
       color: 'text-slate-600',
       bgColor: 'bg-slate-50 dark:bg-slate-900/20',
     }] : []),
   ];
   
   return (
     <div className="flex items-center gap-3 flex-wrap">
       {kpis.map((kpi, idx) => {
         const Icon = kpi.icon;
         return (
           <div
             key={idx}
             className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-card shadow-sm"
           >
             <div className={cn(
               "w-8 h-8 rounded-lg flex items-center justify-center",
               kpi.bgColor
             )}>
               <Icon className={cn("h-4 w-4", kpi.color)} />
             </div>
             <div className="flex flex-col">
               <span className="font-semibold text-sm">
                 {kpi.value}
               </span>
               <span className="text-[10px] text-muted-foreground">
                 {kpi.label}
               </span>
             </div>
           </div>
         );
       })}
     </div>
   );
 }