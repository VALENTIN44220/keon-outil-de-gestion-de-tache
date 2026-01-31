import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Task } from '@/types/task';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Plus, 
  ClipboardList, 
  Calendar, 
  User, 
  Clock,
  AlertTriangle,
  Flag,
  X,
  Check,
  Loader2
} from 'lucide-react';

interface QuickAddPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  availableTasks: Task[];
  onAddExistingTask: (taskId: string, slots: number) => Promise<void>;
  onCreateNewTask?: (title: string, priority: string, slots: number) => Promise<void>;
}

export function QuickAddPopover({
  isOpen,
  onClose,
  position,
  userId,
  userName,
  startDate,
  endDate,
  availableTasks,
  onAddExistingTask,
  onCreateNewTask,
}: QuickAddPopoverProps) {
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Calculate duration
  const duration = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  const slots = duration * 2; // Half-days
  
  // Filter tasks by search query
  const filteredTasks = availableTasks.filter(task => 
    task.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Reset state when popover closes
  useEffect(() => {
    if (!isOpen) {
      setMode('select');
      setSelectedTaskId('');
      setNewTaskTitle('');
      setPriority('medium');
      setSearchQuery('');
    }
  }, [isOpen]);
  
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      if (mode === 'select' && selectedTaskId) {
        await onAddExistingTask(selectedTaskId, slots);
      } else if (mode === 'create' && newTaskTitle.trim() && onCreateNewTask) {
        await onCreateNewTask(newTaskTitle.trim(), priority, slots);
      }
      onClose();
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, selectedTaskId, newTaskTitle, priority, slots, onAddExistingTask, onCreateNewTask, onClose, isSubmitting]);
  
  const canSubmit = mode === 'select' ? !!selectedTaskId : !!newTaskTitle.trim();
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: Math.min(position.x, window.innerWidth - 360),
        top: Math.min(position.y, window.innerHeight - 400),
      }}
    >
      <div className="bg-card border border-keon-200 rounded-xl shadow-2xl w-[340px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Planification rapide</h3>
                <p className="text-[11px] opacity-80">Glissez-déposez ou créez</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Selection info */}
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-md">
              <User className="h-3 w-3" />
              <span className="font-medium">{userName}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-md">
              <Calendar className="h-3 w-3" />
              <span>{format(parseISO(startDate), 'd MMM', { locale: fr })}</span>
              {startDate !== endDate && (
                <span>→ {format(parseISO(endDate), 'd MMM', { locale: fr })}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-md">
              <Clock className="h-3 w-3" />
              <span>{duration}j</span>
            </div>
          </div>
        </div>
        
        {/* Mode tabs */}
        <div className="flex border-b border-keon-100">
          <button
            className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-colors",
              mode === 'select' 
                ? "bg-keon-50 text-primary border-b-2 border-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setMode('select')}
          >
            <ClipboardList className="h-3.5 w-3.5 inline mr-1.5" />
            Tâche existante
          </button>
          {onCreateNewTask && (
            <button
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors",
                mode === 'create' 
                  ? "bg-keon-50 text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode('create')}
            >
              <Plus className="h-3.5 w-3.5 inline mr-1.5" />
              Nouvelle tâche
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="p-4">
          {mode === 'select' ? (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Input
                  placeholder="Rechercher une tâche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-3 pr-8 text-sm bg-keon-50 border-keon-200"
                />
                {searchQuery && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              
              {/* Task list */}
              <div className="max-h-[200px] overflow-y-auto space-y-1.5 -mx-1 px-1">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Aucune tâche disponible</p>
                  </div>
                ) : (
                  filteredTasks.slice(0, 10).map(task => (
                    <button
                      key={task.id}
                      className={cn(
                        "w-full text-left p-2.5 rounded-lg border transition-all",
                        "hover:bg-keon-50 hover:border-primary/30",
                        selectedTaskId === task.id 
                          ? "bg-primary/10 border-primary ring-1 ring-primary/20" 
                          : "border-keon-200"
                      )}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                          selectedTaskId === task.id ? "bg-primary text-white" : "bg-keon-100"
                        )}>
                          {selectedTaskId === task.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <ClipboardList className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {task.priority === 'urgent' && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                Urgent
                              </Badge>
                            )}
                            {task.priority === 'high' && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-orange-300 text-orange-600 bg-orange-50">
                                <Flag className="h-2.5 w-2.5 mr-0.5" />
                                Haute
                              </Badge>
                            )}
                            {task.due_date && (
                              <span className="text-[10px] text-muted-foreground">
                                Échéance: {format(parseISO(task.due_date), 'd MMM', { locale: fr })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
                {filteredTasks.length > 10 && (
                  <p className="text-[10px] text-center text-muted-foreground pt-2">
                    +{filteredTasks.length - 10} autres tâches
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Task title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Titre de la tâche</Label>
                <Input
                  placeholder="Ex: Révision du document..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="h-9 text-sm bg-keon-50 border-keon-200"
                  autoFocus
                />
              </div>
              
              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Priorité</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-9 text-sm bg-keon-50 border-keon-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Basse</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Moyenne</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span>Haute</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="urgent">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span>Urgente</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 pt-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9 border-keon-200"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            size="sm"
            className="flex-1 h-9"
            disabled={!canSubmit || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Planification...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Planifier
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
