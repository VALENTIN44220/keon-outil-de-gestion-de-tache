import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Trash2, Edit2, Copy, GripVertical, Eye, EyeOff, ChevronRight,
  Zap, Bell, ArrowRightLeft, Hash,
} from 'lucide-react';
import type { WfStep, WfStepInsert, WfStepUpdate, WfTransition, WfNotification, WfAction } from '@/types/workflow';
import { WF_STEP_TYPE_LABELS, WF_VALIDATION_MODE_LABELS } from '@/types/workflow';
import type { EnrichedAssignmentRule } from '@/lib/workflowAssignmentRules';
import type { WfTaskConfig, WfValidationConfig } from '@/types/workflowTaskConfig';
import { WfStepDrawer } from './WfStepDrawer';
import { WfStepDetailPanel } from './WfStepDetailPanel';

interface Props {
  steps: WfStep[];
  transitions: WfTransition[];
  notifications: WfNotification[];
  actions: WfAction[];
  assignmentRules: EnrichedAssignmentRule[];
  canManage: boolean;
  subProcessId: string;
  taskConfigs?: WfTaskConfig[];
  validationConfigs?: WfValidationConfig[];
  onAdd: (step: Omit<WfStepInsert, 'workflow_id'>) => Promise<WfStep | null>;
  onUpdate: (id: string, updates: WfStepUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onReorder: (reordered: { id: string; order_index: number }[]) => Promise<void>;
}

const STEP_TYPE_COLORS: Record<string, string> = {
  start: 'bg-green-100 text-green-700 border-green-300',
  end: 'bg-red-100 text-red-700 border-red-300',
  validation: 'bg-blue-100 text-blue-700 border-blue-300',
  execution: 'bg-amber-100 text-amber-700 border-amber-300',
  assignment: 'bg-purple-100 text-purple-700 border-purple-300',
  automatic: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  subprocess: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  task_generation: 'bg-orange-100 text-orange-700 border-orange-300',
  request_creation: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  status_change: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

export function WfStepsSection({
  steps, transitions, notifications, actions, assignmentRules, canManage, subProcessId,
  taskConfigs = [], validationConfigs = [],
  onAdd, onUpdate, onDelete, onDuplicate, onReorder,
}: Props) {
  const [editingStep, setEditingStep] = useState<WfStep | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const allSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
  const selectedStep = allSteps.find(s => s.id === selectedStepId) || null;

  const handleAdd = async (step: Omit<WfStepInsert, 'workflow_id'>) => {
    await onAdd(step);
    setIsAddOpen(false);
  };

  const handleUpdate = async (updates: WfStepUpdate) => {
    if (!editingStep) return;
    await onUpdate(editingStep.id, updates);
    setEditingStep(null);
  };

  const getAssignmentRuleName = (ruleId: string | null) => {
    if (!ruleId) return null;
    return assignmentRules.find(r => r.id === ruleId)?.display_name || null;
  };

  // Counts per step
  const getStepCounts = (step: WfStep) => {
    const transCount = transitions.filter(t => t.from_step_key === step.step_key || t.to_step_key === step.step_key).length;
    const notifCount = notifications.filter(n => n.step_key === step.step_key).length;
    const actionCount = actions.filter(a => a.step_key === step.step_key).length;
    const transitionIds = transitions.filter(t => t.from_step_key === step.step_key).map(t => t.id);
    const transActionCount = actions.filter(a => a.transition_id && transitionIds.includes(a.transition_id)).length;
    const taskCount = taskConfigs.filter(t => t.step_key === step.step_key).length;
    const valCount = validationConfigs.filter(v => v.source_step_key === step.step_key).length;
    return { transCount, notifCount, actionCount: actionCount + transActionCount, taskCount, valCount };
  };

  // Drag and drop handlers
  const handleDragStart = (idx: number) => {
    const step = allSteps[idx];
    if (step.step_type === 'start' || step.step_type === 'end') return;
    setDragIdx(idx);
    dragRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const step = allSteps[idx];
    if (step.step_type === 'start' || step.step_type === 'end') return;
    setOverIdx(idx);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragRef.current;
    const to = overIdx;
    setDragIdx(null);
    setOverIdx(null);
    dragRef.current = null;

    if (from === null || to === null || from === to) return;

    const reordered = [...allSteps];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const updates: { id: string; order_index: number }[] = [];
    let order = 1;
    for (const s of reordered) {
      if (s.step_type === 'start' || s.step_type === 'end') continue;
      updates.push({ id: s.id, order_index: order });
      order++;
    }
    await onReorder(updates);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
    dragRef.current = null;
  };

  return (
    <>
      <div className={`grid gap-4 ${selectedStep ? 'grid-cols-1 lg:grid-cols-[1fr_360px]' : 'grid-cols-1'}`}>
        {/* Steps table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Étapes du workflow</CardTitle>
              <CardDescription>{allSteps.length} étape(s) · Cliquez pour voir le détail</CardDescription>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[42px] pl-3">#</TableHead>
                  <TableHead>Étape</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="hidden md:table-cell">État</TableHead>
                  <TableHead className="hidden lg:table-cell">Affectation</TableHead>
                  <TableHead className="w-[90px] text-center">Rattachés</TableHead>
                  <TableHead className="w-[44px]"></TableHead>
                  {canManage && <TableHead className="w-[90px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSteps.map((step, idx) => {
                  const isSystem = step.step_type === 'start' || step.step_type === 'end';
                  const isDragging = dragIdx === idx;
                  const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
                  const isSelected = selectedStepId === step.id;
                  const counts = getStepCounts(step);
                  const colorClass = STEP_TYPE_COLORS[step.step_type] || '';
                  const ruleName = getAssignmentRuleName(step.assignment_rule_id);

                  return (
                    <TableRow
                      key={step.id}
                      className={`
                        cursor-pointer transition-colors
                        ${isSystem ? 'bg-muted/20' : ''}
                        ${isDragging ? 'opacity-40' : ''}
                        ${isOver ? 'border-t-2 border-t-primary' : ''}
                        ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
                        ${!step.is_active ? 'opacity-50' : ''}
                      `}
                      onClick={() => setSelectedStepId(isSelected ? null : step.id)}
                      draggable={!isSystem && canManage}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                    >
                      <TableCell className="pl-3">
                        <div className="flex items-center gap-0.5">
                          {canManage && !isSystem && (
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          )}
                          <span className="text-xs text-muted-foreground font-mono">{step.order_index}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <span className="font-medium text-sm">{step.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Hash className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground font-mono truncate">{step.step_key}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${colorClass}`} variant="outline">
                          {WF_STEP_TYPE_LABELS[step.step_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{step.state_label || '—'}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {ruleName ? (
                          <span className="text-xs">{ruleName}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          {counts.taskCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title={`${counts.taskCount} tâche(s)`}>
                              <Hash className="h-3 w-3" />
                              {counts.taskCount}
                            </span>
                          )}
                          {counts.valCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title={`${counts.valCount} validation(s)`}>
                              <Eye className="h-3 w-3" />
                              {counts.valCount}
                            </span>
                          )}
                          {counts.transCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title={`${counts.transCount} transition(s)`}>
                              <ArrowRightLeft className="h-3 w-3" />
                              {counts.transCount}
                            </span>
                          )}
                          {counts.actionCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title={`${counts.actionCount} action(s)`}>
                              <Zap className="h-3 w-3" />
                              {counts.actionCount}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          {!isSystem && (
                            <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStep(step)}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(step.id)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(step.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selectedStep && (
          <WfStepDetailPanel
            step={selectedStep}
            steps={allSteps}
            transitions={transitions}
            notifications={notifications}
            actions={actions}
            assignmentRules={assignmentRules}
            taskConfigs={taskConfigs}
            validationConfigs={validationConfigs}
            onClose={() => setSelectedStepId(null)}
          />
        )}
      </div>

      <WfStepDrawer
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSave={handleAdd}
        assignmentRules={assignmentRules}
        existingSteps={steps}
        mode="add"
        maxOrderIndex={Math.max(...steps.map(s => s.order_index), 0)}
        subProcessId={subProcessId}
      />

      {editingStep && (
        <WfStepDrawer
          open={!!editingStep}
          onClose={() => setEditingStep(null)}
          onSave={handleUpdate}
          assignmentRules={assignmentRules}
          existingSteps={steps}
          mode="edit"
          initialData={editingStep}
          maxOrderIndex={Math.max(...steps.map(s => s.order_index), 0)}
          subProcessId={subProcessId}
        />
      )}
    </>
  );
}
