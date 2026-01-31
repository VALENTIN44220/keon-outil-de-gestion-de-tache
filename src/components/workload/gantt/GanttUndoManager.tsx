import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { WorkloadSlot } from '@/types/workload';
import { Undo2, X, Check } from 'lucide-react';

interface UndoAction {
  id: string;
  type: 'move' | 'resize' | 'add' | 'delete' | 'reassign' | 'bulk';
  description: string;
  timestamp: number;
  undo: () => Promise<void>;
  data?: any;
}

interface UseGanttUndoProps {
  undoTimeoutMs?: number;
}

export function useGanttUndo({ undoTimeoutMs = 5000 }: UseGanttUndoProps = {}) {
  const [pendingActions, setPendingActions] = useState<UndoAction[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const addUndoAction = useCallback((action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newAction: UndoAction = {
      ...action,
      id,
      timestamp: Date.now(),
    };
    
    setPendingActions(prev => [...prev, newAction]);
    
    // Set timeout to remove the undo option
    const timeout = setTimeout(() => {
      setPendingActions(prev => prev.filter(a => a.id !== id));
      timeoutsRef.current.delete(id);
    }, undoTimeoutMs);
    
    timeoutsRef.current.set(id, timeout);
    
    return id;
  }, [undoTimeoutMs]);
  
  const executeUndo = useCallback(async (actionId: string) => {
    const action = pendingActions.find(a => a.id === actionId);
    if (!action) return;
    
    // Clear the timeout
    const timeout = timeoutsRef.current.get(actionId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(actionId);
    }
    
    // Remove from pending
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
    
    // Execute the undo
    try {
      await action.undo();
    } catch (error) {
      console.error('Undo failed:', error);
    }
  }, [pendingActions]);
  
  const dismissUndo = useCallback((actionId: string) => {
    // Clear the timeout
    const timeout = timeoutsRef.current.get(actionId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(actionId);
    }
    
    // Remove from pending
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);
  
  return {
    pendingActions,
    addUndoAction,
    executeUndo,
    dismissUndo,
  };
}

// Floating undo toast notifications
interface GanttUndoToastsProps {
  actions: UndoAction[];
  onUndo: (actionId: string) => void;
  onDismiss: (actionId: string) => void;
  undoTimeoutMs?: number;
}

export function GanttUndoToasts({
  actions,
  onUndo,
  onDismiss,
  undoTimeoutMs = 5000,
}: GanttUndoToastsProps) {
  if (actions.length === 0) return null;
  
  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2">
      {actions.map(action => (
        <UndoToast
          key={action.id}
          action={action}
          onUndo={() => onUndo(action.id)}
          onDismiss={() => onDismiss(action.id)}
          timeoutMs={undoTimeoutMs}
        />
      ))}
    </div>
  );
}

interface UndoToastProps {
  action: UndoAction;
  onUndo: () => void;
  onDismiss: () => void;
  timeoutMs: number;
}

function UndoToast({ action, onUndo, onDismiss, timeoutMs }: UndoToastProps) {
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / timeoutMs) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [timeoutMs]);
  
  return (
    <div className="animate-in slide-in-from-right-4 fade-in duration-200 w-80">
      <div className="bg-slate-900 text-white rounded-xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div 
            className="h-full bg-primary transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="p-3 flex items-center gap-3">
          {/* Success icon */}
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Check className="h-4 w-4 text-emerald-400" />
          </div>
          
          {/* Message */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{action.description}</p>
            <p className="text-[10px] text-white/60 mt-0.5">
              Cliquez pour annuler ({Math.ceil(progress / 100 * (timeoutMs / 1000))}s)
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/20"
              onClick={onUndo}
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Annuler</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10"
              onClick={onDismiss}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Saving indicator component
interface SavingIndicatorProps {
  isSaving: boolean;
  lastSaved?: Date;
}

export function SavingIndicator({ isSaving, lastSaved }: SavingIndicatorProps) {
  if (!isSaving && !lastSaved) return null;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
      isSaving 
        ? "bg-amber-100 text-amber-700 border border-amber-200" 
        : "bg-emerald-100 text-emerald-700 border border-emerald-200"
    )}>
      {isSaving ? (
        <>
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Enregistrement...</span>
        </>
      ) : (
        <>
          <Check className="h-3 w-3" />
          <span>Sauvegardé</span>
        </>
      )}
    </div>
  );
}
