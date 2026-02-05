 import { useMemo, useCallback, useState } from 'react';
 import { format, parseISO, isWeekend, isToday, isSameDay, isSameMonth, isSameWeek, startOfWeek, endOfWeek } from 'date-fns';
 import { fr } from 'date-fns/locale';
 import { TeamMemberWorkload, WorkloadSlot, UserLeave, Holiday } from '@/types/workload';
 import { Task } from '@/types/task';
 import { OutlookEvent } from '@/hooks/useOutlookCalendar';
 import { cn } from '@/lib/utils';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
 import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
 import { Progress } from '@/components/ui/progress';
 import { Skeleton } from '@/components/ui/skeleton';
 import { ChevronLeft, ChevronRight, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
 import { getStatusLabel, getStatusColor } from '@/services/taskStatusService';
 import { getPeriodUnits, getColumnWidth, getPeriodLabel, type ViewMode, type PeriodUnit } from '@/utils/planningDateUtils';
 
 // Collaborator color palette (deterministic)
 const USER_COLORS = [
   { bg: 'bg-cyan-500', light: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300' },
   { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300' },
   { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300' },
   { bg: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300' },
   { bg: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300' },
   { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300' },
   { bg: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300' },
   { bg: 'bg-pink-500', light: 'bg-pink-50 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300' },
 ];
 
 interface PlanningCalendarGridProps {
   workloadData: TeamMemberWorkload[];
   startDate: Date;
   endDate: Date;
   tasks: Task[];
   holidays: Holiday[];
   leaves: UserLeave[];
   outlookEvents?: OutlookEvent[];
   showOutlookEvents?: boolean;
   viewMode: ViewMode;
   onNavigate: (direction: 'prev' | 'next') => void;
   onToday: () => void;
   onTaskClick: (task: Task, slots: WorkloadSlot[]) => void;
   onSlotDrop: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', duration: number) => Promise<void>;
   onTaskMove?: (taskId: string, fromUserId: string, toUserId: string, newStartDate: string) => Promise<void>;
   dropTarget: { userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null;
   onDragOver: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
   onDragLeave: () => void;
   isHalfDayAvailable?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
   checkSlotLeaveConflict?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => { hasConflict: boolean; leaveType?: string };
   isCompact?: boolean;
 }
 
 export function PlanningCalendarGrid({
   workloadData = [],
   startDate,
   endDate,
   tasks = [],
   holidays = [],
   leaves = [],
   outlookEvents = [],
   showOutlookEvents = true,
   viewMode,
   onNavigate,
   onToday,
   onTaskClick,
   onSlotDrop,
   onTaskMove,
   dropTarget,
   onDragOver,
   onDragLeave,
   isHalfDayAvailable,
   checkSlotLeaveConflict,
   isCompact = false,
 }: PlanningCalendarGridProps) {
   const [hoveredTask, setHoveredTask] = useState<string | null>(null);
 
   // Use centralized period calculation - robust with fallbacks
   const periodUnits = useMemo(() => {
     if (!startDate || !endDate) return [];
     return getPeriodUnits(viewMode, startDate, endDate);
   }, [viewMode, startDate, endDate]);
 
   const columnWidth = getColumnWidth(viewMode, isCompact);
   const rowHeight = isCompact ? 56 : 72;
   const memberColumnWidth = isCompact ? 200 : 240;
   const headerHeight = viewMode === 'year' ? 48 : 56;
 
   // User color map (deterministic)
   const userColorMap = useMemo(() => {
     const map = new Map<string, typeof USER_COLORS[0]>();
     workloadData.forEach((member, index) => {
       map.set(member.memberId, USER_COLORS[index % USER_COLORS.length]);
     });
     return map;
   }, [workloadData]);
 
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
 
   // Tasks grouped by user with their slots and date ranges
   const tasksByUser = useMemo(() => {
     const map = new Map<string, { task: Task; slots: WorkloadSlot[]; startDate: string; endDate: string }[]>();
     
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
       
       const tasksWithDates = Array.from(taskMap.values()).map(({ task, slots }) => {
         const sortedSlots = [...slots].sort((a, b) => a.date.localeCompare(b.date));
         return {
           task,
           slots,
           startDate: sortedSlots[0]?.date || '',
           endDate: sortedSlots[sortedSlots.length - 1]?.date || '',
         };
       });
       
       map.set(member.memberId, tasksWithDates);
     });
     
     return map;
   }, [workloadData, slotsByUser, tasks]);
 
   // Leaves lookup by user and date
   const leavesByUserDate = useMemo(() => {
     const map = new Map<string, Set<string>>();
     leaves.forEach(leave => {
       if (leave.status === 'cancelled') return;
       try {
         const start = parseISO(leave.start_date);
         const end = parseISO(leave.end_date);
         if (!map.has(leave.user_id)) {
           map.set(leave.user_id, new Set());
         }
         // Add each day of leave
         const current = new Date(start);
         while (current <= end) {
           map.get(leave.user_id)!.add(format(current, 'yyyy-MM-dd'));
           current.setDate(current.getDate() + 1);
         }
       } catch {
         // Skip invalid dates
       }
     });
     return map;
   }, [leaves]);
 
   // Holidays lookup by date
   const holidaysByDate = useMemo(() => {
     const map = new Map<string, Holiday>();
     holidays.forEach(h => map.set(h.date, h));
     return map;
   }, [holidays]);
 
   // Outlook events lookup by user and date
   const outlookByUserDate = useMemo(() => {
     const map = new Map<string, Map<string, OutlookEvent[]>>();
     outlookEvents.forEach(event => {
       if (!map.has(event.user_id)) {
         map.set(event.user_id, new Map());
       }
       const dateKey = event.start_time.split('T')[0];
       const userMap = map.get(event.user_id)!;
       if (!userMap.has(dateKey)) {
         userMap.set(dateKey, []);
       }
       userMap.get(dateKey)!.push(event);
     });
     return map;
   }, [outlookEvents]);
 
   const getInitials = (name: string) => {
     return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
   };
 
   const getPriorityColor = (priority: string) => {
     switch (priority) {
       case 'urgent': return 'bg-destructive text-destructive-foreground';
       case 'high': return 'bg-orange-500 text-white';
       case 'medium': return 'bg-primary text-primary-foreground';
       case 'low': return 'bg-emerald-500 text-white';
       default: return 'bg-muted text-muted-foreground';
     }
   };
 
   // Calculate task bar position within the grid
   const getTaskBarStyle = useCallback((taskStartDate: string, taskEndDate: string) => {
     if (!periodUnits.length) return null;
     
     try {
       const taskStart = parseISO(taskStartDate);
       const taskEnd = parseISO(taskEndDate);
       
       let startIdx = -1;
       let endIdx = -1;
       
       if (viewMode === 'week' || viewMode === 'month') {
         // Day-by-day matching
         startIdx = periodUnits.findIndex(u => isSameDay(u.date, taskStart));
         endIdx = periodUnits.findIndex(u => isSameDay(u.date, taskEnd));
         
         // Clamp to visible range
         if (startIdx === -1 && taskStart < periodUnits[0].date) startIdx = 0;
         if (endIdx === -1 && taskEnd > periodUnits[periodUnits.length - 1].date) endIdx = periodUnits.length - 1;
       } else if (viewMode === 'quarter') {
         // Week-by-week matching
         startIdx = periodUnits.findIndex(u => isSameWeek(u.date, taskStart, { locale: fr }));
         endIdx = periodUnits.findIndex(u => isSameWeek(u.date, taskEnd, { locale: fr }));
         
         if (startIdx === -1 && taskStart < periodUnits[0].date) startIdx = 0;
         if (endIdx === -1 && taskEnd > periodUnits[periodUnits.length - 1].date) endIdx = periodUnits.length - 1;
       } else if (viewMode === 'year') {
         // Month-by-month matching
         startIdx = periodUnits.findIndex(u => isSameMonth(u.date, taskStart));
         endIdx = periodUnits.findIndex(u => isSameMonth(u.date, taskEnd));
         
         if (startIdx === -1 && taskStart < periodUnits[0].date) startIdx = 0;
         if (endIdx === -1 && taskEnd > periodUnits[periodUnits.length - 1].date) endIdx = periodUnits.length - 1;
       }
       
       if (startIdx === -1 || endIdx === -1) return null;
       if (startIdx > endIdx) endIdx = startIdx;
       
       const left = startIdx * columnWidth + 4;
       const width = Math.max((endIdx - startIdx + 1) * columnWidth - 8, 24);
       
       return { left, width };
     } catch {
       return null;
     }
   }, [periodUnits, viewMode, columnWidth]);
 
   // Check if a unit (day/week/month) has leave for a user
   const hasLeaveForUnit = useCallback((userId: string, unit: PeriodUnit): boolean => {
     const userLeaves = leavesByUserDate.get(userId);
     if (!userLeaves) return false;
     
     if (viewMode === 'week' || viewMode === 'month') {
       return userLeaves.has(unit.key);
     } else if (viewMode === 'quarter') {
       // Check if any day in the week has leave
       const weekStart = startOfWeek(unit.date, { locale: fr });
       const weekEnd = endOfWeek(unit.date, { locale: fr });
       const current = new Date(weekStart);
       while (current <= weekEnd) {
         if (userLeaves.has(format(current, 'yyyy-MM-dd'))) return true;
         current.setDate(current.getDate() + 1);
       }
       return false;
     } else {
       // Year view: check if any day in month has leave
       // Just check a sample for performance
       return userLeaves.has(format(unit.date, 'yyyy-MM-01'));
     }
   }, [leavesByUserDate, viewMode]);
 
   const handleDrop = async (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
     e.preventDefault();
     const taskId = e.dataTransfer.getData('taskId');
     const duration = parseInt(e.dataTransfer.getData('duration') || '2', 10);
     
     if (taskId) {
       await onSlotDrop(taskId, userId, date, halfDay, duration);
     }
     onDragLeave();
   };
 
   // Loading/empty state
   if (!startDate || !endDate || !periodUnits.length) {
     return (
       <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden">
         <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
           <Skeleton className="h-8 w-32" />
           <Skeleton className="h-6 w-48" />
           <Skeleton className="h-8 w-24" />
         </div>
         <div className="flex-1 p-4">
           <Skeleton className="h-full w-full" />
         </div>
       </div>
     );
   }
 
   const periodLabel = getPeriodLabel(viewMode, startDate, endDate);
 
   return (
     <div className="flex flex-col h-full bg-card rounded-xl border shadow-premium overflow-hidden">
       {/* Navigation header */}
       <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-muted/40 to-muted/20">
         <div className="flex items-center gap-2">
           <Button variant="outline" size="icon" className="h-8 w-8 shadow-sm" onClick={() => onNavigate('prev')}>
             <ChevronLeft className="h-4 w-4" />
           </Button>
           <Button variant="outline" size="sm" className="h-8 font-medium shadow-sm" onClick={onToday}>
             Aujourd'hui
           </Button>
           <Button variant="outline" size="icon" className="h-8 w-8 shadow-sm" onClick={() => onNavigate('next')}>
             <ChevronRight className="h-4 w-4" />
           </Button>
         </div>
         
         <h3 className="font-semibold text-foreground capitalize flex items-center gap-2">
           <CalendarIcon className="h-4 w-4 text-muted-foreground" />
           {periodLabel}
         </h3>
         
         <div className="flex items-center gap-2">
           <Badge variant="outline" className="text-xs">
             {workloadData.length} collaborateur{workloadData.length > 1 ? 's' : ''}
           </Badge>
         </div>
       </div>
 
       {/* Grid container with sticky positioning */}
       <div className="flex-1 overflow-hidden relative">
         <ScrollArea className="h-full">
           <div className="flex min-w-max">
             {/* Sticky member column */}
             <div 
               className="shrink-0 border-r bg-card z-20 sticky left-0" 
               style={{ width: memberColumnWidth }}
             >
               {/* Header cell */}
               <div 
                 className="border-b bg-muted/50 flex items-center px-3 font-medium text-xs text-muted-foreground sticky top-0 z-30"
                 style={{ height: headerHeight }}
               >
                 Équipe
               </div>
               
               {/* Member rows */}
               {workloadData.map(member => {
                 const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
                 const capacityPercent = available > 0 ? Math.round((member.usedSlots / available) * 100) : 0;
                 const isOverloaded = capacityPercent > 100;
                 const color = userColorMap.get(member.memberId) || USER_COLORS[0];
                 
                 return (
                   <div
                     key={member.memberId}
                     className="flex items-center gap-3 px-3 border-b hover:bg-muted/40 transition-colors"
                     style={{ height: rowHeight }}
                   >
                     <div className={cn("w-1 h-10 rounded-full shrink-0", color.bg)} />
                     <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background shadow-sm">
                       <AvatarImage src={member.avatarUrl || undefined} />
                       <AvatarFallback className={cn("text-xs font-medium", color.bg, "text-white")}>
                         {getInitials(member.memberName)}
                       </AvatarFallback>
                     </Avatar>
                     <div className="flex-1 min-w-0">
                       <div className="text-sm font-medium truncate text-foreground">
                         {member.memberName}
                       </div>
                       <div className="flex items-center gap-2 mt-1">
                         <Progress 
                           value={Math.min(capacityPercent, 100)} 
                           className={cn(
                             "h-1.5 flex-1 bg-muted/50",
                             isOverloaded && "[&>div]:bg-destructive"
                           )}
                         />
                         <span className={cn(
                           "text-[10px] tabular-nums font-semibold min-w-[32px] text-right",
                           isOverloaded ? "text-destructive" : "text-muted-foreground"
                         )}>
                           {capacityPercent}%
                         </span>
                         {isOverloaded && (
                           <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                         )}
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
 
             {/* Scrollable calendar grid */}
             <div className="flex-1">
               <div style={{ minWidth: periodUnits.length * columnWidth }}>
                 {/* Period headers */}
                 <div 
                   className="flex border-b bg-muted/30 sticky top-0 z-10"
                   style={{ height: headerHeight }}
                 >
                   {periodUnits.map((unit, idx) => {
                     const showMonthSeparator = unit.isFirstOfMonth && idx > 0;
                     
                     return (
                       <div
                         key={unit.key}
                         className={cn(
                           "flex flex-col items-center justify-center border-r text-xs relative",
                           unit.isWeekend && "bg-muted/60",
                           unit.isToday && "bg-primary/10",
                           showMonthSeparator && "border-l-2 border-l-primary/30"
                         )}
                         style={{ width: columnWidth }}
                       >
                         {/* Month label for quarter/year views */}
                         {showMonthSeparator && viewMode !== 'year' && (
                           <div className="absolute -top-0 left-1 text-[9px] font-semibold text-primary/70 uppercase tracking-wide">
                             {unit.monthLabel?.slice(0, 3)}
                           </div>
                         )}
                         
                         <span className={cn(
                           "font-semibold leading-tight",
                           unit.isToday && "text-primary"
                         )}>
                           {unit.label}
                         </span>
                         
                         {unit.subLabel && viewMode !== 'year' && (
                           <span className={cn(
                             "text-muted-foreground text-[10px]",
                             unit.isToday && "text-primary font-medium"
                           )}>
                             {unit.subLabel}
                           </span>
                         )}
                       </div>
                     );
                   })}
                 </div>
 
                 {/* Member timeline rows */}
                 {workloadData.map(member => {
                   const userTasks = tasksByUser.get(member.memberId) || [];
                   const userOutlook = outlookByUserDate.get(member.memberId) || new Map();
                   const color = userColorMap.get(member.memberId) || USER_COLORS[0];
                   
                   return (
                     <div
                       key={member.memberId}
                       className="flex relative border-b group"
                       style={{ height: rowHeight }}
                     >
                       {/* Period cells */}
                       {periodUnits.map((unit, unitIdx) => {
                         const dateStr = format(unit.date, 'yyyy-MM-dd');
                         const holiday = holidaysByDate.get(dateStr);
                         const hasLeave = hasLeaveForUnit(member.memberId, unit);
                         const outlookEvts = userOutlook.get(dateStr) || [];
                         const isDropTargetCell = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr;
                         const showMonthSeparator = unit.isFirstOfMonth && unitIdx > 0;
                         
                         return (
                           <div
                             key={unit.key}
                             className={cn(
                               "border-r relative transition-colors",
                               unit.isWeekend && "bg-muted/40",
                               unit.isToday && "bg-primary/5",
                               holiday && "bg-amber-50/60 dark:bg-amber-900/20",
                               hasLeave && "bg-violet-50/70 dark:bg-violet-900/20",
                               isDropTargetCell && "bg-primary/20 ring-2 ring-primary ring-inset",
                               showMonthSeparator && "border-l-2 border-l-primary/30",
                               "hover:bg-muted/50"
                             )}
                             style={{ width: columnWidth }}
                             onDragOver={(e) => {
                               e.preventDefault();
                               if (!unit.isWeekend && !holiday) {
                                 onDragOver(member.memberId, dateStr, 'morning');
                               }
                             }}
                             onDragLeave={onDragLeave}
                             onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'morning')}
                           >
                             {/* Leave indicator */}
                             {hasLeave && (
                               <div className="absolute inset-x-1 top-1 bottom-1 flex items-center justify-center">
                                 <span className={cn(
                                   "text-[9px] font-medium px-1.5 py-0.5 rounded-full",
                                   "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                                 )}>
                                   {viewMode === 'week' ? 'Congé' : '🏖️'}
                                 </span>
                               </div>
                             )}
                             
                             {/* Holiday indicator */}
                             {holiday && !hasLeave && (
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <div className="absolute inset-x-1 top-1 bottom-1 flex items-center justify-center">
                                     <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                       {viewMode === 'week' ? 'Férié' : '🎉'}
                                     </span>
                                   </div>
                                 </TooltipTrigger>
                                 <TooltipContent side="top">
                                   <span className="text-xs">{holiday.name}</span>
                                 </TooltipContent>
                               </Tooltip>
                             )}
                             
                             {/* Outlook busy indicator */}
                             {showOutlookEvents && outlookEvts.length > 0 && !hasLeave && !holiday && viewMode !== 'year' && (
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <div className="absolute bottom-1 left-1 right-1">
                                     <div className="h-1 bg-slate-400/60 rounded-full" />
                                   </div>
                                 </TooltipTrigger>
                                 <TooltipContent side="top">
                                   <div className="text-xs space-y-0.5 max-w-[200px]">
                                     {outlookEvts.slice(0, 3).map((evt, i) => (
                                       <div key={i} className="truncate">{evt.subject}</div>
                                     ))}
                                     {outlookEvts.length > 3 && (
                                       <div className="text-muted-foreground">+{outlookEvts.length - 3} autres</div>
                                     )}
                                   </div>
                                 </TooltipContent>
                               </Tooltip>
                             )}
                           </div>
                         );
                       })}
 
                       {/* Task pills overlay */}
                       <div className="absolute inset-0 pointer-events-none px-1">
                         {userTasks.map(({ task, slots, startDate: taskStart, endDate: taskEnd }) => {
                           const style = getTaskBarStyle(taskStart, taskEnd);
                           if (!style) return null;
                           
                           const isHovered = hoveredTask === task.id;
                           const hasConflict = slots.some(s => {
                             if (!checkSlotLeaveConflict) return false;
                             const result = checkSlotLeaveConflict(member.memberId, s.date, s.half_day as 'morning' | 'afternoon');
                             return result.hasConflict;
                           });
                           
                           return (
                             <Tooltip key={task.id}>
                               <TooltipTrigger asChild>
                                 <div
                                   className={cn(
                                     // Pill styling - Monday/Asana inspired
                                     "absolute rounded-md cursor-pointer pointer-events-auto",
                                     "flex items-center gap-1.5 px-2",
                                     "text-xs font-medium shadow-sm",
                                     "transition-all duration-150",
                                     "hover:shadow-md hover:scale-[1.02] hover:z-20",
                                     getPriorityColor(task.priority),
                                     isHovered && "ring-2 ring-offset-1 ring-foreground/20 z-20",
                                     hasConflict && "ring-2 ring-orange-400"
                                   )}
                                   style={{ 
                                     left: style.left, 
                                     width: style.width,
                                     top: isCompact ? 8 : 12,
                                     height: isCompact ? 'calc(100% - 16px)' : 'calc(100% - 24px)',
                                     minHeight: 24,
                                   }}
                                   onClick={() => onTaskClick(task, slots)}
                                   onMouseEnter={() => setHoveredTask(task.id)}
                                   onMouseLeave={() => setHoveredTask(null)}
                                 >
                                   {hasConflict && <AlertTriangle className="h-3 w-3 shrink-0" />}
                                   <span className="truncate flex-1">{task.title}</span>
                                   {slots.length > 1 && (
                                     <span className="text-[10px] opacity-80 shrink-0">
                                       {Math.ceil(slots.length / 2)}j
                                     </span>
                                   )}
                                 </div>
                               </TooltipTrigger>
                               <TooltipContent side="top" className="max-w-xs p-3">
                                 <div className="space-y-2">
                                   <div className="font-semibold text-sm">{task.title}</div>
                                   <div className="text-xs text-muted-foreground">
                                     {format(parseISO(taskStart), 'd MMM', { locale: fr })} → {format(parseISO(taskEnd), 'd MMM', { locale: fr })}
                                   </div>
                                   <div className="flex items-center gap-2 flex-wrap">
                                     <Badge variant="outline" className="text-[10px]">
                                       {getStatusLabel(task.status)}
                                     </Badge>
                                     <Badge className={cn("text-[10px]", getPriorityColor(task.priority))}>
                                       {task.priority}
                                     </Badge>
                                     <span className="text-[10px] text-muted-foreground">
                                       {slots.length} créneaux
                                     </span>
                                   </div>
                                   {hasConflict && (
                                     <div className="text-orange-600 text-xs flex items-center gap-1 pt-1 border-t">
                                       <AlertTriangle className="h-3 w-3" />
                                       Conflit avec congé/absence
                                     </div>
                                   )}
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
             </div>
           </div>
           <ScrollBar orientation="horizontal" />
         </ScrollArea>
         
         {/* Today indicator line (for week/month views) */}
         {(viewMode === 'week' || viewMode === 'month') && periodUnits.some(u => u.isToday) && (
           <div 
             className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-30 pointer-events-none"
             style={{ 
               left: memberColumnWidth + (periodUnits.findIndex(u => u.isToday) * columnWidth) + (columnWidth / 2)
             }}
           />
         )}
       </div>
     </div>
   );
 }