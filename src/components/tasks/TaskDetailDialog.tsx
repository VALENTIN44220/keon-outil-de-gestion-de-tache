import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  Calendar, 
  User, 
  Flag, 
  Workflow, 
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Edit,
  X,
  Save,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
}

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  low: { label: 'Basse', variant: 'secondary', color: 'text-muted-foreground' },
  medium: { label: 'Moyenne', variant: 'outline', color: 'text-warning' },
  high: { label: 'Haute', variant: 'default', color: 'text-orange-500' },
  urgent: { label: 'Urgente', variant: 'destructive', color: 'text-destructive' },
};

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  todo: { label: 'À faire', icon: AlertCircle, color: 'text-muted-foreground' },
  'in-progress': { label: 'En cours', icon: Clock, color: 'text-info' },
  done: { label: 'Terminé', icon: CheckCircle2, color: 'text-success' },
  'pending-validation': { label: 'En validation', icon: Clock, color: 'text-warning' },
  validated: { label: 'Validé', icon: CheckCircle2, color: 'text-success' },
  refused: { label: 'Refusé', icon: AlertCircle, color: 'text-destructive' },
};

export function TaskDetailDialog({ task, open, onClose, onStatusChange }: TaskDetailDialogProps) {
  const [childTasks, setChildTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [profilesList, setProfilesList] = useState<{ id: string; display_name: string }[]>([]);
  const [departments, setDepartments] = useState<Map<string, string>>(new Map());
  const [processName, setProcessName] = useState<string | null>(null);
  
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

  useEffect(() => {
    if (open && task) {
      fetchRelatedData();
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
      }

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name');

      if (profilesData) {
        const map = new Map<string, string>();
        profilesData.forEach((p) => map.set(p.id, p.display_name || 'Sans nom'));
        setProfiles(map);
        setProfilesList(profilesData.map(p => ({ id: p.id, display_name: p.display_name || 'Sans nom' })));
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

  if (!task) return null;

  const completedTasks = childTasks.filter((t) => t.status === 'done' || t.status === 'validated').length;
  const progressPercent = childTasks.length > 0 ? Math.round((completedTasks / childTasks.length) * 100) : 0;

  const StatusIcon = statusConfig[task.status]?.icon || AlertCircle;

  // Child task detail/edit view
  if (selectedChildTask) {
    const ChildStatusIcon = statusConfig[selectedChildTask.status]?.icon || AlertCircle;
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
                    <Label htmlFor="due_date">Date d'échéance</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
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

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={handleCloseChildTask}>
                    Retour à la demande
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
          </div>
          <DialogTitle className="text-xl mt-2">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Metadata */}
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
                <span>Assigné à: {profiles.get(task.assignee_id) || 'N/A'}</span>
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

          {/* Process info */}
          {processName && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" />
                <span className="font-medium">Processus: {processName}</span>
              </div>
            </div>
          )}

          {/* Child tasks section */}
          {(task.type === 'request' || childTasks.length > 0) && (
            <>
              <Separator />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Workflow className="h-4 w-4" />
                    Tâches liées
                    {childTasks.length > 0 && (
                      <Badge variant="secondary">{childTasks.length}</Badge>
                    )}
                  </h4>
                  {childTasks.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {completedTasks}/{childTasks.length} terminées
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {childTasks.length > 0 && (
                  <div className="mb-4">
                    <Progress value={progressPercent} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1 text-right">{progressPercent}%</p>
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
                      return (
                        <div
                          key={childTask.id}
                          onClick={() => handleOpenChildTask(childTask)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50",
                            childTask.status === 'done' || childTask.status === 'validated'
                              ? 'bg-success/5 border-success/30'
                              : 'bg-card border-border'
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <ChildStatusIcon
                              className={cn('h-4 w-4', statusConfig[childTask.status]?.color)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium text-sm truncate",
                                (childTask.status === 'done' || childTask.status === 'validated') && 'line-through text-muted-foreground'
                              )}>
                                {childTask.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {childTask.assignee_id ? (
                                  <span>{profiles.get(childTask.assignee_id)}</span>
                                ) : (
                                  <span className="text-warning">Non assigné</span>
                                )}
                                {childTask.due_date && (
                                  <>
                                    <span>•</span>
                                    <span>{format(new Date(childTask.due_date), 'dd MMM', { locale: fr })}</span>
                                  </>
                                )}
                                {childTask.is_assignment_task && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">Affectation</Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={priorityConfig[childTask.priority].variant} className="text-xs">
                              {priorityConfig[childTask.priority].label}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            {task.status !== 'done' && (
              <Button onClick={() => { onStatusChange(task.id, 'done'); onClose(); }}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marquer terminé
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
