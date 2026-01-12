import { useState, useEffect } from 'react';
import { ProcessWithTasks, SubProcessTemplate, TaskTemplate } from '@/types/template';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Building2, Briefcase, Layers, ListTodo, Loader2 } from 'lucide-react';
import { useSubProcessTemplates } from '@/hooks/useSubProcessTemplates';
import { SubProcessCard } from './SubProcessCard';
import { AddSubProcessDialog } from './AddSubProcessDialog';
import { EditSubProcessDialog } from './EditSubProcessDialog';
import { AddTaskTemplateDialog } from './AddTaskTemplateDialog';
import { TemplateChecklistEditor } from './TemplateChecklistEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

interface ProcessDetailViewProps {
  process: ProcessWithTasks | null;
  open: boolean;
  onClose: () => void;
  onAddTask: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteTask: (taskId: string) => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export function ProcessDetailView({ 
  process, 
  open, 
  onClose, 
  onAddTask, 
  onDeleteTask 
}: ProcessDetailViewProps) {
  const [isAddSubProcessOpen, setIsAddSubProcessOpen] = useState(false);
  const [editingSubProcess, setEditingSubProcess] = useState<SubProcessTemplate | null>(null);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  
  const {
    subProcesses,
    isLoading,
    fetchSubProcesses,
    addSubProcess,
    updateSubProcess,
    deleteSubProcess,
    addTaskToSubProcess,
    deleteTaskFromSubProcess,
  } = useSubProcessTemplates(process?.id || null);

  useEffect(() => {
    if (process?.id && open) {
      fetchSubProcesses();
    }
  }, [process?.id, open, fetchSubProcesses]);

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

  if (!process) return null;

  // Filter tasks that are directly on the process (not in sub-processes)
  const directTasks = process.task_templates.filter(t => !t.sub_process_template_id);

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="text-xl">{process.name}</SheetTitle>
            {process.description && (
              <p className="text-sm text-muted-foreground">{process.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {process.company && (
                <Badge variant="outline" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {process.company}
                </Badge>
              )}
              {process.department && (
                <Badge variant="outline" className="text-xs">
                  <Briefcase className="h-3 w-3 mr-1" />
                  {process.department}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                <Layers className="h-3 w-3 mr-1" />
                {subProcesses.length} sous-processus
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <ListTodo className="h-3 w-3 mr-1" />
                {directTasks.length} tâche(s) directes
              </Badge>
            </div>
          </SheetHeader>

          <Tabs defaultValue="subprocesses" className="h-full">
            <div className="px-6 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="subprocesses" className="flex-1">
                  <Layers className="h-4 w-4 mr-2" />
                  Sous-processus ({subProcesses.length})
                </TabsTrigger>
                <TabsTrigger value="tasks" className="flex-1">
                  <ListTodo className="h-4 w-4 mr-2" />
                  Tâches directes ({directTasks.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[calc(100vh-250px)]">
              <TabsContent value="subprocesses" className="p-6 pt-4 space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : subProcesses.length === 0 ? (
                  <div className="text-center py-8">
                    <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Aucun sous-processus</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ajoutez des sous-processus pour organiser les tâches
                    </p>
                  </div>
                ) : (
                  subProcesses.map(sp => (
                    <SubProcessCard
                      key={sp.id}
                      subProcess={sp}
                      onEdit={() => setEditingSubProcess(sp)}
                      onDelete={() => deleteSubProcess(sp.id)}
                      onAddTask={(task) => addTaskToSubProcess(sp.id, task)}
                      onDeleteTask={(taskId) => deleteTaskFromSubProcess(sp.id, taskId)}
                    />
                  ))
                )}

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setIsAddSubProcessOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un sous-processus
                </Button>
              </TabsContent>

              <TabsContent value="tasks" className="p-6 pt-4 space-y-2">
                {directTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Aucune tâche directe</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Les tâches directes s'appliquent à tout le processus
                    </p>
                  </div>
                ) : (
                  directTasks.map((task, index) => (
                    <Collapsible
                      key={task.id}
                      open={expandedTasks.has(task.id)}
                      onOpenChange={() => toggleTaskExpanded(task.id)}
                    >
                      <div className="rounded-lg bg-muted/50 overflow-hidden">
                        <div className="flex items-center justify-between p-3">
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-2 flex-1 text-left hover:bg-muted/50 rounded transition-colors">
                              {expandedTasks.has(task.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm text-muted-foreground w-6">
                                {index + 1}.
                              </span>
                              <span className="font-medium">{task.title}</span>
                            </button>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={priorityColors[task.priority]}
                            >
                              {task.priority}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onDeleteTask(task.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="px-3 pb-3">
                            <TemplateChecklistEditor taskTemplateId={task.id} />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))
                )}

                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setIsAddTaskOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une tâche directe
                </Button>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AddSubProcessDialog
        open={isAddSubProcessOpen}
        onClose={() => setIsAddSubProcessOpen(false)}
        onAdd={addSubProcess}
        orderIndex={subProcesses.length}
      />

      <EditSubProcessDialog
        subProcess={editingSubProcess}
        open={!!editingSubProcess}
        onClose={() => setEditingSubProcess(null)}
        onSave={(updates) => updateSubProcess(editingSubProcess!.id, updates)}
      />

      <AddTaskTemplateDialog
        open={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={onAddTask}
        orderIndex={directTasks.length}
      />
    </>
  );
}
