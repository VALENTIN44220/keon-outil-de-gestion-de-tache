import { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import {
  Building2, 
  Calendar, 
  CalendarClock,
  CalendarCheck,
  User, 
  Flag, 
  Workflow, 
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Edit,
  X,
  Save,
  ArrowLeft,
  MessageSquare,
  ListTodo,
  Info,
  FileText,
  UserRoundPlus,
  Send,
  ShieldCheck,
  Play,
  Link as LinkIcon,
} from 'lucide-react';
import { RequestValidationButton } from './RequestValidationButton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getBEStatusMeta, useBETaskStatus } from '@/hooks/useBETaskStatus';
import { ExternalLink, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TaskCommentsSection } from './TaskCommentsSection';
import { TaskChecklist } from './TaskChecklist';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useDueDatePermissionWithManager } from '@/hooks/useDueDatePermission';
import { RequestInfoTab } from './RequestInfoTab';
import { ITProjectPhaseSelect } from '@/components/it/ITProjectPhaseSelect';
import { IT_PROJECT_PHASES } from '@/types/itProject';
import { ReassignTaskDialog } from '@/components/workload/ReassignTaskDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSimulation } from '@/contexts/SimulationContext';
import { canInitiateTaskReassignment } from '@/lib/taskReassignmentPermissions';
import { canOfferSendForValidationInsteadOfMarkDone, normalizeValidationLevel } from '@/lib/taskValidationUi';
import { TaskValidationChainPanel } from '@/components/tasks/TaskValidationChainPanel';
import {
  sendTaskForValidationFromExecutorState,
  rejectValidationWithExecutorPolicy,
} from '@/services/taskStatusService';
import { useSubProcessFinalRejectionPolicy } from '@/hooks/useSubProcessFinalRejectionPolicy';

interface Profile {
  id: string;
  display_name: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  /** Rafraîchir la liste parente après réaffectation / mutation */
  onTaskMutated?: () => void;
}

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  low: { label: 'Basse', variant: 'secondary', color: 'text-muted-foreground' },
  medium: { label: 'Moyenne', variant: 'outline', color: 'text-warning' },
  high: { label: 'Haute', variant: 'default', color: 'text-orange-500' },
  urgent: { label: 'Urgente', variant: 'destructive', color: 'text-destructive' },
};

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  to_assign: { label: 'À affecter', icon: AlertCircle, color: 'text-orange-500' },
  todo: { label: 'À faire', icon: AlertCircle, color: 'text-muted-foreground' },
  'in-progress': { label: 'En cours', icon: Clock, color: 'text-info' },
  done: { label: 'Terminé', icon: CheckCircle2, color: 'text-success' },
  'pending-validation': { label: 'En validation', icon: Clock, color: 'text-warning' },
  validated: { label: 'Validé', icon: CheckCircle2, color: 'text-success' },
  refused: { label: 'Refusé', icon: AlertCircle, color: 'text-destructive' },
};

