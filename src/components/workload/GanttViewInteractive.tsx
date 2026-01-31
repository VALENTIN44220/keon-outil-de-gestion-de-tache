import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { format, parseISO, isWeekend, isToday, eachDayOfInterval, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TeamMemberWorkload, WorkloadSlot, UserLeave } from '@/types/workload';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CheckCircle2, Search, GripVertical, Calendar, Clock, Plus, Keyboard } from 'lucide-react';
import { GanttTimeline, TodayLine } from './gantt/GanttTimeline';
import { GanttKPIs } from './gantt/GanttKPIs';
import { VirtualizedGanttRows } from './gantt/VirtualizedGanttRows';
import { UnifiedTaskDrawer, DrawerItem } from './UnifiedTaskDrawer';
import { GanttSettingsPanel } from './GanttSettingsPanel';
import { GanttExportPanel } from './GanttExportPanel';
import { GanttHeatmapOverlay, HeatmapLegend } from './GanttHeatmapOverlay';
import { GanttEmptyState, GanttLoadingSkeleton } from './GanttEmptyState';
import { useGanttViewPreferences, GroupByOption } from '@/hooks/useGanttViewPreferences';

interface GanttViewInteractiveProps {
  workloadData: TeamMemberWorkload[];
  startDate: Date;
  endDate: Date;
  tasks: Task[];
  leaves: UserLeave[];
  viewMode?: 'week' | 'month' | 'quarter';
  onSlotAdd: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon') => Promise<void>;
  onSlotRemove: (slotId: string) => Promise<void>;
  onSlotMove: (slotId: string, newDate: string, newHalfDay: 'morning' | 'afternoon') => Promise<void>;
  onMultiSlotAdd?: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', count: number) => Promise<void>;
  onReassignTask?: (taskId: string, fromUserId: string, toUserId: string, newStartDate: string) => Promise<void>;
  onResizeTask?: (taskId: string, userId: string, newStartDate: string, newEndDate: string) => Promise<void>;
  onQuickAddTask?: (userId: string, startDate: string, endDate: string) => void;
  isHalfDayAvailable?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
  checkSlotLeaveConflict?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => { hasConflict: boolean; leaveType?: string };
  getTaskSlotsCount?: (taskId: string, userId: string) => number;
  getTaskDuration?: (taskId: string) => number | null;
  getTaskProgress?: (taskId: string) => { completed: number; total: number } | null;
  plannedTaskIds?: string[];
  isLoading?: boolean;
}

