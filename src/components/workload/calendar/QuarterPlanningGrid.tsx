 import { useMemo, useCallback } from 'react';
 import { 
   format, parseISO, startOfWeek, endOfWeek, eachWeekOfInterval,
   isSameMonth, isWithinInterval, getWeek, differenceInDays, addDays
 } from 'date-fns';
 import { fr } from 'date-fns/locale';
 import { TeamMemberWorkload, WorkloadSlot, UserLeave, Holiday } from '@/types/workload';
 import { Task } from '@/types/task';
 import { cn } from '@/lib/utils';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Badge } from '@/components/ui/badge';
 import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Progress } from '@/components/ui/progress';
 import { 
   AlertTriangle, 
   Palmtree,
   Flag,
   GripVertical,
 } from 'lucide-react';
 import { getStatusLabel } from '@/services/taskStatusService';
 
 // Status colors
 const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
   'todo': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-400' },
   'to_assign': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-500' },
   'in-progress': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-500' },
   'pending-validation': { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-500' },
   'validated': { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-800 dark:text-teal-300', border: 'border-teal-500' },
   'done': { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-300', border: 'border-green-500' },
   'blocked': { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-300', border: 'border-red-500' },
 };
 
 const PRIORITY_COLORS: Record<string, string> = {
   'low': 'bg-slate-400',
   'medium': 'bg-amber-500',
   'high': 'bg-orange-500',
   'urgent': 'bg-red-500',
 };
 
 interface WeekData {
   weekNumber: number;
   year: number;
   start: Date;
   end: Date;
   label: string;
   monthLabel: string;
   isFirstOfMonth: boolean;
 }
 
 interface QuarterPlanningGridProps {
   workloadData: TeamMemberWorkload[];
   startDate: Date;
   endDate: Date;
   tasks: Task[];
   holidays: Holiday[];
   leaves: UserLeave[];
   onTaskClick: (task: Task, slots: WorkloadSlot[]) => void;
   onSlotDrop: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', duration: number) => Promise<void>;
   dropTarget: { userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null;
   onDragOver: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
   onDragLeave: () => void;
   isCompact?: boolean;
 }
 
 interface MemberTaskBar {
   task: Task;
   slots: WorkloadSlot[];
   startWeekIdx: number;
   endWeekIdx: number;
   spanWeeks: number;
 }
 
 const WEEK_WIDTH = 90;
 const MEMBER_COL_WIDTH = 220;
 const ROW_HEIGHT = 64;
 
 export function QuarterPlanningGrid({
   workloadData = [],
   startDate,
   endDate,
   tasks = [],
   holidays = [],
   leaves = [],
   onTaskClick,
   onSlotDrop,
   dropTarget,
   onDragOver,
   onDragLeave,
   isCompact = false,
 }: QuarterPlanningGridProps) {
   
   // Generate weeks for the quarter
   const weeks = useMemo<WeekData[]>(() => {
     const weekStarts = eachWeekOfInterval(
       { start: startDate, end: endDate },
       { locale: fr }
     );
     
     let prevMonth: number | null = null;
     
     return weekStarts.map((weekStart) => {
       const weekEnd = endOfWeek(weekStart, { locale: fr });
       const weekNum = getWeek(weekStart, { locale: fr });
       const month = weekStart.getMonth();
       const isFirstOfMonth = prevMonth !== null && prevMonth !== month;
       prevMonth = month;
       
       return {
         weekNumber: weekNum,
         year: weekStart.getFullYear(),
         start: weekStart,
         end: weekEnd,
         label: `S${weekNum}`,
         monthLabel: format(weekStart, 'MMMM', { locale: fr }),
         isFirstOfMonth,
       };
     });
   }, [startDate, endDate]);
   
   // Group weeks by month for headers
   const monthGroups = useMemo(() => {
     const groups: { month: string; weeks: number }[] = [];
     let currentMonth: string | null = null;
     let count = 0;
     
     weeks.forEach((week, idx) => {
       const monthKey = format(week.start, 'MMMM yyyy', { locale: fr });
       if (currentMonth !== monthKey) {
         if (currentMonth) {
           groups.push({ month: currentMonth, weeks: count });
         }
         currentMonth = monthKey;
         count = 1;
       } else {
         count++;
       }
       if (idx === weeks.length - 1) {
         groups.push({ month: currentMonth!, weeks: count });
       }
     });
     
     return groups;
   }, [weeks]);
   
   // Slots grouped by user
   const slotsByUser = useMemo(() => {
     const map = new Map<string, WorkloadSlot[]>();
     workloadData.forEach(member => {
       const userSlots: WorkloadSlot[] = [];
       (member.days || []).forEach(day => {
         if (day.morning.slot) userSlots.push(day.morning.slot);
         if (day.afternoon.slot) userSlots.push(day.afternoon.slot);
       });
       map.set(member.memberId, userSlots);
     });
     return map;
   }, [workloadData]);
   
   // Tasks per user with week positions
   const taskBarsByUser = useMemo(() => {
     const map = new Map<string, MemberTaskBar[]>();
     
     workloadData.forEach(member => {
       const userSlots = slotsByUser.get(member.memberId) || [];
       const taskMap = new Map<string, { task: Task; slots: WorkloadSlot[] }>();
       
       userSlots.forEach(slot => {
         if (slot.task) {
           if (!taskMap.has(slot.task_id)) {
             const fullTask = tasks.find(t => t.id === slot.task_id);
             if (fullTask) {
               taskMap.set(slot.task_id, { task: fullTask, slots: [] });
             }
           }
           const entry = taskMap.get(slot.task_id);
           if (entry) {
             entry.slots.push(slot);
           }
         }
       });
       
       // Convert to bars with week positions
       const bars: MemberTaskBar[] = [];
       taskMap.forEach(({ task, slots }) => {
         if (slots.length === 0) return;
         
         // Find min/max dates for this task
         const dates = slots.map(s => parseISO(s.date)).sort((a, b) => a.getTime() - b.getTime());
         const minDate = dates[0];
         const maxDate = dates[dates.length - 1];
         
         // Find which weeks these fall into
         let startWeekIdx = -1;
         let endWeekIdx = -1;
         
         weeks.forEach((week, idx) => {
           const weekInterval = { start: week.start, end: week.end };
           if (isWithinInterval(minDate, weekInterval) && startWeekIdx === -1) {
             startWeekIdx = idx;
           }
           if (isWithinInterval(maxDate, weekInterval)) {
             endWeekIdx = idx;
           }
         });
         
         // Fallback for edge cases
         if (startWeekIdx === -1) startWeekIdx = 0;
         if (endWeekIdx === -1) endWeekIdx = weeks.length - 1;
         if (endWeekIdx < startWeekIdx) endWeekIdx = startWeekIdx;
         
         bars.push({
           task,
           slots,
           startWeekIdx,
           endWeekIdx,
           spanWeeks: endWeekIdx - startWeekIdx + 1,
         });
       });
       
       // Sort by start week
       bars.sort((a, b) => a.startWeekIdx - b.startWeekIdx);
       map.set(member.memberId, bars);
     });
     
     return map;
   }, [workloadData, slotsByUser, tasks, weeks]);
   
   // Leaves by user and week
   const leavesByUserWeek = useMemo(() => {
     const map = new Map<string, Set<number>>();
     
     leaves.forEach(leave => {
       if (leave.status === 'cancelled') return;
       try {
         const leaveStart = parseISO(leave.start_date);
         const leaveEnd = parseISO(leave.end_date);
         
         weeks.forEach((week, idx) => {
           const weekInterval = { start: week.start, end: week.end };
           // Check if leave overlaps with this week
           if (
             isWithinInterval(leaveStart, weekInterval) ||
             isWithinInterval(leaveEnd, weekInterval) ||
             (leaveStart <= week.start && leaveEnd >= week.end)
           ) {
             if (!map.has(leave.user_id)) {
               map.set(leave.user_id, new Set());
             }
             map.get(leave.user_id)!.add(idx);
           }
         });
       } catch { /* skip */ }
     });
     
     return map;
   }, [leaves, weeks]);
   
   // Calculate weekly capacity/load for each member
   const weeklyLoadByUser = useMemo(() => {
     const map = new Map<string, { weekIdx: number; load: number; capacity: number; percent: number }[]>();
     
     workloadData.forEach(member => {
       const userSlots = slotsByUser.get(member.memberId) || [];
       const weeklyData: { weekIdx: number; load: number; capacity: number; percent: number }[] = [];
       
       weeks.forEach((week, idx) => {
         // Count slots in this week
         let loadSlots = 0;
         const capacitySlots = 10; // 5 days * 2 half-days
         
         userSlots.forEach(slot => {
           try {
             const slotDate = parseISO(slot.date);
             if (isWithinInterval(slotDate, { start: week.start, end: week.end })) {
               loadSlots++;
             }
           } catch { /* skip */ }
         });
         
         weeklyData.push({
           weekIdx: idx,
           load: loadSlots,
           capacity: capacitySlots,
           percent: Math.round((loadSlots / capacitySlots) * 100),
         });
       });
       
       map.set(member.memberId, weeklyData);
     });
     
     return map;
   }, [workloadData, slotsByUser, weeks]);
   
   const getInitials = (name: string) => {
     return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
   };
   
   const handleDrop = async (e: React.DragEvent, weekIdx: number, memberId: string) => {
     e.preventDefault();
     const taskId = e.dataTransfer.getData('taskId');
     const duration = parseInt(e.dataTransfer.getData('duration') || '2', 10);
     
     if (taskId && weeks[weekIdx]) {
       // Drop at start of week
       const dropDate = format(weeks[weekIdx].start, 'yyyy-MM-dd');
       await onSlotDrop(taskId, memberId, dropDate, 'morning', duration);
     }
     onDragLeave();
   };
 
   const rowHeight = isCompact ? 52 : ROW_HEIGHT;
 
   return (
     <div className="flex-1 flex flex-col overflow-hidden">
       {/* Header with month groups + week numbers */}
       <div className="shrink-0 border-b bg-gradient-to-b from-muted/60 to-muted/30">
         {/* Month row */}
         <div className="flex">
           <div 
             className="shrink-0 border-r bg-card flex items-center px-4"
             style={{ width: MEMBER_COL_WIDTH, height: 32 }}
           >
             <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
               Trimestre
             </span>
           </div>
           {monthGroups.map((group, idx) => (
             <div
               key={`${group.month}-${idx}`}
               className="flex items-center justify-center border-r font-semibold text-xs capitalize"
               style={{ 
                 width: group.weeks * WEEK_WIDTH,
                 height: 32,
                 borderColor: 'hsl(var(--border))'
               }}
             >
               {group.month}
             </div>
           ))}
         </div>
         
         {/* Week row */}
         <div className="flex">
           <div 
             className="shrink-0 border-r bg-card flex items-center px-4"
             style={{ width: MEMBER_COL_WIDTH, height: 36 }}
           >
             <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
               Collaborateur
             </span>
           </div>
           {weeks.map((week, idx) => (
             <div
               key={`week-${week.weekNumber}-${week.year}-${idx}`}
               className={cn(
                 "flex flex-col items-center justify-center text-center border-r",
                 week.isFirstOfMonth && "border-l-2 border-l-primary/40"
               )}
               style={{ width: WEEK_WIDTH, height: 36 }}
             >
               <span className="text-xs font-bold text-foreground">{week.label}</span>
               <span className="text-[9px] text-muted-foreground">
                 {format(week.start, 'd MMM', { locale: fr })}
               </span>
             </div>
           ))}
         </div>
       </div>
       
       {/* Grid body */}
       <ScrollArea className="flex-1">
         <div style={{ width: MEMBER_COL_WIDTH + (weeks.length * WEEK_WIDTH) }}>
           {workloadData.map((member, memberIdx) => {
             const memberBars = taskBarsByUser.get(member.memberId) || [];
             const memberLeaves = leavesByUserWeek.get(member.memberId) || new Set<number>();
             const memberLoad = weeklyLoadByUser.get(member.memberId) || [];
             
             return (
               <div 
                 key={member.memberId} 
                 className={cn(
                   "flex border-b",
                   memberIdx % 2 === 0 ? "bg-card" : "bg-muted/10"
                 )}
                 style={{ height: rowHeight }}
               >
                 {/* Member info */}
                 <div 
                   className="shrink-0 border-r flex items-center gap-3 px-3 sticky left-0 z-10 bg-inherit"
                   style={{ width: MEMBER_COL_WIDTH }}
                 >
                   <Avatar className="h-8 w-8 shrink-0 ring-2 ring-background shadow">
                     <AvatarImage src={member.avatarUrl || undefined} />
                     <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                       {getInitials(member.memberName)}
                     </AvatarFallback>
                   </Avatar>
                   <div className="flex-1 min-w-0">
                     <div className="text-sm font-semibold truncate">{member.memberName}</div>
                     <div className="text-[10px] text-muted-foreground truncate">{member.department}</div>
                   </div>
                 </div>
                 
                 {/* Week cells */}
                 <div className="flex relative">
                   {weeks.map((week, weekIdx) => {
                     const hasLeave = memberLeaves.has(weekIdx);
                     const loadData = memberLoad[weekIdx];
                     const isOverloaded = loadData && loadData.percent > 100;
                     const isDropTargetHere = dropTarget?.userId === member.memberId;
                     
                     return (
                       <div
                         key={`cell-${weekIdx}`}
                         className={cn(
                           "shrink-0 border-r relative",
                           week.isFirstOfMonth && "border-l-2 border-l-primary/40",
                           hasLeave && "bg-violet-50/60 dark:bg-violet-900/20",
                           isDropTargetHere && "bg-primary/10"
                         )}
                         style={{ width: WEEK_WIDTH, height: rowHeight }}
                         onDragOver={(e) => {
                           e.preventDefault();
                           onDragOver(member.memberId, format(week.start, 'yyyy-MM-dd'), 'morning');
                         }}
                         onDragLeave={onDragLeave}
                         onDrop={(e) => handleDrop(e, weekIdx, member.memberId)}
                       >
                         {/* Leave indicator */}
                         {hasLeave && (
                           <div className="absolute top-1 right-1">
                             <Palmtree className="h-3 w-3 text-violet-500" />
                           </div>
                         )}
                         
                         {/* Capacity bar at bottom */}
                         {loadData && loadData.load > 0 && (
                           <div className="absolute bottom-1 left-1 right-1">
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <div className="relative">
                                   <Progress 
                                     value={Math.min(loadData.percent, 100)} 
                                     className={cn(
                                       "h-1.5",
                                       isOverloaded && "[&>div]:bg-red-500"
                                     )}
                                   />
                                   {isOverloaded && (
                                     <Badge 
                                       variant="destructive" 
                                       className="absolute -top-4 right-0 text-[8px] px-1 py-0 h-4"
                                     >
                                       {loadData.percent}%
                                     </Badge>
                                   )}
                                 </div>
                               </TooltipTrigger>
                               <TooltipContent side="top">
                                 <div className="text-xs">
                                   <div className="font-semibold">{week.label}</div>
                                   <div>Charge: {loadData.load} créneaux / {loadData.capacity}</div>
                                   <div className={cn(isOverloaded && "text-red-500 font-bold")}>
                                     {loadData.percent}% de capacité
                                   </div>
                                 </div>
                               </TooltipContent>
                             </Tooltip>
                           </div>
                         )}
                       </div>
                     );
                   })}
                   
                   {/* Task bars overlay */}
                   {memberBars.map((bar) => {
                     const statusStyle = STATUS_COLORS[bar.task.status] || STATUS_COLORS['todo'];
                     const priorityColor = PRIORITY_COLORS[bar.task.priority] || PRIORITY_COLORS['medium'];
                     const left = bar.startWeekIdx * WEEK_WIDTH + 4;
                     const width = bar.spanWeeks * WEEK_WIDTH - 8;
                     
                     return (
                       <Tooltip key={bar.task.id}>
                         <TooltipTrigger asChild>
                           <div
                             draggable
                             onDragStart={(e) => {
                               e.dataTransfer.setData('taskId', bar.task.id);
                               e.dataTransfer.setData('duration', String(bar.slots.length));
                             }}
                             onClick={() => onTaskClick(bar.task, bar.slots)}
                             className={cn(
                               "absolute top-2 flex items-center gap-1.5 px-2 rounded-md cursor-pointer",
                               "border shadow-sm transition-all hover:shadow-md hover:scale-[1.02]",
                               statusStyle.bg,
                               statusStyle.text,
                               statusStyle.border
                             )}
                             style={{
                               left,
                               width: Math.max(width, 60),
                               height: isCompact ? 28 : 32,
                             }}
                           >
                             <GripVertical className="h-3 w-3 shrink-0 opacity-40 cursor-grab" />
                             <div className={cn("w-2 h-2 rounded-full shrink-0", priorityColor)} />
                             <span className="text-[11px] font-medium truncate flex-1">
                               {bar.task.title}
                             </span>
                             {bar.spanWeeks > 1 && (
                               <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                                 {bar.spanWeeks}s
                               </Badge>
                             )}
                           </div>
                         </TooltipTrigger>
                         <TooltipContent side="top" className="max-w-xs p-3">
                           <div className="space-y-2">
                             <div className="font-bold">{bar.task.title}</div>
                             <div className="flex items-center gap-2 flex-wrap">
                               <Badge variant="outline" className="text-[10px]">
                                 {getStatusLabel(bar.task.status)}
                               </Badge>
                               <Badge className={cn("text-[10px] text-white", priorityColor)}>
                                 <Flag className="h-3 w-3 mr-1" />
                                 {bar.task.priority}
                               </Badge>
                             </div>
                             <div className="text-xs text-muted-foreground">
                               {bar.slots.length} créneau{bar.slots.length > 1 ? 'x' : ''} sur {bar.spanWeeks} semaine{bar.spanWeeks > 1 ? 's' : ''}
                             </div>
                           </div>
                         </TooltipContent>
                       </Tooltip>
                     );
                   })}
                 </div>
               </div>
             );
           })}
         </div>
       </ScrollArea>
     </div>
   );
 }