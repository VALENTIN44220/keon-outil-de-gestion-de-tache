import { useState } from 'react';
import { SubProcessWithTasks, TaskTemplate } from '@/types/template';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, Plus, Trash2, Edit, ChevronDown, ChevronRight,
  Users, User, UserCog, Building2, FormInput, Lock
} from 'lucide-react';
import { AddTaskTemplateDialog } from './AddTaskTemplateDialog';
import { TemplateChecklistEditor } from './TemplateChecklistEditor';
import { SubProcessCustomFieldsEditor } from './SubProcessCustomFieldsEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubProcessCardProps {
  subProcess: SubProcessWithTasks;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'sub_process_template_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteTask: (taskId: string) => void;
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
};

export function SubProcessCard({ 
  subProcess, 
  onEdit, 
  onDelete, 
  onAddTask, 
  onDeleteTask,
  canManage = false,
  onMandatoryChange
}: SubProcessCardProps) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
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
                  <div className="space-y-2">
                    {subProcess.task_templates.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Aucune tâche dans ce sous-processus
                      </p>
                    ) : (
                      subProcess.task_templates.map((task, index) => (
                        <Collapsible
                          key={task.id}
                          open={expandedTasks.has(task.id)}
                          onOpenChange={() => toggleTaskExpanded(task.id)}
                        >
                          <div className="rounded-lg bg-muted/50 overflow-hidden">
                            <div className="flex items-center justify-between p-2">
                              <CollapsibleTrigger asChild>
                                <button className="flex items-center gap-2 flex-1 text-left hover:bg-muted/50 rounded transition-colors">
                                  {expandedTasks.has(task.id) ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <span className="text-xs text-muted-foreground w-4">
                                    {index + 1}.
                                  </span>
                                  <span className="text-sm truncate">{task.title}</span>
                                </button>
                              </CollapsibleTrigger>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${priorityColors[task.priority]}`}
                                >
                                  {task.priority}
                                </Badge>
                                {canManage && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onDeleteTask(task.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <CollapsibleContent>
                              <div className="px-2 pb-2">
                                <TemplateChecklistEditor taskTemplateId={task.id} />
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))
                    )}
                  </div>

                  {canManage && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-3"
                      onClick={() => setIsAddTaskOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une tâche
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="fields" className="mt-3">
                  <SubProcessCustomFieldsEditor 
                    subProcessTemplateId={subProcess.id}
                    canManage={canManage}
                  />
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
    </>
  );
}
