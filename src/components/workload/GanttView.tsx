import { useState, useCallback } from 'react';
import { format, parseISO, isWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TeamMemberWorkload, WorkloadSlot } from '@/types/workload';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { Task } from '@/types/task';
import { Scissors, Trash2 } from 'lucide-react';

interface GanttViewProps {
  workloadData: TeamMemberWorkload[];
  startDate: Date;
  endDate: Date;
  tasks: Task[];
  onSlotAdd: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon') => Promise<void>;
  onSlotRemove: (slotId: string) => Promise<void>;
  onSlotMove: (slotId: string, newDate: string, newHalfDay: 'morning' | 'afternoon') => Promise<void>;
  onMultiSlotAdd?: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', count: number) => Promise<void>;
  onSegmentSlot?: (slot: WorkloadSlot, userId: string, segments: number) => Promise<void>;
  isHalfDayAvailable?: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
  getTaskSlotsCount?: (taskId: string, userId: string) => number;
  getTaskDuration?: (taskId: string) => number | null; // Duration in half-days
  getTaskProgress?: (taskId: string) => { completed: number; total: number } | null;
  plannedTaskIds?: string[]; // Tasks that already have slots
}

interface DropContext {
  task: Task;
  userId: string;
  date: string;
  halfDay: 'morning' | 'afternoon';
  taskDuration: number; // Duration in half-days
}

interface SegmentContext {
  slot: WorkloadSlot;
  userId: string;
  currentCount: number;
  taskDuration: number; // Total duration in half-days
}