// Group members by department, company, or team
function groupMembers(
  members: TeamMemberWorkload[], 
  groupBy: GroupByOption
): Map<string, TeamMemberWorkload[]> {
  const groups = new Map<string, TeamMemberWorkload[]>();
  
  if (groupBy === 'none') {
    groups.set('all', members);
    return groups;
  }
  
  members.forEach(member => {
    let key = 'Autre';
    
    switch (groupBy) {
      case 'department':
        key = member.department || 'Sans service';
        break;
      case 'company':
        key = member.companyId || 'Sans société';
        break;
      case 'team':
        // Would need manager info - fallback to department
        key = member.department || 'Sans équipe';
        break;
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(member);
  });
  
  return groups;
}

interface DropContext {
  task: Task;
  userId: string;
  date: string;
  halfDay: 'morning' | 'afternoon';
  taskDuration: number;
}

interface QuickAddContext {
  userId: string;
  startDate: string;
  endDate: string;
  duration: number;
}

function getValidSegmentOptions(totalHalfDays: number): number[] {
  const options: number[] = [];
  for (let i = 1; i <= totalHalfDays; i++) {
    if (totalHalfDays % i === 0) {
      options.push(i);
    }
  }
  return options;
}

export function GanttViewInteractive({
  workloadData,
  startDate,
  endDate,
  tasks,
  leaves,
  viewMode = 'month',
  onSlotAdd,
  onSlotRemove,
  onSlotMove,
  onMultiSlotAdd,
  onReassignTask,
  onResizeTask,
  onQuickAddTask,
  isHalfDayAvailable = () => true,
  checkSlotLeaveConflict,
  getTaskSlotsCount,
  getTaskDuration,
  getTaskProgress,
  plannedTaskIds = [],
  isLoading = false,
}: GanttViewInteractiveProps) {
  // Preferences
  const { 
    preferences, 
    savePreferences, 
    resetToDefaults 
  } = useGanttViewPreferences();
  
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<{ userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedTaskIndex, setFocusedTaskIndex] = useState(-1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Drawer state
  const [drawerItem, setDrawerItem] = useState<DrawerItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Multi-slot dialog state
  const [showMultiSlotDialog, setShowMultiSlotDialog] = useState(false);
  const [multiSlotContext, setMultiSlotContext] = useState<DropContext | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Quick add dialog state
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false);
  const [quickAddContext, setQuickAddContext] = useState<QuickAddContext | null>(null);
  
  // Quick add selection state
  const [quickAddSelection, setQuickAddSelection] = useState<{
    userId: string | null;
    startDate: string | null;
    endDate: string | null;
  } | null>(null);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  // Calculate days array
  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
  
  // Day width based on preferences zoom level and view mode
  const dayWidth = useMemo(() => {
    const zoomMultiplier = preferences.zoomLevel === 'day' ? 1.5 : 
                          preferences.zoomLevel === 'month' ? 0.5 : 1;
    switch (viewMode) {
      case 'week': return 120 * zoomMultiplier;
      case 'quarter': return 40 * zoomMultiplier;
      case 'month':
      default: return 80 * zoomMultiplier;
    }
  }, [viewMode, preferences.zoomLevel]);
  
  const isCompact = preferences.compactMode || viewMode === 'quarter';
  const memberColumnWidth = preferences.memberColumnWidth;
  const rowHeight = preferences.rowHeight;
  
  // Group members based on preferences
  const groupedMembers = useMemo(() => 
    groupMembers(workloadData, preferences.groupBy),
    [workloadData, preferences.groupBy]
  );
  
  // Initialize expanded groups
  useEffect(() => {
    if (preferences.groupBy !== 'none' && expandedGroups.size === 0) {
      setExpandedGroups(new Set(groupedMembers.keys()));
    }
  }, [preferences.groupBy, groupedMembers]);
  
  // Flatten for display
  const displayMembers = useMemo(() => {
    if (preferences.groupBy === 'none') {
      return workloadData;
    }
    
    const result: TeamMemberWorkload[] = [];
    groupedMembers.forEach((members, group) => {
      if (expandedGroups.has(group)) {
        result.push(...members);
      }
    });
    return result;
  }, [workloadData, preferences.groupBy, groupedMembers, expandedGroups]);
  
  // Keyboard navigation for task list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!taskListRef.current?.contains(document.activeElement)) return;
      
      const availableCount = availableTasks.length;
      if (availableCount === 0) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedTaskIndex(prev => Math.min(prev + 1, availableCount - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedTaskIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (focusedTaskIndex >= 0 && focusedTaskIndex < availableCount) {
            // Open task drawer
            const task = availableTasks[focusedTaskIndex];
            setDrawerItem({ type: 'task', task, slots: [] });
            setIsDrawerOpen(true);
          }
          break;
        case 'Escape':
          setFocusedTaskIndex(-1);
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedTaskIndex, tasks, plannedTaskIds, searchQuery]);

  // Available tasks (not yet planned)
  const availableTasks = useMemo(() => {
    return tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'validated' && 
      t.assignee_id &&
      !plannedTaskIds.includes(t.id)
    ).filter(t => 
      searchQuery === '' || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tasks, plannedTaskIds, searchQuery]);

  // All slots grouped by user
  const slotsByUser = useMemo(() => {
    const map = new Map<string, WorkloadSlot[]>();
    workloadData.forEach(member => {
      const userSlots: WorkloadSlot[] = [];
      member.days.forEach(day => {
        if (day.morning.slot) userSlots.push(day.morning.slot);
        if (day.afternoon.slot) userSlots.push(day.afternoon.slot);
      });
      map.set(member.memberId, userSlots);
    });
    return map;
  }, [workloadData]);

  // Unique tasks per user with their slots
  const tasksByUser = useMemo(() => {
    const map = new Map<string, { task: Task; slots: WorkloadSlot[] }[]>();
    
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
      
      map.set(member.memberId, Array.from(taskMap.values()));
    });
    
    return map;
  }, [workloadData, slotsByUser, tasks]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-gradient-to-r from-red-500 to-rose-400';
      case 'high': return 'bg-gradient-to-r from-orange-500 to-amber-400';
      case 'medium': return 'bg-gradient-to-r from-blue-500 to-indigo-400';
      case 'low': return 'bg-gradient-to-r from-emerald-500 to-teal-400';
      default: return 'bg-gradient-to-r from-slate-500 to-slate-400';
    }
  };

  // Drag & Drop handlers for task sidebar
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    setDropTarget({ userId, date, halfDay });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    e.preventDefault();
    setDropTarget(null);

    if (draggedTask) {
      const isAvailable = isHalfDayAvailable(userId, date, halfDay);
      const taskDuration = getTaskDuration ? getTaskDuration(draggedTask.id) : null;
      
      if (isAvailable && taskDuration === null) {
        await onSlotAdd(draggedTask.id, userId, date, halfDay);
        setDraggedTask(null);
      } else if (isAvailable && taskDuration === 2) {
        if (onMultiSlotAdd) {
          await onMultiSlotAdd(draggedTask.id, userId, date, halfDay, 2);
        }
        setDraggedTask(null);
      } else {
        const duration = taskDuration || 2;
        setMultiSlotContext({
          task: draggedTask,
          userId,
          date,
          halfDay,
          taskDuration: duration,
        });
        setShowMultiSlotDialog(true);
        setDraggedTask(null);
      }
    }
  };

  const handleConfirmMultiSlot = async () => {
    if (!multiSlotContext || !onMultiSlotAdd) return;
    
    setIsAdding(true);
    try {
      await onMultiSlotAdd(
        multiSlotContext.task.id, 
        multiSlotContext.userId, 
        multiSlotContext.date, 
        multiSlotContext.halfDay, 
        multiSlotContext.taskDuration
      );
      setShowMultiSlotDialog(false);
      setMultiSlotContext(null);
    } catch (error: any) {
      console.error('Error adding slots:', error);
    } finally {
      setIsAdding(false);
    }
  };

  // Task bar interactions
  const handleTaskClick = (task: Task, slots: WorkloadSlot[]) => {
    setDrawerItem({ type: 'task', task, slots });
    setIsDrawerOpen(true);
  };

  const handleDragStart = useCallback((
    e: React.MouseEvent, 
    mode: 'move' | 'resize-start' | 'resize-end', 
    taskId: string, 
    slots: WorkloadSlot[], 
    userId: string
  ) => {
    // For now, use basic drag - full implementation would use the useGanttDragDrop hook
    console.log('Drag start:', mode, taskId);
  }, []);

  // Quick add handlers
  const handleQuickAddStart = useCallback((
    e: React.MouseEvent,
    userId: string,
    date: string,
    halfDay: 'morning' | 'afternoon'
  ) => {
    // Check if it's a clean click (not on a task bar)
    const target = e.target as HTMLElement;
    if (target.closest('[data-task-bar]')) return;
    
    setIsQuickAdding(true);
    setQuickAddSelection({
      userId,
      startDate: date,
      endDate: date,
    });
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate new end date based on mouse position
      const gridElement = containerRef.current?.querySelector('[data-gantt-grid]');
      if (!gridElement) return;
      
      const rect = gridElement.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const dayIndex = Math.floor(x / dayWidth);
      
      if (dayIndex >= 0 && dayIndex < days.length) {
        const newEndDate = format(days[dayIndex], 'yyyy-MM-dd');
        setQuickAddSelection(prev => {
          if (!prev) return null;
          const startD = parseISO(prev.startDate!);
          const endD = parseISO(newEndDate);
          
          return {
            ...prev,
            startDate: startD <= endD ? prev.startDate : newEndDate,
            endDate: startD <= endD ? newEndDate : prev.startDate,
          };
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsQuickAdding(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Show quick add dialog
      if (quickAddSelection?.startDate && quickAddSelection?.endDate && quickAddSelection?.userId) {
        const duration = differenceInDays(
          parseISO(quickAddSelection.endDate), 
          parseISO(quickAddSelection.startDate)
        ) + 1;
        
        if (duration > 0) {
          setQuickAddContext({
            userId: quickAddSelection.userId,
            startDate: quickAddSelection.startDate,
            endDate: quickAddSelection.endDate,
            duration,
          });
          setShowQuickAddDialog(true);
        }
      }
      
      setQuickAddSelection(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [days, dayWidth, quickAddSelection]);

  const handleConfirmQuickAdd = () => {
    if (quickAddContext && onQuickAddTask) {
      onQuickAddTask(quickAddContext.userId, quickAddContext.startDate, quickAddContext.endDate);
    }
    setShowQuickAddDialog(false);
    setQuickAddContext(null);
  };

  // Check for conflicts
  const checkConflict = useCallback((userId: string, slots: WorkloadSlot[]): { hasConflict: boolean; message?: string } => {
    if (!checkSlotLeaveConflict) return { hasConflict: false };
    
    for (const slot of slots) {
      const result = checkSlotLeaveConflict(userId, slot.date, slot.half_day as 'morning' | 'afternoon');
      if (result.hasConflict) {
        return { 
          hasConflict: true, 
          message: `Conflit avec ${result.leaveType === 'paid' ? 'congés payés' : 
            result.leaveType === 'sick' ? 'arrêt maladie' :
            result.leaveType === 'rtt' ? 'RTT' : 'congé'}`
        };
      }
    }
    return { hasConflict: false };
  }, [checkSlotLeaveConflict]);

  // Drag offset placeholder (would be managed by useGanttDragDrop in full implementation)
  const getDragOffset = useCallback((taskId: string) => null, []);

  // Loading state
  if (isLoading) {
    return <GanttLoadingSkeleton />;
  }
  
  // Empty states
  if (workloadData.length === 0) {
    return <GanttEmptyState type="no-members" />;
  }

  return (
    <TooltipProvider>
      <div className="space-y-4" ref={containerRef}>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <GanttKPIs 
            workloadData={workloadData} 
            tasks={tasks} 
            plannedTaskIds={plannedTaskIds} 
          />
          
          <div className="flex items-center gap-2">
            {preferences.showHeatmap && <HeatmapLegend />}
            
            <GanttExportPanel
              workloadData={workloadData}
              tasks={tasks}
              startDate={startDate}
              endDate={endDate}
            />
            
            <GanttSettingsPanel
              preferences={preferences}
              onPreferencesChange={savePreferences}
              onReset={resetToDefaults}
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          {/* Tasks Sidebar */}
          <Card className="w-80 shrink-0 shadow-lg border-0 bg-gradient-to-b from-card to-muted/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/60" />
                <h3 className="font-semibold text-sm">Tâches à planifier</h3>
                <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                  {availableTasks.length}
                </Badge>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-background/50"
                />
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <ScrollArea className="h-[500px] pr-3">
                <div 
                  className="space-y-2" 
                  ref={taskListRef}
                  tabIndex={0}
                  role="listbox"
                  aria-label="Tâches à planifier"
                >
                  {availableTasks.map((task, index) => {
                    const duration = getTaskDuration ? getTaskDuration(task.id) : null;
                    const progress = getTaskProgress ? getTaskProgress(task.id) : null;
                    const progressPercent = progress && progress.total > 0 
                      ? Math.round((progress.completed / progress.total) * 100) 
                      : 0;
                    const isFocused = focusedTaskIndex === index;
                    
                    return (
                      <div
                        key={task.id}
                        role="option"
                        aria-selected={isFocused}
                        draggable
                        onDragStart={(e) => handleTaskDragStart(e, task)}
                        onClick={() => {
                          setFocusedTaskIndex(index);
                          setDrawerItem({ type: 'task', task, slots: [] });
                          setIsDrawerOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setDrawerItem({ type: 'task', task, slots: [] });
                            setIsDrawerOpen(true);
                          }
                        }}
                        tabIndex={isFocused ? 0 : -1}
                        className={cn(
                          "group p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing",
                          "bg-card hover:bg-accent/50 hover:shadow-md",
                          "transition-all duration-200 hover:scale-[1.02]",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                          task.priority === 'urgent' && "border-red-200 hover:border-red-300",
                          task.priority === 'high' && "border-orange-200 hover:border-orange-300",
                          task.priority === 'medium' && "border-blue-200 hover:border-blue-300",
                          task.priority === 'low' && "border-emerald-200 hover:border-emerald-300",
                          !['urgent', 'high', 'medium', 'low'].includes(task.priority) && "border-border",
                          isFocused && "ring-2 ring-primary ring-offset-2"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0 group-hover:text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                getPriorityColor(task.priority)
                              )} />
                              <span className="text-sm font-medium truncate">{task.title}</span>
                            </div>
                            
                            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                              {duration && (
                                <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                                  <Clock className="h-3 w-3" />
                                  {duration / 2}j
                                </span>
                              )}
                              {task.due_date && (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(parseISO(task.due_date), 'dd/MM', { locale: fr })}
                                </span>
                              )}
                            </div>
                            
                            {progress && progress.total > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      progressPercent === 100 ? "bg-emerald-500" : "bg-primary"
                                    )}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-medium tabular-nums">{progressPercent}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {availableTasks.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-7 h-7 text-white" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Toutes les tâches sont planifiées 🎉
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Keyboard hint */}
                <div className="mt-4 p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                  <Keyboard className="h-3 w-3" />
                  <span>↑↓ naviguer • Entrée ouvrir</span>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Gantt Chart */}
          <Card className="flex-1 shadow-lg border-0 overflow-hidden">
            <div className="relative">
              <ScrollArea className="w-full" style={{ height: '600px' }}>
                <div className="min-w-max relative">
                  {/* Timeline Header */}
                  <GanttTimeline 
                    days={days} 
                    dayWidth={dayWidth} 
                    viewMode={viewMode} 
                    isCompact={isCompact}
                    memberColumnWidth={memberColumnWidth}
                  />
                  
                  {/* Today Line */}
                  <TodayLine 
                    days={days} 
                    dayWidth={dayWidth} 
                    headerOffset={memberColumnWidth}
                  />
                  
                  {/* Virtualized Member Rows */}
                  <div data-gantt-grid>
                    <VirtualizedGanttRows
                      workloadData={workloadData}
                      days={days}
                      dayWidth={dayWidth}
                      rowHeight={rowHeight}
                      memberColumnWidth={memberColumnWidth}
                      isCompact={isCompact}
                      startDate={startDate}
                      endDate={endDate}
                      tasks={tasks}
                      tasksByUser={tasksByUser}
                      getTaskProgress={getTaskProgress}
                      onTaskClick={handleTaskClick}
                      onDragStart={handleDragStart}
                      onQuickAddStart={handleQuickAddStart}
                      onDropZoneEnter={handleDragOver}
                      onDropZoneLeave={handleDragLeave}
                      onDrop={handleDrop}
                      dropTarget={dropTarget}
                      dragState={null}
                      getDragOffset={getDragOffset}
                      quickAddSelection={isQuickAdding ? quickAddSelection : null}
                      leaves={leaves}
                      checkConflict={checkConflict}
                      containerHeight={500}
                    />
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </Card>
        </div>
      </div>

      {/* Unified Task Drawer */}
      <UnifiedTaskDrawer
        item={drawerItem}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSlotDelete={(slotId) => onSlotRemove(slotId)}
      />

      {/* Multi-slot Dialog */}
      <Dialog open={showMultiSlotDialog} onOpenChange={setShowMultiSlotDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Planifier la tâche</DialogTitle>
            <DialogDescription>
              Choisissez comment segmenter cette tâche. Les créneaux seront automatiquement répartis.
            </DialogDescription>
          </DialogHeader>
          
          {multiSlotContext && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-xl border">
                <p className="font-semibold text-sm">{multiSlotContext.task.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  À partir du {format(parseISO(multiSlotContext.date), 'EEEE d MMMM', { locale: fr })}
                </p>
                <div className="mt-3 p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm font-semibold text-primary">
                    Durée: {multiSlotContext.taskDuration / 2} jour(s)
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowMultiSlotDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmMultiSlot} disabled={isAdding}>
              {isAdding ? 'Planification...' : 'Planifier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Dialog */}
      <Dialog open={showQuickAddDialog} onOpenChange={setShowQuickAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Créer une tâche rapidement
            </DialogTitle>
            <DialogDescription>
              Créez une nouvelle tâche pour la période sélectionnée.
            </DialogDescription>
          </DialogHeader>
          
          {quickAddContext && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-xl border">
                <p className="text-sm text-muted-foreground">
                  Période: {format(parseISO(quickAddContext.startDate), 'd MMMM', { locale: fr })} 
                  {quickAddContext.startDate !== quickAddContext.endDate && 
                    ` → ${format(parseISO(quickAddContext.endDate), 'd MMMM', { locale: fr })}`}
                </p>
                <div className="mt-2 p-2 bg-primary/10 rounded-lg">
                  <p className="text-sm font-semibold text-primary">
                    Durée: {quickAddContext.duration} jour(s)
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Cliquez sur "Créer" pour ouvrir le formulaire de création de tâche avec ces dates pré-remplies.
              </p>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowQuickAddDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmQuickAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Créer la tâche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
