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
}

interface DropContext {
  task: Task;
  userId: string;
  date: string;
  halfDay: 'morning' | 'afternoon';
}

interface SegmentContext {
  slot: WorkloadSlot;
  userId: string;
  currentCount: number;
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
    e.preventDefault();
    setDropTarget({ userId, date, halfDay });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  // Check if drop target is available
  const checkDropAvailable = useCallback((userId: string, date: string, halfDay: 'morning' | 'afternoon'): boolean => {
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
      // Check if target is available - if not, auto-segment
      const isAvailable = checkDropAvailable(userId, date, halfDay);
      
      if (!isAvailable && onMultiSlotAdd) {
        // Auto-segment: find next available slot and add there
        await onMultiSlotAdd(draggedTask.id, userId, date, halfDay, 1);
        setDraggedTask(null);
      } else {
        // Show dialog to choose number of half-days
        setMultiSlotContext({
          task: draggedTask,
          userId,
          date,
          halfDay,
        });
        setHalfDayCount(1);
        setShowMultiSlotDialog(true);
        setDraggedTask(null);
      }
    }
  };

  const handleConfirmMultiSlot = async () => {
    if (!multiSlotContext) return;
    
    setIsAdding(true);
    try {
      // Always use multi-slot add to handle segmentation automatically
      if (onMultiSlotAdd) {
        await onMultiSlotAdd(multiSlotContext.task.id, multiSlotContext.userId, multiSlotContext.date, multiSlotContext.halfDay, halfDayCount);
      } else if (halfDayCount === 1) {
        await onSlotAdd(multiSlotContext.task.id, multiSlotContext.userId, multiSlotContext.date, multiSlotContext.halfDay);
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
    setSegmentContext({ slot, userId, currentCount });
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

  // Available tasks (not fully scheduled)
  const availableTasks = tasks.filter(t => 
    t.status !== 'done' && t.status !== 'validated' && t.assignee_id
  );

  return (
    <TooltipProvider>
      <div className="flex gap-4">
        {/* Tasks sidebar */}
        <div className="w-64 shrink-0 bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-3">Tâches à planifier</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {availableTasks.map(task => (
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
                  <div className={cn("w-2 h-2 rounded-full", getPriorityColor(task.priority))} />
                  <span className="text-sm truncate flex-1">{task.title}</span>
                </div>
                {task.due_date && (
                  <span className="text-xs text-muted-foreground">
                    Échéance: {format(parseISO(task.due_date), 'dd/MM', { locale: fr })}
                  </span>
                )}
              </div>
            ))}
            {availableTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune tâche à planifier
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

      {/* Multi-slot dialog */}
      <Dialog open={showMultiSlotDialog} onOpenChange={setShowMultiSlotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planifier des créneaux</DialogTitle>
            <DialogDescription>
              Choisissez le nombre de demi-journées à planifier. Les créneaux seront automatiquement répartis en évitant les weekends, jours fériés et congés.
            </DialogDescription>
          </DialogHeader>
          
          {multiSlotContext && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{multiSlotContext.task.title}</p>
                <p className="text-sm text-muted-foreground">
                  À partir du {format(parseISO(multiSlotContext.date), 'EEEE d MMMM', { locale: fr })} ({multiSlotContext.halfDay === 'morning' ? 'matin' : 'après-midi'})
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="halfDayCount">Nombre de demi-journées</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setHalfDayCount(Math.max(1, halfDayCount - 1))}
                    disabled={halfDayCount <= 1}
                  >
                    -
                  </Button>
                  <Input
                    id="halfDayCount"
                    type="number"
                    min={1}
                    max={40}
                    value={halfDayCount}
                    onChange={(e) => setHalfDayCount(Math.max(1, Math.min(40, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setHalfDayCount(Math.min(40, halfDayCount + 1))}
                    disabled={halfDayCount >= 40}
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground ml-2">
                    = {(halfDayCount / 2).toFixed(1)} jour(s)
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setHalfDayCount(2)}
                >
                  1 jour
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setHalfDayCount(4)}
                >
                  2 jours
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setHalfDayCount(10)}
                >
                  1 semaine
                </Button>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMultiSlotDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmMultiSlot} disabled={isAdding}>
              {isAdding ? 'Ajout...' : `Planifier ${halfDayCount} créneau${halfDayCount > 1 ? 'x' : ''}`}
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
              Modifiez le nombre de demi-journées allouées à cette tâche. La segmentation recommencera à partir du premier créneau existant.
            </DialogDescription>
          </DialogHeader>
          
          {segmentContext && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{segmentContext.slot.task?.title}</p>
                <p className="text-sm text-muted-foreground">
                  Créneaux actuels: {segmentContext.currentCount} demi-journée{segmentContext.currentCount > 1 ? 's' : ''} ({(segmentContext.currentCount / 2).toFixed(1)} jour{segmentContext.currentCount > 2 ? 's' : ''})
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newSegmentCount">Nouveau nombre de demi-journées</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setNewSegmentCount(Math.max(1, newSegmentCount - 1))}
                    disabled={newSegmentCount <= 1}
                  >
                    -
                  </Button>
                  <Input
                    id="newSegmentCount"
                    type="number"
                    min={1}
                    max={40}
                    value={newSegmentCount}
                    onChange={(e) => setNewSegmentCount(Math.max(1, Math.min(40, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setNewSegmentCount(Math.min(40, newSegmentCount + 1))}
                    disabled={newSegmentCount >= 40}
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground ml-2">
                    = {(newSegmentCount / 2).toFixed(1)} jour(s)
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setNewSegmentCount(2)}
                >
                  1 jour
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setNewSegmentCount(4)}
                >
                  2 jours
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setNewSegmentCount(10)}
                >
                  1 semaine
                </Button>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSegmentDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmSegment} disabled={isAdding || !onSegmentSlot}>
              {isAdding ? 'Segmentation...' : `Segmenter en ${newSegmentCount} créneau${newSegmentCount > 1 ? 'x' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
