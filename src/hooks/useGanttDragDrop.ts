import { useState, useCallback, useRef, useMemo } from 'react';
import { Task } from '@/types/task';
import { WorkloadSlot, TeamMemberWorkload } from '@/types/workload';
import { format, parseISO, addDays, differenceInDays, isWeekend, eachDayOfInterval } from 'date-fns';

export type DragMode = 'move' | 'resize-start' | 'resize-end' | 'quick-add' | 'reassign' | null;

export interface DragState {
  mode: DragMode;
  taskId: string | null;
  originalSlots: WorkloadSlot[];
  originalUserId: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startDate: string | null;
  endDate: string | null;
  newUserId: string | null;
  newStartDate: string | null;
  newEndDate: string | null;
  isValid: boolean;
}

interface OptimisticUpdate {
  type: 'move' | 'resize' | 'reassign' | 'add';
  taskId: string;
  userId: string;
  slots: WorkloadSlot[];
  originalSlots?: WorkloadSlot[];
  originalUserId?: string;
}

interface UseGanttDragDropProps {
  workloadData: TeamMemberWorkload[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  rowHeight: number;
  memberColumnWidth: number;
  isHalfDayAvailable: (userId: string, date: string, halfDay: 'morning' | 'afternoon') => boolean;
  onSlotMove: (slotId: string, newDate: string, newHalfDay: 'morning' | 'afternoon') => Promise<void>;
  onSlotAdd: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon') => Promise<void>;
  onSlotRemove: (slotId: string) => Promise<void>;
  onMultiSlotAdd?: (taskId: string, userId: string, date: string, halfDay: 'morning' | 'afternoon', count: number) => Promise<void>;
  onReassignTask?: (taskId: string, fromUserId: string, toUserId: string, newStartDate: string) => Promise<void>;
}

export function useGanttDragDrop({
  workloadData,
  startDate,
  endDate,
  dayWidth,
  rowHeight,
  memberColumnWidth,
  isHalfDayAvailable,
  onSlotMove,
  onSlotAdd,
  onSlotRemove,
  onMultiSlotAdd,
  onReassignTask,
}: UseGanttDragDropProps) {
  const [dragState, setDragState] = useState<DragState>({
    mode: null,
    taskId: null,
    originalSlots: [],
    originalUserId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startDate: null,
    endDate: null,
    newUserId: null,
    newStartDate: null,
    newEndDate: null,
    isValid: false,
  });

  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Get all days
  const days = useMemo(() => 
    eachDayOfInterval({ start: startDate, end: endDate }), 
    [startDate, endDate]
  );

  // Convert X coordinate to date and half-day
  const xToDateAndHalfDay = useCallback((x: number): { date: string; halfDay: 'morning' | 'afternoon' } | null => {
    const gridX = x - memberColumnWidth;
    if (gridX < 0) return null;
    
    const dayIndex = Math.floor(gridX / dayWidth);
    if (dayIndex < 0 || dayIndex >= days.length) return null;
    
    const day = days[dayIndex];
    const offsetInDay = gridX % dayWidth;
    const halfDay: 'morning' | 'afternoon' = offsetInDay < dayWidth / 2 ? 'morning' : 'afternoon';
    
    return { date: format(day, 'yyyy-MM-dd'), halfDay };
  }, [days, dayWidth, memberColumnWidth]);

  // Convert Y coordinate to user ID
  const yToUserId = useCallback((y: number): string | null => {
    const rowIndex = Math.floor(y / rowHeight);
    if (rowIndex < 0 || rowIndex >= workloadData.length) return null;
    return workloadData[rowIndex].memberId;
  }, [workloadData, rowHeight]);

  // Check if a date range is valid for a user
  const isRangeValid = useCallback((
    userId: string, 
    startDateStr: string, 
    endDateStr: string, 
    excludeTaskId?: string
  ): boolean => {
    const start = parseISO(startDateStr);
    const end = parseISO(endDateStr);
    const daysInRange = eachDayOfInterval({ start, end });
    
    for (const day of daysInRange) {
      const dateStr = format(day, 'yyyy-MM-dd');
      if (isWeekend(day)) continue; // Skip weekends
      
      // Check morning and afternoon
      if (!isHalfDayAvailable(userId, dateStr, 'morning')) {
        // Check if it's occupied by the task we're moving
        if (!excludeTaskId) return false;
      }
      if (!isHalfDayAvailable(userId, dateStr, 'afternoon')) {
        if (!excludeTaskId) return false;
      }
    }
    
    return true;
  }, [isHalfDayAvailable]);

  // Start dragging a task bar
  const startDrag = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    mode: DragMode,
    taskId: string,
    slots: WorkloadSlot[],
    userId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Get the earliest and latest slot dates
    const sortedSlots = [...slots].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.half_day === 'morning' ? -1 : 1;
    });
    
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    setDragState({
      mode,
      taskId,
      originalSlots: slots,
      originalUserId: userId,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      startDate: firstSlot?.date || null,
      endDate: lastSlot?.date || null,
      newUserId: userId,
      newStartDate: firstSlot?.date || null,
      newEndDate: lastSlot?.date || null,
      isValid: true,
    });
    
    // Add global event listeners
    document.addEventListener('mousemove', handleDrag as any);
    document.addEventListener('mouseup', endDrag as any);
    document.addEventListener('touchmove', handleDrag as any);
    document.addEventListener('touchend', endDrag as any);
  }, []);

  // Handle drag movement
  const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDragState(prev => {
      if (!prev.mode) return prev;
      
      const deltaX = clientX - prev.startX;
      const deltaY = clientY - prev.startY;
      
      // Calculate new position based on mode
      let newState = { ...prev, currentX: clientX, currentY: clientY };
      
      if (prev.mode === 'move' || prev.mode === 'reassign') {
        // Calculate date offset
        const dayOffset = Math.round(deltaX / dayWidth);
        
        if (prev.startDate) {
          const origStart = parseISO(prev.startDate);
          const newStart = addDays(origStart, dayOffset);
          newState.newStartDate = format(newStart, 'yyyy-MM-dd');
          
          if (prev.endDate) {
            const origEnd = parseISO(prev.endDate);
            const newEnd = addDays(origEnd, dayOffset);
            newState.newEndDate = format(newEnd, 'yyyy-MM-dd');
          }
        }
        
        // Calculate user offset for vertical drag
        const rowOffset = Math.round(deltaY / rowHeight);
        const currentUserIndex = workloadData.findIndex(m => m.memberId === prev.originalUserId);
        const newUserIndex = Math.max(0, Math.min(workloadData.length - 1, currentUserIndex + rowOffset));
        newState.newUserId = workloadData[newUserIndex]?.memberId || prev.originalUserId;
        
        // Validate the new position
        if (newState.newUserId && newState.newStartDate && newState.newEndDate) {
          newState.isValid = isRangeValid(
            newState.newUserId, 
            newState.newStartDate, 
            newState.newEndDate,
            prev.taskId || undefined
          );
        }
      } else if (prev.mode === 'resize-end') {
        // Resize from end - extend or shrink
        const dayOffset = Math.round(deltaX / dayWidth);
        
        if (prev.endDate) {
          const origEnd = parseISO(prev.endDate);
          const newEnd = addDays(origEnd, dayOffset);
          
          // Don't allow end before start
          if (prev.startDate && newEnd >= parseISO(prev.startDate)) {
            newState.newEndDate = format(newEnd, 'yyyy-MM-dd');
            newState.isValid = true;
          } else {
            newState.isValid = false;
          }
        }
      } else if (prev.mode === 'resize-start') {
        // Resize from start - extend or shrink
        const dayOffset = Math.round(deltaX / dayWidth);
        
        if (prev.startDate) {
          const origStart = parseISO(prev.startDate);
          const newStart = addDays(origStart, dayOffset);
          
          // Don't allow start after end
          if (prev.endDate && newStart <= parseISO(prev.endDate)) {
            newState.newStartDate = format(newStart, 'yyyy-MM-dd');
            newState.isValid = true;
          } else {
            newState.isValid = false;
          }
        }
      }
      
      return newState;
    });
  }, [dayWidth, rowHeight, workloadData, isRangeValid]);

  // End drag and apply changes
  const endDrag = useCallback(async () => {
    // Remove global event listeners
    document.removeEventListener('mousemove', handleDrag as any);
    document.removeEventListener('mouseup', endDrag as any);
    document.removeEventListener('touchmove', handleDrag as any);
    document.removeEventListener('touchend', endDrag as any);
    
    const state = dragState;
    
    if (!state.mode || !state.isValid || isProcessing) {
      setDragState(prev => ({ ...prev, mode: null }));
      return;
    }
    
    setIsProcessing(true);
    
    try {
      if (state.mode === 'move' && state.originalSlots.length > 0 && state.newStartDate) {
        // Calculate the offset
        const origStart = parseISO(state.startDate!);
        const newStart = parseISO(state.newStartDate);
        const dayOffset = differenceInDays(newStart, origStart);
        
        // Check if user changed
        const userChanged = state.newUserId !== state.originalUserId;
        
        if (dayOffset !== 0 || userChanged) {
          // Optimistic update
          const updatedSlots = state.originalSlots.map(slot => ({
            ...slot,
            date: format(addDays(parseISO(slot.date), dayOffset), 'yyyy-MM-dd'),
            user_id: state.newUserId || slot.user_id,
          }));
          
          setOptimisticUpdates(prev => [...prev, {
            type: 'move',
            taskId: state.taskId!,
            userId: state.newUserId!,
            slots: updatedSlots,
            originalSlots: state.originalSlots,
            originalUserId: state.originalUserId!,
          }]);
          
          // Apply changes to DB
          for (const slot of state.originalSlots) {
            const newDate = format(addDays(parseISO(slot.date), dayOffset), 'yyyy-MM-dd');
            await onSlotMove(slot.id, newDate, slot.half_day as 'morning' | 'afternoon');
          }
          
          // Handle reassignment if user changed
          if (userChanged && onReassignTask && state.taskId && state.originalUserId && state.newUserId) {
            await onReassignTask(state.taskId, state.originalUserId, state.newUserId, state.newStartDate);
          }
          
          // Clear optimistic update on success
          setOptimisticUpdates(prev => prev.filter(u => u.taskId !== state.taskId));
        }
      } else if ((state.mode === 'resize-start' || state.mode === 'resize-end') && state.taskId) {
        // Handle resize
        const origSlotCount = state.originalSlots.length;
        const origStart = parseISO(state.startDate!);
        const origEnd = parseISO(state.endDate!);
        const newStart = parseISO(state.newStartDate!);
        const newEnd = parseISO(state.newEndDate!);
        
        const newDayCount = differenceInDays(newEnd, newStart) + 1;
        const origDayCount = differenceInDays(origEnd, origStart) + 1;
        
        if (newDayCount !== origDayCount && onMultiSlotAdd) {
          // Need to recreate slots with new duration
          // This is a simplified approach - you might want to preserve existing slots
          const newSlotCount = newDayCount * 2; // Half-days
          
          // Remove old slots
          for (const slot of state.originalSlots) {
            await onSlotRemove(slot.id);
          }
          
          // Add new slots
          await onMultiSlotAdd(
            state.taskId,
            state.originalUserId!,
            format(newStart, 'yyyy-MM-dd'),
            'morning',
            newSlotCount
          );
        }
      }
    } catch (error) {
      console.error('Error applying drag changes:', error);
      // Rollback optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.taskId !== state.taskId));
    } finally {
      setIsProcessing(false);
      setDragState(prev => ({ ...prev, mode: null }));
    }
  }, [dragState, isProcessing, onSlotMove, onSlotRemove, onMultiSlotAdd, onReassignTask, handleDrag]);

  // Quick add - start creating a new task by dragging on empty space
  const startQuickAdd = useCallback((
    e: React.MouseEvent,
    userId: string,
    date: string,
    halfDay: 'morning' | 'afternoon'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    setDragState({
      mode: 'quick-add',
      taskId: null,
      originalSlots: [],
      originalUserId: userId,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      startDate: date,
      endDate: date,
      newUserId: userId,
      newStartDate: date,
      newEndDate: date,
      isValid: true,
    });
    
    document.addEventListener('mousemove', handleQuickAddDrag as any);
    document.addEventListener('mouseup', endQuickAdd as any);
  }, []);

  const handleQuickAddDrag = useCallback((e: MouseEvent) => {
    e.preventDefault();
    
    setDragState(prev => {
      if (prev.mode !== 'quick-add') return prev;
      
      const result = xToDateAndHalfDay(e.clientX);
      if (!result) return prev;
      
      // Extend the selection
      const startD = parseISO(prev.startDate!);
      const currentD = parseISO(result.date);
      
      let newStartDate = prev.startDate!;
      let newEndDate = result.date;
      
      // Ensure start is before end
      if (currentD < startD) {
        newStartDate = result.date;
        newEndDate = prev.startDate!;
      }
      
      return {
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
        newStartDate,
        newEndDate,
        isValid: true,
      };
    });
  }, [xToDateAndHalfDay]);

  const endQuickAdd = useCallback(() => {
    document.removeEventListener('mousemove', handleQuickAddDrag as any);
    document.removeEventListener('mouseup', endQuickAdd as any);
    
    // The parent component will handle the actual task creation
    // We just provide the selection info via getQuickAddSelection
    
    setDragState(prev => ({ ...prev, mode: null }));
  }, [handleQuickAddDrag]);

  // Get the current quick add selection
  const getQuickAddSelection = useCallback(() => {
    if (dragState.mode !== 'quick-add') return null;
    
    return {
      userId: dragState.newUserId,
      startDate: dragState.newStartDate,
      endDate: dragState.newEndDate,
    };
  }, [dragState]);

  // Calculate visual offset for a task during drag
  const getDragOffset = useCallback((taskId: string): { x: number; y: number } | null => {
    if (dragState.taskId !== taskId || !dragState.mode) return null;
    
    return {
      x: dragState.currentX - dragState.startX,
      y: dragState.currentY - dragState.startY,
    };
  }, [dragState]);

  // Get optimistic slot positions for a task
  const getOptimisticSlots = useCallback((taskId: string): WorkloadSlot[] | null => {
    const update = optimisticUpdates.find(u => u.taskId === taskId);
    return update?.slots || null;
  }, [optimisticUpdates]);

  return {
    dragState,
    isProcessing,
    startDrag,
    startQuickAdd,
    getDragOffset,
    getOptimisticSlots,
    getQuickAddSelection,
    containerRef,
  };
}
