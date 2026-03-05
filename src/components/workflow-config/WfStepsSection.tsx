import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Edit2, Copy, GripVertical, Eye, EyeOff } from 'lucide-react';
import type { WfStep, WfStepInsert, WfStepUpdate } from '@/types/workflow';
import { WF_STEP_TYPE_LABELS, WF_VALIDATION_MODE_LABELS } from '@/types/workflow';
import type { EnrichedAssignmentRule } from '@/hooks/useWorkflowConfig';
import { WfStepDrawer } from './WfStepDrawer';

interface Props {
  steps: WfStep[];
  assignmentRules: EnrichedAssignmentRule[];
  canManage: boolean;
  onAdd: (step: Omit<WfStepInsert, 'workflow_id'>) => Promise<WfStep | null>;
  onUpdate: (id: string, updates: WfStepUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onReorder: (reordered: { id: string; order_index: number }[]) => Promise<void>;
}

export function WfStepsSection({ steps, assignmentRules, canManage, onAdd, onUpdate, onDelete, onDuplicate, onReorder }: Props) {
  const [editingStep, setEditingStep] = useState<WfStep | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const allSteps = [...steps].sort((a, b) => a.order_index - b.order_index);

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
    if (!ruleId) return '—';
    return assignmentRules.find(r => r.id === ruleId)?.display_name || '—';
  };

  const getStepTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'validation': return 'default' as const;
      case 'execution': return 'secondary' as const;
      case 'task_generation': return 'default' as const;
      default: return 'outline' as const;
    }
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

    // Reorder: move item from `from` to `to`
    const reordered = [...allSteps];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    // Recalculate order_index: keep start=0, end=999, others sequential
    const updates: { id: string; order_index: number }[] = [];
    let order = 1;
    for (const s of reordered) {
      if (s.step_type === 'start') continue;
      if (s.step_type === 'end') continue;
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Étapes du workflow</CardTitle>
            <CardDescription>{allSteps.length} étape(s) configurée(s)</CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter étape
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="w-[110px]">Type</TableHead>
                <TableHead>État affiché</TableHead>
                <TableHead>Affectation</TableHead>
                <TableHead className="w-[100px]">Validation</TableHead>
                <TableHead className="w-[60px]">Actif</TableHead>
                {canManage && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSteps.map((step, idx) => {
                const isSystem = step.step_type === 'start' || step.step_type === 'end';
                const isDragging = dragIdx === idx;
                const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
                return (
                  <TableRow
                    key={step.id}
                    className={`
                      ${isSystem ? 'bg-muted/30' : ''}
                      ${isDragging ? 'opacity-40' : ''}
                      ${isOver ? 'border-t-2 border-t-primary' : ''}
                      ${!isSystem && canManage ? 'cursor-grab' : ''}
                    `}
                    draggable={!isSystem && canManage}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canManage && !isSystem && (
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-muted-foreground text-xs">{step.order_index}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{step.name}</TableCell>
                    <TableCell>
                      <Badge variant={getStepTypeBadgeVariant(step.step_type)} className="text-xs">
                        {WF_STEP_TYPE_LABELS[step.step_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{step.state_label || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{getAssignmentRuleName(step.assignment_rule_id)}</span>
                    </TableCell>
                    <TableCell>
                      {step.step_type === 'validation' ? (
                        <Badge variant="outline" className="text-xs">
                          {WF_VALIDATION_MODE_LABELS[step.validation_mode]}
                          {step.validation_mode === 'n_of_m' && step.n_required ? ` (${step.n_required})` : ''}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {step.is_active ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        {!isSystem && (
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStep(step)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(step.id)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(step.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
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

      <WfStepDrawer
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSave={handleAdd}
        assignmentRules={assignmentRules}
        existingSteps={steps}
        mode="add"
        maxOrderIndex={Math.max(...steps.map(s => s.order_index), 0)}
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
        />
      )}
    </>
  );
}
