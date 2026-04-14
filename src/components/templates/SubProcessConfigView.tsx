import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  Bell,
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Loader2,
  Save,
  ArrowLeft,
  GitBranch,
  ExternalLink,
  Package,
  Database,
  Filter,
  Eye,
  EyeOff,
  Workflow,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SubProcessTemplate, TaskTemplate, ASSIGNMENT_TYPE_LABELS } from '@/types/template';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AddTaskTemplateDialog } from './AddTaskTemplateDialog';
import { EditTaskTemplateDialog } from './EditTaskTemplateDialog';
import { SubProcessNotificationsPanel } from './SubProcessNotificationsPanel';
import { TableOutputMappingPanel } from './TableOutputMappingPanel';
import { addTaskToWorkflow, removeTaskFromWorkflow } from '@/hooks/useAutoWorkflowGeneration';
import { WorkflowConfigTab } from '@/components/workflow-config/WorkflowConfigTab';
import { cn } from '@/lib/utils';

interface SubProcessConfigViewProps {
  subProcessId: string;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  canManage?: boolean;
}

interface TaskTemplateWithChecklist extends TaskTemplate {
  checklist_count: number;
}

// ValidationLevel interface removed — validation is now managed via workflow steps

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

export function SubProcessConfigView({
  subProcessId,
  open,
  onClose,
  onUpdate,
  canManage = false,
}: SubProcessConfigViewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Sub-process data
  const [subProcess, setSubProcess] = useState<SubProcessTemplate | null>(null);
  const [tasks, setTasks] = useState<TaskTemplateWithChecklist[]>([]);
  // validationLevels state removed — managed via workflow steps
  
  // Reference data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<CollaboratorGroup[]>([]);

  // Task dialogs
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplateWithChecklist | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_mandatory: true,
    apply_request_validation: true,
    assignment_type: 'manager' as 'manager' | 'user' | 'role' | 'group' | 'requester',
    target_assignee_id: null as string | null,
    target_manager_id: null as string | null,
    target_department_id: null as string | null,
    target_group_id: null as string | null,
    modifiable_at_request: false,
    show_quick_launch: false,
  });

  // Table filters config (stored in form_schema.table_filters, keyed by table_name)
  const [tableFilters, setTableFilters] = useState<Record<string, { ref_prefix: string; exclude_des: string }>>({});
  // All available lookup table configs
  const [allLookupConfigs, setAllLookupConfigs] = useState<{ table_name: string; label: string }[]>([]);
  // Selected tables for integrated components & filters
  const [enabledComponents, setEnabledComponents] = useState<string[]>([]);
  const [enabledFilterTables, setEnabledFilterTables] = useState<string[]>([]);

  // Built-in component flags (legacy)
  const [hasMaterialLines, setHasMaterialLines] = useState(false);

  // Hidden request fields config (stored in form_schema)
  const [hiddenRequestFields, setHiddenRequestFields] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<{ id: string; label: string; name: string }[]>([]);

  useEffect(() => {
    if (open && subProcessId) {
      fetchData();
    }
  }, [open, subProcessId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch sub-process
      const { data: spData } = await supabase
        .from('sub_process_templates')
        .select('*')
        .eq('id', subProcessId)
        .single();

      if (spData) {
        setSubProcess(spData as SubProcessTemplate);
        setFormData({
          name: spData.name,
          description: spData.description || '',
          is_mandatory: spData.is_mandatory ?? true,
          apply_request_validation: ((spData as any).form_schema as any)?.apply_request_validation !== false,
          assignment_type: spData.assignment_type as any,
          target_assignee_id: spData.target_assignee_id,
          target_manager_id: spData.target_manager_id,
          target_department_id: spData.target_department_id,
          target_group_id: spData.target_group_id,
          modifiable_at_request: false,
          show_quick_launch: (spData as any).show_quick_launch ?? false,
        });

        // Load table filters and hidden request fields from form_schema
        const formSchema = (spData as any).form_schema;
        if (formSchema && typeof formSchema === 'object') {
          // Support both legacy article_filter and new table_filters
          const tf = (formSchema as any).table_filters;
          const af = (formSchema as any).article_filter;
          if (tf && typeof tf === 'object') {
            setTableFilters(tf);
          } else if (af) {
            // Migrate legacy article_filter to table_filters format
            setTableFilters({ articles: { ref_prefix: af.ref_prefix || '', exclude_des: af.exclude_des || '' } });
          } else {
            setTableFilters({});
          }
          const hrf = (formSchema as any).hidden_request_fields;
          if (Array.isArray(hrf)) {
            setHiddenRequestFields(hrf);
          } else {
            setHiddenRequestFields([]);
          }
          // Load material lines flag and enabled components/filters
          setHasMaterialLines(!!(formSchema as any).has_material_lines);
          setEnabledComponents(Array.isArray((formSchema as any).enabled_components) ? (formSchema as any).enabled_components : []);
          setEnabledFilterTables(Array.isArray((formSchema as any).enabled_filter_tables) ? (formSchema as any).enabled_filter_tables : []);
        }

        // validation_config loading removed — managed via workflow steps
      }

      // Fetch tasks with checklist count
      const { data: taskData, error: taskError } = await supabase
        .from('task_templates')
        .select(`
          *,
          task_template_checklists (id)
        `)
        .eq('sub_process_template_id', subProcessId)
        .order('order_index');

      console.log('SubProcessConfigView - Tasks query:', { subProcessId, taskData, taskError, tasksCount: taskData?.length || 0 });

      if (taskData) {
        setTasks(taskData.map(t => ({
          ...t,
          checklist_count: t.task_template_checklists?.length || 0,
        })) as TaskTemplateWithChecklist[]);
      }

      // Fetch reference data
      const [profileRes, deptRes, groupRes, customFieldsRes, spFieldsRes, lookupConfigsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('collaborator_groups').select('id, name').order('name'),
        spData?.process_template_id
          ? supabase.from('template_custom_fields').select('id, label, name').eq('process_template_id', spData.process_template_id).order('order_index')
          : Promise.resolve({ data: [] }),
        // Fetch custom fields for THIS sub-process + process-level ones to find table_lookup usage
        supabase.from('template_custom_fields')
          .select('id, field_type, lookup_table')
          .or(`sub_process_template_id.eq.${subProcessId},process_template_id.eq.${spData?.process_template_id}`)
          .eq('field_type', 'table_lookup')
          .not('lookup_table', 'is', null),
        supabase.from('admin_table_lookup_configs')
          .select('table_name, label')
          .eq('is_active', true),
      ]);

      if (profileRes.data) setProfiles(profileRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (groupRes.data) setGroups(groupRes.data);
      if (customFieldsRes.data) setCustomFields(customFieldsRes.data);
      
      // Store all lookup configs for component/filter selection
      if (lookupConfigsRes.data) {
        setAllLookupConfigs(lookupConfigsRes.data.map((c: any) => ({ table_name: c.table_name, label: c.label })));
      }

    } catch (error) {
      console.error('Error fetching sub-process data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    if (!subProcess) return;
    setIsSaving(true);

    try {
      // Build form_schema with table filters (and keep legacy article_filter for backward compat)
      const existingSchema = (subProcess as any).form_schema || {};
      const articleFilterFromTable = tableFilters['articles'];
      const updatedSchema = {
        ...existingSchema,
        table_filters: tableFilters,
        // Keep article_filter for backward compatibility with existing consumers
        article_filter: articleFilterFromTable ? {
          ref_prefix: articleFilterFromTable.ref_prefix || null,
          exclude_des: articleFilterFromTable.exclude_des || null,
        } : (existingSchema.article_filter || null),
        hidden_request_fields: hiddenRequestFields,
        has_material_lines: hasMaterialLines,
        apply_request_validation: formData.apply_request_validation,
        enabled_components: enabledComponents,
        enabled_filter_tables: enabledFilterTables,
      };

      const { error } = await supabase
        .from('sub_process_templates')
        .update({
          name: formData.name,
          description: formData.description || null,
          is_mandatory: formData.is_mandatory,
          show_quick_launch: formData.show_quick_launch,
          form_schema: updatedSchema,
        } as any)
        .eq('id', subProcessId);

      if (error) throw error;

      toast.success('Paramètres enregistrés');
      // onUpdate() removed to prevent tab reset
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
          target_assignee_id: formData.assignment_type === 'user' ? (formData.target_assignee_id || null) : null,
          target_manager_id: formData.assignment_type === 'manager' ? (formData.target_manager_id || null) : null,
          target_department_id: formData.target_department_id || null,
          target_group_id: formData.assignment_type === 'group' ? (formData.target_group_id || null) : null,
        })
        .eq('id', subProcessId);

      if (error) throw error;

      toast.success('Affectation enregistrée');
      // onUpdate() removed to prevent tab reset
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // addValidationLevel, removeValidationLevel, handleSaveValidation removed — managed via workflow steps

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
      await addTaskToWorkflow(subProcessId, data.id, data.title, data.default_duration_days || 5);

      setTasks(prev => [...prev, { ...data, checklist_count: 0 } as TaskTemplateWithChecklist]);
      toast.success('Tâche ajoutée au workflow');
      setIsAddTaskOpen(false);
      // onUpdate() removed to prevent tab reset
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error("Erreur lors de l'ajout de la tâche");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // Remove task node from workflow first
      await removeTaskFromWorkflow(subProcessId, taskId);

      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Tâche supprimée du workflow');
      // onUpdate() removed to prevent tab reset
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent className="w-full sm:max-w-3xl">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!subProcess) return null;

  const tabs = [
    { id: 'general', label: 'Général', icon: Settings },
    { id: 'tasks', label: 'Tâches', icon: ListTodo },
    { id: 'assignment', label: 'Affectation', icon: Users },
    { id: 'output', label: 'Sortie table', icon: Database },
    { id: 'visibility', label: 'Visibilité', icon: Eye },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'workflow', label: 'Workflow', icon: Workflow },
  ];

  return (
    <>
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-[90vw] p-0 flex flex-col h-full">
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <SheetTitle className="text-xl flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                {subProcess.name}
              </SheetTitle>
              <div className="flex gap-2 mt-2">
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
          </div>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="w-full grid grid-cols-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="gap-1 text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
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
                        <Label>Validations de la demande</Label>
                        <p className="text-xs text-muted-foreground">
                          Appliquer les règles de validations du processus
                        </p>
                      </div>
                      <Switch
                        checked={formData.apply_request_validation}
                        onCheckedChange={(checked) => setFormData({ ...formData, apply_request_validation: checked })}
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

                    <Separator />

                    {/* Built-in components - multi-table selection */}
                    <Card className="border-warning/30 bg-warning/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Package className="h-4 w-4 text-warning" />
                          Composants intégrés
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Sélectionnez les tables à intégrer au formulaire de demande
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {/* Legacy material lines toggle */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-warning/10 flex items-center justify-center">
                              <Package className="h-4 w-4 text-warning" />
                            </div>
                            <div>
                              <Label className="text-sm">Lignes de matériel (articles)</Label>
                              <p className="text-xs text-muted-foreground">
                                Ajoute un sélecteur d'articles avec quantités au formulaire
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={hasMaterialLines}
                            onCheckedChange={(checked) => setHasMaterialLines(checked)}
                            disabled={!canManage}
                          />
                        </div>
                        {/* Dynamic table components */}
                        {allLookupConfigs.map((config) => {
                          const isEnabled = enabledComponents.includes(config.table_name);
                          return (
                            <div key={config.table_name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded bg-warning/10 flex items-center justify-center">
                                  <Database className="h-4 w-4 text-warning" />
                                </div>
                                <div>
                                  <Label className="text-sm">{config.label}</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Table : {config.table_name}
                                  </p>
                                </div>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => {
                                  setEnabledComponents(prev =>
                                    checked ? [...prev, config.table_name] : prev.filter(t => t !== config.table_name)
                                  );
                                }}
                                disabled={!canManage}
                              />
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>

                    <Separator />

                    {/* Table filters - multi-table selection */}
                    <Card className="border-primary/30 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Filter className="h-4 w-4 text-primary" />
                          Filtre des tables
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Sélectionnez les tables à filtrer et configurez les filtres
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Table selection */}
                        <div className="space-y-2">
                          {allLookupConfigs.map((config) => {
                            const isEnabled = enabledFilterTables.includes(config.table_name);
                            return (
                              <div key={config.table_name} className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                  <Label className="text-xs font-semibold flex items-center gap-2">
                                    <Database className="h-3.5 w-3.5" />
                                    {config.label}
                                  </Label>
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={(checked) => {
                                      setEnabledFilterTables(prev =>
                                        checked ? [...prev, config.table_name] : prev.filter(t => t !== config.table_name)
                                      );
                                    }}
                                    disabled={!canManage}
                                  />
                                </div>
                                {isEnabled && (
                                  <div className="pl-4 space-y-2 border-l-2 border-primary/20 ml-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Préfixe de référence</Label>
                                      <Input
                                        value={(tableFilters[config.table_name] || { ref_prefix: '', exclude_des: '' }).ref_prefix}
                                        onChange={(e) => setTableFilters(prev => ({
                                          ...prev,
                                          [config.table_name]: { ...(prev[config.table_name] || { ref_prefix: '', exclude_des: '' }), ref_prefix: e.target.value }
                                        }))}
                                        placeholder="Ex: ASM, AD0... (vide = tous)"
                                        className="h-8 text-sm"
                                        disabled={!canManage}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Exclure les désignations contenant</Label>
                                      <Input
                                        value={(tableFilters[config.table_name] || { ref_prefix: '', exclude_des: '' }).exclude_des}
                                        onChange={(e) => setTableFilters(prev => ({
                                          ...prev,
                                          [config.table_name]: { ...(prev[config.table_name] || { ref_prefix: '', exclude_des: '' }), exclude_des: e.target.value }
                                        }))}
                                        placeholder="Ex: NON DEFINI (vide = aucune exclusion)"
                                        className="h-8 text-sm"
                                        disabled={!canManage}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    {canManage && (
                      <Button onClick={handleSaveGeneral} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer
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
                      <CardDescription className="space-y-1">
                        <span>Liste des tâches avec leurs checklists.</span>
                        <span className="block text-xs text-amber-900/90 dark:text-amber-200/90">
                          Pour activer « Envoyer pour validation » côté exécutant, ouvrez une tâche avec « Modifier » et renseignez la section « Qui valide avant la clôture ? ».
                        </span>
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
                                {(task.validation_level_1 !== 'none' || task.validation_level_2 !== 'none') && (
                                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-900 dark:text-amber-100">
                                    Validation avant clôture
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
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Assignment Tab — Read-only summary, config lives in Workflow */}
              <TabsContent value="assignment" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mode d'affectation</CardTitle>
                    <CardDescription>
                      L'affectation est configurée dans le workflow. Voici un résumé de la configuration actuelle.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Type d'affectation</span>
                        <Badge variant="outline">
                          {ASSIGNMENT_TYPE_LABELS[formData.assignment_type] || 'Non défini'}
                        </Badge>
                      </div>

                      {formData.assignment_type === 'user' && formData.target_assignee_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Utilisateur cible</span>
                          <span className="text-sm font-medium">
                            {profiles.find(p => p.id === formData.target_assignee_id)?.display_name || '—'}
                          </span>
                        </div>
                      )}

                      {formData.assignment_type === 'manager' && formData.target_manager_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Manager cible</span>
                          <span className="text-sm font-medium">
                            {profiles.find(p => p.id === formData.target_manager_id)?.display_name || 'Premier manager du service'}
                          </span>
                        </div>
                      )}

                      {formData.assignment_type === 'group' && formData.target_group_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Groupe cible</span>
                          <span className="text-sm font-medium">
                            {groups.find(g => g.id === formData.target_group_id)?.name || '—'}
                          </span>
                        </div>
                      )}

                      {formData.assignment_type === 'user' && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Modifiable à la demande</span>
                          <Badge variant={formData.modifiable_at_request ? 'default' : 'secondary'}>
                            {formData.modifiable_at_request ? 'Oui' : 'Non'}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <Workflow className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm text-primary flex-1">
                        Pour modifier l'affectation, utilisez la configuration du workflow.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('workflow')}
                        className="shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Aller au Workflow
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Validations Tab removed — managed via workflow steps */}

              {/* Visibility Tab - Request detail fields */}
              <TabsContent value="visibility" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Visibilité des champs de la demande
                    </CardTitle>
                    <CardDescription>
                      Sélectionnez les champs de la demande parent qui seront visibles dans l'onglet "Détail demande" des tâches créées par ce sous-processus
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Champs standards</h4>
                      <div className="space-y-2">
                        {[
                          { key: 'standard:title', label: 'Titre de la demande' },
                          { key: 'standard:request_number', label: 'Numéro de la demande' },
                          { key: 'standard:description', label: 'Description' },
                          { key: 'standard:priority', label: 'Priorité' },
                          { key: 'standard:due_date', label: 'Date d\'échéance' },
                          { key: 'standard:requester', label: 'Demandeur' },
                          { key: 'standard:department', label: 'Service cible' },
                          { key: 'standard:category', label: 'Catégorie' },
                          { key: 'standard:process', label: 'Processus' },
                        ].map((field) => {
                          const isHidden = hiddenRequestFields.includes(field.key);
                          return (
                            <div
                              key={field.key}
                              className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <span className="text-sm">{field.label}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (isHidden) {
                                    setHiddenRequestFields(prev => prev.filter(f => f !== field.key));
                                  } else {
                                    setHiddenRequestFields(prev => [...prev, field.key]);
                                  }
                                }}
                                disabled={!canManage}
                                className={cn("gap-1.5", isHidden ? "text-muted-foreground" : "text-primary")}
                              >
                                {isHidden ? (
                                  <>
                                    <EyeOff className="h-4 w-4" />
                                    <span className="text-xs">Masqué</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4" />
                                    <span className="text-xs">Visible</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {customFields.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold">Champs personnalisés</h4>
                          <div className="space-y-2">
                            {customFields.map((field) => {
                              const key = `custom:${field.id}`;
                              const isHidden = hiddenRequestFields.includes(key);
                              return (
                                <div
                                  key={field.id}
                                  className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <span className="text-sm">{field.label}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (isHidden) {
                                        setHiddenRequestFields(prev => prev.filter(f => f !== key));
                                      } else {
                                        setHiddenRequestFields(prev => [...prev, key]);
                                      }
                                    }}
                                    disabled={!canManage}
                                    className={cn("gap-1.5", isHidden ? "text-muted-foreground" : "text-primary")}
                                  >
                                    {isHidden ? (
                                      <>
                                        <EyeOff className="h-4 w-4" />
                                        <span className="text-xs">Masqué</span>
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-4 w-4" />
                                        <span className="text-xs">Visible</span>
                                      </>
                                    )}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {canManage && (
                      <Button onClick={handleSaveGeneral} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Output Tab */}
              <TabsContent value="output" className="mt-0 space-y-4">
                <TableOutputMappingPanel
                  processTemplateId={subProcess?.process_template_id || null}
                  subProcessTemplateId={subProcessId}
                  canManage={canManage}
                  onUpdate={onUpdate}
                />
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="mt-0 space-y-4">
                <SubProcessNotificationsPanel
                  subProcessId={subProcessId}
                  canManage={canManage}
                  onUpdate={onUpdate}
                />
              </TabsContent>

              {/* Workflow Tab */}
              <TabsContent value="workflow" className="mt-0 space-y-4">
                <WorkflowConfigTab
                  subProcessId={subProcessId}
                  subProcessName={subProcess.name}
                  canManage={canManage}
                />
              </TabsContent>

            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>

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
    </>
  );
}
