import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WfStep } from '@/types/workflow';
import type { WfTaskConfigInsert } from '@/types/workflowTaskConfig';
import { EXECUTOR_TYPE_LABELS, TRIGGER_MODE_LABELS, COMPLETION_BEHAVIOR_LABELS } from '@/types/workflowTaskConfig';

interface Props {
  steps: WfStep[];
  existingKeys: string[];
  onSave: (data: Omit<WfTaskConfigInsert, 'workflow_id'>) => Promise<void>;
  onClose: () => void;
}

export function WfTaskAddDialog({ steps, existingKeys, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [taskKey, setTaskKey] = useState('');
  const [stepKey, setStepKey] = useState('');
  const [executorType, setExecutorType] = useState('manual');
  const [triggerMode, setTriggerMode] = useState('on_step_entry');
  const [completionBehavior, setCompletionBehavior] = useState('close_task');
  const [isSaving, setIsSaving] = useState(false);

  const editableSteps = steps.filter(s => s.step_type !== 'start' && s.step_type !== 'end');

  const generateKey = (n: string) => {
    const base = n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    let key = `task_${base}`;
    if (existingKeys.includes(key)) key = `${key}_${Date.now().toString(36).slice(-4)}`;
    return key;
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!taskKey || taskKey === generateKey(name)) setTaskKey(generateKey(v));
  };

  const handleSave = async () => {
    if (!name.trim() || !stepKey || !taskKey.trim()) return;
    setIsSaving(true);
    await onSave({
      step_key: stepKey,
      task_key: taskKey.trim(),
      name: name.trim(),
      description: null,
      order_index: 0,
      is_active: true,
      is_required: true,
      executor_type: executorType,
      executor_value: null,
      assignment_mode: 'direct',
      trigger_mode: triggerMode,
      trigger_task_key: null,
      trigger_condition_json: null,
      initial_status: 'todo',
      completion_behavior: completionBehavior,
      completion_target_step_key: null,
      completion_target_task_key: null,
      completion_action_id: null,
      validation_config_id: null,
      outcome_behaviors_json: {},
    });
    setIsSaving(false);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Libellé *</Label>
            <Input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Ex: Rédiger le rapport" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Clé technique *</Label>
            <Input value={taskKey} onChange={e => setTaskKey(e.target.value)} placeholder="task_rediger_rapport" className="h-9 font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Étape parent *</Label>
            <Select value={stepKey} onValueChange={setStepKey}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {editableSteps.map(s => (
                  <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Exécutant</Label>
              <Select value={executorType} onValueChange={setExecutorType}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXECUTOR_TYPE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Déclenchement</Label>
              <Select value={triggerMode} onValueChange={setTriggerMode}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_MODE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fin de tâche</Label>
              <Select value={completionBehavior} onValueChange={setCompletionBehavior}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPLETION_BEHAVIOR_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim() || !stepKey || !taskKey.trim()}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
