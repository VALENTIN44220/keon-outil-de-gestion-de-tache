import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubProcessWithTasks, TaskTemplate } from '@/types/template';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, Plus, Trash2, Edit, ChevronDown, ChevronRight,
  Users, User, UserCog, FormInput, Lock, Link2, Edit2, Workflow
} from 'lucide-react';
import { AddTaskTemplateDialog } from './AddTaskTemplateDialog';
import { EditTaskTemplateDialog } from './EditTaskTemplateDialog';
import { LinkExistingTaskDialog } from './LinkExistingTaskDialog';
import { SubProcessCustomFieldsEditor } from './SubProcessCustomFieldsEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
interface SubProcessCardProps {
  subProcess: SubProcessWithTasks;
  processId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'sub_process_template_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteTask: (taskId: string) => void;
  onRefresh?: () => void;
  canManage?: boolean;
  onMandatoryChange?: (id: string, isMandatory: boolean) => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const assignmentTypeLabels: Record<string, { label: string; icon: any }> = {
  manager: { label: 'Par manager', icon: Users },
  role: { label: 'Par poste', icon: UserCog },
  user: { label: 'Utilisateur', icon: User },
  group: { label: 'Groupe', icon: Users },
};

export function SubProcessCard({ 
  subProcess, 
  processId,
  onEdit, 
  onDelete, 
  onAddTask, 
  onDeleteTask,
  onRefresh,
  canManage = false,
  onMandatoryChange
}: SubProcessCardProps) {
  const navigate = useNavigate();
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isLinkTaskOpen, setIsLinkTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMandatory, setIsMandatory] = useState(subProcess.is_mandatory ?? false);

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleMandatoryToggle = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .update({ is_mandatory: checked })
        .eq('id', subProcess.id);
      
      if (error) throw error;
      
      setIsMandatory(checked);
      onMandatoryChange?.(subProcess.id, checked);
      toast.success(checked ? 'Sous-processus marqué comme obligatoire' : 'Sous-processus marqué comme optionnel');
    } catch (error) {
      console.error('Error updating mandatory status:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const AssignmentIcon = assignmentTypeLabels[subProcess.assignment_type]?.icon || Users;

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card className="border-l-4 border-l-primary/50">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 flex-1 text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{subProcess.name}</CardTitle>
                    {subProcess.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {subProcess.description}
                      </p>
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/templates/workflow/subprocess/${subProcess.id}`)}>
                      <Workflow className="h-4 w-4 mr-2" />
                      Workflow
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="outline" className="text-xs">
                <AssignmentIcon className="h-3 w-3 mr-1" />
                {assignmentTypeLabels[subProcess.assignment_type]?.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {subProcess.task_templates.length} tâche(s)
              </Badge>
              {isMandatory && (
                <Badge variant="default" className="text-xs bg-primary/80">
                  <Lock className="h-3 w-3 mr-1" />
                  Obligatoire
                </Badge>
              )}
            </div>

            {canManage && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <Switch
                  id={`mandatory-${subProcess.id}`}
                  checked={isMandatory}
                  onCheckedChange={handleMandatoryToggle}
                />
                <label 
                  htmlFor={`mandatory-${subProcess.id}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Sous-processus obligatoire
                </label>
              </div>
            )}
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-2">
              <Tabs defaultValue="tasks" className="w-full">
                <TabsList className="w-full h-8">
                  <TabsTrigger value="tasks" className="text-xs flex-1">
                    Tâches ({subProcess.task_templates.length})
                  </TabsTrigger>
                  <TabsTrigger value="fields" className="text-xs flex-1">
                    <FormInput className="h-3 w-3 mr-1" />
                    Champs
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="mt-3">
                  {subProcess.task_templates.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Aucune tâche dans ce sous-processus
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {subProcess.task_templates.map((task, index) => (
                        <div 
                          key={task.id}
                          className="rounded-lg bg-muted/50 p-2 flex items-center justify-between gap-1"
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground shrink-0">
                              {index + 1}.
                            </span>
                            <span className="text-sm truncate">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${priorityColors[task.priority]}`}
                            >
                              {task.priority}
                            </Badge>
                            {canManage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setEditingTask(task)}
                                >
                                  <Edit2 className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => onDeleteTask(task.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {canManage && (
                    <div className="flex gap-2 mt-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => setIsAddTaskOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle tâche
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => setIsLinkTaskOpen(true)}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Existante
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="fields" className="mt-3">
                  <ScrollArea className="h-[200px]">
                    <SubProcessCustomFieldsEditor 
                      subProcessTemplateId={subProcess.id}
                      canManage={canManage}
                    />
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AddTaskTemplateDialog
        open={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={onAddTask}
        orderIndex={subProcess.task_templates.length}
      />

      <LinkExistingTaskDialog
        open={isLinkTaskOpen}
        onClose={() => setIsLinkTaskOpen(false)}
        subProcessId={subProcess.id}
        processId={processId}
        existingTaskIds={subProcess.task_templates.map(t => t.id)}
        onTasksLinked={() => onRefresh?.()}
      />

      <EditTaskTemplateDialog
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={() => { setEditingTask(null); onRefresh?.(); }}
      />
    </>
  );
}
