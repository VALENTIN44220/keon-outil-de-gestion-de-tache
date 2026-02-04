import { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategorySelect } from '@/components/templates/CategorySelect';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { TaskChecklist } from './TaskChecklist';
import { TaskLinksEditor } from './TaskLinksEditor';
import { Badge } from '@/components/ui/badge';
import { Ticket, CheckSquare, Save, Loader2, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTaskAttachments } from '@/hooks/useTaskAttachments';
import { useDueDatePermissionWithManager } from '@/hooks/useDueDatePermission';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getStatusSelectOptions } from '@/services/taskStatusService';

interface Department {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  job_title: string | null;
}

interface TaskEditDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
}

// Use centralized status options from taskStatusService
const statusOptions = getStatusSelectOptions();

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Basse' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Haute' },
  { value: 'urgent', label: 'Urgente' },
];

export function TaskEditDialog({ task, open, onClose, onTaskUpdated }: TaskEditDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [requesterId, setRequesterId] = useState<string | null>(null);
  const [reporterId, setReporterId] = useState<string | null>(null);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(null);
  
  // Assignee manager for due date permission
  const [assigneeManagerId, setAssigneeManagerId] = useState<string | null>(null);
  
  // Data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const { categories, addCategory, addSubcategory } = useCategories();
  const { attachments, addAttachment, deleteAttachment } = useTaskAttachments(task?.id || null);
  
  // Due date permission check
  const { canEditDueDate, reason: dueDateReason } = useDueDatePermissionWithManager(task, assigneeManagerId);

  // Initialize form when task changes
  useEffect(() => {
    if (task && open) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setCategoryId(task.category_id);
      setSubcategoryId(task.subcategory_id);
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
      setAssigneeId(task.assignee_id);
      setRequesterId(task.requester_id);
      setReporterId(task.reporter_id);
      setTargetDepartmentId(task.target_department_id);
      
      fetchProfiles();
      fetchDepartments();
      fetchAssigneeManager(task.assignee_id);
    }
  }, [task, open]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, job_title')
      .order('display_name');

    if (!error && data) {
      setProfiles(data);
    }
  };

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    if (data) setDepartments(data);
  };
  
  const fetchAssigneeManager = async (assigneeProfileId: string | null) => {
    if (!assigneeProfileId) {
      setAssigneeManagerId(null);
      return;
    }
    
    const { data } = await supabase
      .from('profiles')
      .select('manager_id')
      .eq('id', assigneeProfileId)
      .single();
    
    setAssigneeManagerId(data?.manager_id || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!task || !title.trim()) return;

    setIsLoading(true);

    const selectedCategory = categories.find(c => c.id === categoryId);

    const { error } = await supabase
      .from('tasks')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        category: selectedCategory?.name || null,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        due_date: dueDate || null,
        assignee_id: assigneeId,
        requester_id: requesterId,
        reporter_id: reporterId,
        target_department_id: targetDepartmentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    setIsLoading(false);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la tâche',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Tâche mise à jour',
        description: 'Les modifications ont été enregistrées',
      });
      onTaskUpdated();
      onClose();
    }
  };

  const handleAddCategory = async (name: string) => {
    const newCategory = await addCategory(name);
    if (newCategory) {
      setCategoryId(newCategory.id);
    }
  };

  const handleAddSubcategory = async (catId: string, name: string) => {
    const newSubcategory = await addSubcategory(catId, name);
    if (newSubcategory) {
      setSubcategoryId(newSubcategory.id);
    }
  };

  const isRequest = task?.type === 'request';

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRequest ? (
              <>
                <Ticket className="h-5 w-5" />
                Modifier la demande
                <Badge variant="secondary">Ticket</Badge>
              </>
            ) : (
              <>
                <CheckSquare className="h-5 w-5" />
                Modifier la tâche
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la tâche"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description détaillée..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="dueDate">Date d'échéance</Label>
              {!canEditDueDate && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{dueDateReason}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!canEditDueDate}
              className={!canEditDueDate ? 'opacity-50 cursor-not-allowed' : ''}
            />
          </div>

          <CategorySelect
            categories={categories}
            selectedCategoryId={categoryId}
            selectedSubcategoryId={subcategoryId}
            onCategoryChange={setCategoryId}
            onSubcategoryChange={setSubcategoryId}
            onAddCategory={handleAddCategory}
            onAddSubcategory={handleAddSubcategory}
          />

          {/* Assignment section */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-medium mb-3 block">Affectation</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service cible</Label>
                <Select 
                  value={targetDepartmentId || 'none'} 
                  onValueChange={(v) => setTargetDepartmentId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Exécutant</Label>
                <Select 
                  value={assigneeId || 'none'} 
                  onValueChange={(v) => setAssigneeId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner l'exécutant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.display_name || 'Sans nom'} 
                        {profile.job_title && ` - ${profile.job_title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tabs for additional features */}
          <Tabs defaultValue="checklist" className="border-t pt-4 mt-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="checklist">Sous-actions</TabsTrigger>
              <TabsTrigger value="links">Liens & PJ</TabsTrigger>
              <TabsTrigger value="roles">Responsabilités</TabsTrigger>
            </TabsList>
            
            <TabsContent value="checklist" className="mt-4">
              <TaskChecklist taskId={task.id} />
            </TabsContent>

            <TabsContent value="links" className="mt-4">
              <div className="space-y-4">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center justify-between p-2 border rounded">
                    <a 
                      href={att.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {att.name}
                    </a>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteAttachment(att.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nom du lien" 
                    id="link-name"
                    className="flex-1"
                  />
                  <Input 
                    placeholder="URL" 
                    id="link-url"
                    className="flex-1"
                  />
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const nameInput = document.getElementById('link-name') as HTMLInputElement;
                      const urlInput = document.getElementById('link-url') as HTMLInputElement;
                      if (nameInput?.value && urlInput?.value) {
                        addAttachment(nameInput.value, urlInput.value, 'link');
                        nameInput.value = '';
                        urlInput.value = '';
                      }
                    }}
                  >
                    Ajouter
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="roles" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Demandeur</Label>
                <Select 
                  value={requesterId || 'none'} 
                  onValueChange={(v) => setRequesterId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le demandeur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.display_name || 'Sans nom'} 
                        {profile.job_title && ` - ${profile.job_title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rapporteur</Label>
                <Select 
                  value={reporterId || 'none'} 
                  onValueChange={(v) => setReporterId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le rapporteur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.display_name || 'Sans nom'} 
                        {profile.job_title && ` - ${profile.job_title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