export function TaskDetailDialog({ task, open, onClose, onStatusChange, onTaskMutated }: TaskDetailDialogProps) {
  const { profile } = useAuth();
  const { isAdmin: realIsAdmin } = useUserRole();
  // En mode simulation, on évalue les permissions COMME le user simulé. L'admin
  // réel garde son rôle pour interagir avec l'app, mais ses droits avancés
  // (genre réaffectation libre) ne s'appliquent pas tant qu'il joue un autre user.
  const { isSimulating, simulatedProfile } = useSimulation();
  const isAdmin = realIsAdmin && !isSimulating;
  // Profile effectif pour les checks "est-ce que c'est moi qui ai cette tâche ?"
  // En simulation, on raisonne avec le user incarné (sinon le bouton "Commencer"
  // n'apparaît jamais pour Magalie simulée par Valentin).
  const currentProfileId = (isSimulating && simulatedProfile ? simulatedProfile : profile)?.id ?? null;
  const { updateBEStatus, isUpdating: isBeUpdating } = useBETaskStatus();
  const navigate = useNavigate();
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [taskForReassign, setTaskForReassign] = useState<Task | null>(null);
  const [childTasks, setChildTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [profilesList, setProfilesList] = useState<{ id: string; display_name: string; manager_id: string | null }[]>([]);
  const [departments, setDepartments] = useState<Map<string, string>>(new Map());
  const [processName, setProcessName] = useState<string | null>(null);
  const [dispatchManagerId, setDispatchManagerId] = useState<string | null>(null);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchAssignee, setDispatchAssignee] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [beProject, setBeProject] = useState<{ code_projet: string; nom_projet: string } | null>(null);
  const [beLabel, setBeLabel] = useState<{ code: string; name: string; color: string | null } | null>(null);
  const [beAffaire, setBeAffaire] = useState<{ code_affaire: string; libelle: string } | null>(null);
  /** Demandeur / rapporteur hérités de la demande parente quand la tâche ne les a pas en colonne. */
  const [parentRequestPersonIds, setParentRequestPersonIds] = useState<{
    requester_id: string | null;
    reporter_id: string | null;
  } | null>(null);
  /** Pièces jointes / liens fournis par le demandeur sur la demande parente
      (le wizard BE stocke les liens sur la tâche parent_request, pas sur la
      tâche enfant — donc l'exécutant doit les voir d'ici). */
  const [parentAttachments, setParentAttachments] = useState<Array<{
    id: string;
    name: string;
    url: string;
    type: string | null;
  }>>([]);

  // Child task editing state
  const [selectedChildTask, setSelectedChildTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingValidation, setIsSendingValidation] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationActionDialog, setValidationActionDialog] = useState<{
    type: 'approve' | 'refuse';
  } | null>(null);
  const [validationComment, setValidationComment] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'request-info'>('tasks');
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '' as TaskStatus,
    priority: '' as TaskPriority,
    assignee_id: '',
    due_date: '',
  });
  
  // Compute assignee manager for due date permission
  const selectedChildAssigneeManagerId = useMemo(() => {
    if (!selectedChildTask?.assignee_id) return null;
    const assigneeProfile = profilesList.find(p => p.id === selectedChildTask.assignee_id);
    return assigneeProfile?.manager_id || null;
  }, [selectedChildTask?.assignee_id, profilesList]);
  
  // Due date permission for selected child task
  const { canEditDueDate, reason: dueDateReason } = useDueDatePermissionWithManager(
    selectedChildTask,
    selectedChildAssigneeManagerId
  );

  const rootTaskAssigneeManagerId = useMemo(() => {
    if (!task?.assignee_id) return null;
    return profilesList.find((p) => p.id === task.assignee_id)?.manager_id ?? null;
  }, [task?.assignee_id, profilesList]);

  const displayRequesterId = useMemo(
    () => task?.requester_id ?? parentRequestPersonIds?.requester_id ?? null,
    [task?.requester_id, parentRequestPersonIds?.requester_id],
  );
  const displayReporterId = useMemo(
    () => task?.reporter_id ?? parentRequestPersonIds?.reporter_id ?? null,
    [task?.reporter_id, parentRequestPersonIds?.reporter_id],
  );

  // Politique de rejet : retour exécuteur ou refus terminal ?
  const returnsToExecutorOnReject = useSubProcessFinalRejectionPolicy(
    task?.source_sub_process_template_id ?? undefined,
  );

  // L'utilisateur courant peut-il valider/rejeter la tâche ?
  const validationLevel = task?.status === 'pending_validation_2' ? 2 : 1;
  const canValidateTask = useMemo(() => {
    if (!task || !profile?.id) return false;
    if (task.status !== 'pending_validation_1' && task.status !== 'pending_validation_2') return false;
    if (isAdmin) return true;
    const level = task.status === 'pending_validation_2' ? 2 : 1;
    const validationType = normalizeValidationLevel(
      level === 1 ? task.validation_level_1 : task.validation_level_2,
    );
    const explicitValidatorId = level === 1 ? task.validator_level_1_id : task.validator_level_2_id;
    if (explicitValidatorId) return explicitValidatorId === profile.id;
    if (validationType === 'manager') return rootTaskAssigneeManagerId === profile.id;
    if (validationType === 'requester') return displayRequesterId === profile.id;
    return false;
  }, [task, profile?.id, isAdmin, rootTaskAssigneeManagerId, displayRequesterId]);
  
  // Fetch checklist progress for child tasks
  const childTaskIds = childTasks.map(t => t.id);
  const { progressMap: checklistProgress } = useTasksProgress(childTaskIds);

  const fetchRelatedData = useCallback(async () => {
    if (!task) return;

    setIsLoading(true);
    try {
      // Fetch child tasks
      const { data: children } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_request_id', task.id)
        .order('created_at', { ascending: true });

      if (children) {
        setChildTasks(children as Task[]);
      }

      if (task.parent_request_id) {
        const [{ data: pr }, { data: parentAtts }] = await Promise.all([
          supabase
            .from('tasks')
            .select('requester_id, reporter_id')
            .eq('id', task.parent_request_id)
            .maybeSingle(),
          // Récupère les liens/fichiers que le demandeur a fournis sur la
          // demande parente (le wizard BE les attache à task_id = request.id)
          supabase
            .from('task_attachments')
            .select('id, name, url, type')
            .eq('task_id', task.parent_request_id)
            .order('created_at', { ascending: true }),
        ]);
        setParentRequestPersonIds(
          pr
            ? { requester_id: pr.requester_id ?? null, reporter_id: pr.reporter_id ?? null }
            : null,
        );
        setParentAttachments((parentAtts as any[]) ?? []);
      } else {
        setParentRequestPersonIds(null);
        setParentAttachments([]);
      }

      // Fetch profiles with manager_id for permission checking
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, manager_id');

      if (profilesData) {
        const map = new Map<string, string>();
        profilesData.forEach((p) => map.set(p.id, p.display_name || 'Sans nom'));
        setProfiles(map);
        setProfilesList(profilesData.map(p => ({ 
          id: p.id, 
          display_name: p.display_name || 'Sans nom',
          manager_id: p.manager_id
        })));
      }

      // Fetch departments
      const { data: depsData } = await supabase
        .from('departments')
        .select('id, name');

      if (depsData) {
        const map = new Map<string, string>();
        depsData.forEach((d) => map.set(d.id, d.name));
        setDepartments(map);
      }

      // Fetch process name if linked
      if (task.source_process_template_id) {
        const { data: processData } = await supabase
          .from('process_templates')
          .select('name')
          .eq('id', task.source_process_template_id)
          .single();

        if (processData) {
          setProcessName(processData.name);
        }
      }

      // Fetch sub_process_template.dispatch_manager_id pour savoir si current user
      // peut dispatcher cette tâche (cas BE be_status='soumise')
      if ((task as any).sub_process_template_id) {
        const { data: spData } = await (supabase as any)
          .from('sub_process_templates')
          .select('dispatch_manager_id')
          .eq('id', (task as any).sub_process_template_id)
          .maybeSingle();
        if (spData?.dispatch_manager_id) {
          setDispatchManagerId(spData.dispatch_manager_id);
        }
      }

      // Fetch BE project info if linked
      if (task.be_project_id) {
        const { data: bePrj } = await (supabase as any)
          .from('be_projects')
          .select('code_projet, nom_projet')
          .eq('id', task.be_project_id)
          .maybeSingle();
        setBeProject(bePrj ?? null);
      } else {
        setBeProject(null);
      }

      // Fetch BE label (libelle de tache : ex 'Agrement sanitaire')
      const beLabelId = (task as any).be_label_id;
      if (beLabelId) {
        const { data: lbl } = await (supabase as any)
          .from('be_task_labels')
          .select('code, name, color')
          .eq('id', beLabelId)
          .maybeSingle();
        setBeLabel(lbl ?? null);
      } else {
        setBeLabel(null);
      }

      // Fetch BE affaire (sous-affaire d'un projet)
      const beAffaireId = (task as any).be_affaire_id;
      if (beAffaireId) {
        const { data: aff } = await (supabase as any)
          .from('be_affaires')
          .select('code_affaire, libelle')
          .eq('id', beAffaireId)
          .maybeSingle();
        setBeAffaire(aff ?? null);
      } else {
        setBeAffaire(null);
      }
    } catch (error) {
      console.error('Error fetching related data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [task]);

  useEffect(() => {
    if (open && task) {
      fetchRelatedData();
    }
  }, [open, task?.id, fetchRelatedData]);

  const handleRootSendForValidation = useCallback(async () => {
    if (!task) return;
    setIsSendingValidation(true);
    try {
      const res = await sendTaskForValidationFromExecutorState(
        task.id,
        task.status,
        task.validator_level_1_id,
      );
      if (!res.success) {
        toast.error(res.error || 'Envoi pour validation impossible');
        return;
      }
      if (res.newStatus) onStatusChange(task.id, res.newStatus);
      toast.success('Tâche envoyée pour validation');
      onClose();
    } finally {
      setIsSendingValidation(false);
    }
  }, [task, onStatusChange, onClose]);

  const handleChildSendForValidation = useCallback(async () => {
    if (!selectedChildTask) return;
    setIsSendingValidation(true);
    try {
      const res = await sendTaskForValidationFromExecutorState(
        selectedChildTask.id,
        selectedChildTask.status,
        selectedChildTask.validator_level_1_id,
      );
      if (!res.success) {
        toast.error(res.error || 'Envoi pour validation impossible');
        return;
      }
      const ns = res.newStatus!;
      onStatusChange(selectedChildTask.id, ns);
      const { data: fresh } = await supabase.from('tasks').select('*').eq('id', selectedChildTask.id).maybeSingle();
      if (fresh) {
        const row = fresh as Task;
        setSelectedChildTask(row);
        setChildTasks((prev) => prev.map((t) => (t.id === row.id ? row : t)));
      } else {
        setSelectedChildTask((prev) => (prev ? { ...prev, status: ns } : null));
        setChildTasks((prev) => prev.map((t) => (t.id === selectedChildTask.id ? { ...t, status: ns } : t)));
      }
      toast.success('Tâche envoyée pour validation');
    } finally {
      setIsSendingValidation(false);
    }
  }, [selectedChildTask, onStatusChange]);

  const handleReassigned = useCallback(async () => {
    const reassignId = taskForReassign?.id;
    setIsReassignOpen(false);
    setTaskForReassign(null);
    if (open && task) {
      await fetchRelatedData();
    }
    if (reassignId) {
      const { data } = await supabase.from('tasks').select('*').eq('id', reassignId).maybeSingle();
      if (data) {
        const updated = data as Task;
        setSelectedChildTask((prev) => (prev?.id === reassignId ? updated : prev));
      }
    }
    onTaskMutated?.();
  }, [open, task, taskForReassign?.id, onTaskMutated, fetchRelatedData]);

  const handleOpenChildTask = (childTask: Task) => {
    setSelectedChildTask(childTask);
    setEditForm({
      title: childTask.title,
      description: childTask.description || '',
      status: childTask.status,
      priority: childTask.priority,
      assignee_id: childTask.assignee_id || '',
      due_date: childTask.due_date || '',
    });
    setIsEditing(false);
  };

  const handleCloseChildTask = () => {
    setSelectedChildTask(null);
    setIsEditing(false);
  };

  const handleSaveChildTask = async () => {
    if (!selectedChildTask) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editForm.title,
          description: editForm.description || null,
          status: editForm.status,
          priority: editForm.priority,
          assignee_id: editForm.assignee_id || null,
          due_date: editForm.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedChildTask.id);

      if (error) throw error;

      // Update local state
      setChildTasks(prev => prev.map(t => 
        t.id === selectedChildTask.id 
          ? { ...t, ...editForm, assignee_id: editForm.assignee_id || null, due_date: editForm.due_date || null }
          : t
      ));
      setSelectedChildTask(prev => prev ? { ...prev, ...editForm } : null);
      setIsEditing(false);
      toast.success('Tâche mise à jour');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  if (!task) return null;

  const completedTasks = childTasks.filter((t) => t.status === 'done' || t.status === 'validated').length;
  const progressPercent = childTasks.length > 0 ? Math.round((completedTasks / childTasks.length) * 100) : 0;

  const StatusIcon = statusConfig[task.status]?.icon || AlertCircle;

  // Child task detail/edit view
  if (selectedChildTask) {
    const ChildStatusIcon = statusConfig[selectedChildTask.status]?.icon || AlertCircle;
    const canShowReassignChild =
      canInitiateTaskReassignment({
        task: selectedChildTask,
        profileId: profile?.id,
        assigneeManagerId: selectedChildAssigneeManagerId,
        isAdmin,
      }) &&
      !!selectedChildTask.assignee_id &&
      selectedChildTask.status !== 'validated' &&
      selectedChildTask.status !== 'done' &&
      selectedChildTask.status !== 'cancelled' &&
      selectedChildTask.status !== 'refused';

    const childOfferSend = canOfferSendForValidationInsteadOfMarkDone(selectedChildTask);
    const childCanSubmitValidation =
      !!profile?.id &&
      !!selectedChildTask.assignee_id &&
      (profile.id === selectedChildTask.assignee_id || isAdmin);

    return (
      <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleCloseChildTask}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 flex items-center gap-2">
                <Badge variant={priorityConfig[selectedChildTask.priority].variant}>
                  <Flag className="h-3 w-3 mr-1" />
                  {priorityConfig[selectedChildTask.priority].label}
                </Badge>
                <Badge variant="outline" className={statusConfig[selectedChildTask.status]?.color}>
                  <ChildStatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig[selectedChildTask.status]?.label}
                </Badge>
                {selectedChildTask.is_assignment_task && (
                  <Badge variant="secondary">Affectation</Badge>
                )}
              </div>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
              )}
            </div>
            <DialogTitle className="text-xl flex items-center gap-2 flex-wrap">
              {isEditing ? 'Modifier la tâche' : selectedChildTask.title}
              {task?.request_number && (
                <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/30">
                  Demande : {task.request_number}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 flex-1 overflow-y-auto">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input
                    id="title"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value: TaskStatus) => setEditForm(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">À faire</SelectItem>
                        <SelectItem value="in-progress">En cours</SelectItem>
                        <SelectItem value="done">Terminé</SelectItem>
                        <SelectItem value="pending-validation">En validation</SelectItem>
                        <SelectItem value="validated">Validé</SelectItem>
                        <SelectItem value="refused">Refusé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Priorité</Label>
                    <Select
                      value={editForm.priority}
                      onValueChange={(value: TaskPriority) => setEditForm(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assigné à</Label>
                    <SearchableSelect
                      value={editForm.assignee_id || '__none__'}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, assignee_id: value === '__none__' ? '' : value }))}
                      placeholder="Non assigné"
                      searchPlaceholder="Rechercher un collaborateur..."
                      options={[
                        { value: '__none__', label: 'Non assigné' },
                        ...profilesList.map(p => ({ value: p.id, label: p.display_name || 'Sans nom' }))
                      ]}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="due_date">Date d'échéance</Label>
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
                      id="due_date"
                      type="date"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
                      disabled={!canEditDueDate}
                      className={!canEditDueDate ? 'opacity-50 cursor-not-allowed' : ''}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    <X className="h-4 w-4 mr-1" />
                    Annuler
                  </Button>
                  <Button onClick={handleSaveChildTask} disabled={isSaving || !editForm.title.trim()}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Enregistrer
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1 gap-2">
                    <ListTodo className="h-4 w-4" />
                    Détails
                  </TabsTrigger>
                  {selectedChildTask.parent_request_id && (
                    <TabsTrigger value="request-info" className="flex-1 gap-2">
                      <FileText className="h-4 w-4" />
                      Détail demande
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="chat" className="flex-1 gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Échanges
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4 space-y-4">
                  {selectedChildTask.description && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <p className="text-base leading-relaxed font-medium whitespace-pre-wrap">
                            {selectedChildTask.description}
                          </p>
                        </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedChildTask.due_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Échéance: {format(new Date(selectedChildTask.due_date), 'dd MMMM yyyy', { locale: fr })}</span>
                      </div>
                    )}
                    {selectedChildTask.assignee_id && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Assigné à: {profiles.get(selectedChildTask.assignee_id) || 'N/A'}</span>
                      </div>
                    )}
                    {!selectedChildTask.assignee_id && (
                      <div className="flex items-center gap-2 text-warning">
                        <User className="h-4 w-4" />
                        <span>Non assigné</span>
                      </div>
                    )}
                  </div>

                  {canShowReassignChild && (
                    <>
                      <Separator />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                        onClick={() => {
                          setTaskForReassign(selectedChildTask);
                          setIsReassignOpen(true);
                        }}
                      >
                        <UserRoundPlus className="h-4 w-4" />
                        Réaffecter à quelqu'un d'autre
                      </Button>
                    </>
                  )}

                  {/* Checklist / Sub-actions */}
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Sous-actions</h4>
                    <TaskChecklist taskId={selectedChildTask.id} />
                  </div>

                  {/* Chat section for child task */}
                  <Separator />
                  <TaskCommentsSection taskId={selectedChildTask.id} className="h-[36vh] max-h-[360px] min-h-[180px]" />
                </TabsContent>

                {selectedChildTask.parent_request_id && (
                  <TabsContent value="request-info" className="mt-2">
                    <RequestInfoTab
                      task={selectedChildTask}
                      profiles={profiles}
                      departments={departments}
                    />
                  </TabsContent>
                )}

                <TabsContent value="chat" className="mt-2">
                  <TaskCommentsSection taskId={selectedChildTask.id} className="h-[48vh] max-h-[460px] min-h-[220px]" />
                </TabsContent>
              </Tabs>
            )}

            {/* Actions footer */}
            {!isEditing && (
              <div className="flex justify-between items-center gap-2 pt-3 border-t mt-3">
                <RequestValidationButton 
                  taskId={selectedChildTask.id} 
                  taskStatus={selectedChildTask.status}
                  onValidationTriggered={() => {
                    setChildTasks(prev => prev.map(t => 
                      t.id === selectedChildTask.id 
                        ? { ...t, status: 'pending_validation_1' as TaskStatus }
                        : t
                    ));
                    setSelectedChildTask(prev => prev ? { ...prev, status: 'pending_validation_1' as TaskStatus } : null);
                  }}
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCloseChildTask}>
                    Retour à la demande
                  </Button>
                  {childOfferSend && childCanSubmitValidation ? (
                    <Button
                      disabled={isSendingValidation}
                      onClick={() => void handleChildSendForValidation()}
                    >
                      {isSendingValidation ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Envoyer pour validation
                    </Button>
                  ) : (
                    <Button onClick={() => { onStatusChange(selectedChildTask.id, 'done'); handleCloseChildTask(); }}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Marquer terminé
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ReassignTaskDialog
        task={taskForReassign}
        isOpen={isReassignOpen && !!taskForReassign}
        onClose={() => {
          setIsReassignOpen(false);
          setTaskForReassign(null);
        }}
        onReassigned={handleReassigned}
        includeWorkloadSlots={false}
      />
      </>
    );
  }

  const canShowReassignRoot =
    task.type !== 'request' &&
    canInitiateTaskReassignment({
      task,
      profileId: profile?.id,
      assigneeManagerId: rootTaskAssigneeManagerId,
      isAdmin,
    }) &&
    !!task.assignee_id &&
    task.status !== 'validated' &&
    task.status !== 'done' &&
    task.status !== 'cancelled' &&
    task.status !== 'refused';

  const handleValidationApprove = async () => {
    if (!task || !profile?.id) return;
    setIsValidating(true);
    try {
      const level = validationLevel as 1 | 2;
      const needsLevel2 = level === 1 && normalizeValidationLevel(task.validation_level_2) !== 'none';
      const newStatus = needsLevel2 ? 'pending_validation_2' : 'validated';
      const updates: Record<string, unknown> = {
        status: newStatus,
        [`validation_${level}_status`]: 'validated',
        [`validation_${level}_at`]: new Date().toISOString(),
        [`validation_${level}_by`]: profile.id,
        [`validation_${level}_comment`]: validationComment || null,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'validated') updates.validated_at = new Date().toISOString();
      const { error } = await (supabase as any).from('tasks').update(updates).eq('id', task.id);
      if (error) throw error;
      toast.success(newStatus === 'validated' ? 'Tâche validée' : 'Passage à la validation niveau 2');
      onStatusChange(task.id, newStatus as TaskStatus);
      setValidationActionDialog(null);
      setValidationComment('');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Impossible de valider la tâche');
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidationRefuse = async () => {
    if (!task || !profile?.id) return;
    if (!validationComment.trim()) {
      toast.error('Un commentaire est obligatoire pour justifier le refus.');
      return;
    }
    setIsValidating(true);
    try {
      const level = validationLevel as 1 | 2;
      const result = await rejectValidationWithExecutorPolicy(
        task.id,
        level,
        profile.id,
        validationComment,
        returnsToExecutorOnReject,
      );
      if (!result.success) throw new Error(result.error);
      toast.success(
        returnsToExecutorOnReject
          ? 'Tâche renvoyée à l\'assigné pour correction'
          : 'Refus enregistré',
      );
      onStatusChange(task.id, result.newStatus ?? (returnsToExecutorOnReject ? 'in-progress' : 'refused'));
      setValidationActionDialog(null);
      setValidationComment('');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Impossible de refuser la tâche');
    } finally {
      setIsValidating(false);
    }
  };

  const rootOfferSend = task.type === 'task' && canOfferSendForValidationInsteadOfMarkDone(task);
  const rootCanSubmitValidation =
    !!profile?.id &&
    !!task.assignee_id &&
    (profile.id === task.assignee_id || isAdmin);

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95%] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {task.type === 'request' && <Building2 className="h-5 w-5 text-primary" />}
            <Badge variant={priorityConfig[task.priority].variant}>
              <Flag className="h-3 w-3 mr-1" />
              {priorityConfig[task.priority].label}
            </Badge>
            <Badge variant="outline" className={statusConfig[task.status]?.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[task.status]?.label || task.status}
            </Badge>
            {task.type === 'request' && (
              <Badge variant="secondary">Demande</Badge>
            )}
            {processName && (
              <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                <Workflow className="h-2.5 w-2.5" />
                {processName}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl pr-8">{task.title}</DialogTitle>
          {task.status !== 'done' && task.status !== 'validated' && (
            <div className="mt-3 flex justify-end gap-2 flex-wrap">
              {/* ── Boutons workflow BE — si la tâche a un be_status (= tâche
                  BE) et l'utilisateur courant est l'assigné ou le validateur ── */}
              {(() => {
                const beStatus = (task as any).be_status as string | null | undefined;
                if (!beStatus) return null;
                const isAssignee = currentProfileId !== null && task.assignee_id === currentProfileId;
                const isValidator1 = currentProfileId !== null && (task as any).validator_level_1_id === currentProfileId;
                const isValidator2 = currentProfileId !== null && (task as any).validator_level_2_id === currentProfileId;
                const isDispatcher = currentProfileId !== null && dispatchManagerId === currentProfileId;
                const canDispatch = isAdmin || isDispatcher;
                const canValidateBE = isAdmin || isValidator1 || isValidator2;

                const handleDispatch = async () => {
                  if (!dispatchAssignee) { toast.error("Sélectionne d'abord la personne à affecter"); return; }
                  setIsDispatching(true);
                  try {
                    const { error } = await supabase.from('tasks')
                      .update({ assignee_id: dispatchAssignee, be_status: 'affectee' })
                      .eq('id', task.id);
                    if (error) throw error;
                    // Notification à l'assigné
                    const assigneeAuthUser = profiles.get(dispatchAssignee);
                    if (dispatchAssignee !== currentProfileId) {
                      const { data: pf } = await supabase.from('profiles').select('user_id').eq('id', dispatchAssignee).maybeSingle();
                      if (pf?.user_id) {
                        await supabase.from('notifications').insert({
                          user_id: pf.user_id,
                          title: `Affecté : ${task.title}`,
                          message: 'Une tâche BE vous a été affectée.',
                          type: 'be_affectee',
                          related_entity_type: 'task',
                          related_entity_id: task.id,
                        });
                      }
                    }
                    toast.success(`Tâche affectée${assigneeAuthUser ? ` à ${assigneeAuthUser}` : ''}`);
                    setDispatchOpen(false);
                    setDispatchAssignee('');
                    onTaskMutated?.();
                    onClose();
                  } catch (err: any) {
                    toast.error(`Erreur : ${err.message ?? err}`);
                  } finally {
                    setIsDispatching(false);
                  }
                };

                const beAction = async (newStatus: string) => {
                  await updateBEStatus({
                    taskId: task.id,
                    status: newStatus as any,
                    notify: {
                      taskLabel: task.title,
                      assigneeId: task.assignee_id,
                      dispatchManagerId: null,
                    },
                  });
                  onTaskMutated?.();
                };

                // Liste des collaborateurs pour le picker dispatch
                const dispatchOptions = Array.from(profiles.entries())
                  .map(([id, name]) => ({ value: id, label: name }))
                  .sort((a, b) => a.label.localeCompare(b.label));

                return (
                  <>
                    {/* soumise → affectee : le dispatcher choisit un assignataire */}
                    {beStatus === 'soumise' && canDispatch && (
                      <Popover open={dispatchOpen} onOpenChange={setDispatchOpen}>
                        <PopoverTrigger asChild>
                          <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                            <UserPlus className="h-4 w-4" />
                            Dispatcher la tâche
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-semibold">Affecter cette tâche</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Choisis qui prend en charge cette demande BE.
                              </p>
                            </div>
                            <SearchableSelect
                              value={dispatchAssignee}
                              onValueChange={setDispatchAssignee}
                              placeholder="Sélectionner un collaborateur…"
                              searchPlaceholder="Rechercher…"
                              options={dispatchOptions}
                            />
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => setDispatchOpen(false)} disabled={isDispatching}>
                                Annuler
                              </Button>
                              <Button size="sm" onClick={handleDispatch} disabled={isDispatching || !dispatchAssignee} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
                                {isDispatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                Affecter
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}

                    {/* affectee → en_cours : l'assignée démarre */}
                    {beStatus === 'affectee' && isAssignee && (
                      <Button
                        onClick={() => void beAction('en_cours')}
                        disabled={isBeUpdating}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Play className="h-4 w-4" />
                        Commencer
                      </Button>
                    )}
                    {/* en_cours → a_relire : l'assignée soumet */}
                    {beStatus === 'en_cours' && isAssignee && (
                      <Button
                        onClick={() => void beAction('a_relire')}
                        disabled={isBeUpdating}
                        className="gap-2 bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4" />
                        Soumettre pour relecture
                      </Button>
                    )}
                    {/* a_relire → a_valider : le manager / validateur valide */}
                    {beStatus === 'a_relire' && canValidateBE && (
                      <Button
                        onClick={() => void beAction('a_valider')}
                        disabled={isBeUpdating}
                        className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Valider
                      </Button>
                    )}
                    {/* a_valider / a_deposer → cloturee */}
                    {(beStatus === 'a_valider' || beStatus === 'a_deposer') && canValidateBE && (
                      <Button
                        onClick={() => void beAction('cloturee')}
                        disabled={isBeUpdating}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Clôturer
                      </Button>
                    )}
                  </>
                );
              })()}

              {/* Boutons manager : valider / rejeter (pour validation_level_X classique) */}
              {canValidateTask && (
                <>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => { setValidationComment(''); setValidationActionDialog({ type: 'refuse' }); }}
                  >
                    <XCircle className="h-4 w-4" />
                    {task.source_sub_process_template_id ? 'Tâche non validée' : 'Rejeter'}
                  </Button>
                  <Button
                    className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => { setValidationComment(''); setValidationActionDialog({ type: 'approve' }); }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Valider la tâche
                  </Button>
                </>
              )}
              {/* Bouton exécutant : envoyer pour validation classique */}
              {!canValidateTask && rootOfferSend && rootCanSubmitValidation && (
                <Button
                  onClick={() => void handleRootSendForValidation()}
                  disabled={isSendingValidation}
                  className="gap-2"
                >
                  {isSendingValidation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Envoyer pour validation
                </Button>
              )}
              {/* Marquer terminé : seulement si tâche standard (pas BE, pas validation pending).
                  Une tâche BE se complète via le workflow be_status (Commencer / Soumettre /
                  Valider / Clôturer) — jamais via « Marquer terminé ». */}
              {!canValidateTask && !rootOfferSend
                && !(task as any).be_status
                && !(task as any).sub_process_template_id  // = tâche issue d'une prestation BE
                && task.source_process_template_id !== 'bd75a3b0-c918-4b43-befe-739b83f7461a' // BE process
                && task.status !== 'pending_validation_1' && task.status !== 'pending_validation_2' && (
                <Button
                  onClick={() => { onStatusChange(task.id, 'done'); onClose(); }}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Marquer terminé
                </Button>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-4 flex-1 overflow-y-auto px-0">
          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-base leading-relaxed font-medium whitespace-pre-wrap">{task.description}</p>
              </div>
            </div>
          )}

          {/* Chaîne de validation — affichée uniquement si validation_level_1
              ou validation_level_2 est configuré sur le template de tâche.
              Donne à l'exécutant comme au validateur la visibilité sur :
              "qui valide à quel niveau" + "où en sommes-nous". */}
          <TaskValidationChainPanel
            task={task}
            profiles={profiles}
            managerOfAssigneeId={rootTaskAssigneeManagerId}
            requesterId={displayRequesterId}
          />

          {/* Liens fournis par le demandeur sur la demande parente
              (le wizard BE attache les liens à la demande parente,
              pas à chaque tâche enfant — d'où le fetch séparé). */}
          {parentAttachments.length > 0 && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="h-4 w-4 text-sky-700" />
                <h4 className="text-sm font-semibold text-sky-800">
                  Liens fournis par le demandeur
                </h4>
                <span className="ml-auto text-[10px] text-sky-700/70">
                  ({parentAttachments.length})
                </span>
              </div>
              <ul className="space-y-1.5">
                {parentAttachments.map((att) => (
                  <li key={att.id} className="flex items-center gap-2 text-sm">
                    <LinkIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 hover:text-sky-900 hover:underline truncate"
                      title={att.url}
                    >
                      {att.name || att.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {(task.task_number || task.request_number) && (
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">N°:</span>
                <span className="font-medium">{task.task_number || task.request_number}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Assigné à:</span>
              <span>{task.assignee_id ? profiles.get(task.assignee_id) || 'N/A' : <span className="italic text-muted-foreground">Non assigné</span>}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Demandeur:</span>
              <span>
                {displayRequesterId ? (
                  profiles.get(displayRequesterId) || 'N/A'
                ) : (
                  <span className="italic text-muted-foreground">—</span>
                )}
              </span>
            </div>
            {/* Rapporteur : affiche seulement si renseigne (sinon redondant avec Demandeur) */}
            {displayReporterId && displayReporterId !== displayRequesterId && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Rapporteur:</span>
                <span>{profiles.get(displayReporterId) || 'N/A'}</span>
              </div>
            )}
            {task.reassignment_stakeholder_id && (
              <div className="flex items-center gap-2">
                <UserRoundPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Suivi réaffectation :</span>
                <span>
                  {profiles.get(task.reassignment_stakeholder_id) || 'N/A'}
                </span>
              </div>
            )}
            {/* Service / Categorie : affiches seulement si renseignes */}
            {task.target_department_id && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Service:</span>
                <span>{departments.get(task.target_department_id) || 'N/A'}</span>
              </div>
            )}
            {task.category && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Catégorie:</span>
                <Badge variant="outline">{task.category}</Badge>
              </div>
            )}
            {/* ── Section BE ── */}
            {task.be_status && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Statut BE:</span>
                <Badge
                  variant="outline"
                  className={cn('border font-medium text-xs', getBEStatusMeta(task.be_status).bgClass, getBEStatusMeta(task.be_status).textClass)}
                  style={{ borderColor: getBEStatusMeta(task.be_status).color + '60' }}
                >
                  {getBEStatusMeta(task.be_status).icon} {getBEStatusMeta(task.be_status).label}
                </Badge>
              </div>
            )}
            {beProject && (
              <div className="flex items-center gap-2 col-span-2">
                <ExternalLink className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-muted-foreground shrink-0">Projet BE:</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-sm font-medium text-primary hover:underline"
                  onClick={() => { onClose(); navigate(`/be/projects/${beProject.code_projet}/overview`); }}
                >
                  {beProject.code_projet} — {beProject.nom_projet}
                </Button>
              </div>
            )}
            {/* Sous-affaire BE (affichee si differente du projet principal) */}
            {beAffaire && (
              <div className="flex items-center gap-2 col-span-2">
                <span className="text-muted-foreground shrink-0">Sous-affaire BE:</span>
                <Badge variant="outline" className="text-xs font-mono">{beAffaire.code_affaire}</Badge>
                <span className="text-sm">{beAffaire.libelle}</span>
              </div>
            )}
            {/* Libelle BE (type de tache : Agrement sanitaire, Permis de construire, etc.) */}
            {beLabel && (
              <div className="flex items-center gap-2 col-span-2">
                <span className="text-muted-foreground shrink-0">Libellé BE:</span>
                <Badge
                  variant="outline"
                  className="text-xs font-medium"
                  style={beLabel.color ? { borderColor: beLabel.color, color: beLabel.color } : undefined}
                >
                  {beLabel.code} — {beLabel.name}
                </Badge>
              </div>
            )}
            {/* Urgence BE (if set) */}
            {(task as any).be_urgency && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Urgence:</span>
                {(() => {
                  const u = (task as any).be_urgency as string;
                  const cfg: Record<string, { label: string; cls: string }> = {
                    'standard': { label: 'Standard', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
                    'urgent': { label: 'Urgent', cls: 'bg-orange-100 text-orange-800 border-orange-300' },
                    'critique': { label: 'Critique', cls: 'bg-red-100 text-red-800 border-red-300' },
                    'low': { label: 'Faible', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                  };
                  const c = cfg[u] ?? { label: u, cls: 'bg-amber-100 text-amber-800 border-amber-300' };
                  return <Badge variant="outline" className={cn('text-xs font-medium', c.cls)}>{c.label}</Badge>;
                })()}
              </div>
            )}
            {task.it_project_id && (
              <div className="flex items-center gap-2 col-span-2">
                <Workflow className="h-4 w-4 text-violet-500" />
                <span className="text-muted-foreground">Phase IT:</span>
                <ITProjectPhaseSelect
                  value={task.it_project_phase || null}
                  onChange={async (phase) => {
                    await supabase.from('tasks').update({ it_project_phase: phase }).eq('id', task.id);
                    toast.success('Phase mise à jour');
                  }}
                />
              </div>
            )}
            {/* Dates : affiche seulement celles qui ont une valeur. Doublons evites. */}
            {task.start_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Début:</span>
                <span>{format(new Date(task.start_date), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Échéance:</span>
                <span>{format(new Date(task.due_date), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Créée le:</span>
              <span>{format(new Date(task.created_at), 'dd MMMM yyyy', { locale: fr })}</span>
            </div>
            {/* Date d'ouverture = date_demande, on ne montre que si elle differe de created_at */}
            {task.date_demande && task.date_demande.slice(0, 10) !== task.created_at.slice(0, 10) && (
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Date de demande:</span>
                <span>{format(new Date(task.date_demande), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
            )}
            {(task.status === 'done' || task.status === 'validated') && (task.date_fermeture || task.updated_at) && (
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-success" />
                <span className="text-muted-foreground">Date de fermeture:</span>
                <span className="text-success">{format(new Date(task.date_fermeture || task.updated_at), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
            )}
            {task.date_lancement && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Date de lancement:</span>
                <span>{format(new Date(task.date_lancement), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
            )}
          </div>

          {canShowReassignRoot && (
            <>
              <Separator />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => {
                  setTaskForReassign(task);
                  setIsReassignOpen(true);
                }}
              >
                <UserRoundPlus className="h-4 w-4" />
                Réaffecter à quelqu'un d'autre
              </Button>
            </>
          )}

          {/* Checklist / Sub-actions for main task */}
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Sous-actions</h4>
            <TaskChecklist taskId={task.id} />
          </div>

          {/* (Le nom du processus est maintenant affiché en badge discret dans le header) */}

          {/* Child tasks and Chat section for requests */}
          {(task.type === 'request' || childTasks.length > 0) && (
            <>
              <Separator />
              
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tasks' | 'chat' | 'request-info')} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="tasks" className="flex-1 gap-2">
                    <ListTodo className="h-4 w-4" />
                    Tâches
                    {childTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-1">{completedTasks}/{childTasks.length}</Badge>
                    )}
                  </TabsTrigger>
                  {task.parent_request_id && task.type !== 'request' && (
                    <TabsTrigger value="request-info" className="flex-1 gap-2">
                      <FileText className="h-4 w-4" />
                      Détail demande
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="chat" className="flex-1 gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Échanges
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="mt-4">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Workflow className="h-4 w-4" />
                        Tâches liées
                      </h4>
                      <span className="text-sm text-muted-foreground">
                        {progressPercent}% complété
                      </span>
                    </div>

                    {/* Progress bar */}
                    {childTasks.length > 0 && (
                      <div className="mb-4">
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                    )}

                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : childTasks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Aucune tâche liée à cette demande</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {childTasks.map((childTask) => {
                          const ChildStatusIcon = statusConfig[childTask.status]?.icon || AlertCircle;
                          const isCompleted = childTask.status === 'done' || childTask.status === 'validated';
                          const taskProgress = checklistProgress[childTask.id];
                          
                          return (
                            <div
                              key={childTask.id}
                              onClick={() => handleOpenChildTask(childTask)}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50",
                                isCompleted
                                  ? 'bg-success/5 border-success/30'
                                  : 'bg-card border-border'
                              )}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="relative">
                                  <ChildStatusIcon
                                    className={cn('h-5 w-5', statusConfig[childTask.status]?.color)}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={cn(
                                      "font-medium text-sm truncate",
                                      isCompleted && 'line-through text-muted-foreground'
                                    )}>
                                      {childTask.title}
                                    </p>
                                    {taskProgress && taskProgress.total > 0 && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                        {taskProgress.completed}/{taskProgress.total}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {childTask.assignee_id ? (
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {profiles.get(childTask.assignee_id)}
                                      </span>
                                    ) : (
                                      <span className="text-warning flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        Non assigné
                                      </span>
                                    )}
                                    {childTask.due_date && (
                                      <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {format(new Date(childTask.due_date), 'dd MMM', { locale: fr })}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {/* Mini progress bar for checklist */}
                                  {taskProgress && taskProgress.total > 0 && (
                                    <Progress 
                                      value={taskProgress.progress} 
                                      className="h-1 mt-1.5" 
                                    />
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {childTask.be_status && (
                                  <Badge
                                    variant="outline"
                                    className={cn('text-xs border font-medium', getBEStatusMeta(childTask.be_status).bgClass, getBEStatusMeta(childTask.be_status).textClass)}
                                    style={{ borderColor: getBEStatusMeta(childTask.be_status).color + '50' }}
                                  >
                                    {getBEStatusMeta(childTask.be_status).icon} {getBEStatusMeta(childTask.be_status).label}
                                  </Badge>
                                )}
                                {!childTask.be_status && (
                                  <Badge
                                    variant="outline"
                                    className={cn("text-xs", statusConfig[childTask.status]?.color)}
                                  >
                                    {statusConfig[childTask.status]?.label}
                                  </Badge>
                                )}
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {task.parent_request_id && task.type !== 'request' && (
                  <TabsContent value="request-info" className="mt-2">
                    <RequestInfoTab
                      task={task}
                      profiles={profiles}
                      departments={departments}
                    />
                  </TabsContent>
                )}

                <TabsContent value="chat" className="mt-2">
                  <TaskCommentsSection taskId={task.id} className="min-h-[180px] max-h-[40vh]" />
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* Chat/Request info section for non-request tasks without child tasks */}
          {task.type !== 'request' && childTasks.length === 0 && (
            <>
              <Separator />
              {task.parent_request_id ? (
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="details" className="flex-1 gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Échanges
                    </TabsTrigger>
                    <TabsTrigger value="request-info" className="flex-1 gap-2">
                      <FileText className="h-4 w-4" />
                      Détail demande
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="details" className="mt-2">
                    <TaskCommentsSection taskId={task.id} className="min-h-[160px] max-h-[36vh]" />
                  </TabsContent>
                  <TabsContent value="request-info" className="mt-2">
                    <RequestInfoTab
                      task={task}
                      profiles={profiles}
                      departments={departments}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <TaskCommentsSection taskId={task.id} className="min-h-[160px] max-h-[36vh]" />
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <ReassignTaskDialog
      task={taskForReassign}
      isOpen={isReassignOpen && !!taskForReassign}
      onClose={() => {
        setIsReassignOpen(false);
        setTaskForReassign(null);
      }}
      onReassigned={handleReassigned}
      includeWorkloadSlots={false}
    />

    {/* Dialogue confirmation validation / refus */}
    <Dialog open={!!validationActionDialog} onOpenChange={() => setValidationActionDialog(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {validationActionDialog?.type === 'approve' ? 'Valider la tâche' : 'Rejeter la tâche'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{task.title}</p>
          <Textarea
            placeholder={
              validationActionDialog?.type === 'approve'
                ? 'Commentaire (optionnel)…'
                : 'Justification du refus (obligatoire)…'
            }
            value={validationComment}
            onChange={(e) => setValidationComment(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setValidationActionDialog(null)}>
            Annuler
          </Button>
          {validationActionDialog?.type === 'approve' && (
            <Button
              onClick={() => void handleValidationApprove()}
              disabled={isValidating}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              {isValidating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <ShieldCheck className="h-4 w-4 mr-2" />
              Valider
            </Button>
          )}
          {validationActionDialog?.type === 'refuse' && (
            <Button
              onClick={() => void handleValidationRefuse()}
              disabled={isValidating}
              variant="destructive"
            >
              {isValidating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <XCircle className="h-4 w-4 mr-2" />
              {task.source_sub_process_template_id ? 'Tâche non validée' : 'Rejeter'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
