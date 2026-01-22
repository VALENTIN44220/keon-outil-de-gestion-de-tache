import { useState, useCallback, useMemo } from 'react';
import { format, parseISO, isWeekend, isToday, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TeamMemberWorkload, WorkloadSlot } from '@/types/workload';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Scissors, Trash2, CheckCircle2, Search, GripVertical, Calendar, Clock } from 'lucide-react';
import { GanttTaskBar } from './gantt/GanttTaskBar';
import { GanttMemberRow } from './gantt/GanttMemberRow';
import { GanttTimeline, TodayLine } from './gantt/GanttTimeline';
import { GanttKPIs } from './gantt/GanttKPIs';
import { TaskDrawer } from './calendar/TaskDrawer';

interface GanttViewProps {
  workloadData: TeamMemberWorkload[];
  startDate: Date;
  endDate: Date;
  tasks: Task[];
  viewMode?: 'week' | 'month' | 'quarter';
  onSlotAdd: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon') => Promise<void>;
  onSlotRemove: (slotId: string) => Promise<void>;
  onSlotMove: (slotId: string, newDate: string, newHalfDay: 'morning' | 'afternoon') => Promise<void>;
  onMultiSlotAdd?: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', count: number) => Promise<void>;
  onSegmentSlot?: (slot: WorkloadSlot, userId: string, segments: number) => Promise<void>;
  isHalfDayAvailable?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
  getTaskSlotsCount?: (taskId: string, userId: string) => number;
  getTaskDuration?: (taskId: string) => number | null;
  getTaskProgress?: (taskId: string) => { completed: number; total: number } | null;
  plannedTaskIds?: string[];
}

interface DropContext {
  task: Task;
  userId: string;
  date: string;
  halfDay: 'morning' | 'afternoon';
  taskDuration: number;
}

