 import { useMemo, useCallback, useState } from 'react';
import { format, parseISO, isWeekend, isToday, eachDayOfInterval, isSameDay, getWeek } from 'date-fns';
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
 import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, Plus, User } from 'lucide-react';
 import { getStatusLabel, getStatusColor } from '@/services/taskStatusService';
 
 // Color palette for collaborators
 const USER_COLORS = [
   { bg: 'bg-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-900/40', border: 'border-cyan-400' },
   { bg: 'bg-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-400' },
   { bg: 'bg-amber-500', light: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-400' },
   { bg: 'bg-rose-500', light: 'bg-rose-100 dark:bg-rose-900/40', border: 'border-rose-400' },
   { bg: 'bg-violet-500', light: 'bg-violet-100 dark:bg-violet-900/40', border: 'border-violet-400' },
   { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-400' },
   { bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-400' },
   { bg: 'bg-pink-500', light: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-400' },
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
   viewMode: 'week' | 'month' | 'quarter' | 'year';
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
   workloadData,
   startDate,
   endDate,
   tasks,
   holidays,
   leaves,
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
 
  const days = useMemo(() => {
    if (!startDate || !endDate) return [];
    try {
      return eachDayOfInterval({ start: startDate, end: endDate });
    } catch {
      return [];
    }
  }, [startDate, endDate]);
   
   const dayWidth = useMemo(() => {
     switch (viewMode) {
       case 'week': return 120;
       case 'month': return 80;
       case 'quarter': return 40;
       case 'year': return 24;
       default: return 80;
     }
   }, [viewMode]);
 
   const rowHeight = isCompact ? 60 : 80;
   const memberColumnWidth = isCompact ? 180 : 220;
 
   // User color map
   const userColorMap = useMemo(() => {
     const map = new Map<string, typeof USER_COLORS[0]>();
    (workloadData || []).forEach((member, index) => {
       map.set(member.memberId, USER_COLORS[index % USER_COLORS.length]);
     });
     return map;
   }, [workloadData]);
 
   // All slots grouped by user
   const slotsByUser = useMemo(() => {
     const map = new Map<string, WorkloadSlot[]>();
    (workloadData || []).forEach(member => {
       const userSlots: WorkloadSlot[] = [];
      (member.days || []).forEach(day => {
         if (day.morning.slot) userSlots.push(day.morning.slot);
         if (day.afternoon.slot) userSlots.push(day.afternoon.slot);
       });
       map.set(member.memberId, userSlots);
     });
     return map;
   }, [workloadData]);
 
   // Tasks grouped by user with their slots
   const tasksByUser = useMemo(() => {
     const map = new Map<string, { task: Task; slots: WorkloadSlot[]; startDate: string; endDate: string }[]>();
     
    (workloadData || []).forEach(member => {
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
       
       // Calculate date ranges for each task
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
 
   // Leaves by user and date
   const leavesByUserDate = useMemo(() => {
     const map = new Map<string, Set<string>>();
    (leaves || []).forEach(leave => {
       if (leave.status === 'cancelled') return;
       const start = parseISO(leave.start_date);
       const end = parseISO(leave.end_date);
       const leaveDays = eachDayOfInterval({ start, end });
       
       if (!map.has(leave.user_id)) {
         map.set(leave.user_id, new Set());
       }
       leaveDays.forEach(day => {
         map.get(leave.user_id)!.add(format(day, 'yyyy-MM-dd'));
       });
     });
     return map;
   }, [leaves]);
 
   // Holidays by date
   const holidaysByDate = useMemo(() => {
     const map = new Map<string, Holiday>();
    (holidays || []).forEach(h => map.set(h.date, h));
     return map;
   }, [holidays]);
 
   // Outlook events by user and date
   const outlookByUserDate = useMemo(() => {
     const map = new Map<string, Map<string, OutlookEvent[]>>();
    (outlookEvents || []).forEach(event => {
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
 
   const getPriorityGradient = (priority: string) => {
     switch (priority) {
       case 'urgent': return 'from-red-500 to-rose-400';
       case 'high': return 'from-orange-500 to-amber-400';
       case 'medium': return 'from-blue-500 to-indigo-400';
       case 'low': return 'from-emerald-500 to-teal-400';
       default: return 'from-slate-500 to-slate-400';
     }
   };
 
   const getPeriodLabel = () => {
    if (!startDate || !endDate) return '';
     switch (viewMode) {
       case 'week':
         return `Semaine ${getWeek(startDate, { locale: fr })} - ${format(startDate, 'MMMM yyyy', { locale: fr })}`;
       case 'quarter':
         return `${format(startDate, 'MMM', { locale: fr })} - ${format(endDate, 'MMM yyyy', { locale: fr })}`;
       case 'year':
         return format(startDate, 'yyyy');
       default:
         return format(startDate, 'MMMM yyyy', { locale: fr });
     }
   };
 
   // Calculate task bar position and width
   const getTaskBarStyle = useCallback((startDateStr: string, endDateStr: string) => {
     const taskStart = parseISO(startDateStr);
     const taskEnd = parseISO(endDateStr);
     
     // Find the day index for start and end
     let startIdx = days.findIndex(d => isSameDay(d, taskStart));
     let endIdx = days.findIndex(d => isSameDay(d, taskEnd));
     
     // If task starts before visible range
     if (startIdx === -1 && taskStart < days[0]) {
       startIdx = 0;
     }
     // If task ends after visible range
     if (endIdx === -1 && taskEnd > days[days.length - 1]) {
       endIdx = days.length - 1;
     }
     
     if (startIdx === -1 || endIdx === -1) return null;
     
     const left = startIdx * dayWidth + 4;
     const width = (endIdx - startIdx + 1) * dayWidth - 8;
     
     return { left, width };
   }, [days, dayWidth]);
 
   const handleDrop = async (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
     e.preventDefault();
     const taskId = e.dataTransfer.getData('taskId');
     const duration = parseInt(e.dataTransfer.getData('duration') || '2', 10);
     
     if (taskId) {
       await onSlotDrop(taskId, userId, date, halfDay, duration);
     }
     onDragLeave();
   };
 
   return (
     <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden">
       {/* Header with navigation */}
       <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
         <div className="flex items-center gap-2">
           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate('prev')}>
             <ChevronLeft className="h-4 w-4" />
           </Button>
           <Button variant="outline" size="sm" className="h-8" onClick={onToday}>
             Aujourd'hui
           </Button>
           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate('next')}>
             <ChevronRight className="h-4 w-4" />
           </Button>
         </div>
         
         <h3 className="font-semibold capitalize">{getPeriodLabel()}</h3>
         
         <div className="w-24" /> {/* Spacer for alignment */}
       </div>
 
       {/* Grid container */}
       <div className="flex-1 overflow-hidden">
         <ScrollArea className="h-full">
           <div className="flex">
             {/* Fixed member column */}
             <div className="shrink-0 border-r bg-muted/20" style={{ width: memberColumnWidth }}>
               {/* Header spacer */}
               <div className="h-12 border-b bg-muted/30 flex items-center px-3">
                 <span className="text-xs font-medium text-muted-foreground">Collaborateurs</span>
               </div>
               
               {/* Member rows */}
                {(workloadData || []).map(member => {
                 const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
                 const capacityPercent = available > 0 ? Math.round((member.usedSlots / available) * 100) : 0;
                 const isOverloaded = capacityPercent > 100;
                 const color = userColorMap.get(member.memberId) || USER_COLORS[0];
                 
                 return (
                   <div
                     key={member.memberId}
                     className="flex items-center gap-2 px-3 border-b hover:bg-muted/30 transition-colors"
                     style={{ height: rowHeight }}
                   >
                     <div className={cn("w-1 h-8 rounded-full", color.bg)} />
                     <Avatar className="h-8 w-8 shrink-0">
                       <AvatarImage src={member.avatarUrl || undefined} />
                       <AvatarFallback className={cn("text-xs", color.bg, "text-white")}>
                         {getInitials(member.memberName)}
                       </AvatarFallback>
                     </Avatar>
                     <div className="flex-1 min-w-0">
                       <div className="text-sm font-medium truncate">{member.memberName}</div>
                       <div className="flex items-center gap-1.5 mt-0.5">
                         <Progress 
                           value={Math.min(capacityPercent, 100)} 
                           className={cn("h-1.5 flex-1", isOverloaded && "[&>div]:bg-red-500")}
                         />
                         <span className={cn(
                           "text-[10px] tabular-nums font-medium",
                           isOverloaded ? "text-red-600" : "text-muted-foreground"
                         )}>
                           {capacityPercent}%
                         </span>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
 
             {/* Scrollable calendar grid */}
             <div className="flex-1 overflow-x-auto">
               <div style={{ minWidth: days.length * dayWidth }}>
                 {/* Day headers */}
                 <div className="flex h-12 border-b bg-muted/30 sticky top-0 z-10">
                   {days.map((day, idx) => {
                     const isWeekendDay = isWeekend(day);
                     const isTodayDay = isToday(day);
                     const holiday = holidaysByDate.get(format(day, 'yyyy-MM-dd'));
                     
                     return (
                       <div
                         key={idx}
                         className={cn(
                           "flex flex-col items-center justify-center border-r text-xs",
                           isWeekendDay && "bg-muted/50",
                           isTodayDay && "bg-primary/10",
                           holiday && "bg-amber-50 dark:bg-amber-900/20"
                         )}
                         style={{ width: dayWidth }}
                       >
                         <span className={cn(
                           "font-medium",
                           isTodayDay && "text-primary"
                         )}>
                           {format(day, viewMode === 'year' ? 'd' : 'EEE', { locale: fr })}
                         </span>
                         <span className={cn(
                           "text-muted-foreground",
                           isTodayDay && "text-primary font-semibold"
                         )}>
                           {format(day, viewMode === 'year' ? '' : 'd MMM', { locale: fr })}
                         </span>
                       </div>
                     );
                   })}
                 </div>
 
                 {/* Member timeline rows */}
              {(workloadData || []).map(member => {
                   const userTasks = tasksByUser.get(member.memberId) || [];
                   const userLeaves = leavesByUserDate.get(member.memberId) || new Set();
                   const userOutlook = outlookByUserDate.get(member.memberId) || new Map();
                   const color = userColorMap.get(member.memberId) || USER_COLORS[0];
                   
                   return (
                     <div
                       key={member.memberId}
                       className="flex relative border-b"
                       style={{ height: rowHeight }}
                     >
                       {/* Day cells */}
                       {days.map((day, dayIdx) => {
                         const dateStr = format(day, 'yyyy-MM-dd');
                         const isWeekendDay = isWeekend(day);
                         const isTodayDay = isToday(day);
                         const holiday = holidaysByDate.get(dateStr);
                         const isOnLeave = userLeaves.has(dateStr);
                         const outlookEvts = userOutlook.get(dateStr) || [];
                         const isDropTarget = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr;
                         
                         return (
                           <div
                             key={dayIdx}
                             className={cn(
                               "border-r relative",
                               isWeekendDay && "bg-muted/30",
                               isTodayDay && "bg-primary/5",
                               holiday && "bg-amber-50/50 dark:bg-amber-900/10",
                               isOnLeave && "bg-purple-50/50 dark:bg-purple-900/10",
                               isDropTarget && "bg-primary/20 ring-2 ring-primary ring-inset"
                             )}
                             style={{ width: dayWidth }}
                             onDragOver={(e) => {
                               e.preventDefault();
                               if (!isWeekendDay && !holiday) {
                                 onDragOver(member.memberId, dateStr, 'morning');
                               }
                             }}
                             onDragLeave={onDragLeave}
                             onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'morning')}
                           >
                             {/* Leave overlay */}
                             {isOnLeave && (
                               <div className="absolute inset-0 flex items-center justify-center">
                                 <span className="text-[10px] text-purple-600 font-medium px-1 bg-purple-100 rounded">
                                   Congé
                                 </span>
                               </div>
                             )}
                             
                             {/* Outlook events overlay */}
                             {showOutlookEvents && outlookEvts.length > 0 && !isOnLeave && (
                               <div className="absolute bottom-1 left-1 right-1">
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <div className="h-1.5 bg-slate-400/50 rounded-full" />
                                   </TooltipTrigger>
                                   <TooltipContent>
                                     <div className="text-xs space-y-1">
                                       {outlookEvts.map((evt, i) => (
                                         <div key={i}>{evt.subject}</div>
                                       ))}
                                     </div>
                                   </TooltipContent>
                                 </Tooltip>
                               </div>
                             )}
                           </div>
                         );
                       })}
 
                       {/* Task bars overlay */}
                       <div className="absolute inset-0 pointer-events-none">
                         {userTasks.map(({ task, slots, startDate, endDate }) => {
                           const style = getTaskBarStyle(startDate, endDate);
                           if (!style) return null;
                           
                           const isHovered = hoveredTask === task.id;
                           const statusColor = getStatusColor(task.status);
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
                                     "absolute top-2 h-[calc(100%-16px)] rounded-lg cursor-pointer pointer-events-auto",
                                     "bg-gradient-to-r shadow-sm border",
                                     getPriorityGradient(task.priority),
                                     "text-white text-xs font-medium",
                                     "flex items-center gap-1 px-2 overflow-hidden",
                                     "hover:shadow-md hover:scale-[1.02] transition-all",
                                     isHovered && "ring-2 ring-white/50",
                                     hasConflict && "ring-2 ring-orange-400"
                                   )}
                                   style={{ left: style.left, width: style.width }}
                                   onClick={() => onTaskClick(task, slots)}
                                   onMouseEnter={() => setHoveredTask(task.id)}
                                   onMouseLeave={() => setHoveredTask(null)}
                                 >
                                   {hasConflict && <AlertTriangle className="h-3 w-3 shrink-0" />}
                                   <span className="truncate">{task.title}</span>
                                 </div>
                               </TooltipTrigger>
                               <TooltipContent side="top" className="max-w-xs">
                                 <div className="space-y-1">
                                   <div className="font-semibold">{task.title}</div>
                                   <div className="text-xs text-muted-foreground">
                                     {format(parseISO(startDate), 'd MMM', { locale: fr })} - {format(parseISO(endDate), 'd MMM', { locale: fr })}
                                   </div>
                                   <div className="flex items-center gap-2 text-xs">
                                     <Badge variant="outline" className="text-[10px]">
                                       {getStatusLabel(task.status)}
                                     </Badge>
                                     <span className="capitalize">{task.priority}</span>
                                   </div>
                                   {hasConflict && (
                                     <div className="text-orange-600 text-xs flex items-center gap-1">
                                       <AlertTriangle className="h-3 w-3" />
                                       Conflit avec congé
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
       </div>
     </div>
   );
 }