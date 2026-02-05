 import { useMemo, useCallback, useState } from 'react';
 import { format, parseISO, isWeekend, isToday, isSameDay } from 'date-fns';
 import { fr } from 'date-fns/locale';
 import { TeamMemberWorkload, WorkloadSlot, UserLeave, Holiday } from '@/types/workload';
 import { Task } from '@/types/task';
 import { OutlookEvent } from '@/hooks/useOutlookCalendar';
 import { cn } from '@/lib/utils';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Badge } from '@/components/ui/badge';
 import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
 import { Progress } from '@/components/ui/progress';
 import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
 import { 
   AlertTriangle, 
   Palmtree, 
   Calendar as CalendarIcon,
   Clock,
   Flag,
   GripVertical,
 } from 'lucide-react';
 import { getStatusLabel } from '@/services/taskStatusService';
 import { type PeriodUnit } from '@/utils/planningDateUtils';
 
 // Status color mapping
 const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
   'todo': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600' },
   'to_assign': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-600' },
   'in-progress': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-400 dark:border-blue-500' },
   'pending-validation': { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-600' },
   'validated': { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-800 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-600' },
   'done': { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-300', border: 'border-green-400 dark:border-green-500' },
   'blocked': { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-300', border: 'border-red-400 dark:border-red-500' },
 };
 
 // Priority indicators
 const PRIORITY_INDICATORS: Record<string, { dot: string; label: string }> = {
   'low': { dot: 'bg-slate-400', label: 'Basse' },
   'medium': { dot: 'bg-amber-500', label: 'Moyenne' },
   'high': { dot: 'bg-orange-500', label: 'Haute' },
   'urgent': { dot: 'bg-red-500', label: 'Urgente' },
 };
 
 // Collaborator color palette
 const USER_COLORS = [
   { bg: 'bg-cyan-500', light: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-700' },
   { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700' },
   { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700' },
   { bg: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700' },
   { bg: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700' },
   { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700' },
   { bg: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700' },
   { bg: 'bg-pink-500', light: 'bg-pink-50 dark:bg-pink-900/30', text: 'text-pink-700' },
 ];
 
 interface WeekPlanningGridProps {
   workloadData: TeamMemberWorkload[];
   periodUnits: PeriodUnit[];
   tasks: Task[];
   holidays: Holiday[];
   leaves: UserLeave[];
   outlookEvents?: OutlookEvent[];
   showOutlookEvents?: boolean;
   onTaskClick: (task: Task, slots: WorkloadSlot[]) => void;
   onSlotDrop: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', duration: number) => Promise<void>;
   dropTarget: { userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null;
   onDragOver: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => void;
   onDragLeave: () => void;
   checkSlotLeaveConflict?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => { hasConflict: boolean; leaveType?: string };
   isCompact?: boolean;
 }
 
 interface TaskPill {
   task: Task;
   slots: WorkloadSlot[];
   startDate: string;
   endDate: string;
   startCol: number;
   spanCols: number;
   row: number; // For stacking multiple tasks
 }
 
 export function WeekPlanningGrid({
   workloadData = [],
   periodUnits = [],
   tasks = [],
   holidays = [],
   leaves = [],
   outlookEvents = [],
   showOutlookEvents = true,
   onTaskClick,
   onSlotDrop,
   dropTarget,
   onDragOver,
   onDragLeave,
   checkSlotLeaveConflict,
   isCompact = false,
 }: WeekPlanningGridProps) {
   const [hoveredTask, setHoveredTask] = useState<string | null>(null);
   const [draggingTask, setDraggingTask] = useState<string | null>(null);
 
   // Dimensions
   const columnWidth = isCompact ? 120 : 160;
   const rowHeight = isCompact ? 72 : 96;
   const memberColumnWidth = isCompact ? 200 : 260;
   const headerHeight = 56;
   const pillHeight = isCompact ? 28 : 36;
   const pillGap = 4;
 
   // User color map
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
 
   // Compute task pills with positions for each user
   const taskPillsByUser = useMemo(() => {
     const result = new Map<string, TaskPill[]>();
     
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
       
       // Convert to positioned pills
       const pills: TaskPill[] = [];
       Array.from(taskMap.values()).forEach(({ task, slots }) => {
         const sortedSlots = [...slots].sort((a, b) => a.date.localeCompare(b.date));
         if (sortedSlots.length === 0) return;
         
         const startDateStr = sortedSlots[0].date;
         const endDateStr = sortedSlots[sortedSlots.length - 1].date;
         
         // Find column indices
         let startCol = periodUnits.findIndex(u => u.key === startDateStr);
         let endCol = periodUnits.findIndex(u => u.key === endDateStr);
         
         // Clamp to visible range
         if (startCol === -1) {
           try {
             const taskStart = parseISO(startDateStr);
             if (taskStart < periodUnits[0]?.date) startCol = 0;
           } catch { /* skip */ }
         }
         if (endCol === -1) {
           try {
             const taskEnd = parseISO(endDateStr);
             if (taskEnd > periodUnits[periodUnits.length - 1]?.date) endCol = periodUnits.length - 1;
           } catch { /* skip */ }
         }
         
         if (startCol !== -1 && endCol !== -1 && startCol <= endCol) {
           pills.push({
             task,
             slots,
             startDate: startDateStr,
             endDate: endDateStr,
             startCol,
             spanCols: endCol - startCol + 1,
             row: 0, // Will be computed for stacking
           });
         }
       });
       
       // Sort by start column, then by span (longer first)
       pills.sort((a, b) => a.startCol - b.startCol || b.spanCols - a.spanCols);
       
       // Assign rows for overlapping pills (simple greedy algorithm)
       const colEndRow: number[] = new Array(periodUnits.length).fill(0);
       pills.forEach(pill => {
         let maxRow = 0;
         for (let c = pill.startCol; c < pill.startCol + pill.spanCols; c++) {
           maxRow = Math.max(maxRow, colEndRow[c]);
         }
         pill.row = maxRow;
         for (let c = pill.startCol; c < pill.startCol + pill.spanCols; c++) {
           colEndRow[c] = maxRow + 1;
         }
       });
       
       result.set(member.memberId, pills);
     });
     
     return result;
   }, [workloadData, slotsByUser, tasks, periodUnits]);
 
   // Leaves lookup
   const leavesByUserDate = useMemo(() => {
     const map = new Map<string, Map<string, UserLeave>>();
     leaves.forEach(leave => {
       if (leave.status === 'cancelled') return;
       try {
         const start = parseISO(leave.start_date);
         const end = parseISO(leave.end_date);
         if (!map.has(leave.user_id)) {
           map.set(leave.user_id, new Map());
         }
         const current = new Date(start);
         while (current <= end) {
           map.get(leave.user_id)!.set(format(current, 'yyyy-MM-dd'), leave);
           current.setDate(current.getDate() + 1);
         }
       } catch { /* skip */ }
     });
     return map;
   }, [leaves]);
 
   // Holidays lookup
   const holidaysByDate = useMemo(() => {
     const map = new Map<string, Holiday>();
     holidays.forEach(h => map.set(h.date, h));
     return map;
   }, [holidays]);
 
   // Outlook events lookup
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
 
   const handleDrop = async (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
     e.preventDefault();
     const taskId = e.dataTransfer.getData('taskId');
     const duration = parseInt(e.dataTransfer.getData('duration') || '2', 10);
     
     if (taskId) {
       await onSlotDrop(taskId, userId, date, halfDay, duration);
     }
     setDraggingTask(null);
     onDragLeave();
   };
 
   const handleTaskDragStart = (e: React.DragEvent, task: Task, slots: WorkloadSlot[]) => {
     e.dataTransfer.setData('taskId', task.id);
     e.dataTransfer.setData('duration', String(slots.length));
     setDraggingTask(task.id);
   };
 
   if (!periodUnits.length) return null;
 
   return (
     <div className="flex-1 overflow-hidden relative">
       <ScrollArea className="h-full">
         <div className="flex min-w-max">
           {/* Sticky member column */}
           <div 
             className="shrink-0 border-r bg-card z-20 sticky left-0 shadow-sm" 
             style={{ width: memberColumnWidth }}
           >
             {/* Header cell */}
             <div 
               className="border-b bg-muted/50 flex items-center px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide sticky top-0 z-30"
               style={{ height: headerHeight }}
             >
               <span>Collaborateurs</span>
               <Badge variant="outline" className="ml-auto text-[10px]">
                 {workloadData.length}
               </Badge>
             </div>
             
             {/* Member rows */}
             {workloadData.map((member, memberIdx) => {
               const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
               const capacityPercent = available > 0 ? Math.round((member.usedSlots / available) * 100) : 0;
               const isOverloaded = capacityPercent > 100;
               const color = userColorMap.get(member.memberId) || USER_COLORS[0];
               const userPills = taskPillsByUser.get(member.memberId) || [];
               const maxRows = Math.max(1, ...userPills.map(p => p.row + 1));
               const dynamicRowHeight = Math.max(rowHeight, headerHeight + maxRows * (pillHeight + pillGap) + 8);
               
               return (
                 <div
                   key={member.memberId}
                   className={cn(
                     "flex items-start gap-3 px-4 py-3 border-b transition-colors",
                     memberIdx % 2 === 1 && "bg-muted/20"
                   )}
                   style={{ minHeight: dynamicRowHeight }}
                 >
                   {/* Color bar */}
                   <div className={cn("w-1 rounded-full shrink-0", color.bg)} style={{ height: 48 }} />
                   
                   {/* Avatar */}
                   <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-md">
                     <AvatarImage src={member.avatarUrl || undefined} />
                     <AvatarFallback className={cn("text-xs font-bold", color.bg, "text-white")}>
                       {getInitials(member.memberName)}
                     </AvatarFallback>
                   </Avatar>
                   
                   {/* Info */}
                   <div className="flex-1 min-w-0">
                     <div className="text-sm font-semibold truncate text-foreground">
                       {member.memberName}
                     </div>
                     {member.department && (
                       <div className="text-[11px] text-muted-foreground truncate">
                         {member.department}
                       </div>
                     )}
                     
                     {/* Capacity bar */}
                     <div className="flex items-center gap-2 mt-2">
                       <Progress 
                         value={Math.min(capacityPercent, 100)} 
                         className={cn(
                           "h-2 flex-1 bg-muted/60",
                           isOverloaded && "[&>div]:bg-destructive",
                           !isOverloaded && capacityPercent > 80 && "[&>div]:bg-amber-500"
                         )}
                       />
                       <span className={cn(
                         "text-[11px] tabular-nums font-bold min-w-[40px] text-right",
                         isOverloaded ? "text-destructive" : capacityPercent > 80 ? "text-amber-600" : "text-muted-foreground"
                       )}>
                         {capacityPercent}%
                       </span>
                       {isOverloaded && (
                         <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                       )}
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
 
           {/* Calendar grid */}
           <div className="flex-1">
             <div style={{ minWidth: periodUnits.length * columnWidth }}>
               {/* Day headers */}
               <div 
                 className="flex border-b bg-muted/40 sticky top-0 z-10"
                 style={{ height: headerHeight }}
               >
                 {periodUnits.map((unit, idx) => {
                   const isWeekendDay = unit.isWeekend;
                   
                   return (
                     <div
                       key={unit.key}
                       className={cn(
                         "flex flex-col items-center justify-center border-r text-center relative",
                         isWeekendDay && "bg-muted/80",
                         unit.isToday && "bg-primary/10"
                       )}
                       style={{ width: columnWidth }}
                     >
                       {/* Day name */}
                       <span className={cn(
                         "text-xs font-bold uppercase tracking-wide",
                         unit.isToday ? "text-primary" : "text-muted-foreground"
                       )}>
                         {unit.label}
                       </span>
                       {/* Date */}
                       <span className={cn(
                         "text-sm font-semibold mt-0.5",
                         unit.isToday && "text-primary"
                       )}>
                         {unit.subLabel}
                       </span>
                       
                       {/* Today indicator dot */}
                       {unit.isToday && (
                         <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                       )}
                     </div>
                   );
                 })}
               </div>
 
               {/* Member rows */}
               {workloadData.map((member, memberIdx) => {
                 const userLeaves = leavesByUserDate.get(member.memberId) || new Map();
                 const userOutlook = outlookByUserDate.get(member.memberId) || new Map();
                 const userPills = taskPillsByUser.get(member.memberId) || [];
                 const maxRows = Math.max(1, ...userPills.map(p => p.row + 1));
                 const dynamicRowHeight = Math.max(rowHeight, headerHeight + maxRows * (pillHeight + pillGap) + 8);
                 
                 return (
                   <div
                     key={member.memberId}
                     className={cn(
                       "flex relative border-b group",
                       memberIdx % 2 === 1 && "bg-muted/10"
                     )}
                     style={{ minHeight: dynamicRowHeight }}
                   >
                     {/* Day cells */}
                     {periodUnits.map((unit) => {
                       const dateStr = unit.key;
                       const holiday = holidaysByDate.get(dateStr);
                       const leave = userLeaves.get(dateStr);
                       const outlookEvts = userOutlook.get(dateStr) || [];
                       const isDropTargetCell = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr;
                       
                       return (
                         <div
                           key={unit.key}
                           className={cn(
                             "border-r relative transition-all duration-150",
                             unit.isWeekend && "bg-muted/50",
                             unit.isToday && "bg-primary/5",
                             holiday && "bg-amber-50/80 dark:bg-amber-900/30",
                             leave && "bg-violet-50/80 dark:bg-violet-900/30",
                             isDropTargetCell && "bg-primary/20 ring-2 ring-primary ring-inset"
                           )}
                           style={{ width: columnWidth, minHeight: dynamicRowHeight }}
                           onDragOver={(e) => {
                             e.preventDefault();
                             if (!unit.isWeekend && !holiday) {
                               onDragOver(member.memberId, dateStr, 'morning');
                             }
                           }}
                           onDragLeave={onDragLeave}
                           onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'morning')}
                         >
                           {/* Leave overlay */}
                           {leave && (
                             <div className="absolute inset-1 flex items-start justify-center pt-2">
                               <Badge 
                                 variant="secondary" 
                                 className="bg-violet-100 text-violet-700 dark:bg-violet-800 dark:text-violet-200 text-[10px] font-medium px-2 py-0.5 gap-1"
                               >
                                 <Palmtree className="h-3 w-3" />
                                 Congé
                               </Badge>
                             </div>
                           )}
                           
                           {/* Holiday overlay */}
                           {holiday && !leave && (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <div className="absolute inset-1 flex items-start justify-center pt-2">
                                   <Badge 
                                     variant="secondary" 
                                     className="bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-200 text-[10px] font-medium px-2 py-0.5"
                                   >
                                     🎉 Férié
                                   </Badge>
                                 </div>
                               </TooltipTrigger>
                               <TooltipContent side="top">
                                 <span className="text-xs font-medium">{holiday.name}</span>
                               </TooltipContent>
                             </Tooltip>
                           )}
                           
                           {/* Outlook busy indicators */}
                           {showOutlookEvents && outlookEvts.length > 0 && !leave && !holiday && (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <div className="absolute bottom-2 left-2 right-2">
                                   <div className="h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                                 </div>
                               </TooltipTrigger>
                               <TooltipContent side="bottom" className="max-w-[200px]">
                                 <div className="text-xs space-y-1">
                                   <div className="font-semibold flex items-center gap-1">
                                     <CalendarIcon className="h-3 w-3" />
                                     Événements Outlook
                                   </div>
                                   {outlookEvts.slice(0, 3).map((evt, i) => (
                                     <div key={i} className="truncate text-muted-foreground">{evt.subject}</div>
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
                     <div className="absolute inset-0 pointer-events-none" style={{ top: 8 }}>
                       {userPills.map((pill) => {
                         const { task, slots, startCol, spanCols, row } = pill;
                         const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS['todo'];
                         const priority = PRIORITY_INDICATORS[task.priority] || PRIORITY_INDICATORS['medium'];
                         const isHovered = hoveredTask === task.id;
                         const isDragging = draggingTask === task.id;
                         
                         // Check for conflicts
                         const hasConflict = slots.some(s => {
                           if (!checkSlotLeaveConflict) return false;
                           const result = checkSlotLeaveConflict(member.memberId, s.date, s.half_day as 'morning' | 'afternoon');
                           return result.hasConflict;
                         });
                         
                         // Calculate position
                         const left = startCol * columnWidth + 4;
                         const width = spanCols * columnWidth - 8;
                         const top = row * (pillHeight + pillGap);
                         
                         // Duration in days
                         const durationDays = Math.ceil(slots.length / 2);
                         
                         return (
                           <Tooltip key={task.id}>
                             <TooltipTrigger asChild>
                               <div
                                 draggable
                                 onDragStart={(e) => handleTaskDragStart(e, task, slots)}
                                 onDragEnd={() => setDraggingTask(null)}
                                 onClick={() => onTaskClick(task, slots)}
                                 onMouseEnter={() => setHoveredTask(task.id)}
                                 onMouseLeave={() => setHoveredTask(null)}
                                 className={cn(
                                   "absolute rounded-lg cursor-pointer pointer-events-auto",
                                   "flex items-center gap-2 px-3 border-l-4",
                                   "text-xs font-medium shadow-sm",
                                   "transition-all duration-150",
                                   "hover:shadow-lg hover:z-20",
                                   statusStyle.bg,
                                   statusStyle.text,
                                   statusStyle.border,
                                   isHovered && "ring-2 ring-primary/30 z-20 scale-[1.02]",
                                   isDragging && "opacity-50 rotate-1 scale-105",
                                   hasConflict && "ring-2 ring-orange-400"
                                 )}
                                 style={{ 
                                   left, 
                                   width: Math.max(width, 80),
                                   top,
                                   height: pillHeight,
                                 }}
                               >
                                 {/* Priority dot */}
                                 <div className={cn("w-2 h-2 rounded-full shrink-0", priority.dot)} />
                                 
                                 {/* Conflict icon */}
                                 {hasConflict && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                                 
                                 {/* Title */}
                                 <span className="truncate flex-1 font-semibold">{task.title}</span>
                                 
                                 {/* Duration badge */}
                                 {durationDays >= 1 && (
                                   <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5 bg-background/50">
                                     <Clock className="h-3 w-3 mr-0.5" />
                                     {durationDays}j
                                   </Badge>
                                 )}
                                 
                                 {/* Drag handle (visible on hover) */}
                                 <GripVertical className={cn(
                                   "h-4 w-4 shrink-0 text-muted-foreground/50 transition-opacity",
                                   isHovered ? "opacity-100" : "opacity-0"
                                 )} />
                               </div>
                             </TooltipTrigger>
                             <TooltipContent side="top" className="max-w-xs p-3">
                               <div className="space-y-2">
                                 <div className="font-bold text-sm">{task.title}</div>
                                 {task.description && (
                                   <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                                 )}
                                 <div className="flex items-center gap-2 flex-wrap">
                                   <Badge variant="outline" className="text-[10px]">
                                     {getStatusLabel(task.status)}
                                   </Badge>
                                   <Badge className={cn("text-[10px]", priority.dot.replace('bg-', 'bg-'), "text-white")}>
                                     <Flag className="h-3 w-3 mr-1" />
                                     {priority.label}
                                   </Badge>
                                 </div>
                                 <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1 border-t">
                                   <Clock className="h-3 w-3" />
                                   {slots.length} créneaux • {durationDays} jour{durationDays > 1 ? 's' : ''}
                                 </div>
                                 {hasConflict && (
                                   <div className="text-orange-600 text-xs flex items-center gap-1 pt-1 border-t border-orange-200">
                                     <AlertTriangle className="h-3 w-3" />
                                     Conflit avec congé ou absence
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
       
       {/* Today indicator line */}
       {periodUnits.some(u => u.isToday) && (
         <div 
           className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none shadow-sm"
           style={{ 
             left: memberColumnWidth + (periodUnits.findIndex(u => u.isToday) * columnWidth) + (columnWidth / 2)
           }}
         />
       )}
     </div>
   );
 }