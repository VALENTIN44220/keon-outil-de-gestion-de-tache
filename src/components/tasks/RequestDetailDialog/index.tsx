import { useState, useEffect, useMemo } from 'react';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  Calendar, 
  User, 
  Flag, 
  Workflow, 
  CheckCircle2,
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
  LayoutDashboard,
  GitBranch
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TaskCommentsSection } from '../TaskCommentsSection';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useDueDatePermissionWithManager } from '@/hooks/useDueDatePermission';
import { SubProcessGroup, priorityConfig, statusConfig, RequestDetailDialogProps, Profile } from './types';
import { SynthesisTab } from './SynthesisTab';
import { SubProcessTab } from './SubProcessTab';
import { WorkflowProgressTab } from './WorkflowProgressTab';

export function RequestDetailDialog({ task, open, onClose, onStatusChange }: RequestDetailDialogProps) {
  const [childTasks, setChildTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Map<string, string>>(new Map());
  const [processName, setProcessName] = useState<string | null>(null);
  const [subProcessNames, setSubProcessNames] = useState<Map<string, { name: string; departmentId: string | null }>>(new Map());
  
  // Active tab management
  const [activeTab, setActiveTab] = useState<string>('synthesis');
  
  // Child task editing state
  const [selectedChildTask, setSelectedChildTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  
  // Fetch checklist progress for child tasks
  const childTaskIds = childTasks.map(t => t.id);
  const { progressMap: checklistProgress } = useTasksProgress(childTaskIds);

  // Group tasks by sub-process
  const subProcessGroups = useMemo<SubProcessGroup[]>(() => {
    const groups = new Map<string, Task[]>();
    
    childTasks.forEach(task => {
      const spId = task.source_sub_process_template_id || 'direct';
      if (!groups.has(spId)) {
        groups.set(spId, []);
      }
      groups.get(spId)!.push(task);
    });
    
    return Array.from(groups.entries())
      .filter(([id]) => id !== 'direct') // Only sub-process tasks
      .map(([subProcessId, tasks]) => {
        const spInfo = subProcessNames.get(subProcessId);
        const completedCount = tasks.filter(t => t.status === 'done' || t.status === 'validated').length;
        const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
        
        let status: 'pending' | 'in-progress' | 'done' = 'pending';
        if (completedCount === tasks.length && tasks.length > 0) {
          status = 'done';
        } else if (tasks.some(t => t.status === 'in-progress' || t.status === 'done')) {
          status = 'in-progress';
        }
        
        return {
          subProcessId,
          subProcessName: spInfo?.name || 'Sous-processus',
          departmentId: spInfo?.departmentId || null,
          departmentName: spInfo?.departmentId ? departments.get(spInfo.departmentId) || null : null,
          tasks,
          completedCount,
          totalCount: tasks.length,
          progressPercent,
          status,
        };
      });
  }, [childTasks, subProcessNames, departments]);

  // Calculate global progress
  const globalProgress = useMemo(() => {
    if (childTasks.length === 0) return 0;
    const completedTasks = childTasks.filter(t => t.status === 'done' || t.status === 'validated').length;
    return Math.round((completedTasks / childTasks.length) * 100);
  }, [childTasks]);

  useEffect(() => {
    if (open && task) {
      fetchRelatedData();
      setActiveTab('synthesis');
    }
  }, [open, task?.id]);

  const fetchRelatedData = async () => {
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
        
        // Get unique sub-process IDs
        const spIds = [...new Set(children.map(c => c.source_sub_process_template_id).filter(Boolean))];
        
        if (spIds.length > 0) {
          // Fetch sub-process template names and departments
          const { data: spData } = await supabase
            .from('sub_process_templates')
            .select('id, name, target_department_id')
            .in('id', spIds);
          
          if (spData) {
            const spMap = new Map<string, { name: string; departmentId: string | null }>();
            spData.forEach(sp => spMap.set(sp.id, { 
              name: sp.name, 
              departmentId: sp.target_department_id 
            }));
            setSubProcessNames(spMap);
          }
        }
      }

      // Fetch profiles with manager_id
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, manager_id');

      if (profilesData) {
        const map = new Map<string, string>();
        profilesData.forEach((p) => map.set(p.id, p.display_name || 'Sans nom'));
        setProfiles(map);
        setProfilesList(profilesData.map(p => ({ 
          id: p.id, 
          display_name: p.display_name,
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
    } catch (error) {
      console.error('Error fetching related data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSelectSubProcess = (subProcessId: string) => {
    setActiveTab(subProcessId);
  };

  if (!task) return null;

  const StatusIcon = statusConfig[task.status] ? 
    (task.status === 'done' || task.status === 'validated' ? CheckCircle2 : 
     task.status === 'in-progress' ? Clock : AlertCircle) 
    : AlertCircle;

  // Child task detail/edit view
  if (selectedChildTask) {
    const ChildStatusIcon = selectedChildTask.status === 'done' || selectedChildTask.status === 'validated' 
      ? CheckCircle2 
      : selectedChildTask.status === 'in-progress' 
        ? Clock 
        : AlertCircle;
        
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
              </div>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
              )}
            </div>
            <DialogTitle className="text-xl mt-2">
              {isEditing ? 'Modifier la tâche' : selectedChildTask.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {isEditing ? (
              <>
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
                    <Select
                      value={editForm.assignee_id || '__none__'}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, assignee_id: value === '__none__' ? '' : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Non assigné" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Non assigné</SelectItem>
                        {profilesList.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              </>
            ) : (
              <>
                {selectedChildTask.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                    <p className="text-sm whitespace-pre-wrap">{selectedChildTask.description}</p>
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

                <Separator />
                <TaskCommentsSection taskId={selectedChildTask.id} className="min-h-[200px]" />

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={handleCloseChildTask}>
                    Retour
                  </Button>
                  <Button onClick={() => { onStatusChange(selectedChildTask.id, 'done'); handleCloseChildTask(); }}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marquer terminé
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Check if this request has sub-processes
  const hasSubProcesses = subProcessGroups.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
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
          </div>
          <DialogTitle className="text-xl mt-2">{task.title}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasSubProcesses ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="w-full shrink-0">
              <TabsList className="inline-flex w-max">
                <TabsTrigger value="synthesis" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Synthèse
                </TabsTrigger>
                {task.source_process_template_id && (
                  <TabsTrigger value="workflow" className="gap-2">
                    <GitBranch className="h-4 w-4" />
                    Workflow
                  </TabsTrigger>
                )}
                {subProcessGroups.map((group) => (
                  <TabsTrigger key={group.subProcessId} value={group.subProcessId} className="gap-2">
                    {group.subProcessName}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {group.progressPercent}%
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <div className="flex-1 overflow-hidden mt-4">
              <TabsContent value="synthesis" className="h-full m-0">
                <SynthesisTab
                  task={task}
                  processName={processName}
                  profiles={profiles}
                  departments={departments}
                  subProcessGroups={subProcessGroups}
                  globalProgress={globalProgress}
                  onSelectSubProcess={handleSelectSubProcess}
                />
              </TabsContent>

              {task.source_process_template_id && (
                <TabsContent value="workflow" className="h-full m-0">
                  <WorkflowProgressTab task={task} />
                </TabsContent>
              )}

              {subProcessGroups.map((group) => (
                <TabsContent key={group.subProcessId} value={group.subProcessId} className="h-full m-0">
                  <SubProcessTab
                    group={group}
                    profiles={profiles}
                    checklistProgress={checklistProgress}
                    onOpenTask={handleOpenChildTask}
                    requestId={task.id}
                  />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          // Simple request without sub-processes - show original layout
          <div className="space-y-6 mt-4 overflow-y-auto flex-1">
            {task.description && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              {task.due_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Échéance: {format(new Date(task.due_date), 'dd MMMM yyyy', { locale: fr })}</span>
                </div>
              )}
              {task.target_department_id && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>Service: {departments.get(task.target_department_id) || 'N/A'}</span>
                </div>
              )}
              {task.assignee_id && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Exécutant: {profiles.get(task.assignee_id) || 'N/A'}</span>
                </div>
              )}
              {task.requester_id && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Demandeur: {profiles.get(task.requester_id) || 'N/A'}</span>
                </div>
              )}
              {task.category && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Catégorie:</span>
                  <Badge variant="outline">{task.category}</Badge>
                </div>
              )}
            </div>

            {processName && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-primary" />
                  <span className="font-medium">Processus: {processName}</span>
                </div>
              </div>
            )}

            <Separator />
            <TaskCommentsSection taskId={task.id} className="min-h-[200px]" />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {task.status !== 'done' && task.status !== 'validated' && (
            <Button onClick={() => { onStatusChange(task.id, 'done'); onClose(); }}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marquer terminé
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
