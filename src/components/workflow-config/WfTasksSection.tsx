import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Trash2, Edit2, Eye, EyeOff, ChevronRight, Hash, ListTodo, User, Play, Zap,
} from 'lucide-react';
import type { WfStep } from '@/types/workflow';
import type { WfTaskConfig, WfTaskConfigInsert, WfTaskConfigUpdate } from '@/types/workflowTaskConfig';
import {
  EXECUTOR_TYPE_LABELS, TRIGGER_MODE_LABELS, COMPLETION_BEHAVIOR_LABELS, INITIAL_STATUS_LABELS,
} from '@/types/workflowTaskConfig';
import type { WfValidationConfig } from '@/types/workflowTaskConfig';
import { WfTaskDetailPanel } from './WfTaskDetailPanel';
import { WfTaskAddDialog } from './WfTaskAddDialog';

interface Props {
  taskConfigs: WfTaskConfig[];
  validationConfigs: WfValidationConfig[];
  steps: WfStep[];
  canManage: boolean;
  onAdd: (t: Omit<WfTaskConfigInsert, 'workflow_id'>) => Promise<WfTaskConfig | null>;
  onUpdate: (id: string, u: WfTaskConfigUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const COMPLETION_COLORS: Record<string, string> = {
  close_task: 'bg-muted text-muted-foreground',
  close_and_advance_step: 'bg-green-100 text-green-700',
  close_and_goto_step: 'bg-blue-100 text-blue-700',
  send_to_validation: 'bg-amber-100 text-amber-700',
  wait_validation: 'bg-amber-100 text-amber-700',
  create_task: 'bg-purple-100 text-purple-700',
  trigger_action: 'bg-cyan-100 text-cyan-700',
  stay_on_step: 'bg-muted text-muted-foreground',
};

export function WfTasksSection({ taskConfigs, validationConfigs, steps, canManage, onAdd, onUpdate, onDelete }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const sorted = [...taskConfigs].sort((a, b) => a.order_index - b.order_index);
  const selectedTask = sorted.find(t => t.id === selectedTaskId) || null;

  const getStepName = (key: string | null) => {
    if (!key) return '—';
    return steps.find(s => s.step_key === key)?.name || key;
  };

  return (
    <>
      <div className={`grid gap-4 ${selectedTask ? 'grid-cols-1 lg:grid-cols-[1fr_400px]' : 'grid-cols-1'}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" />
                Tâches du workflow
              </CardTitle>
              <CardDescription>{sorted.length} tâche(s) configurée(s) · Cliquez pour voir le détail</CardDescription>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {sorted.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Aucune tâche configurée. Ajoutez des tâches pour définir le travail à chaque étape.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[42px] pl-3">#</TableHead>
                    <TableHead>Tâche</TableHead>
                    <TableHead className="hidden md:table-cell">Étape</TableHead>
                    <TableHead className="hidden md:table-cell">Exécutant</TableHead>
                    <TableHead className="hidden lg:table-cell">Déclenchement</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead className="w-[44px]"></TableHead>
                    {canManage && <TableHead className="w-[70px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(task => {
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <TableRow
                        key={task.id}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''} ${!task.is_active ? 'opacity-50' : ''}`}
                        onClick={() => setSelectedTaskId(isSelected ? null : task.id)}
                      >
                        <TableCell className="pl-3">
                          <span className="text-xs text-muted-foreground font-mono">{task.order_index}</span>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm">{task.name}</span>
                              {!task.is_active && <EyeOff className="h-3 w-3 text-muted-foreground" />}
                              {task.is_required && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-300 text-amber-700">Requis</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Hash className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground font-mono truncate">{task.task_key}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs">{getStepName(task.step_key)}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 text-xs">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {EXECUTOR_TYPE_LABELS[task.executor_type] || task.executor_type}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1 text-xs">
                            <Play className="h-3 w-3 text-muted-foreground" />
                            {TRIGGER_MODE_LABELS[task.trigger_mode] || task.trigger_mode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] h-5 ${COMPLETION_COLORS[task.completion_behavior] || ''}`}>
                            {COMPLETION_BEHAVIOR_LABELS[task.completion_behavior] || task.completion_behavior}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(task.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selectedTask && (
          <WfTaskDetailPanel
            task={selectedTask}
            steps={steps}
            validationConfigs={validationConfigs}
            taskConfigs={taskConfigs}
            canManage={canManage}
            onUpdate={onUpdate}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
      </div>

      {isAddOpen && (
        <WfTaskAddDialog
          steps={steps}
          existingKeys={taskConfigs.map(t => t.task_key)}
          onSave={async (data) => {
            await onAdd(data);
            setIsAddOpen(false);
          }}
          onClose={() => setIsAddOpen(false)}
        />
      )}
    </>
  );
}
