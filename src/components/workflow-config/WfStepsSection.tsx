import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Edit2, Copy, GripVertical, Eye, EyeOff } from 'lucide-react';
import type { WfStep, WfStepInsert, WfStepUpdate, WfAssignmentRule } from '@/types/workflow';
import { WF_STEP_TYPE_LABELS, WF_VALIDATION_MODE_LABELS } from '@/types/workflow';
import { WfStepDrawer } from './WfStepDrawer';

interface Props {
  steps: WfStep[];
  assignmentRules: WfAssignmentRule[];
  canManage: boolean;
  onAdd: (step: Omit<WfStepInsert, 'workflow_id'>) => Promise<WfStep | null>;
  onUpdate: (id: string, updates: WfStepUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
}

export function WfStepsSection({ steps, assignmentRules, canManage, onAdd, onUpdate, onDelete, onDuplicate }: Props) {
  const [editingStep, setEditingStep] = useState<WfStep | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const editableSteps = steps.filter(s => s.step_type !== 'start' && s.step_type !== 'end');
  const allSteps = steps.sort((a, b) => a.order_index - b.order_index);

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
    return assignmentRules.find(r => r.id === ruleId)?.name || '—';
  };

  const getStepTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'validation': return 'default' as const;
      case 'execution': return 'secondary' as const;
      case 'subprocess': return 'outline' as const;
      case 'start': case 'end': return 'outline' as const;
      default: return 'secondary' as const;
    }
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
                <TableHead className="w-[120px]">Step Key</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="w-[110px]">Type</TableHead>
                <TableHead>État affiché</TableHead>
                <TableHead>Acteur</TableHead>
                <TableHead className="w-[100px]">Validation</TableHead>
                <TableHead className="w-[60px]">Actif</TableHead>
                {canManage && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSteps.map((step, idx) => {
                const isSystem = step.step_type === 'start' || step.step_type === 'end';
                return (
                  <TableRow key={step.id} className={isSystem ? 'bg-muted/30' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canManage && !isSystem && <GripVertical className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-muted-foreground text-xs">{idx}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {step.step_key.length > 12 ? step.step_key.slice(0, 12) + '…' : step.step_key}
                      </code>
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

      {/* Add step drawer */}
      <WfStepDrawer
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSave={handleAdd}
        assignmentRules={assignmentRules}
        existingSteps={steps}
        mode="add"
        maxOrderIndex={Math.max(...steps.map(s => s.order_index), 0)}
      />

      {/* Edit step drawer */}
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
