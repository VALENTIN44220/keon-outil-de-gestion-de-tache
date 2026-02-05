 import { useMemo, useState, useCallback } from 'react';
 import { 
   format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
   eachDayOfInterval, isSameMonth, isSameDay, isToday, isWeekend, getWeek
 } from 'date-fns';
 import { fr } from 'date-fns/locale';
 import { TeamMemberWorkload, WorkloadSlot, UserLeave, Holiday } from '@/types/workload';
 import { Task } from '@/types/task';
 import { OutlookEvent } from '@/hooks/useOutlookCalendar';
 import { cn } from '@/lib/utils';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { 
   AlertTriangle, 
   Palmtree, 
   Calendar as CalendarIcon,
   Clock,
   Users,
   User,
   ChevronRight,
   Plus,
   Flag,
 } from 'lucide-react';
 import { getStatusLabel } from '@/services/taskStatusService';
 
 // Status colors
 const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
   'todo': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-l-slate-400' },
   'to_assign': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300', border: 'border-l-amber-500' },
   'in-progress': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300', border: 'border-l-blue-500' },
   'pending-validation': { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-300', border: 'border-l-purple-500' },
   'validated': { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-800 dark:text-teal-300', border: 'border-l-teal-500' },
   'done': { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-300', border: 'border-l-green-500' },
   'blocked': { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-300', border: 'border-l-red-500' },
 };
 
 // Priority indicators
 const PRIORITY_DOTS: Record<string, string> = {
   'low': 'bg-slate-400',
   'medium': 'bg-amber-500',
   'high': 'bg-orange-500',
   'urgent': 'bg-red-500',
 };
 
 // User colors
 const USER_COLORS = [
   { bg: 'bg-cyan-500', ring: 'ring-cyan-300' },
   { bg: 'bg-emerald-500', ring: 'ring-emerald-300' },
   { bg: 'bg-amber-500', ring: 'ring-amber-300' },
   { bg: 'bg-rose-500', ring: 'ring-rose-300' },
   { bg: 'bg-violet-500', ring: 'ring-violet-300' },
   { bg: 'bg-blue-500', ring: 'ring-blue-300' },
   { bg: 'bg-orange-500', ring: 'ring-orange-300' },
   { bg: 'bg-pink-500', ring: 'ring-pink-300' },
 ];
 
 const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
 
 interface MonthPlanningGridProps {
   workloadData: TeamMemberWorkload[];
   currentMonth: Date;
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
   isCompact?: boolean;
 }
 
 interface DayTask {
   task: Task;
   slots: WorkloadSlot[];
   userId: string;
   userName: string;
   userAvatar?: string;
 }
 
 export function MonthPlanningGrid({
   workloadData = [],
   currentMonth,
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
   isCompact = false,
 }: MonthPlanningGridProps) {
   const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
   const [viewMode, setViewMode] = useState<'team' | 'individual'>('team');
   
   // Calculate calendar days (6 weeks to ensure full coverage)
   const calendarDays = useMemo(() => {
     const monthStart = startOfMonth(currentMonth);
     const monthEnd = endOfMonth(currentMonth);
     const calendarStart = startOfWeek(monthStart, { locale: fr });
     const calendarEnd = endOfWeek(monthEnd, { locale: fr });
     
     return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
   }, [currentMonth]);
   
   // Group days into weeks
   const weeks = useMemo(() => {
     const result: Date[][] = [];
     for (let i = 0; i < calendarDays.length; i += 7) {
       result.push(calendarDays.slice(i, i + 7));
     }
     return result;
   }, [calendarDays]);
   
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
   
   // Tasks by date (for all or selected members)
   const tasksByDate = useMemo(() => {
     const map = new Map<string, DayTask[]>();
     const filterMembers = selectedMembers.size > 0 ? selectedMembers : null;
     
     workloadData.forEach(member => {
       if (filterMembers && !filterMembers.has(member.memberId)) return;
       
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
       
       // Add to date map
       taskMap.forEach(({ task, slots }) => {
         slots.forEach(slot => {
           const dateKey = slot.date;
           if (!map.has(dateKey)) {
             map.set(dateKey, []);
           }
           // Check if this task is already added for this date
           const existing = map.get(dateKey)!.find(dt => dt.task.id === task.id && dt.userId === member.memberId);
           if (!existing) {
             map.get(dateKey)!.push({
               task,
               slots,
               userId: member.memberId,
               userName: member.memberName,
               userAvatar: member.avatarUrl,
             });
           }
         });
       });
     });
     
     return map;
   }, [workloadData, slotsByUser, tasks, selectedMembers]);
   
   // Leaves by user and date
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
         const current = new Date(start);
         while (current <= end) {
           map.get(leave.user_id)!.add(format(current, 'yyyy-MM-dd'));
           current.setDate(current.getDate() + 1);
         }
       } catch { /* skip */ }
     });
     return map;
   }, [leaves]);
   
   // Holidays by date
   const holidaysByDate = useMemo(() => {
     const map = new Map<string, Holiday>();
     holidays.forEach(h => map.set(h.date, h));
     return map;
   }, [holidays]);
   
   // Outlook events by date
   const outlookByDate = useMemo(() => {
     const map = new Map<string, OutlookEvent[]>();
     outlookEvents.forEach(event => {
       const dateKey = event.start_time.split('T')[0];
       if (!map.has(dateKey)) {
         map.set(dateKey, []);
       }
       map.get(dateKey)!.push(event);
     });
     return map;
   }, [outlookEvents]);
   
   // Check if any selected member has leave on a date
   const hasLeaveOnDate = useCallback((dateStr: string) => {
     const filterMembers = selectedMembers.size > 0 ? selectedMembers : new Set(workloadData.map(m => m.memberId));
     for (const memberId of filterMembers) {
       if (leavesByUserDate.get(memberId)?.has(dateStr)) return true;
     }
     return false;
   }, [selectedMembers, workloadData, leavesByUserDate]);
   
   const getInitials = (name: string) => {
     return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
   };
   
   const toggleMember = (memberId: string) => {
     setSelectedMembers(prev => {
       const next = new Set(prev);
       if (next.has(memberId)) {
         next.delete(memberId);
       } else {
         next.add(memberId);
       }
       return next;
     });
   };
   
   const selectAll = () => {
     setSelectedMembers(new Set(workloadData.map(m => m.memberId)));
   };
   
   const selectNone = () => {
     setSelectedMembers(new Set());
   };
   
   const handleDrop = async (e: React.DragEvent, date: string) => {
     e.preventDefault();
     const taskId = e.dataTransfer.getData('taskId');
     const duration = parseInt(e.dataTransfer.getData('duration') || '2', 10);
     
     if (taskId) {
       // If only one member selected, assign to them
       const targetUserId = selectedMembers.size === 1 
         ? Array.from(selectedMembers)[0] 
         : workloadData[0]?.memberId;
       
       if (targetUserId) {
         await onSlotDrop(taskId, targetUserId, date, 'morning', duration);
       }
     }
     onDragLeave();
   };
   
   const maxTasksPerDay = isCompact ? 2 : 3;
 
   return (
     <div className="flex-1 flex overflow-hidden">
       {/* Left sidebar - Member selection */}
       <div className="w-56 shrink-0 border-r bg-muted/20 flex flex-col">
         <div className="p-3 border-b bg-muted/40">
           <div className="flex items-center justify-between mb-2">
             <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
               Collaborateurs
             </span>
             <Badge variant="outline" className="text-[10px]">
               {selectedMembers.size || 'Tous'}
             </Badge>
           </div>
           <div className="flex gap-1">
             <Button 
               variant={selectedMembers.size === 0 ? "default" : "outline"} 
               size="sm" 
               className="flex-1 h-7 text-xs"
               onClick={selectNone}
             >
               <Users className="h-3 w-3 mr-1" />
               Tous
             </Button>
             <Button 
               variant="outline" 
               size="sm" 
               className="flex-1 h-7 text-xs"
               onClick={selectAll}
             >
               Sélect. tout
             </Button>
           </div>
         </div>
         
         <ScrollArea className="flex-1">
           <div className="p-2 space-y-1">
             {workloadData.map((member) => {
               const isSelected = selectedMembers.has(member.memberId);
               const color = userColorMap.get(member.memberId) || USER_COLORS[0];
               
               return (
                 <button
                   key={member.memberId}
                   onClick={() => toggleMember(member.memberId)}
                   className={cn(
                     "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all",
                     isSelected 
                       ? "bg-primary/10 ring-1 ring-primary/30" 
                       : "hover:bg-muted/60"
                   )}
                 >
                   <Checkbox 
                     checked={isSelected} 
                     className="pointer-events-none"
                   />
                   <Avatar className={cn("h-7 w-7 shrink-0", isSelected && "ring-2", color.ring)}>
                     <AvatarImage src={member.avatarUrl || undefined} />
                     <AvatarFallback className={cn("text-[10px] font-bold text-white", color.bg)}>
                       {getInitials(member.memberName)}
                     </AvatarFallback>
                   </Avatar>
                   <div className="flex-1 min-w-0">
                     <div className="text-xs font-medium truncate">{member.memberName}</div>
                     <div className="text-[10px] text-muted-foreground truncate">{member.department}</div>
                   </div>
                 </button>
               );
             })}
           </div>
         </ScrollArea>
       </div>
       
       {/* Main calendar grid */}
       <div className="flex-1 flex flex-col overflow-hidden">
         {/* Day headers */}
         <div className="grid grid-cols-7 border-b bg-muted/40">
           {DAY_NAMES.map((day, idx) => (
             <div 
               key={day} 
               className={cn(
                 "py-2 text-center text-xs font-bold uppercase tracking-wide border-r last:border-r-0",
                 idx >= 5 && "text-muted-foreground bg-muted/60"
               )}
             >
               {day}
             </div>
           ))}
         </div>
         
         {/* Calendar weeks */}
         <div className="flex-1 overflow-auto">
           {weeks.map((week, weekIdx) => (
             <div key={weekIdx} className="grid grid-cols-7 border-b last:border-b-0" style={{ minHeight: isCompact ? 100 : 130 }}>
               {week.map((day) => {
                 const dateStr = format(day, 'yyyy-MM-dd');
                 const isCurrentMonth = isSameMonth(day, currentMonth);
                 const isTodayDate = isToday(day);
                 const isWeekendDay = isWeekend(day);
                 const holiday = holidaysByDate.get(dateStr);
                 const hasLeave = hasLeaveOnDate(dateStr);
                 const dayTasks = tasksByDate.get(dateStr) || [];
                 const outlookEvts = outlookByDate.get(dateStr) || [];
                 const isDropTargetCell = dropTarget?.date === dateStr;
                 const visibleTasks = dayTasks.slice(0, maxTasksPerDay);
                 const hiddenCount = dayTasks.length - maxTasksPerDay;
                 
                 return (
                   <div
                     key={dateStr}
                     className={cn(
                       "border-r last:border-r-0 flex flex-col relative",
                       !isCurrentMonth && "bg-muted/30",
                       isWeekendDay && isCurrentMonth && "bg-muted/20",
                       isTodayDate && "bg-primary/5",
                       holiday && "bg-amber-50/60 dark:bg-amber-900/20",
                       hasLeave && "bg-violet-50/60 dark:bg-violet-900/20",
                       isDropTargetCell && "bg-primary/20 ring-2 ring-primary ring-inset"
                     )}
                     onDragOver={(e) => {
                       e.preventDefault();
                       if (!holiday) {
                         onDragOver('', dateStr, 'morning');
                       }
                     }}
                     onDragLeave={onDragLeave}
                     onDrop={(e) => handleDrop(e, dateStr)}
                   >
                     {/* Day header */}
                     <div className={cn(
                       "flex items-center justify-between px-2 py-1 text-xs",
                       !isCurrentMonth && "text-muted-foreground"
                     )}>
                       <span className={cn(
                         "font-semibold",
                         isTodayDate && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                       )}>
                         {format(day, 'd')}
                       </span>
                       
                       {/* Indicators */}
                       <div className="flex items-center gap-1">
                         {holiday && (
                           <Tooltip>
                             <TooltipTrigger>
                               <span className="text-[10px]">🎉</span>
                             </TooltipTrigger>
                             <TooltipContent side="top">
                               <span className="text-xs font-medium">{holiday.name}</span>
                             </TooltipContent>
                           </Tooltip>
                         )}
                         {hasLeave && (
                           <Tooltip>
                             <TooltipTrigger>
                               <Palmtree className="h-3 w-3 text-violet-500" />
                             </TooltipTrigger>
                             <TooltipContent side="top">
                               <span className="text-xs">Congé</span>
                             </TooltipContent>
                           </Tooltip>
                         )}
                         {showOutlookEvents && outlookEvts.length > 0 && (
                           <Tooltip>
                             <TooltipTrigger>
                               <CalendarIcon className="h-3 w-3 text-slate-400" />
                             </TooltipTrigger>
                             <TooltipContent side="top" className="max-w-[200px]">
                               <div className="text-xs space-y-1">
                                 <div className="font-semibold">Événements Outlook</div>
                                 {outlookEvts.slice(0, 3).map((evt, i) => (
                                   <div key={i} className="truncate text-muted-foreground">{evt.subject}</div>
                                 ))}
                               </div>
                             </TooltipContent>
                           </Tooltip>
                         )}
                       </div>
                     </div>
                     
                     {/* Task pills */}
                     <div className="flex-1 px-1 pb-1 space-y-0.5 overflow-hidden">
                       {visibleTasks.map((dayTask) => {
                         const { task, slots, userId, userName, userAvatar } = dayTask;
                         const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS['todo'];
                         const priorityDot = PRIORITY_DOTS[task.priority] || PRIORITY_DOTS['medium'];
                         const userColor = userColorMap.get(userId) || USER_COLORS[0];
                         
                         return (
                           <Tooltip key={`${task.id}-${userId}`}>
                             <TooltipTrigger asChild>
                               <div
                                 draggable
                                 onDragStart={(e) => {
                                   e.dataTransfer.setData('taskId', task.id);
                                   e.dataTransfer.setData('duration', String(slots.length));
                                 }}
                                 onClick={() => onTaskClick(task, slots)}
                                 className={cn(
                                   "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] cursor-pointer",
                                   "border-l-2 transition-all hover:shadow-md hover:scale-[1.02]",
                                   statusStyle.bg,
                                   statusStyle.text,
                                   statusStyle.border
                                 )}
                               >
                                 {/* Priority dot */}
                                 <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityDot)} />
                                 
                                 {/* Title */}
                                 <span className="truncate flex-1 font-medium">{task.title}</span>
                                 
                                 {/* User avatar (team view) */}
                                 {selectedMembers.size !== 1 && (
                                   <Avatar className={cn("h-4 w-4 shrink-0 ring-1", userColor.ring)}>
                                     <AvatarImage src={userAvatar} />
                                     <AvatarFallback className={cn("text-[6px] text-white", userColor.bg)}>
                                       {getInitials(userName)}
                                     </AvatarFallback>
                                   </Avatar>
                                 )}
                               </div>
                             </TooltipTrigger>
                             <TooltipContent side="right" className="max-w-xs p-3">
                               <div className="space-y-2">
                                 <div className="font-bold text-sm">{task.title}</div>
                                 <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                   <User className="h-3 w-3" />
                                   {userName}
                                 </div>
                                 <div className="flex items-center gap-2 flex-wrap">
                                   <Badge variant="outline" className="text-[10px]">
                                     {getStatusLabel(task.status)}
                                   </Badge>
                                   <Badge className={cn("text-[10px] text-white", priorityDot)}>
                                     <Flag className="h-3 w-3 mr-1" />
                                     {task.priority}
                                   </Badge>
                                 </div>
                               </div>
                             </TooltipContent>
                           </Tooltip>
                         );
                       })}
                       
                       {/* "+N more" button */}
                       {hiddenCount > 0 && (
                         <Popover>
                           <PopoverTrigger asChild>
                             <button className="w-full text-[10px] font-medium text-primary hover:bg-primary/10 rounded px-1.5 py-0.5 flex items-center justify-center gap-1">
                               <Plus className="h-3 w-3" />
                               {hiddenCount} autres
                               <ChevronRight className="h-3 w-3" />
                             </button>
                           </PopoverTrigger>
                           <PopoverContent side="right" className="w-72 p-0">
                             <div className="p-2 border-b bg-muted/30">
                               <div className="font-semibold text-sm">
                                 {format(day, 'EEEE d MMMM', { locale: fr })}
                               </div>
                               <div className="text-xs text-muted-foreground">
                                 {dayTasks.length} tâche{dayTasks.length > 1 ? 's' : ''}
                               </div>
                             </div>
                             <ScrollArea className="max-h-64">
                               <div className="p-2 space-y-1">
                                 {dayTasks.map((dayTask) => {
                                   const { task, slots, userId, userName, userAvatar } = dayTask;
                                   const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS['todo'];
                                   const priorityDot = PRIORITY_DOTS[task.priority] || PRIORITY_DOTS['medium'];
                                   const userColor = userColorMap.get(userId) || USER_COLORS[0];
                                   
                                   return (
                                     <div
                                       key={`${task.id}-${userId}`}
                                       onClick={() => onTaskClick(task, slots)}
                                       className={cn(
                                         "flex items-center gap-2 p-2 rounded-lg cursor-pointer",
                                         "border-l-2 transition-all hover:shadow-md",
                                         statusStyle.bg,
                                         statusStyle.text,
                                         statusStyle.border
                                       )}
                                     >
                                       <div className={cn("w-2 h-2 rounded-full shrink-0", priorityDot)} />
                                       <div className="flex-1 min-w-0">
                                         <div className="text-xs font-medium truncate">{task.title}</div>
                                         <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                           <Clock className="h-3 w-3" />
                                           {getStatusLabel(task.status)}
                                         </div>
                                       </div>
                                       <Avatar className={cn("h-5 w-5 shrink-0", userColor.ring)}>
                                         <AvatarImage src={userAvatar} />
                                         <AvatarFallback className={cn("text-[8px] text-white", userColor.bg)}>
                                           {getInitials(userName)}
                                         </AvatarFallback>
                                       </Avatar>
                                     </div>
                                   );
                                 })}
                               </div>
                             </ScrollArea>
                           </PopoverContent>
                         </Popover>
                       )}
                     </div>
                   </div>
                 );
               })}
             </div>
           ))}
         </div>
       </div>
     </div>
   );
 }