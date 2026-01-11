import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ListTodo, Clock } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProcessWithTasks, TaskTemplate } from '@/types/template';
import { Task } from '@/types/task';
import { toast } from 'sonner';

interface CreateFromTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onTasksCreated: () => void;
}

const priorityLabels: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

export function CreateFromTemplateDialog({ open, onClose, onTasksCreated }: CreateFromTemplateDialogProps) {
  const { user } = useAuth();
  const [processes, setProcesses] = useState<ProcessWithTasks[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const selectedProcess = processes.find(p => p.id === selectedProcessId);

  useEffect(() => {
    if (open) {
      fetchProcesses();
    }
  }, [open]);

  const fetchProcesses = async () => {
    setIsFetching(true);
    try {
      const { data: processData, error } = await supabase
        .from('process_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const processesWithTasks: ProcessWithTasks[] = await Promise.all(
        (processData || []).map(async (process) => {
          const { data: tasks } = await supabase
            .from('task_templates')
            .select('*')
            .eq('process_template_id', process.id)
            .order('order_index', { ascending: true });

          return {
            ...process,
            task_templates: (tasks || []) as TaskTemplate[],
          };
        })
      );

      setProcesses(processesWithTasks);
    } catch (error) {
      console.error('Error fetching processes:', error);
      toast.error('Erreur lors du chargement des processus');
    } finally {
      setIsFetching(false);
    }
  };

  const calculateDueDate = (taskIndex: number, templates: TaskTemplate[]): string => {
    let totalDays = 0;
    for (let i = 0; i <= taskIndex; i++) {
      totalDays += templates[i].default_duration_days;
    }
    return format(addDays(startDate, totalDays), 'yyyy-MM-dd');
  };

  const handleCreate = async () => {
    if (!user || !selectedProcess) return;

    setIsLoading(true);
    try {
      // First, fetch all template checklists for this process's task templates
      const templateIds = selectedProcess.task_templates.map(t => t.id);
      const { data: templateChecklists } = await supabase
        .from('task_template_checklists')
        .select('*')
        .in('task_template_id', templateIds)
        .order('order_index', { ascending: true });

      // Create a map of template id to its checklists
      const checklistsByTemplate: Record<string, { title: string; order_index: number }[]> = {};
      (templateChecklists || []).forEach((item: any) => {
        if (!checklistsByTemplate[item.task_template_id]) {
          checklistsByTemplate[item.task_template_id] = [];
        }
        checklistsByTemplate[item.task_template_id].push({
          title: item.title,
          order_index: item.order_index,
        });
      });

      const tasksToCreate = selectedProcess.task_templates.map((template, index) => ({
        title: template.title,
        description: template.description,
        priority: template.priority,
        status: 'todo' as const,
        type: 'task' as const,
        category: template.category,
        category_id: template.category_id,
        subcategory_id: template.subcategory_id,
        due_date: calculateDueDate(index, selectedProcess.task_templates),
        user_id: user.id,
        assignee_id: null,
        requester_id: null,
        reporter_id: null,
        target_department_id: null,
      }));

      const { data: createdTasks, error } = await supabase
        .from('tasks')
        .insert(tasksToCreate)
        .select();

      if (error) throw error;

      // Now create the checklists for each created task
      if (createdTasks && createdTasks.length > 0) {
        const checklistsToCreate: { task_id: string; title: string; order_index: number }[] = [];
        
        createdTasks.forEach((task, index) => {
          const templateId = selectedProcess.task_templates[index].id;
          const templateChecklistItems = checklistsByTemplate[templateId] || [];
          
          templateChecklistItems.forEach(item => {
            checklistsToCreate.push({
              task_id: task.id,
              title: item.title,
              order_index: item.order_index,
            });
          });
        });

        if (checklistsToCreate.length > 0) {
          await supabase
            .from('task_checklists')
            .insert(checklistsToCreate);
        }
      }

      toast.success(`${tasksToCreate.length} tâche(s) créée(s) avec succès`);
      onTasksCreated();
      handleClose();
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast.error('Erreur lors de la création des tâches');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedProcessId('');
    setStartDate(new Date());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Créer depuis un modèle</DialogTitle>
          <DialogDescription>
            Sélectionnez un processus pour générer automatiquement toutes ses tâches
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Process Selection */}
          <div className="space-y-2">
            <Label>Modèle de processus</Label>
            <Select 
              value={selectedProcessId} 
              onValueChange={setSelectedProcessId}
              disabled={isFetching}
            >
              <SelectTrigger>
                <SelectValue placeholder={isFetching ? "Chargement..." : "Sélectionner un processus"} />
              </SelectTrigger>
              <SelectContent>
                {processes.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Aucun processus disponible
                  </SelectItem>
                ) : (
                  processes.map(process => (
                    <SelectItem key={process.id} value={process.id}>
                      <div className="flex items-center gap-2">
                        <span>{process.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {process.task_templates.length} tâche(s)
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date Selection */}
          <div className="space-y-2">
            <Label>Date de début</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "PPP", { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Preview of tasks to be created */}
          {selectedProcess && selectedProcess.task_templates.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                Aperçu des tâches ({selectedProcess.task_templates.length})
              </Label>
              <div className="max-h-60 overflow-y-auto rounded-lg border bg-muted/30 p-3 space-y-2">
                {selectedProcess.task_templates.map((template, index) => (
                  <div 
                    key={template.id}
                    className="flex items-center justify-between p-2 rounded-md bg-background"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium w-5">
                        {index + 1}.
                      </span>
                      <span className="text-sm truncate max-w-[200px]">{template.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {priorityLabels[template.priority]}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(addDays(startDate, selectedProcess.task_templates
                          .slice(0, index + 1)
                          .reduce((sum, t) => sum + t.default_duration_days, 0)), "dd/MM", { locale: fr })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedProcess && selectedProcess.task_templates.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              Ce processus ne contient aucune tâche modèle
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!selectedProcess || selectedProcess.task_templates.length === 0 || isLoading}
          >
            {isLoading ? 'Création...' : `Créer ${selectedProcess?.task_templates.length || 0} tâche(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
