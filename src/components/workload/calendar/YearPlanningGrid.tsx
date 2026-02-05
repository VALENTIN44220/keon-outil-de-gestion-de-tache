 import { useMemo, useCallback } from 'react';
 import { 
   format, startOfMonth, endOfMonth, eachDayOfInterval, 
   eachMonthOfInterval, isWeekend, getDay, isSameMonth, parseISO
 } from 'date-fns';
 import { fr } from 'date-fns/locale';
 import { TeamMemberWorkload, WorkloadSlot, UserLeave, Holiday } from '@/types/workload';
 import { Task } from '@/types/task';
 import { cn } from '@/lib/utils';
 import { Badge } from '@/components/ui/badge';
 import { Card, CardContent, CardHeader } from '@/components/ui/card';
 import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Progress } from '@/components/ui/progress';
 import { 
   CalendarDays,
   Palmtree,
   ListTodo,
   Users,
   ArrowRight,
 } from 'lucide-react';
 
 interface YearPlanningGridProps {
   workloadData: TeamMemberWorkload[];
   currentYear: Date;
   tasks: Task[];
   holidays: Holiday[];
   leaves: UserLeave[];
   onMonthClick: (month: Date) => void;
   isCompact?: boolean;
 }
 
 interface MonthStats {
   month: Date;
   label: string;
   shortLabel: string;
   taskCount: number;
   leaveDays: number;
   holidayDays: number;
   loadPercent: number;
   isCurrent: boolean;
 }
 
 const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
 
 export function YearPlanningGrid({
   workloadData = [],
   currentYear,
   tasks = [],
   holidays = [],
   leaves = [],
   onMonthClick,
   isCompact = false,
 }: YearPlanningGridProps) {
   // Safely get year start/end with fallback
   const safeYear = useMemo(() => {
     if (!currentYear || !(currentYear instanceof Date) || isNaN(currentYear.getTime())) {
       return new Date();
     }
     return currentYear;
   }, [currentYear]);
   
   // Generate 12 months of the year
   const months = useMemo(() => {
     try {
       const yearStart = new Date(safeYear.getFullYear(), 0, 1);
       const yearEnd = new Date(safeYear.getFullYear(), 11, 31);
       return eachMonthOfInterval({ start: yearStart, end: yearEnd });
     } catch {
       // Fallback to current year
       const now = new Date();
       return eachMonthOfInterval({ 
         start: new Date(now.getFullYear(), 0, 1), 
         end: new Date(now.getFullYear(), 11, 31) 
       });
     }
   }, [safeYear]);
   
   // Collect all slots by date
   const slotsByDate = useMemo(() => {
     const map = new Map<string, WorkloadSlot[]>();
     workloadData.forEach(member => {
       (member.days || []).forEach(day => {
         if (!map.has(day.date)) {
           map.set(day.date, []);
         }
         if (day.morning.slot) map.get(day.date)!.push(day.morning.slot);
         if (day.afternoon.slot) map.get(day.date)!.push(day.afternoon.slot);
       });
     });
     return map;
   }, [workloadData]);
   
   // Holidays by date
   const holidaysByDate = useMemo(() => {
     const set = new Set<string>();
     holidays.forEach(h => set.add(h.date));
     return set;
   }, [holidays]);
   
   // Leaves by date (count unique users on leave per day)
   const leavesByDate = useMemo(() => {
     const map = new Map<string, Set<string>>();
     leaves.forEach(leave => {
       if (leave.status === 'cancelled') return;
       try {
         const start = parseISO(leave.start_date);
         const end = parseISO(leave.end_date);
         const current = new Date(start);
         while (current <= end) {
           const dateStr = format(current, 'yyyy-MM-dd');
           if (!map.has(dateStr)) {
             map.set(dateStr, new Set());
           }
           map.get(dateStr)!.add(leave.user_id);
           current.setDate(current.getDate() + 1);
         }
       } catch { /* skip */ }
     });
     return map;
   }, [leaves]);
   
   // Calculate stats for each month
   const monthStats = useMemo<MonthStats[]>(() => {
     const today = new Date();
     
     return months.map(monthStart => {
       try {
         const monthEnd = endOfMonth(monthStart);
         const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
         
         let taskCount = 0;
         let leaveDays = 0;
         let holidayDays = 0;
         let workDays = 0;
         const taskIds = new Set<string>();
         
         days.forEach(day => {
           const dateStr = format(day, 'yyyy-MM-dd');
           const dayOfWeek = getDay(day);
           const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
           
           if (!isWeekendDay) {
             workDays++;
             
             // Count holidays
             if (holidaysByDate.has(dateStr)) {
               holidayDays++;
             }
             
             // Count leave days (any user on leave)
             const usersOnLeave = leavesByDate.get(dateStr);
             if (usersOnLeave && usersOnLeave.size > 0) {
               leaveDays++;
             }
             
             // Count unique tasks
             const daySlots = slotsByDate.get(dateStr) || [];
             daySlots.forEach(slot => {
               if (slot.task_id) {
                 taskIds.add(slot.task_id);
               }
             });
           }
         });
         
         taskCount = taskIds.size;
         
         // Capacity = work days * users * 2 (half-days)
         const capacity = workDays * Math.max(workloadData.length, 1) * 2;
         let loadSlots = 0;
         days.forEach(day => {
           const dateStr = format(day, 'yyyy-MM-dd');
           const daySlots = slotsByDate.get(dateStr) || [];
           loadSlots += daySlots.length;
         });
         
         const loadPercent = capacity > 0 ? Math.round((loadSlots / capacity) * 100) : 0;
         
         return {
           month: monthStart,
           label: format(monthStart, 'MMMM', { locale: fr }),
           shortLabel: format(monthStart, 'MMM', { locale: fr }),
           taskCount,
           leaveDays,
           holidayDays,
           loadPercent,
           isCurrent: isSameMonth(monthStart, today),
         };
       } catch {
         return {
           month: monthStart,
           label: format(monthStart, 'MMMM', { locale: fr }),
           shortLabel: format(monthStart, 'MMM', { locale: fr }),
           taskCount: 0,
           leaveDays: 0,
           holidayDays: 0,
           loadPercent: 0,
           isCurrent: false,
         };
       }
     });
   }, [months, slotsByDate, holidaysByDate, leavesByDate, workloadData.length]);
   
   // Generate mini calendar grid for a month
   const getMiniCalendarDays = useCallback((monthStart: Date) => {
     try {
       const monthEnd = endOfMonth(monthStart);
       const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
       
       // Get the day of week for the first day (0 = Sunday)
       const firstDayOfWeek = getDay(monthStart);
       // Convert to Monday-first (0 = Monday)
       const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
       
       // Create padded array
       const paddedDays: (Date | null)[] = [];
       for (let i = 0; i < startOffset; i++) {
         paddedDays.push(null);
       }
       paddedDays.push(...days);
       
       // Pad to complete weeks
       while (paddedDays.length % 7 !== 0) {
         paddedDays.push(null);
       }
       
       return paddedDays;
     } catch {
       return [];
     }
   }, []);
   
   // Check if a day has activity
   const getDayIndicator = useCallback((day: Date | null) => {
     if (!day) return null;
     
     const dateStr = format(day, 'yyyy-MM-dd');
     const hasHoliday = holidaysByDate.has(dateStr);
     const hasLeave = leavesByDate.has(dateStr);
     const hasTask = (slotsByDate.get(dateStr) || []).length > 0;
     
     if (hasHoliday) return 'holiday';
     if (hasLeave) return 'leave';
     if (hasTask) return 'task';
     return null;
   }, [holidaysByDate, leavesByDate, slotsByDate]);
 
   return (
     <ScrollArea className="flex-1 p-4">
       {/* Summary bar */}
       <div className="mb-4 flex items-center justify-between px-2">
         <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 text-sm text-muted-foreground">
             <Users className="h-4 w-4" />
             <span>{workloadData.length} collaborateur{workloadData.length > 1 ? 's' : ''}</span>
           </div>
           <div className="flex items-center gap-2 text-sm text-muted-foreground">
             <ListTodo className="h-4 w-4" />
             <span>{tasks.length} tâche{tasks.length > 1 ? 's' : ''} planifiée{tasks.length > 1 ? 's' : ''}</span>
           </div>
         </div>
         
         <div className="flex items-center gap-3 text-xs">
           <div className="flex items-center gap-1">
             <div className="w-2 h-2 rounded-full bg-primary" />
             <span className="text-muted-foreground">Tâche</span>
           </div>
           <div className="flex items-center gap-1">
             <div className="w-2 h-2 rounded-full bg-violet-500" />
             <span className="text-muted-foreground">Congé</span>
           </div>
           <div className="flex items-center gap-1">
             <div className="w-2 h-2 rounded-full bg-amber-500" />
             <span className="text-muted-foreground">Férié</span>
           </div>
         </div>
       </div>
       
       {/* 12 mini-month grid (3x4) */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
         {monthStats.map((stat) => {
           const miniDays = getMiniCalendarDays(stat.month);
           
           return (
             <Card 
               key={stat.label}
               className={cn(
                 "group cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                 stat.isCurrent && "ring-2 ring-primary ring-offset-2"
               )}
               onClick={() => onMonthClick(stat.month)}
             >
               <CardHeader className="p-3 pb-2">
                 <div className="flex items-center justify-between">
                   <h4 className={cn(
                     "font-semibold capitalize",
                     stat.isCurrent && "text-primary"
                   )}>
                     {stat.label}
                   </h4>
                   <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
                 
                 {/* Stats badges */}
                 <div className="flex items-center gap-1 flex-wrap mt-1">
                   {stat.taskCount > 0 && (
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                           <ListTodo className="h-3 w-3 mr-0.5" />
                           {stat.taskCount}
                         </Badge>
                       </TooltipTrigger>
                       <TooltipContent>{stat.taskCount} tâche{stat.taskCount > 1 ? 's' : ''}</TooltipContent>
                     </Tooltip>
                   )}
                   {stat.leaveDays > 0 && (
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-violet-600 border-violet-300">
                           <Palmtree className="h-3 w-3 mr-0.5" />
                           {stat.leaveDays}j
                         </Badge>
                       </TooltipTrigger>
                       <TooltipContent>{stat.leaveDays} jour{stat.leaveDays > 1 ? 's' : ''} de congé</TooltipContent>
                     </Tooltip>
                   )}
                   {stat.holidayDays > 0 && (
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
                           🎉 {stat.holidayDays}j
                         </Badge>
                       </TooltipTrigger>
                       <TooltipContent>{stat.holidayDays} jour{stat.holidayDays > 1 ? 's' : ''} férié{stat.holidayDays > 1 ? 's' : ''}</TooltipContent>
                     </Tooltip>
                   )}
                 </div>
               </CardHeader>
               
               <CardContent className="p-3 pt-0">
                 {/* Day headers */}
                 <div className="grid grid-cols-7 gap-0.5 mb-1">
                   {DAY_LETTERS.map((letter, idx) => (
                     <div 
                       key={idx} 
                       className={cn(
                         "text-center text-[9px] font-medium",
                         idx >= 5 ? "text-muted-foreground/50" : "text-muted-foreground"
                       )}
                     >
                       {letter}
                     </div>
                   ))}
                 </div>
                 
                 {/* Mini calendar grid */}
                 <div className="grid grid-cols-7 gap-0.5">
                   {miniDays.map((day, idx) => {
                     if (!day) {
                       return <div key={`empty-${idx}`} className="w-full aspect-square" />;
                     }
                     
                     const dayNum = day.getDate();
                     const isWeekendDay = isWeekend(day);
                     const indicator = getDayIndicator(day);
                     const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                     
                     return (
                       <div 
                         key={format(day, 'yyyy-MM-dd')} 
                         className={cn(
                           "w-full aspect-square flex items-center justify-center text-[10px] rounded-sm relative",
                           isWeekendDay && "text-muted-foreground/40",
                           isToday && "bg-primary text-primary-foreground font-bold",
                           !isToday && indicator === 'task' && "bg-primary/20",
                           !isToday && indicator === 'leave' && "bg-violet-100 dark:bg-violet-900/30",
                           !isToday && indicator === 'holiday' && "bg-amber-100 dark:bg-amber-900/30",
                         )}
                       >
                         {dayNum}
                         {/* Indicator dot */}
                         {indicator && !isToday && (
                           <div className={cn(
                             "absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                             indicator === 'task' && "bg-primary",
                             indicator === 'leave' && "bg-violet-500",
                             indicator === 'holiday' && "bg-amber-500",
                           )} />
                         )}
                       </div>
                     );
                   })}
                 </div>
                 
                 {/* Load progress bar */}
                 <div className="mt-3">
                   <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                     <span>Charge</span>
                     <span className={cn(
                       stat.loadPercent > 100 && "text-destructive font-semibold"
                     )}>
                       {stat.loadPercent}%
                     </span>
                   </div>
                   <Progress 
                     value={Math.min(stat.loadPercent, 100)} 
                     className={cn(
                       "h-1.5",
                       stat.loadPercent > 100 && "[&>div]:bg-destructive",
                       stat.loadPercent > 80 && stat.loadPercent <= 100 && "[&>div]:bg-amber-500"
                     )}
                   />
                 </div>
               </CardContent>
             </Card>
           );
         })}
       </div>
     </ScrollArea>
   );
 }