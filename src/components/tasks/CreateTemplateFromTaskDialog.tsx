import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { ProcessWithTasks } from '@/types/template';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FileText, Plus } from 'lucide-react';

interface CreateTemplateFromTaskDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  onSuccess?: () => void;
}

export function CreateTemplateFromTaskDialog({ 
  open, 
  onClose, 
  task,
  onSuccess 
}: CreateTemplateFromTaskDialogProps) {
  const { user } = useAuth();
  const [processes, setProcesses] = useState<ProcessWithTasks[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string>('new');
  const [newProcessName, setNewProcessName] = useState('');
  const [newProcessDescription, setNewProcessDescription] = useState('');
  const [defaultDurationDays, setDefaultDurationDays] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [checklistItems, setChecklistItems] = useState<{ title: string; order_index: number }[]>([]);

  useEffect(() => {
    if (open && user) {
      fetchProcesses();
      fetchTaskChecklists();
    }
  }, [open, user]);

  const fetchProcesses = async () => {
    const { data, error } = await supabase
      .from('process_templates')
      .select('*')
      .order('name');

    if (!error && data) {
      setProcesses(data.map(p => ({ ...p, task_templates: [] })));
    }
  };

  const fetchTaskChecklists = async () => {
    const { data, error } = await supabase
      .from('task_checklists')
      .select('title, order_index')
      .eq('task_id', task.id)
      .order('order_index');

    if (!error && data) {
      setChecklistItems(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      let processId = selectedProcessId;

      // Create new process if needed
      if (selectedProcessId === 'new') {
        if (!newProcessName.trim()) {
          toast.error('Veuillez entrer un nom pour le nouveau processus');
          setIsLoading(false);
          return;
        }

        const { data: newProcess, error: processError } = await supabase
          .from('process_templates')
          .insert({
            name: newProcessName.trim(),
            description: newProcessDescription.trim() || null,
            user_id: user.id,
          })
          .select()
          .single();

        if (processError) throw processError;
        processId = newProcess.id;
      }

      // Create task template from the task
      const { data: taskTemplate, error: taskError } = await supabase
        .from('task_templates')
        .insert({
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: task.category,
          category_id: task.category_id,
          subcategory_id: task.subcategory_id,
          default_duration_days: defaultDurationDays,
          order_index: 0,
          user_id: user.id,
          process_template_id: processId,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Copy checklist items if any
      if (checklistItems.length > 0) {
        const checklistsToCreate = checklistItems.map(item => ({
          task_template_id: taskTemplate.id,
          title: item.title,
          order_index: item.order_index,
        }));

        await supabase
          .from('task_template_checklists')
          .insert(checklistsToCreate);
      }

      toast.success('Modèle de tâche créé avec succès');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Erreur lors de la création du modèle');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Créer un modèle depuis cette tâche
          </DialogTitle>
          <DialogDescription>
            Créez un modèle de tâche réutilisable à partir de "{task.title}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Processus cible</Label>
            <Select 
              value={selectedProcessId} 
              onValueChange={setSelectedProcessId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un processus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nouveau processus
                  </span>
                </SelectItem>
                {processes.map(process => (
                  <SelectItem key={process.id} value={process.id}>
                    {process.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProcessId === 'new' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="processName">Nom du nouveau processus *</Label>
                <Input
                  id="processName"
                  value={newProcessName}
                  onChange={(e) => setNewProcessName(e.target.value)}
                  placeholder="Ex: Onboarding client"
                  required={selectedProcessId === 'new'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="processDescription">Description</Label>
                <Input
                  id="processDescription"
                  value={newProcessDescription}
                  onChange={(e) => setNewProcessDescription(e.target.value)}
                  placeholder="Description du processus"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="duration">Durée par défaut (jours)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={defaultDurationDays}
              onChange={(e) => setDefaultDurationDays(parseInt(e.target.value) || 7)}
            />
          </div>

          {checklistItems.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {checklistItems.length} sous-action(s) seront également copiées dans le modèle
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Création...' : 'Créer le modèle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