// Helper to get valid segment options (divisors of total duration)
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
  
  // Multi-slot dialog state
  const [showMultiSlotDialog, setShowMultiSlotDialog] = useState(false);
  const [multiSlotContext, setMultiSlotContext] = useState<DropContext | null>(null);
  const [halfDayCount, setHalfDayCount] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  
  // Segment dialog state
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [segmentContext, setSegmentContext] = useState<SegmentContext | null>(null);
  const [newSegmentCount, setNewSegmentCount] = useState(1);

  const days = [];
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const handleDragStart = (e: React.DragEvent, slot: WorkloadSlot) => {
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    // Block drag over weekends
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

  // Check if drop target is available (excludes weekends)
  const checkDropAvailable = useCallback((userId: string, date: string, halfDay: 'morning' | 'afternoon'): boolean => {
    // Block weekends
    const dayDate = parseISO(date);
    if (isWeekend(dayDate)) return false;
    
    if (!isHalfDayAvailable) return true;
    return isHalfDayAvailable(userId, date, halfDay);
  }, [isHalfDayAvailable]);

  const handleDrop = async (e: React.DragEvent, userId: string, date: string, halfDay: 'morning' | 'afternoon') => {
    e.preventDefault();
    setDropTarget(null);

    if (draggedSlot) {
      // Moving existing slot - check if target is available
      if (checkDropAvailable(userId, date, halfDay)) {
        await onSlotMove(draggedSlot.id, date, halfDay);
      }
      setDraggedSlot(null);
    } else if (draggedTask) {
      const isAvailable = checkDropAvailable(userId, date, halfDay);
      const taskDuration = getTaskDuration ? getTaskDuration(draggedTask.id) : null;
      
      if (isAvailable && taskDuration === null) {
        // No duration defined and slot available - place directly with 1 slot
        await onSlotAdd(draggedTask.id, userId, date, halfDay);
        setDraggedTask(null);
      } else if (isAvailable && taskDuration === 2) {
        // Duration is 1 day (2 half-days) and slot available - place directly
        if (onMultiSlotAdd) {
          await onMultiSlotAdd(draggedTask.id, userId, date, halfDay, 2);
        }
        setDraggedTask(null);
      } else {
        // Show dialog to choose segmentation
        const duration = taskDuration || 2; // Default to 1 day if not defined
        setMultiSlotContext({
          task: draggedTask,
          userId,
          date,
          halfDay,
          taskDuration: duration,
        });
        setHalfDayCount(duration); // Default to full duration (1 segment per half-day)
        setShowMultiSlotDialog(true);
        setDraggedTask(null);
      }
    }
  };

  const handleConfirmMultiSlot = async () => {
    if (!multiSlotContext) return;
    
    setIsAdding(true);
    try {
      // Add the total duration worth of slots
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

  // Handle right-click to segment
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

  // Available tasks (not yet planned)
  const availableTasks = tasks.filter(t => 
    t.status !== 'done' && 
    t.status !== 'validated' && 
    t.assignee_id &&
    !plannedTaskIds.includes(t.id)
  );

  return (
    <TooltipProvider>
      <div className="flex gap-4">
        {/* Tasks sidebar */}
        <div className="w-72 shrink-0 bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-3">Tâches à planifier ({availableTasks.length})</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                    "p-2 rounded border cursor-grab active:cursor-grabbing hover:bg-muted transition-colors",
                    getPriorityColor(task.priority) === 'bg-red-500' && "border-red-300",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", getPriorityColor(task.priority))} />
                    <span className="text-sm truncate flex-1">{task.title}</span>
                  </div>
                  
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {duration && (
                      <span className="bg-muted px-1.5 py-0.5 rounded">
                        {duration / 2} jour{duration > 2 ? 's' : ''}
                      </span>
                    )}
                    {progress && progress.total > 0 && (
                      <div className="flex items-center gap-1 flex-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              progressPercent === 100 ? "bg-green-500" : "bg-primary"
                            )}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span>{progressPercent}%</span>
                      </div>
                    )}
                  </div>
                  
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground block mt-1">
                      Échéance: {format(parseISO(task.due_date), 'dd/MM', { locale: fr })}
                    </span>
                  )}
                </div>
              );
            })}
            {availableTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Toutes les tâches sont planifiées
              </p>
            )}
          </div>
        </div>

        {/* Gantt chart */}
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-max">
            {/* Header - Days */}
            <div className="flex border-b sticky top-0 bg-background z-10">
              <div className="w-48 shrink-0 p-2 font-medium border-r">Collaborateur</div>
              {days.map(day => {
                const isWeekendDay = isWeekend(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "w-24 shrink-0 text-center text-xs border-r",
                      isWeekendDay && "bg-muted/50"
                    )}
                  >
                    <div className="font-medium py-1 border-b">
                      {format(day, 'EEE', { locale: fr })}
                    </div>
                    <div className="py-1">
                      {format(day, 'dd/MM', { locale: fr })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rows - Team members */}
            {workloadData.map(member => (
              <div key={member.memberId} className="flex border-b hover:bg-muted/20">
                {/* Member info */}
                <div className="w-48 shrink-0 p-2 border-r flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(member.memberName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{member.memberName}</div>
                    <div className="text-xs text-muted-foreground truncate">{member.jobTitle}</div>
                  </div>
                </div>

                {/* Day cells */}
                {member.days.map(day => {
                  const isDropTargetMorning = dropTarget?.userId === member.memberId && dropTarget?.date === day.date && dropTarget?.halfDay === 'morning';
                  const isDropTargetAfternoon = dropTarget?.userId === member.memberId && dropTarget?.date === day.date && dropTarget?.halfDay === 'afternoon';

                  return (
                    <div key={day.date} className="w-24 shrink-0 border-r flex">
                      {/* Morning */}
                      <div
                        className={cn(
                          "flex-1 min-h-[48px] p-0.5 border-r border-dashed",
                          day.morning.isWeekend && "bg-muted/50",
                          day.morning.isHoliday && "bg-amber-100 dark:bg-amber-900/30",
                          day.morning.isLeave && "bg-blue-100 dark:bg-blue-900/30",
                          isDropTargetMorning && "bg-primary/20 ring-2 ring-primary ring-inset"
                        )}
                        onDragOver={(e) => handleDragOver(e, member.memberId, day.date, 'morning')}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, member.memberId, day.date, 'morning')}
                      >
                        {day.morning.isHoliday && (
                          <Badge variant="outline" className="text-[10px] w-full justify-center bg-amber-200 dark:bg-amber-800">
                            Férié
                          </Badge>
                        )}
                        {day.morning.isLeave && !day.morning.isHoliday && (
                          <Badge variant="outline" className="text-[10px] w-full justify-center bg-blue-200 dark:bg-blue-800">
                            Congé
                          </Badge>
                        )}
                        {day.morning.slot && !day.morning.isHoliday && !day.morning.isLeave && (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, day.morning.slot!)}
                                className={cn(
                                  "w-full h-full rounded text-[10px] p-0.5 cursor-pointer hover:opacity-80",
                                  getPriorityColor(day.morning.slot.task?.priority || 'medium'),
                                  "text-white"
                                )}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate block">{day.morning.slot.task?.title}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{day.morning.slot.task?.title}</p>
                                    <p className="text-xs text-muted-foreground">Clic droit pour options</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => handleSegmentRequest(day.morning.slot!, member.memberId)}>
                                <Scissors className="h-4 w-4 mr-2" />
                                Segmenter
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem 
                                onClick={() => handleSlotDelete(day.morning.slot!)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        )}
                      </div>

                      {/* Afternoon */}
                      <div
                        className={cn(
                          "flex-1 min-h-[48px] p-0.5",
                          day.afternoon.isWeekend && "bg-muted/50",
                          day.afternoon.isHoliday && "bg-amber-100 dark:bg-amber-900/30",
                          day.afternoon.isLeave && "bg-blue-100 dark:bg-blue-900/30",
                          isDropTargetAfternoon && "bg-primary/20 ring-2 ring-primary ring-inset"
                        )}
                        onDragOver={(e) => handleDragOver(e, member.memberId, day.date, 'afternoon')}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, member.memberId, day.date, 'afternoon')}
                      >
                        {day.afternoon.isHoliday && (
                          <Badge variant="outline" className="text-[10px] w-full justify-center bg-amber-200 dark:bg-amber-800">
                            Férié
                          </Badge>
                        )}
                        {day.afternoon.isLeave && !day.afternoon.isHoliday && (
                          <Badge variant="outline" className="text-[10px] w-full justify-center bg-blue-200 dark:bg-blue-800">
                            Congé
                          </Badge>
                        )}
                        {day.afternoon.slot && !day.afternoon.isHoliday && !day.afternoon.isLeave && (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, day.afternoon.slot!)}
                                className={cn(
                                  "w-full h-full rounded text-[10px] p-0.5 cursor-pointer hover:opacity-80",
                                  getPriorityColor(day.afternoon.slot.task?.priority || 'medium'),
                                  "text-white"
                                )}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate block">{day.afternoon.slot.task?.title}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{day.afternoon.slot.task?.title}</p>
                                    <p className="text-xs text-muted-foreground">Clic droit pour options</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => handleSegmentRequest(day.afternoon.slot!, member.memberId)}>
                                <Scissors className="h-4 w-4 mr-2" />
                                Segmenter
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem 
                                onClick={() => handleSlotDelete(day.afternoon.slot!)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
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

      {/* Multi-slot dialog - Segmentation choice */}
      <Dialog open={showMultiSlotDialog} onOpenChange={setShowMultiSlotDialog}>
        <DialogContent>
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
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{multiSlotContext.task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    À partir du {format(parseISO(multiSlotContext.date), 'EEEE d MMMM', { locale: fr })} ({multiSlotContext.halfDay === 'morning' ? 'matin' : 'après-midi'})
                  </p>
                  <div className="mt-2 p-2 bg-primary/10 rounded border border-primary/20">
                    <p className="text-sm font-medium text-primary">
                      Durée totale: {totalHalfDays} demi-journée{totalHalfDays > 1 ? 's' : ''} ({totalDays} jour{totalDays > 1 ? 's' : ''})
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Segmentation</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Divisez la tâche en segments égaux :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {validOptions.map(segments => {
                      const halfDaysPerSegment = totalHalfDays / segments;
                      const daysPerSegment = halfDaysPerSegment / 2;
                      const isSelected = halfDayCount === totalHalfDays / segments * segments; // Check if this results in correct total
                      
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
                            halfDayCount === totalHalfDays && segments === validOptions[validOptions.length - 1] 
                              ? "ring-2 ring-primary" 
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
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMultiSlotDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmMultiSlot} disabled={isAdding}>
              {isAdding ? 'Planification...' : `Planifier ${multiSlotContext?.taskDuration || 0} créneau${(multiSlotContext?.taskDuration || 0) > 1 ? 'x' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segment dialog */}
      <Dialog open={showSegmentDialog} onOpenChange={setShowSegmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Segmenter la tâche</DialogTitle>
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
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{segmentContext.slot.task?.title}</p>
                  <div className="mt-2 p-2 bg-primary/10 rounded border border-primary/20">
                    <p className="text-sm font-medium text-primary">
                      Durée totale: {totalHalfDays} demi-journée{totalHalfDays > 1 ? 's' : ''} ({totalDays} jour{totalDays > 1 ? 's' : ''})
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Actuellement: {segmentContext.currentCount} créneau{segmentContext.currentCount > 1 ? 'x' : ''}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Nouvelle segmentation</Label>
                  <p className="text-sm text-muted-foreground mb-2">
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
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSegmentDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleConfirmSegment} 
              disabled={isAdding || !onSegmentSlot || newSegmentCount === segmentContext?.currentCount}
            >
              {isAdding ? 'Segmentation...' : 'Appliquer la segmentation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
