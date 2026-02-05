import { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { ProcessWithTasks, TaskTemplate } from '@/types/template';
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
import { InlineChecklistEditor } from './InlineChecklistEditor';
import { TaskLinksEditor } from './TaskLinksEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { FileText, Workflow, Loader2 } from 'lucide-react';
import { ActionType } from '@/components/layout/NewActionMenu';

interface Profile {
  id: string;
  display_name: string | null;
  job_title: string | null;
}

interface ChecklistItem {
  id: string;
  title: string;
  order_index: number;
}

interface LinkItem {
  id: string;
  name: string;
  url: string;
  type: 'link' | 'file';
}

interface NewTaskDialogProps {
  open: boolean;
  onClose: () => void;
  mode: ActionType;
  onAdd: (
    task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>, 
    checklistItems?: ChecklistItem[],
    links?: LinkItem[]
  ) => void;
  onTasksCreated?: () => void;
}

type CreationMode = 'empty' | 'template' | 'process';

export function NewTaskDialog({ open, onClose, mode, onAdd, onTasksCreated }: NewTaskDialogProps) {
  const { profile: currentUser } = useAuth();
  const [creationMode, setCreationMode] = useState<CreationMode>('empty');
  
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
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  
  // Template/Process selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  
  // Data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [processes, setProcesses] = useState<ProcessWithTasks[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const { categories, addCategory, addSubcategory } = useCategories();

  // Set defaults based on mode
  useEffect(() => {
    if (open && currentUser) {
      if (mode === 'personal') {
        // Personal task: both requester and assignee are current user
        setAssigneeId(currentUser.id);
        setRequesterId(currentUser.id);
      } else if (mode === 'team') {
        // Team task: requester is current user, assignee to be selected
        setRequesterId(currentUser.id);
        setAssigneeId(null);
      }
    }
  }, [open, mode, currentUser]);

  useEffect(() => {
    if (open) {
      fetchProfiles();
      fetchTemplatesAndProcesses();
    }
  }, [open]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, job_title')
      .order('display_name');

    if (!error && data) {
      setProfiles(data);
    }
  };

  const fetchTemplatesAndProcesses = async () => {
    setIsLoadingTemplates(true);
    try {
      // Fetch processes with task templates
      const { data: processData } = await supabase
        .from('process_templates')
        .select('*')
        .order('name');

      if (processData) {
        const processesWithTasks = await Promise.all(
          processData.map(async (process) => {
            const { data: tasks } = await supabase
              .from('task_templates')
              .select('*')
              .eq('process_template_id', process.id)
              .order('order_index');
            return { ...process, task_templates: tasks || [] } as ProcessWithTasks;
          })
        );
        setProcesses(processesWithTasks);
      }

      // Fetch standalone task templates (not attached to a process)
      const { data: templateData } = await supabase
        .from('task_templates')
        .select('*')
        .is('process_template_id', null)
        .order('title');

      if (templateData) {
        setTaskTemplates(templateData as TaskTemplate[]);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplateId && creationMode === 'template') {
      const template = taskTemplates.find(t => t.id === selectedTemplateId);
      if (template) {
        setTitle(template.title);
        setDescription(template.description || '');
        setPriority(template.priority);
        setCategoryId(template.category_id);
        setSubcategoryId(template.subcategory_id);
        if (template.default_duration_days) {
          const date = new Date();
          date.setDate(date.getDate() + template.default_duration_days);
          setDueDate(date.toISOString().split('T')[0]);
        }
      }
    }
  }, [selectedTemplateId, creationMode, taskTemplates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (creationMode === 'process' && selectedProcessId) {
      // Create all tasks from process
      await createTasksFromProcess();
    } else {
      // Create single task
      if (!title.trim()) return;
      createSingleTask();
    }
  };

  const createSingleTask = () => {
    const selectedCategory = categories.find(c => c.id === categoryId);

    onAdd({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      type: 'task',
      category: selectedCategory?.name || null,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      due_date: dueDate || null,
      assignee_id: assigneeId,
      requester_id: requesterId,
      reporter_id: reporterId,
      target_department_id: null,
      validator_id: null,
      validation_requested_at: null,
      validated_at: null,
      validation_comment: null,
      requires_validation: false,
      current_validation_level: 0,
      parent_request_id: null,
      is_assignment_task: false,
      source_process_template_id: null,
      source_sub_process_template_id: null,
      be_project_id: null,
      be_label_id: null,
      rbe_validator_id: null,
      rbe_validated_at: null,
      rbe_validation_status: null,
      rbe_validation_comment: null,
      requester_validated_at: null,
      requester_validation_status: null,
      requester_validation_comment: null,
      // New validation workflow fields
      validation_level_1: 'none',
      validation_level_2: 'none',
      validator_level_1_id: null,
      validator_level_2_id: null,
      validation_1_status: 'pending',
      validation_1_at: null,
      validation_1_by: null,
      validation_1_comment: null,
      validation_2_status: 'pending',
      validation_2_at: null,
      validation_2_by: null,
      validation_2_comment: null,
      original_assignee_id: null,
      is_locked_for_validation: false,
      // Numbering fields (auto-generated by DB trigger)
      request_number: null,
      task_number: null,
    }, checklistItems.length > 0 ? checklistItems : undefined, links.length > 0 ? links : undefined);

    resetForm();
    onClose();
  };

  const createTasksFromProcess = async () => {
    const process = processes.find(p => p.id === selectedProcessId);
    if (!process || !currentUser) return;

    for (const template of process.task_templates) {
      const dueDate = new Date();
      if (template.default_duration_days) {
        dueDate.setDate(dueDate.getDate() + template.default_duration_days);
      }

      await onAdd({
        title: template.title,
        description: template.description || null,
        priority: template.priority,
        status: 'todo',
        type: 'task',
        category: template.category || null,
        category_id: template.category_id,
        subcategory_id: template.subcategory_id,
        due_date: dueDate.toISOString().split('T')[0],
        assignee_id: mode === 'personal' ? currentUser.id : assigneeId,
        requester_id: currentUser.id,
        reporter_id: reporterId,
        target_department_id: null,
        validator_id: null,
        validation_requested_at: null,
        validated_at: null,
        validation_comment: null,
        requires_validation: false,
        current_validation_level: 0,
        parent_request_id: null,
        is_assignment_task: false,
        source_process_template_id: null,
        source_sub_process_template_id: null,
        be_project_id: null,
        be_label_id: null,
        rbe_validator_id: null,
        rbe_validated_at: null,
        rbe_validation_status: null,
        rbe_validation_comment: null,
        requester_validated_at: null,
        requester_validation_status: null,
        requester_validation_comment: null,
        // New validation workflow fields
        validation_level_1: (template as any).validation_level_1 || 'none',
        validation_level_2: (template as any).validation_level_2 || 'none',
        validator_level_1_id: (template as any).validator_level_1_id || null,
        validator_level_2_id: (template as any).validator_level_2_id || null,
        validation_1_status: 'pending',
        validation_1_at: null,
        validation_1_by: null,
        validation_1_comment: null,
        validation_2_status: 'pending',
        validation_2_at: null,
        validation_2_by: null,
        validation_2_comment: null,
        original_assignee_id: null,
        is_locked_for_validation: false,
        // Numbering fields (auto-generated by DB trigger)
        request_number: null,
        task_number: null,
      });
    }

    onTasksCreated?.();
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setCreationMode('empty');
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStatus('todo');
    setCategoryId(null);
    setSubcategoryId(null);
    setDueDate('');
    setAssigneeId(null);
    setRequesterId(null);
    setReporterId(null);
    setChecklistItems([]);
    setLinks([]);
    setSelectedTemplateId(null);
    setSelectedProcessId(null);
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

  const getDialogTitle = () => {
    switch (mode) {
      case 'personal':
        return 'Nouvelle tâche personnelle';
      case 'team':
        return 'Affecter une tâche à votre équipe';
      default:
        return 'Nouvelle tâche';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Creation mode selection */}
          <div className="space-y-3">
            <Label>Comment souhaitez-vous créer cette tâche ?</Label>
            <RadioGroup
              value={creationMode}
              onValueChange={(v) => setCreationMode(v as CreationMode)}
              className="grid grid-cols-3 gap-4"
            >
              <Label
                htmlFor="empty"
                className={`flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                  creationMode === 'empty' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="empty" id="empty" className="sr-only" />
                <FileText className="h-8 w-8 text-muted-foreground" />
                <span className="font-medium text-sm">Tâche vide</span>
              </Label>
              
              <Label
                htmlFor="template"
                className={`flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                  creationMode === 'template' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="template" id="template" className="sr-only" />
                <FileText className="h-8 w-8 text-muted-foreground" />
                <span className="font-medium text-sm">Depuis un modèle</span>
              </Label>
              
              <Label
                htmlFor="process"
                className={`flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                  creationMode === 'process' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="process" id="process" className="sr-only" />
                <Workflow className="h-8 w-8 text-muted-foreground" />
                <span className="font-medium text-sm">Processus complet</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Template selection */}
          {creationMode === 'template' && (
            <div className="space-y-2">
              <Label>Sélectionner un modèle de tâche</Label>
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <Select value={selectedTemplateId || ''} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un modèle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                        {template.priority && (
                          <Badge variant="outline" className="ml-2">
                            {template.priority}
                          </Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Process selection */}
          {creationMode === 'process' && (
            <div className="space-y-2">
              <Label>Sélectionner un processus</Label>
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <Select value={selectedProcessId || ''} onValueChange={setSelectedProcessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un processus..." />
                  </SelectTrigger>
                  <SelectContent>
                    {processes.map(process => (
                      <SelectItem key={process.id} value={process.id}>
                        {process.name}
                        <Badge variant="secondary" className="ml-2">
                          {process.task_templates.length} tâches
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedProcessId && (
                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Tâches à créer :</p>
                  <ul className="text-sm space-y-1">
                    {processes.find(p => p.id === selectedProcessId)?.task_templates.map((t, i) => (
                      <li key={t.id}>• {t.title}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Task form (for empty or template mode) */}
          {(creationMode === 'empty' || creationMode === 'template') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Décrivez brièvement votre tâche"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Donnez plus de détails..."
                  rows={3}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priorité</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
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

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Date d'échéance</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Assignee selection - only for team mode */}
              {mode === 'team' && (
                <div className="space-y-2">
                  <Label>Exécutant *</Label>
                  <Select 
                    value={assigneeId || ''} 
                    onValueChange={(v) => setAssigneeId(v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner l'exécutant" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.display_name || 'Sans nom'} 
                          {profile.job_title && ` - ${profile.job_title}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Additional tabs */}
              <Tabs defaultValue="checklist" className="border-t pt-4 mt-4">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="checklist">Sous-actions</TabsTrigger>
                  <TabsTrigger value="links">Liens & PJ</TabsTrigger>
                  <TabsTrigger value="roles">Responsabilités</TabsTrigger>
                </TabsList>
                
                <TabsContent value="checklist" className="mt-4">
                  <InlineChecklistEditor 
                    items={checklistItems} 
                    onChange={setChecklistItems} 
                  />
                </TabsContent>

                <TabsContent value="links" className="mt-4">
                  <TaskLinksEditor 
                    items={links} 
                    onChange={setLinks} 
                  />
                </TabsContent>

                <TabsContent value="roles" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Rapporteur (à qui rapporter l'action)</Label>
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
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              type="submit"
              disabled={
                (creationMode !== 'process' && !title.trim()) ||
                (creationMode === 'process' && !selectedProcessId)
              }
            >
              {creationMode === 'process' ? 'Créer les tâches' : 'Créer la tâche'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
