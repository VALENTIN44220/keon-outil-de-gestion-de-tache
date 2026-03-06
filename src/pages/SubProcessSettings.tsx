import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Settings,
  ListTodo,
  Users,
  CheckSquare,
  FileText,
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Loader2,
  Save,
  ArrowLeft,
  GitBranch,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SubProcessTemplate, TaskTemplate, AssignmentType, ASSIGNMENT_TYPE_LABELS, ASSIGNMENT_TYPE_DESCRIPTIONS, WatcherRule } from '@/types/template';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AddTaskTemplateDialog } from '@/components/templates/AddTaskTemplateDialog';
import { EditTaskTemplateDialog } from '@/components/templates/EditTaskTemplateDialog';
import { addTaskToWorkflow, removeTaskFromWorkflow } from '@/hooks/useAutoWorkflowGeneration';
import { WorkflowConfigTab } from '@/components/workflow-config/WorkflowConfigTab';
import { SubProcessCustomFieldsEditor } from '@/components/templates/SubProcessCustomFieldsEditor';
import { RecurrenceConfig, RecurrenceData } from '@/components/templates/RecurrenceConfig';

interface TaskTemplateWithChecklist extends TaskTemplate {
  checklist_count: number;
}

interface ValidationLevel {
  level: number;
  type: 'manager' | 'requester' | 'user';
  userId: string | null;
  timing: 'before_start' | 'before_close';
}

interface Profile {
  id: string;
  display_name: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface CollaboratorGroup {
  id: string;
  name: string;
}

export default function SubProcessSettings() {
  const { subProcessId } = useParams<{ subProcessId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Support ?tab=workflow query param
  const searchParams = new URLSearchParams(window.location.search);
  const initialTab = searchParams.get('tab') || 'general';

  const [activeView, setActiveView] = useState('templates');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);

  // Sub-process data
  const [subProcess, setSubProcess] = useState<SubProcessTemplate | null>(null);
  const [tasks, setTasks] = useState<TaskTemplateWithChecklist[]>([]);
  const [validationLevels, setValidationLevels] = useState<ValidationLevel[]>([]);

  // Reference data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<CollaboratorGroup[]>([]);

  // Task dialogs
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplateWithChecklist | null>(null);

  // Recurrence state
  const [recurrence, setRecurrence] = useState<RecurrenceData>({
    enabled: false, interval: 1, unit: 'months', delayDays: 7, startDate: '',
  });
  const [isSavingRecurrence, setIsSavingRecurrence] = useState(false);

  // Job titles for role-based assignment
  const [jobTitles, setJobTitles] = useState<{ id: string; name: string }[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_mandatory: true,
    assignment_type: 'manager' as AssignmentType,
    target_assignee_id: null as string | null,
    target_manager_id: null as string | null,
    target_department_id: null as string | null,
    target_group_id: null as string | null,
    target_job_title_id: null as string | null,
    modifiable_at_request: false,
    show_quick_launch: false,
    // Fallback
    fallback_assignment_type: null as AssignmentType | null,
    fallback_target_assignee_id: null as string | null,
    fallback_target_group_id: null as string | null,
    fallback_target_department_id: null as string | null,
    fallback_target_job_title_id: null as string | null,
    // Watchers
    watcher_config: [] as WatcherRule[],
  });