interface SegmentContext {
  slot: WorkloadSlot;
  userId: string;
  currentCount: number;
  taskDuration: number;
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

export function GanttView({
  workloadData,
  startDate,
  endDate,
  tasks,
  viewMode = 'month',
  onSlotAdd,
  onSlotRemove,
  onSlotMove,
  onMultiSlotAdd,
  onSegmentSlot,
  isHalfDayAvailable,
  getTaskSlotsCount,
  getTaskDuration,
  getTaskProgress,
  plannedTaskIds = [],
}: GanttViewProps) {
  const [draggedSlot, setDraggedSlot] = useState<WorkloadSlot | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<{ userId: string; date: string; halfDay: 'morning' | 'afternoon' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drawer state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Multi-slot dialog state
  const [showMultiSlotDialog, setShowMultiSlotDialog] = useState(false);
  const [multiSlotContext, setMultiSlotContext] = useState<DropContext | null>(null);
  const [halfDayCount, setHalfDayCount] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  
  // Segment dialog state
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [segmentContext, setSegmentContext] = useState<SegmentContext | null>(null);
  const [newSegmentCount, setNewSegmentCount] = useState(1);

  // Calculate days array
  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
  
  // Day width based on view mode
  const dayWidth = useMemo(() => {
    switch (viewMode) {
      case 'week': return 120;
      case 'quarter': return 40;
      case 'month':
      default: return 80;
    }
  }, [viewMode]);
  
  const isCompact = viewMode === 'quarter';
  const memberColumnWidth = isCompact ? 192 : 240; // 48rem / 60rem in pixels
  const rowHeight = isCompact ? 48 : 72;

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

  // All slots flat
  const allSlots = useMemo(() => {
    const slots: WorkloadSlot[] = [];
    slotsByUser.forEach(userSlots => slots.push(...userSlots));
    return slots;
  }, [slotsByUser]);

  // Get slots grouped by task for each user
  const getTaskSlotsForUser = useCallback((userId: string, taskId: string) => {
    const userSlots = slotsByUser.get(userId) || [];
    return userSlots.filter(s => s.task_id === taskId);
  }, [slotsByUser]);

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

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, slot: WorkloadSlot) => {
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    const dayDate = parseISO(date);
    if (isWeekend(dayDate)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.preventDefault();
    setDropTarget({ userId, date, halfDay });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const checkDropAvailable = useCallback((userId: string, date: string, halfDay: 'morning' | 'afternoon'): boolean => {
    const dayDate = parseISO(date);
    if (isWeekend(dayDate)) return false;
    if (!isHalfDayAvailable) return true;
    return isHalfDayAvailable(userId, date, halfDay);
  }, [isHalfDayAvailable]);

  const handleDrop = async (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    e.preventDefault();
    setDropTarget(null);

    if (draggedSlot) {
      if (checkDropAvailable(userId, date, halfDay)) {
        await onSlotMove(draggedSlot.id, date, halfDay);
      }
      setDraggedSlot(null);
    } else if (draggedTask) {
      const isAvailable = checkDropAvailable(userId, date, halfDay);
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
        setHalfDayCount(duration);
        setShowMultiSlotDialog(true);
        setDraggedTask(null);
      }
    }
  };

  const handleConfirmMultiSlot = async () => {
    if (!multiSlotContext) return;
    
    setIsAdding(true);
    try {
      if (onMultiSlotAdd) {
        await onMultiSlotAdd(multiSlotContext.task.id, multiSlotContext.userId, multiSlotContext.date, multiSlotContext.halfDay, multiSlotContext.taskDuration);
      }
      setShowMultiSlotDialog(false);
      setMultiSlotContext(null);
    } catch (error: any) {
      console.error('Error adding slots:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSegmentRequest = (slot: WorkloadSlot, userId: string) => {
    const currentCount = getTaskSlotsCount ? getTaskSlotsCount(slot.task_id, userId) : 1;
    const taskDuration = getTaskDuration ? getTaskDuration(slot.task_id) : currentCount;
    setSegmentContext({ slot, userId, currentCount, taskDuration: taskDuration || currentCount });
    setNewSegmentCount(currentCount);
    setShowSegmentDialog(true);
  };

  const handleConfirmSegment = async () => {
    if (!segmentContext || !onSegmentSlot) return;
    
    setIsAdding(true);
    try {
      await onSegmentSlot(segmentContext.slot, segmentContext.userId, newSegmentCount);
      setShowSegmentDialog(false);
      setSegmentContext(null);
    } catch (error: any) {
      console.error('Error segmenting slot:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSlotDelete = async (slot: WorkloadSlot) => {
    await onSlotRemove(slot.id);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const handleMarkDone = async (taskId: string) => {
    // This would update task status - for now just close drawer
    setIsDrawerOpen(false);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* KPIs Header */}
        <div className="flex items-center justify-between">
          <GanttKPIs 
            workloadData={workloadData} 
            tasks={tasks} 
            plannedTaskIds={plannedTaskIds} 
          />
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
                <div className="space-y-2">
                  {availableTasks.map(task => {
                    const duration = getTaskDuration ? getTaskDuration(task.id) : null;
                    const progress = getTaskProgress ? getTaskProgress(task.id) : null;
                    const progressPercent = progress && progress.total > 0 
                      ? Math.round((progress.completed / progress.total) * 100) 
                      : 0;
                    
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleTaskDragStart(e, task)}
                        className={cn(
                          "group p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing",
                          "bg-card hover:bg-accent/50 hover:shadow-md",
                          "transition-all duration-200 hover:scale-[1.02]",
                          task.priority === 'urgent' && "border-red-200 hover:border-red-300",
                          task.priority === 'high' && "border-orange-200 hover:border-orange-300",
                          task.priority === 'medium' && "border-blue-200 hover:border-blue-300",
                          task.priority === 'low' && "border-emerald-200 hover:border-emerald-300",
                          !['urgent', 'high', 'medium', 'low'].includes(task.priority) && "border-border"
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
                  />
                  
                  {/* Today Line */}
                  <TodayLine 
                    days={days} 
                    dayWidth={dayWidth} 
                    headerOffset={memberColumnWidth}
                  />
                  
                  {/* Member Rows */}
                  {workloadData.map((member, memberIdx) => {
                    const memberTasks = tasksByUser.get(member.memberId) || [];
                    
                    return (
                      <div 
                        key={member.memberId} 
                        className={cn(
                          "flex border-b border-border/30 relative",
                          memberIdx % 2 === 0 ? "bg-card" : "bg-muted/20"
                        )}
                        style={{ height: rowHeight }}
                      >
                        {/* Member Info Column */}
                        <GanttMemberRow member={member} isCompact={isCompact} />
                        
                        {/* Timeline Area */}
                        <div 
                          className="relative flex-1"
                          style={{ width: days.length * dayWidth }}
                        >
                          {/* Day cells (background grid) */}
                          <div className="absolute inset-0 flex">
                            {days.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const dayData = member.days.find(d => d.date === dateStr);
                              const isWeekendDay = isWeekend(day);
                              const isTodayDay = isToday(day);
                              const isHoliday = dayData?.morning.isHoliday || dayData?.afternoon.isHoliday;
                              const isLeave = dayData?.morning.isLeave || dayData?.afternoon.isLeave;
                              
                              const isDropTargetHere = dropTarget?.userId === member.memberId && dropTarget?.date === dateStr;
                              
                              return (
                                <div
                                  key={dateStr}
                                  className={cn(
                                    "shrink-0 border-r border-border/20 flex",
                                    isWeekendDay && "bg-muted/40",
                                    isTodayDay && "bg-primary/5",
                                    isHoliday && "bg-amber-50 dark:bg-amber-900/20",
                                    isLeave && "bg-blue-50 dark:bg-blue-900/20"
                                  )}
                                  style={{ width: dayWidth, height: '100%' }}
                                >
                                  {/* Morning drop zone */}
                                  <div
                                    className={cn(
                                      "flex-1 transition-colors",
                                      isDropTargetHere && dropTarget?.halfDay === 'morning' && 
                                        "bg-primary/20 ring-2 ring-primary ring-inset"
                                    )}
                                    onDragOver={(e) => handleDragOver(e, member.memberId, dateStr, 'morning')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'morning')}
                                  >
                                    {isHoliday && (
                                      <div className="h-full flex items-center justify-center">
                                        <Badge variant="outline" className="text-[9px] bg-amber-100 border-amber-300 text-amber-700">
                                          {isCompact ? 'F' : 'Férié'}
                                        </Badge>
                                      </div>
                                    )}
                                    {isLeave && !isHoliday && (
                                      <div className="h-full flex items-center justify-center">
                                        <Badge variant="outline" className="text-[9px] bg-blue-100 border-blue-300 text-blue-700">
                                          {isCompact ? 'C' : 'Congé'}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Afternoon drop zone */}
                                  <div
                                    className={cn(
                                      "flex-1 border-l border-dashed border-border/20 transition-colors",
                                      isDropTargetHere && dropTarget?.halfDay === 'afternoon' && 
                                        "bg-primary/20 ring-2 ring-primary ring-inset"
                                    )}
                                    onDragOver={(e) => handleDragOver(e, member.memberId, dateStr, 'afternoon')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, member.memberId, dateStr, 'afternoon')}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Task Bars */}
                          {memberTasks.map(({ task, slots }) => {
                            const progress = getTaskProgress ? getTaskProgress(task.id) : null;
                            const progressPercent = progress && progress.total > 0 
                              ? Math.round((progress.completed / progress.total) * 100) 
                              : 0;
                            
                            return (
                              <GanttTaskBar
                                key={task.id}
                                task={task}
                                slots={slots}
                                startDate={startDate}
                                endDate={endDate}
                                dayWidth={dayWidth}
                                progress={progressPercent}
                                onClick={() => handleTaskClick(task)}
                                onDragStart={(e) => {
                                  if (slots.length > 0) {
                                    handleDragStart(e, slots[0]);
                                  }
                                }}
                                isCompact={isCompact}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </Card>
        </div>
      </div>

      {/* Task Details Drawer */}
      <TaskDrawer
        task={selectedTask}
        slots={allSlots}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onMarkDone={handleMarkDone}
        onDelete={(slotId) => onSlotRemove(slotId)}
        onSegment={(slot) => selectedTask && handleSegmentRequest(slot, selectedTask.assignee_id || '')}
      />

      {/* Multi-slot Dialog */}
      <Dialog open={showMultiSlotDialog} onOpenChange={setShowMultiSlotDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Planifier la tâche</DialogTitle>
            <DialogDescription>
              Choisissez comment segmenter cette tâche. Les créneaux seront automatiquement répartis en évitant les weekends, jours fériés et congés.
            </DialogDescription>
          </DialogHeader>
          
          {multiSlotContext && (() => {
            const totalHalfDays = multiSlotContext.taskDuration;
            const totalDays = totalHalfDays / 2;
            const validOptions = getValidSegmentOptions(totalHalfDays);
            
            return (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-xl border">
                  <p className="font-semibold text-sm">{multiSlotContext.task.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    À partir du {format(parseISO(multiSlotContext.date), 'EEEE d MMMM', { locale: fr })} ({multiSlotContext.halfDay === 'morning' ? 'matin' : 'après-midi'})
                  </p>
                  <div className="mt-3 p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-semibold text-primary">
                      Durée totale: {totalHalfDays} demi-journée{totalHalfDays > 1 ? 's' : ''} ({totalDays} jour{totalDays > 1 ? 's' : ''})
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Segmentation</Label>
                  <p className="text-xs text-muted-foreground">
                    Divisez la tâche en segments égaux :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {validOptions.map(segments => {
                      const halfDaysPerSegment = totalHalfDays / segments;
                      const daysPerSegment = halfDaysPerSegment / 2;
                      
                      let label = '';
                      if (segments === 1) {
                        label = `1 bloc de ${totalDays} jour${totalDays > 1 ? 's' : ''}`;
                      } else if (halfDaysPerSegment === 1) {
                        label = `${segments} × ½ journée`;
                      } else if (halfDaysPerSegment === 2) {
                        label = `${segments} × 1 jour`;
                      } else {
                        label = `${segments} × ${daysPerSegment} jour${daysPerSegment > 1 ? 's' : ''}`;
                      }
                      
                      return (
                        <Button
                          key={segments}
                          variant={halfDayCount === totalHalfDays ? "default" : "outline"}
                          size="sm"
                          onClick={() => setHalfDayCount(totalHalfDays)}
                          className={cn(
                            "transition-all",
                            halfDayCount === totalHalfDays && segments === validOptions[validOptions.length - 1] 
                              ? "ring-2 ring-primary/50" 
                              : ""
                          )}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowMultiSlotDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmMultiSlot} disabled={isAdding}>
              {isAdding ? 'Planification...' : `Planifier ${multiSlotContext?.taskDuration || 0} créneau${(multiSlotContext?.taskDuration || 0) > 1 ? 'x' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segment Dialog */}
      <Dialog open={showSegmentDialog} onOpenChange={setShowSegmentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Segmenter la tâche
            </DialogTitle>
            <DialogDescription>
              Redistribuez les créneaux de cette tâche. La somme des créneaux reste égale à la durée totale.
            </DialogDescription>
          </DialogHeader>
          
          {segmentContext && (() => {
            const totalHalfDays = segmentContext.taskDuration;
            const totalDays = totalHalfDays / 2;
            const validOptions = getValidSegmentOptions(totalHalfDays);
            
            return (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-xl border">
                  <p className="font-semibold text-sm">{segmentContext.slot.task?.title}</p>
                  <div className="mt-3 p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-semibold text-primary">
                      Durée totale: {totalHalfDays} demi-journée{totalHalfDays > 1 ? 's' : ''} ({totalDays} jour{totalDays > 1 ? 's' : ''})
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Actuellement: {segmentContext.currentCount} créneau{segmentContext.currentCount > 1 ? 'x' : ''}
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Nouvelle segmentation</Label>
                  <p className="text-xs text-muted-foreground">
                    Choisissez comment diviser les {totalHalfDays} demi-journées :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {validOptions.map(segments => {
                      const halfDaysPerSegment = totalHalfDays / segments;
                      const daysPerSegment = halfDaysPerSegment / 2;
                      const isSelected = newSegmentCount === segments;
                      
                      let label = '';
                      if (segments === 1) {
                        label = `1 bloc de ${totalDays} jour${totalDays > 1 ? 's' : ''}`;
                      } else if (halfDaysPerSegment === 1) {
                        label = `${segments} × ½ journée`;
                      } else if (halfDaysPerSegment === 2) {
                        label = `${segments} × 1 jour`;
                      } else {
                        label = `${segments} × ${daysPerSegment} jour${daysPerSegment > 1 ? 's' : ''}`;
                      }
                      
                      return (
                        <Button
                          key={segments}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewSegmentCount(segments)}
                          className={cn(
                            "transition-all",
                            isSelected && "ring-2 ring-primary/50"
                          )}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSegmentDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleConfirmSegment} 
              disabled={isAdding || !segmentContext}
            >
              {isAdding ? 'Application...' : 'Appliquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}