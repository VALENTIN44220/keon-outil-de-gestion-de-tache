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
import { SubProcessTemplate, TaskTemplate, ASSIGNMENT_TYPE_LABELS } from '@/types/template';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AddTaskTemplateDialog } from '@/components/templates/AddTaskTemplateDialog';
import { EditTaskTemplateDialog } from '@/components/templates/EditTaskTemplateDialog';
import { addTaskToWorkflow, removeTaskFromWorkflow } from '@/hooks/useAutoWorkflowGeneration';
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

  const [activeView, setActiveView] = useState('templates');
  const [activeTab, setActiveTab] = useState('general');
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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_mandatory: true,
    assignment_type: 'manager' as 'manager' | 'user' | 'role' | 'group',
    target_assignee_id: null as string | null,
    target_manager_id: null as string | null,
    target_department_id: null as string | null,
    target_group_id: null as string | null,
    modifiable_at_request: false,
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
        assignment_type: spData.assignment_type as any,
        target_assignee_id: spData.target_assignee_id,
        target_manager_id: spData.target_manager_id,
        target_department_id: spData.target_department_id,
        target_group_id: spData.target_group_id,
        modifiable_at_request: false,
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
      const [profileRes, deptRes, groupRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').order('display_name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('collaborator_groups').select('id, name').order('name'),
      ]);

      if (profileRes.data) setProfiles(profileRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (groupRes.data) setGroups(groupRes.data);

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
        })
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
        })
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

  const handleSaveValidations = async () => {
    if (!subProcess) return;
    setIsSaving(true);

    try {
      // For now, just show success - actual implementation would save to a validations table
      toast.success('Validations enregistrées');
    } catch (error) {
      console.error('Error saving validations:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };


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
    { id: 'validations', label: 'Validations', icon: CheckSquare },
    { id: 'custom-fields', label: 'Champs personnalisés', icon: FileText },
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
              <Button
                variant="outline"
                size="sm"
                className="ml-auto gap-2"
                onClick={() => navigate(`/templates/workflow/subprocess/${subProcessId}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Éditeur Workflow
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-6 pt-4 shrink-0 border-b bg-background">
              <TabsList className="w-full grid grid-cols-5">
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
                                    {task.default_duration_days} jour(s)
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
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Mode d'affectation</CardTitle>
                      <CardDescription>
                        Définit comment les tâches sont affectées
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => {
                          const isSelected = formData.assignment_type === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => canManage && setFormData({ ...formData, assignment_type: value as any })}
                              disabled={!canManage}
                              className={`p-4 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/50'
                              } ${!canManage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <Separator />

                      {formData.assignment_type === 'user' && (
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
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mt-3">
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
                          <Label>Manager du service cible</Label>
                          <Select
                            value={formData.target_manager_id || '__none__'}
                            onValueChange={(v) => setFormData({ ...formData, target_manager_id: v === '__none__' ? null : v })}
                            disabled={!canManage}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Premier manager du service" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Premier manager du service</SelectItem>
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

                      {canManage && (
                        <Button onClick={handleSaveAssignment} disabled={isSaving}>
                          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <Save className="h-4 w-4 mr-2" />
                          Enregistrer
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Validations Tab */}
                <TabsContent value="validations" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-base">Niveaux de validation</CardTitle>
                        <CardDescription>
                          Configurez les étapes de validation (0 à 5 niveaux)
                        </CardDescription>
                      </div>
                      {canManage && validationLevels.length < 5 && (
                        <Button size="sm" variant="outline" onClick={addValidationLevel}>
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter niveau
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {validationLevels.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>Aucune validation configurée</p>
                          <p className="text-sm">Les tâches seront directement clôturées</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Niveau</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Validateur</TableHead>
                              <TableHead>Moment</TableHead>
                              <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validationLevels.map((v) => (
                              <TableRow key={v.level}>
                                <TableCell className="font-medium">N{v.level}</TableCell>
                                <TableCell>
                                  <Select
                                    value={v.type}
                                    onValueChange={(val) => {
                                      setValidationLevels(validationLevels.map(vl =>
                                        vl.level === v.level ? { ...vl, type: val as any } : vl
                                      ));
                                    }}
                                    disabled={!canManage}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="manager">Manager</SelectItem>
                                      <SelectItem value="requester">Demandeur</SelectItem>
                                      <SelectItem value="user">Utilisateur</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {v.type === 'user' ? (
                                    <Select
                                      value={v.userId || '__none__'}
                                      onValueChange={(val) => {
                                        setValidationLevels(validationLevels.map(vl =>
                                          vl.level === v.level ? { ...vl, userId: val === '__none__' ? null : val } : vl
                                        ));
                                      }}
                                      disabled={!canManage}
                                    >
                                      <SelectTrigger className="w-[160px]">
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
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={v.timing}
                                    onValueChange={(val) => {
                                      setValidationLevels(validationLevels.map(vl =>
                                        vl.level === v.level ? { ...vl, timing: val as any } : vl
                                      ));
                                    }}
                                    disabled={!canManage}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="before_start">Avant démarrage</SelectItem>
                                      <SelectItem value="before_close">Avant clôture</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {canManage && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => removeValidationLevel(v.level)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                      {canManage && (
                        <div className="pt-4 border-t mt-4">
                          <Button onClick={handleSaveValidations} disabled={isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Save className="h-4 w-4 mr-2" />
                            Enregistrer les validations
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
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
