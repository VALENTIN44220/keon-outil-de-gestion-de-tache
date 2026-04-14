import { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { useParentRequestNumber } from '@/hooks/useParentRequestNumber';
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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CategorySelect } from '@/components/templates/CategorySelect';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { TaskChecklist } from './TaskChecklist';
import { TaskLinksEditor } from './TaskLinksEditor';
import { TaskCommentsSection } from './TaskCommentsSection';
import { RequestValidationButton } from './RequestValidationButton';
import { Badge } from '@/components/ui/badge';
import { Ticket, CheckSquare, Save, Loader2, Info, MessageSquare, Lock, UserRoundPlus, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTaskAttachments } from '@/hooks/useTaskAttachments';
import { useDueDatePermissionWithManager } from '@/hooks/useDueDatePermission';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getStatusSelectOptions, sendTaskForValidationFromExecutorState } from '@/services/taskStatusService';
import { canOfferSendForValidationInsteadOfMarkDone, taskRequiresValidationBeforeDone } from '@/lib/taskValidationUi';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ReassignTaskDialog } from '@/components/workload/ReassignTaskDialog';
import { canInitiateTaskReassignment } from '@/lib/taskReassignmentPermissions';

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
  const { profile } = useAuth();
  const { isAdmin } = useUserRole();
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingValidation, setIsSendingValidation] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const parentRequestNumber = useParentRequestNumber(task?.parent_request_id || null);
  
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

  // Assignee + validation modèle (N1/N2 ou flag) → lecture seule sur la fiche (liens / commentaires restent possibles)
  const isAssigneeReadOnly = useMemo(() => {
    if (!task || !profile) return false;
    if (task.assignee_id !== profile.id) return false;
    return Boolean(task.requires_validation || taskRequiresValidationBeforeDone(task));
  }, [task, profile]);

  const canSubmitTemplateValidation = Boolean(
    task &&
      profile &&
      task.type === 'task' &&
      task.assignee_id &&
      (profile.id === task.assignee_id || isAdmin),
  );
  const showSendForValidation =
    Boolean(task) && canSubmitTemplateValidation && canOfferSendForValidationInsteadOfMarkDone(task!);

  const handleSendForValidation = useCallback(async () => {
    if (!task || task.type !== 'task') return;
    setIsSendingValidation(true);
    try {
      const res = await sendTaskForValidationFromExecutorState(
        task.id,
        task.status,
        task.validator_level_1_id,
      );
      if (!res.success) {
        toast({
          title: 'Erreur',
          description: res.error || 'Envoi pour validation impossible',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Envoyé',
        description: 'La tâche a été envoyée pour validation.',
      });
      onTaskUpdated();
      onClose();
    } finally {
      setIsSendingValidation(false);
    }
  }, [task, toast, onTaskUpdated, onClose]);

  const isStakeholderOnly = useMemo(() => {
    if (!task || !profile) return false;
    return (
      task.reassignment_stakeholder_id === profile.id &&
      task.assignee_id !== profile.id
    );
  }, [task, profile]);

  const isFormLocked = isAssigneeReadOnly || isStakeholderOnly;

  const canReassign = useMemo(() => {
    if (!task) return false;
    return canInitiateTaskReassignment({
      task,
      profileId: profile?.id,
      assigneeManagerId,
      isAdmin,
    });
  }, [task, profile?.id, assigneeManagerId, isAdmin]);

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
      .eq('status', 'active')
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
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
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
            {task.task_number && (
              <Badge variant="outline" className="text-xs font-mono bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                {task.task_number}
              </Badge>
            )}
            {parentRequestNumber && (
              <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/30">
                Demande : {parentRequestNumber}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {isAssigneeReadOnly && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Cette tâche fait partie d'un processus avec validation. Les champs sont verrouillés. Vous pouvez ajouter des liens/PJ, échanger des messages et demander la validation.</span>
            </div>
          )}
          {isStakeholderOnly && !isAssigneeReadOnly && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                Vous suivez cette tâche après une réaffectation. Les champs de la fiche sont en lecture seule ;
                l'exécution est du ressort du nouveau responsable.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la tâche"
              required
              disabled={isFormLocked}
              className={isFormLocked ? 'opacity-60 cursor-not-allowed' : ''}
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
              disabled={isFormLocked}
              className={isFormLocked ? 'opacity-60 cursor-not-allowed' : ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)} disabled={isFormLocked}>
                <SelectTrigger className={isFormLocked ? 'opacity-60 cursor-not-allowed' : ''}>
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
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)} disabled={isFormLocked}>
                <SelectTrigger className={isFormLocked ? 'opacity-60 cursor-not-allowed' : ''}>
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
              {(!canEditDueDate || isFormLocked) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        {isStakeholderOnly
                          ? 'Lecture seule : vous suivez cette tâche après une réaffectation.'
                          : isAssigneeReadOnly
                            ? 'Champ verrouillé pour les tâches avec validation'
                            : dueDateReason}
                      </p>
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
              disabled={!canEditDueDate || isFormLocked}
              className={(!canEditDueDate || isFormLocked) ? 'opacity-60 cursor-not-allowed' : ''}
            />
          </div>

          <div className={isFormLocked ? 'pointer-events-none opacity-60' : ''}>
            <CategorySelect
              categories={categories}
              selectedCategoryId={categoryId}
              selectedSubcategoryId={subcategoryId}
              onCategoryChange={setCategoryId}
              onSubcategoryChange={setSubcategoryId}
              onAddCategory={handleAddCategory}
              onAddSubcategory={handleAddSubcategory}
            />
          </div>

          {/* Assignment section */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-medium mb-3 block">Affectation</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service cible</Label>
                <SearchableSelect
                  value={targetDepartmentId || 'none'}
                  onValueChange={(v) => setTargetDepartmentId(v === 'none' ? null : v)}
                  disabled={isFormLocked}
                  placeholder="Sélectionner un service"
                  searchPlaceholder="Rechercher un service..."
                  options={[
                    { value: 'none', label: 'Aucun' },
                    ...departments.map(dept => ({ value: dept.id, label: dept.name }))
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label>Exécutant</Label>
                <SearchableSelect
                  value={assigneeId || 'none'}
                  onValueChange={(v) => setAssigneeId(v === 'none' ? null : v)}
                  disabled={isFormLocked}
                  placeholder="Sélectionner l'exécutant"
                  searchPlaceholder="Rechercher un collaborateur..."
                  options={[
                    { value: 'none', label: 'Non défini' },
                    ...profiles.map(p => ({ value: p.id, label: `${p.display_name || 'Sans nom'}${p.job_title ? ` - ${p.job_title}` : ''}` }))
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Tabs for additional features */}
          <Tabs defaultValue={isFormLocked ? "links" : "checklist"} className="border-t pt-4 mt-4">
            <TabsList className={`grid w-full ${isFormLocked ? 'grid-cols-4' : 'grid-cols-4'}`}>
              <TabsTrigger value="checklist">Sous-actions</TabsTrigger>
              <TabsTrigger value="links">Liens & PJ</TabsTrigger>
              <TabsTrigger value="roles">Responsabilités</TabsTrigger>
              <TabsTrigger value="exchanges" className="gap-1">
                <MessageSquare className="h-3 w-3" />
                Échanges
              </TabsTrigger>
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
              <div className={isFormLocked ? 'pointer-events-none opacity-60' : ''}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Demandeur</Label>
                    <SearchableSelect
                      value={requesterId || 'none'}
                      onValueChange={(v) => setRequesterId(v === 'none' ? null : v)}
                      disabled={isFormLocked}
                      placeholder="Sélectionner le demandeur"
                      searchPlaceholder="Rechercher un collaborateur..."
                      options={[
                        { value: 'none', label: 'Non défini' },
                        ...profiles.map(p => ({ value: p.id, label: `${p.display_name || 'Sans nom'}${p.job_title ? ` - ${p.job_title}` : ''}` }))
                      ]}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rapporteur</Label>
                    <SearchableSelect
                      value={reporterId || 'none'}
                      onValueChange={(v) => setReporterId(v === 'none' ? null : v)}
                      disabled={isFormLocked}
                      placeholder="Sélectionner le rapporteur"
                      searchPlaceholder="Rechercher un collaborateur..."
                      options={[
                        { value: 'none', label: 'Non défini' },
                        ...profiles.map(p => ({ value: p.id, label: `${p.display_name || 'Sans nom'}${p.job_title ? ` - ${p.job_title}` : ''}` }))
                      ]}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="exchanges" className="mt-4">
              <TaskCommentsSection taskId={task.id} className="min-h-[250px]" />
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center gap-3 pt-4 border-t">
            <div className="flex flex-wrap gap-2 items-center">
              {showSendForValidation && (
                <Button
                  type="button"
                  onClick={() => void handleSendForValidation()}
                  disabled={isSendingValidation}
                >
                  {isSendingValidation ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Envoyer pour validation
                </Button>
              )}
              {isAssigneeReadOnly && task ? (
                <RequestValidationButton
                  taskId={task.id}
                  taskStatus={task.status}
                  onValidationTriggered={() => {
                    onTaskUpdated();
                    onClose();
                  }}
                />
              ) : null}
            </div>
            <div className="flex gap-3 flex-wrap justify-end">
              {!isRequest && canReassign && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-amber-700 border-amber-200 hover:bg-amber-50"
                  onClick={() => setIsReassignOpen(true)}
                >
                  <UserRoundPlus className="h-4 w-4 mr-2" />
                  Réaffecter à quelqu'un d'autre
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                {isFormLocked ? 'Fermer' : 'Annuler'}
              </Button>
              {!isFormLocked && (
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
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <ReassignTaskDialog
      task={task}
      isOpen={isReassignOpen}
      onClose={() => setIsReassignOpen(false)}
      onReassigned={() => {
        onTaskUpdated();
        onClose();
      }}
      includeWorkloadSlots
    />
    </>
  );
}
