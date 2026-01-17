import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Layers, GitBranch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TaskTemplate } from '@/types/template';

interface TaskTemplateWithContext extends TaskTemplate {
  process_name?: string | null;
  sub_process_name?: string | null;
}

interface LinkExistingTaskDialogProps {
  open: boolean;
  onClose: () => void;
  subProcessId: string;
  processId: string | null;
  existingTaskIds: string[];
  onTasksLinked: () => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export function LinkExistingTaskDialog({ 
  open, 
  onClose, 
  subProcessId, 
  processId,
  existingTaskIds,
  onTasksLinked 
}: LinkExistingTaskDialogProps) {
  const [tasks, setTasks] = useState<TaskTemplateWithContext[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskTemplateWithContext[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAvailableTasks();
      setSelectedTaskIds(new Set());
      setSearchQuery('');
    }
  }, [open]);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    setFilteredTasks(
      tasks.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.process_name?.toLowerCase().includes(query) ||
        t.sub_process_name?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, tasks]);

  const fetchAvailableTasks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_templates')
        .select(`
          *,
          process_templates (id, name),
          sub_process_templates (id, name)
        `)
        .order('title');

      if (error) throw error;

      const availableTasks = (data || [])
        .filter(t => !existingTaskIds.includes(t.id))
        .map(t => ({
          ...t,
          priority: t.priority as 'low' | 'medium' | 'high' | 'urgent',
          visibility_level: t.visibility_level as TaskTemplate['visibility_level'],
          validation_level_1: (t.validation_level_1 || 'none') as TaskTemplate['validation_level_1'],
          validation_level_2: (t.validation_level_2 || 'none') as TaskTemplate['validation_level_2'],
          process_name: (t as any).process_templates?.name || null,
          sub_process_name: (t as any).sub_process_templates?.name || null,
        }));

      setTasks(availableTasks);
      setFilteredTasks(availableTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleLink = async () => {
    if (selectedTaskIds.size === 0) return;

    setIsLinking(true);
    try {
      // Update selected tasks to link them to this sub-process
      const { error } = await supabase
        .from('task_templates')
        .update({ 
          sub_process_template_id: subProcessId,
          process_template_id: processId 
        })
        .in('id', Array.from(selectedTaskIds));

      if (error) throw error;

      toast.success(`${selectedTaskIds.size} tâche(s) liée(s) au sous-processus`);
      onTasksLinked();
      onClose();
    } catch (error) {
      console.error('Error linking tasks:', error);
      toast.error('Erreur lors de la liaison des tâches');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Ajouter des tâches existantes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une tâche..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground">Chargement...</span>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p>Aucune tâche disponible</p>
                <p className="text-sm">Toutes les tâches sont déjà liées à ce sous-processus</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredTasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedTaskIds.has(task.id) 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleTask(task.id)}
                  >
                    <Checkbox
                      checked={selectedTaskIds.has(task.id)}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{task.title}</span>
                        <Badge variant="outline" className={`text-xs shrink-0 ${priorityColors[task.priority]}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {task.process_name && (
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {task.process_name}
                          </span>
                        )}
                        {task.sub_process_name && (
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {task.sub_process_name}
                          </span>
                        )}
                        {!task.process_name && !task.sub_process_name && (
                          <span className="italic">Tâche indépendante</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedTaskIds.size > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedTaskIds.size} tâche(s) sélectionnée(s)
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={selectedTaskIds.size === 0 || isLinking}
          >
            {isLinking ? 'Liaison...' : `Lier ${selectedTaskIds.size || ''} tâche(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