  const fetchData = useCallback(async () => {
    if (!subProcessId) return;

    setIsLoading(true);
    try {
      // Fetch sub-process
      const { data: spData, error } = await supabase
        .from('sub_process_templates')
        .select('*')
        .eq('id', subProcessId)
        .single();

      if (error) throw error;
      if (!spData) {
        navigate('/templates');
        return;
      }

      // Check if user can manage
      const { data: canManageData } = await supabase.rpc('can_manage_template', {
        _creator_id: spData.user_id,
      });

      setSubProcess(spData as SubProcessTemplate);
      setCanManage(Boolean(canManageData));
      setFormData({
        name: spData.name,
        description: spData.description || '',
        is_mandatory: spData.is_mandatory ?? true,
        assignment_type: (spData.assignment_type || 'manager') as AssignmentType,
        target_assignee_id: spData.target_assignee_id,
        target_manager_id: spData.target_manager_id,
        target_department_id: spData.target_department_id,
        target_group_id: spData.target_group_id,
        target_job_title_id: spData.target_job_title_id,
        modifiable_at_request: false,
        show_quick_launch: (spData as any).show_quick_launch ?? false,
        fallback_assignment_type: (spData as any).fallback_assignment_type || null,
        fallback_target_assignee_id: (spData as any).fallback_target_assignee_id || null,
        fallback_target_group_id: (spData as any).fallback_target_group_id || null,
        fallback_target_department_id: (spData as any).fallback_target_department_id || null,
        fallback_target_job_title_id: (spData as any).fallback_target_job_title_id || null,
        watcher_config: ((spData as any).watcher_config as WatcherRule[]) || [],
      });
      setRecurrence({
        enabled: (spData as any).recurrence_enabled || false,
        interval: (spData as any).recurrence_interval || 1,
        unit: ((spData as any).recurrence_unit || 'months') as RecurrenceData['unit'],
        delayDays: (spData as any).recurrence_delay_days || 7,
        startDate: (spData as any).recurrence_start_date || '',
      });

      // Fetch tasks with checklist count
      const { data: taskData, error: taskError } = await supabase
        .from('task_templates')
        .select(`
          *,
          task_template_checklists (id)
        `)
        .eq('sub_process_template_id', subProcessId)
        .order('order_index');

      console.log('SubProcessSettings - Tasks query:', { subProcessId, taskData, taskError, tasksCount: taskData?.length || 0 });

      if (taskData) {
        setTasks(taskData.map(t => ({
          ...t,
          checklist_count: t.task_template_checklists?.length || 0,
        })) as TaskTemplateWithChecklist[]);
      }

      // Fetch reference data
      const [profileRes, deptRes, groupRes, jobTitleRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('collaborator_groups').select('id, name').order('name'),
        supabase.from('job_titles').select('id, name').order('name'),
      ]);

      if (profileRes.data) setProfiles(profileRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (groupRes.data) setGroups(groupRes.data);
      if (jobTitleRes.data) setJobTitles(jobTitleRes.data);

    } catch (error) {
      console.error('Error fetching sub-process data:', error);
      navigate('/templates');
    } finally {
      setIsLoading(false);
    }
  }, [subProcessId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveGeneral = async () => {
    if (!subProcess) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .update({
          name: formData.name,
          description: formData.description || null,
          is_mandatory: formData.is_mandatory,
          show_quick_launch: formData.show_quick_launch,
        } as any)
        .eq('id', subProcessId);

      if (error) throw error;

      toast.success('Paramètres enregistrés');
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!subProcess) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .update({
          assignment_type: formData.assignment_type,
          target_assignee_id: formData.assignment_type === 'user' ? formData.target_assignee_id : null,
          target_manager_id: formData.assignment_type === 'manager' ? formData.target_manager_id : null,
          target_department_id: formData.target_department_id,
          target_group_id: formData.assignment_type === 'group' ? formData.target_group_id : null,
          target_job_title_id: formData.assignment_type === 'role' ? (formData.target_job_title_id || null) : null,
          fallback_assignment_type: formData.fallback_assignment_type || null,
          fallback_target_assignee_id: formData.fallback_assignment_type === 'user' ? formData.fallback_target_assignee_id : null,
          fallback_target_group_id: formData.fallback_assignment_type === 'group' ? formData.fallback_target_group_id : null,
          fallback_target_department_id: formData.fallback_target_department_id || null,
          fallback_target_job_title_id: formData.fallback_assignment_type === 'role' ? formData.fallback_target_job_title_id : null,
          watcher_config: formData.watcher_config.length > 0 ? formData.watcher_config : null,
        } as any)
        .eq('id', subProcessId);

      if (error) throw error;

      toast.success('Affectation enregistrée');
      fetchData();
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // handleSaveValidations removed — managed via workflow steps


  const handleSaveRecurrence = async () => {
    if (!subProcess) return;
    setIsSavingRecurrence(true);
    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .update({
          recurrence_enabled: recurrence.enabled,
          recurrence_interval: recurrence.interval,
          recurrence_unit: recurrence.unit,
          recurrence_delay_days: recurrence.delayDays,
          recurrence_start_date: recurrence.startDate || null,
          recurrence_next_run_at: recurrence.enabled && recurrence.startDate ? recurrence.startDate : null,
        } as any)
        .eq('id', subProcessId);

      if (error) throw error;
      toast.success('Configuration de récurrence enregistrée');
      fetchData();
    } catch (error) {
      console.error('Error saving recurrence:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingRecurrence(false);
    }
  };

  const addValidationLevel = () => {
    if (validationLevels.length >= 5) {
      toast.error('Maximum 5 niveaux de validation');
      return;
    }
    setValidationLevels([
      ...validationLevels,
      {
        level: validationLevels.length + 1,
        type: 'manager',
        userId: null,
        timing: 'before_close',
      },
    ]);
  };

  const removeValidationLevel = (level: number) => {
    setValidationLevels(validationLevels.filter(v => v.level !== level));
  };

  const handleAddTask = async (
    task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'sub_process_template_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user || !subProcess) return;

    try {
      const { data, error } = await supabase
        .from('task_templates')
        .insert({
          ...task,
          user_id: user.id,
          sub_process_template_id: subProcessId,
          process_template_id: subProcess.process_template_id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add task node to the workflow
      await addTaskToWorkflow(subProcessId!, data.id, data.title, data.default_duration_days || 5);

      setTasks(prev => [...prev, { ...data, checklist_count: 0 } as TaskTemplateWithChecklist]);
      toast.success('Tâche ajoutée au workflow');
      setIsAddTaskOpen(false);
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error("Erreur lors de l'ajout de la tâche");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // Remove task node from workflow first
      await removeTaskFromWorkflow(subProcessId!, taskId);

      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Tâche supprimée du workflow');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const tabs = [
    { id: 'general', label: 'Général', icon: Settings },
    { id: 'tasks', label: 'Tâches', icon: ListTodo },
    { id: 'assignment', label: 'Affectation', icon: Users },
    { id: 'workflow', label: 'Workflow', icon: GitBranch },
    { id: 'custom-fields', label: 'Champs', icon: FileText },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PageHeader title="Chargement..." />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-64 w-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!subProcess) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <GitBranch className="h-5 w-5 text-primary" />
              <span>{subProcess.name}</span>
            </div>
          }
        />

        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Header with badges */}
          <div className="px-6 py-4 border-b bg-card/50">
            <div className="flex flex-wrap gap-2">
              {subProcess.is_mandatory ? (
                <Badge variant="destructive">Obligatoire</Badge>
              ) : (
                <Badge variant="secondary">Optionnel</Badge>
              )}
              <Badge variant="outline">
                {ASSIGNMENT_TYPE_LABELS[subProcess.assignment_type] || 'Standard'}
              </Badge>
              <Badge variant="outline">{tasks.length} tâche(s)</Badge>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-6 pt-4 shrink-0 border-b bg-background">
              <TabsList className="w-full grid grid-cols-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 max-w-4xl">
                {/* General Tab */}
                <TabsContent value="general" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Informations générales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nom *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <Label>Sous-processus obligatoire</Label>
                          <p className="text-xs text-muted-foreground">
                            Ne peut pas être désélectionné à la création de demande
                          </p>
                        </div>
                        <Switch
                          checked={formData.is_mandatory}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <Label>Afficher en lancement rapide</Label>
                          <p className="text-xs text-muted-foreground">
                            Ajoute un bouton raccourci sur la carte du processus dans la page Demandes
                          </p>
                        </div>
                        <Switch
                          checked={formData.show_quick_launch}
                          onCheckedChange={(checked) => setFormData({ ...formData, show_quick_launch: checked })}
                          disabled={!canManage}
                        />
                      </div>
                      {canManage && (
                        <Button onClick={handleSaveGeneral} disabled={isSaving}>
                          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <Save className="h-4 w-4 mr-2" />
                          Enregistrer
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Récurrence automatique */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Récurrence automatique</CardTitle>
                      <CardDescription className="text-xs">
                        Configurez la génération automatique de ce sous-processus à intervalle régulier
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <RecurrenceConfig value={recurrence} onChange={setRecurrence} />
                      {canManage && (
                        <Button size="sm" onClick={handleSaveRecurrence} disabled={isSavingRecurrence}>
                          {isSavingRecurrence && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          <Save className="h-3 w-3 mr-1" />
                          Enregistrer la récurrence
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-base">Tâches du sous-processus</CardTitle>
                        <CardDescription>
                          Liste des tâches avec leurs checklists
                        </CardDescription>
                      </div>
                      {canManage && (
                        <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {tasks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>Aucune tâche configurée</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tasks.map((task, index) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 p-3 border rounded-lg group"
                            >
                              {canManage && (
                                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {index + 1}.
                                  </span>
                                  <span className="font-medium">{task.title}</span>
                                </div>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {task.default_duration_days} {(task as any).default_duration_unit === 'hours' ? 'heure(s)' : 'jour(s)'}
                                  </Badge>
                                  {task.checklist_count > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {task.checklist_count} sous-action(s)
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {canManage && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setEditingTask(task)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteTask(task.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {canManage && tasks.length > 0 && (
                        <div className="pt-4 border-t mt-4">
                          <p className="text-sm text-muted-foreground">
                            Les modifications des tâches sont enregistrées automatiquement.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Assignment Tab */}
                <TabsContent value="assignment" className="mt-0 space-y-4">
                  {/* Primary Assignment */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Mode d'affectation principal</CardTitle>
                      <CardDescription>
                        Définit comment les tâches sont affectées à leur création
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => {
                          const isSelected = formData.assignment_type === value;
                          const desc = ASSIGNMENT_TYPE_DESCRIPTIONS[value as AssignmentType];
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => canManage && setFormData({ ...formData, assignment_type: value as AssignmentType })}
                              disabled={!canManage}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/50'
                              } ${!canManage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className={`font-medium text-sm ${isSelected ? 'text-primary' : ''}`}>
                                {label}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                            </button>
                          );
                        })}
                      </div>

                      <Separator />

                      {/* Contextual options per type */}
                      {formData.assignment_type === 'user' && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Utilisateur cible</Label>
                            <Select
                              value={formData.target_assignee_id || '__none__'}
                              onValueChange={(v) => setFormData({ ...formData, target_assignee_id: v === '__none__' ? null : v })}
                              disabled={!canManage}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sélectionner...</SelectItem>
                                {profiles.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.display_name || 'Sans nom'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <Label>Modifiable à la demande</Label>
                              <p className="text-xs text-muted-foreground">
                                Le demandeur peut changer l'affectataire
                              </p>
                            </div>
                            <Switch
                              checked={formData.modifiable_at_request}
                              onCheckedChange={(checked) => setFormData({ ...formData, modifiable_at_request: checked })}
                              disabled={!canManage}
                            />
                          </div>
                        </div>
                      )}

                      {formData.assignment_type === 'manager' && (
                        <div className="space-y-2">
                          <Label>Manager spécifique (optionnel)</Label>
                          <p className="text-xs text-muted-foreground">
                            Si vide, le manager du demandeur sera utilisé automatiquement
                          </p>
                          <Select
                            value={formData.target_manager_id || '__none__'}
                            onValueChange={(v) => setFormData({ ...formData, target_manager_id: v === '__none__' ? null : v })}
                            disabled={!canManage}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Manager du demandeur (par défaut)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Manager du demandeur (par défaut)</SelectItem>
                              {profiles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.display_name || 'Sans nom'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.assignment_type === 'group' && (
                        <div className="space-y-2">
                          <Label>Groupe cible</Label>
                          <Select
                            value={formData.target_group_id || '__none__'}
                            onValueChange={(v) => setFormData({ ...formData, target_group_id: v === '__none__' ? null : v })}
                            disabled={!canManage}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un groupe" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sélectionner...</SelectItem>
                              {groups.map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                  {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.assignment_type === 'role' && (
                        <div className="space-y-2">
                          <Label>Poste / Fonction</Label>
                          <Select
                            value={formData.target_job_title_id || '__none__'}
                            onValueChange={(v) => setFormData({ ...formData, target_job_title_id: v === '__none__' ? null : v })}
                            disabled={!canManage}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un poste..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sélectionner...</SelectItem>
                              {jobTitles.map((jt) => (
                                <SelectItem key={jt.id} value={jt.id}>
                                  {jt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="space-y-2">
                            <Label>Service cible (optionnel)</Label>
                            <Select
                              value={formData.target_department_id || '__none__'}
                              onValueChange={(v) => setFormData({ ...formData, target_department_id: v === '__none__' ? null : v })}
                              disabled={!canManage}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Tous les services" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Tous les services</SelectItem>
                                {departments.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {formData.assignment_type === 'requester' && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            La tâche sera automatiquement affectée au demandeur qui crée la demande.
                            Utile pour les actions de validation ou de confirmation.
                          </p>
                        </div>
                      )}

                      {/* Service cible (for non-role types) */}
                      {formData.assignment_type !== 'role' && formData.assignment_type !== 'requester' && (
                        <div className="space-y-2">
                          <Label>Service cible (optionnel)</Label>
                          <Select
                            value={formData.target_department_id || '__none__'}
                            onValueChange={(v) => setFormData({ ...formData, target_department_id: v === '__none__' ? null : v })}
                            disabled={!canManage}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Aucun filtre par service" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Aucun filtre par service</SelectItem>
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Fallback Assignment */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Affectation de repli (fallback)</CardTitle>
                      <CardDescription>
                        Utilisée si l'affectation principale ne peut pas être résolue (ex: manager absent)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <Label>Activer le fallback</Label>
                          <p className="text-xs text-muted-foreground">
                            Définir une règle de secours
                          </p>
                        </div>
                        <Switch
                          checked={!!formData.fallback_assignment_type}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              setFormData({
                                ...formData,
                                fallback_assignment_type: null,
                                fallback_target_assignee_id: null,
                                fallback_target_group_id: null,
                                fallback_target_department_id: null,
                                fallback_target_job_title_id: null,
                              });
                            } else {
                              setFormData({ ...formData, fallback_assignment_type: 'group' });
                            }
                          }}
                          disabled={!canManage}
                        />
                      </div>

                      {formData.fallback_assignment_type && (
                        <>
                          <div className="space-y-2">
                            <Label>Type de repli</Label>
                            <Select
                              value={formData.fallback_assignment_type}
                              onValueChange={(v) => setFormData({ ...formData, fallback_assignment_type: v as AssignmentType })}
                              disabled={!canManage}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ASSIGNMENT_TYPE_LABELS)
                                  .filter(([k]) => k !== formData.assignment_type)
                                  .map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {formData.fallback_assignment_type === 'user' && (
                            <div className="space-y-2">
                              <Label>Utilisateur de repli</Label>
                              <Select
                                value={formData.fallback_target_assignee_id || '__none__'}
                                onValueChange={(v) => setFormData({ ...formData, fallback_target_assignee_id: v === '__none__' ? null : v })}
                                disabled={!canManage}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sélectionner...</SelectItem>
                                  {profiles.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.display_name || 'Sans nom'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {formData.fallback_assignment_type === 'group' && (
                            <div className="space-y-2">
                              <Label>Groupe de repli</Label>
                              <Select
                                value={formData.fallback_target_group_id || '__none__'}
                                onValueChange={(v) => setFormData({ ...formData, fallback_target_group_id: v === '__none__' ? null : v })}
                                disabled={!canManage}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sélectionner...</SelectItem>
                                  {groups.map((g) => (
                                    <SelectItem key={g.id} value={g.id}>
                                      {g.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {formData.fallback_assignment_type === 'role' && (
                            <div className="space-y-2">
                              <Label>Poste de repli</Label>
                              <Select
                                value={formData.fallback_target_job_title_id || '__none__'}
                                onValueChange={(v) => setFormData({ ...formData, fallback_target_job_title_id: v === '__none__' ? null : v })}
                                disabled={!canManage}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sélectionner...</SelectItem>
                                  {jobTitles.map((jt) => (
                                    <SelectItem key={jt.id} value={jt.id}>
                                      {jt.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Watchers / Multi-assignment */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-base">Observateurs (watchers)</CardTitle>
                        <CardDescription>
                          Utilisateurs ou groupes notifiés en plus de l'affectataire principal
                        </CardDescription>
                      </div>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFormData({
                            ...formData,
                            watcher_config: [...formData.watcher_config, { type: 'requester', target_id: null }],
                          })}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {formData.watcher_config.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Aucun observateur configuré</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {formData.watcher_config.map((watcher, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                              <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Type</Label>
                                  <Select
                                    value={watcher.type}
                                    onValueChange={(v) => {
                                      const updated = [...formData.watcher_config];
                                      updated[idx] = { ...updated[idx], type: v as WatcherRule['type'], target_id: null };
                                      setFormData({ ...formData, watcher_config: updated });
                                    }}
                                    disabled={!canManage}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="requester">Demandeur</SelectItem>
                                      <SelectItem value="group">Groupe</SelectItem>
                                      <SelectItem value="user">Utilisateur</SelectItem>
                                      <SelectItem value="department">Service</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {watcher.type === 'group' && (
                                  <div>
                                    <Label className="text-xs">Groupe</Label>
                                    <Select
                                      value={watcher.target_id || '__none__'}
                                      onValueChange={(v) => {
                                        const updated = [...formData.watcher_config];
                                        updated[idx] = { ...updated[idx], target_id: v === '__none__' ? null : v };
                                        setFormData({ ...formData, watcher_config: updated });
                                      }}
                                      disabled={!canManage}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Sélectionner...</SelectItem>
                                        {groups.map((g) => (
                                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {watcher.type === 'user' && (
                                  <div>
                                    <Label className="text-xs">Utilisateur</Label>
                                    <Select
                                      value={watcher.target_id || '__none__'}
                                      onValueChange={(v) => {
                                        const updated = [...formData.watcher_config];
                                        updated[idx] = { ...updated[idx], target_id: v === '__none__' ? null : v };
                                        setFormData({ ...formData, watcher_config: updated });
                                      }}
                                      disabled={!canManage}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Sélectionner...</SelectItem>
                                        {profiles.map((p) => (
                                          <SelectItem key={p.id} value={p.id}>{p.display_name || 'Sans nom'}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {watcher.type === 'department' && (
                                  <div>
                                    <Label className="text-xs">Service</Label>
                                    <Select
                                      value={watcher.target_id || '__none__'}
                                      onValueChange={(v) => {
                                        const updated = [...formData.watcher_config];
                                        updated[idx] = { ...updated[idx], target_id: v === '__none__' ? null : v };
                                        setFormData({ ...formData, watcher_config: updated });
                                      }}
                                      disabled={!canManage}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Sélectionner...</SelectItem>
                                        {departments.map((d) => (
                                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {watcher.type === 'requester' && (
                                  <div className="flex items-end">
                                    <p className="text-xs text-muted-foreground pb-2">
                                      Le demandeur sera automatiquement ajouté en observateur
                                    </p>
                                  </div>
                                )}
                              </div>

                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive shrink-0"
                                  onClick={() => {
                                    const updated = formData.watcher_config.filter((_, i) => i !== idx);
                                    setFormData({ ...formData, watcher_config: updated });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {canManage && (
                    <div className="flex justify-end">
                      <Button onClick={handleSaveAssignment} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer l'affectation
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* Validations Tab removed — managed via workflow steps */}

                {/* Workflow Tab */}
                <TabsContent value="workflow" className="mt-0 space-y-4">
                  <WorkflowConfigTab
                    subProcessId={subProcessId!}
                    subProcessName={subProcess.name}
                    canManage={canManage}
                  />
                </TabsContent>

                {/* Custom Fields Tab */}
                <TabsContent value="custom-fields" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Champs personnalisés du sous-processus</CardTitle>
                      <CardDescription>
                        Champs spécifiques à ce sous-processus, utilisables dans les tâches et formulaires
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SubProcessCustomFieldsEditor
                        subProcessTemplateId={subProcessId!}
                        canManage={canManage}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </main>
      </div>

      <AddTaskTemplateDialog
        open={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={handleAddTask}
        orderIndex={tasks.length}
        processTemplateId={subProcess?.process_template_id}
        subProcessTemplateId={subProcessId}
      />

      <EditTaskTemplateDialog
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={() => {
          setEditingTask(null);
          fetchData();
        }}
      />
    </div>
  );
}
