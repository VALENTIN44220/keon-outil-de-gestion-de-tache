 import { useState, useMemo, useCallback } from 'react';
 import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, addYears, startOfYear, endOfYear } from 'date-fns';
 import { fr } from 'date-fns/locale';
 import { TeamMemberWorkload, WorkloadSlot, Holiday, UserLeave } from '@/types/workload';
 import { Task } from '@/types/task';
 import { OutlookEvent } from '@/hooks/useOutlookCalendar';
 import { TooltipProvider } from '@/components/ui/tooltip';
 import { Button } from '@/components/ui/button';
 import { Switch } from '@/components/ui/switch';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { Input } from '@/components/ui/input';
 import { 
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
   DropdownMenuSeparator,
 } from '@/components/ui/dropdown-menu';
 import { cn } from '@/lib/utils';
 import { Search, Calendar, Settings2, Maximize2, Minimize2, Eye, EyeOff, CheckSquare } from 'lucide-react';
 import { PlanningKPIs } from './PlanningKPIs';
 import { BacklogSidebar } from './BacklogSidebar';
 import { PlanningCalendarGrid } from './PlanningCalendarGrid';
 import { UnifiedTaskDrawer, DrawerItem } from '../UnifiedTaskDrawer';
 import { toast } from 'sonner';
 
 interface PlanningCalendarViewProps {
   workloadData: TeamMemberWorkload[];
   startDate: Date;
   endDate: Date;
   tasks: Task[];
   holidays: Holiday[];
   leaves: UserLeave[];
   outlookEvents?: OutlookEvent[];
   viewMode: 'week' | 'month' | 'quarter' | 'year';
   onNavigate: (direction: 'prev' | 'next') => void;
   onToday: () => void;
   onSlotAdd: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon') => Promise<void>;
   onMultiSlotAdd?: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', count: number) => Promise<void>;
   onReassignTask?: (taskId: string, fromUserId: string, toUserId: string, newStartDate: string) => Promise<void>;
   isHalfDayAvailable?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
   checkSlotLeaveConflict?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => { hasConflict: boolean; leaveType?: string };
   getTaskDuration?: (taskId: string) => number | null;
   getTaskProgress?: (taskId: string) => { completed: number; total: number } | null;
   plannedTaskIds: string[];
   onTaskUpdated?: () => void;
   searchQuery?: string;
   onSearchChange?: (query: string) => void;
 }
 
 export function PlanningCalendarView({
  workloadData = [],
   startDate,
   endDate,
  tasks = [],
  holidays = [],
  leaves = [],
   outlookEvents = [],
   viewMode,
   onNavigate,
   onToday,
   onSlotAdd,
   onMultiSlotAdd,
   onReassignTask,
   isHalfDayAvailable,
   checkSlotLeaveConflict,
   getTaskDuration,
   getTaskProgress,
   plannedTaskIds,
   onTaskUpdated,
   searchQuery = '',
   onSearchChange,
 }: PlanningCalendarViewProps) {
   // UI state
   const [isBacklogCollapsed, setIsBacklogCollapsed] = useState(false);
   const [showOutlookEvents, setShowOutlookEvents] = useState(true);
   const [isCompact, setIsCompact] = useState(false);
   const [draggedTask, setDraggedTask] = useState<Task | null>(null);
   const [dropTarget, setDropTarget] = useState<{ userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null>(null);
   
   // Selection state
   const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
   
   // Drawer state
   const [drawerItem, setDrawerItem] = useState<DrawerItem | null>(null);
   const [isDrawerOpen, setIsDrawerOpen] = useState(false);
 
   // Calculate conflict count
   const conflictCount = useMemo(() => {
     if (!checkSlotLeaveConflict) return 0;
     
     let count = 0;
    (workloadData || []).forEach(member => {
      (member.days || []).forEach(day => {
         if (day.morning.slot) {
           const result = checkSlotLeaveConflict(member.memberId, day.date, 'morning');
           if (result.hasConflict) count++;
         }
         if (day.afternoon.slot) {
           const result = checkSlotLeaveConflict(member.memberId, day.date, 'afternoon');
           if (result.hasConflict) count++;
         }
       });
     });
     return count;
   }, [workloadData, checkSlotLeaveConflict]);
 
   // Drag handlers
   const handleTaskDragStart = useCallback((e: React.DragEvent, task: Task) => {
     setDraggedTask(task);
     e.dataTransfer.effectAllowed = 'copy';
     e.dataTransfer.setData('taskId', task.id);
     const duration = getTaskDuration?.(task.id) ?? 2;
     e.dataTransfer.setData('duration', String(duration));
   }, [getTaskDuration]);
 
   const handleDragOver = useCallback((userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
     setDropTarget({ userId, date, halfDay });
   }, []);
 
   const handleDragLeave = useCallback(() => {
     setDropTarget(null);
   }, []);
 
   const handleSlotDrop = useCallback(async (
     taskId: string, 
     userId: string, 
     date: string, 
     halfDay: 'morning' | 'afternoon',
     duration: number
   ) => {
     try {
       if (duration > 1 && onMultiSlotAdd) {
         await onMultiSlotAdd(taskId, userId, date, halfDay, duration);
       } else {
         await onSlotAdd(taskId, userId, date, halfDay);
       }
       const task = tasks.find(t => t.id === taskId);
       toast.success(`Tâche "${task?.title}" planifiée`);
       setDraggedTask(null);
     } catch (error: any) {
       if (error.code === '23505') {
         toast.error('Ce créneau est déjà occupé');
       } else {
         toast.error('Erreur lors de la planification');
       }
     }
   }, [tasks, onSlotAdd, onMultiSlotAdd]);
 
   // Task click handler
   const handleTaskClick = useCallback((task: Task, slots: WorkloadSlot[]) => {
     setDrawerItem({ type: 'task', task, slots });
     setIsDrawerOpen(true);
   }, []);
 
   // Selection handlers
   const handleTaskSelect = useCallback((taskId: string, selected: boolean) => {
     setSelectedTasks(prev => {
       const next = new Set(prev);
       if (selected) {
         next.add(taskId);
       } else {
         next.delete(taskId);
       }
       return next;
     });
   }, []);
 
   const handleSelectAll = useCallback(() => {
    const availableTasks = (tasks || []).filter(t => 
       t.status !== 'done' && 
       t.status !== 'validated' && 
      !(plannedTaskIds || []).includes(t.id)
     );
     setSelectedTasks(new Set(availableTasks.map(t => t.id)));
   }, [tasks, plannedTaskIds]);
 
   const handleClearSelection = useCallback(() => {
     setSelectedTasks(new Set());
   }, []);
 
   return (
     <TooltipProvider>
       <div className="flex flex-col h-full gap-4">
         {/* Header row with KPIs and controls */}
         <div className="flex items-center justify-between gap-4 flex-wrap">
           <PlanningKPIs
             workloadData={workloadData}
             tasks={tasks}
             plannedTaskIds={plannedTaskIds}
             conflictCount={conflictCount}
           />
           
           <div className="flex items-center gap-3">
             {/* Search */}
             {onSearchChange && (
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="Rechercher..."
                   value={searchQuery}
                   onChange={(e) => onSearchChange(e.target.value)}
                   className="pl-9 h-9 w-48"
                 />
               </div>
             )}
             
             {/* Display options */}
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="sm" className="h-9 gap-2">
                   <Settings2 className="h-4 w-4" />
                   <span className="hidden sm:inline">Affichage</span>
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56">
                 <div className="p-2">
                   <div className="flex items-center justify-between">
                     <Label className="text-sm">Mode compact</Label>
                     <Switch
                       checked={isCompact}
                       onCheckedChange={setIsCompact}
                     />
                   </div>
                 </div>
                 <DropdownMenuSeparator />
                 <div className="p-2">
                   <div className="flex items-center justify-between">
                     <Label className="text-sm">Calendriers Outlook</Label>
                     <Switch
                       checked={showOutlookEvents}
                       onCheckedChange={setShowOutlookEvents}
                       disabled={outlookEvents.length === 0}
                     />
                   </div>
                   {outlookEvents.length === 0 && (
                     <p className="text-xs text-muted-foreground mt-1">
                       Aucune synchronisation active
                     </p>
                   )}
                 </div>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={() => setIsBacklogCollapsed(!isBacklogCollapsed)}>
                   {isBacklogCollapsed ? (
                     <>
                       <Maximize2 className="h-4 w-4 mr-2" />
                       Afficher le backlog
                     </>
                   ) : (
                     <>
                       <Minimize2 className="h-4 w-4 mr-2" />
                       Masquer le backlog
                     </>
                   )}
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
           </div>
         </div>
 
         {/* Main content: Backlog + Calendar Grid */}
         <div className="flex-1 flex gap-4 min-h-0">
           {/* Backlog Sidebar */}
           <BacklogSidebar
             tasks={tasks}
             plannedTaskIds={plannedTaskIds}
             onTaskDragStart={handleTaskDragStart}
             getTaskDuration={getTaskDuration}
             getTaskProgress={getTaskProgress}
             isCollapsed={isBacklogCollapsed}
             onToggleCollapse={() => setIsBacklogCollapsed(!isBacklogCollapsed)}
             selectedTasks={selectedTasks}
             onTaskSelect={handleTaskSelect}
             onSelectAll={handleSelectAll}
             onClearSelection={handleClearSelection}
           />
 
           {/* Calendar Grid */}
           <div className="flex-1 min-w-0">
             <PlanningCalendarGrid
               workloadData={workloadData}
               startDate={startDate}
               endDate={endDate}
               tasks={tasks}
               holidays={holidays}
               leaves={leaves}
               outlookEvents={outlookEvents}
               showOutlookEvents={showOutlookEvents}
               viewMode={viewMode}
               onNavigate={onNavigate}
               onToday={onToday}
               onTaskClick={handleTaskClick}
               onSlotDrop={handleSlotDrop}
               onTaskMove={onReassignTask}
               dropTarget={dropTarget}
               onDragOver={handleDragOver}
               onDragLeave={handleDragLeave}
               isHalfDayAvailable={isHalfDayAvailable}
               checkSlotLeaveConflict={checkSlotLeaveConflict}
               isCompact={isCompact}
             />
           </div>
         </div>
 
         {/* Task Drawer */}
         <UnifiedTaskDrawer
           item={drawerItem}
           isOpen={isDrawerOpen}
           onClose={() => {
             setIsDrawerOpen(false);
             setDrawerItem(null);
             onTaskUpdated?.();
           }}
         />
       </div>
     </TooltipProvider>
   );
 }