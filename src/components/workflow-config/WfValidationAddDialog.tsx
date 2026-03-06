import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WfStep } from '@/types/workflow';
import type { WfValidationConfigInsert } from '@/types/workflowTaskConfig';
import { OBJECT_TYPE_LABELS, VALIDATOR_TYPE_LABELS, ON_APPROVED_LABELS, ON_REJECTED_LABELS } from '@/types/workflowTaskConfig';

interface Props {
  steps: WfStep[];
  existingKeys: string[];
  onSave: (data: Omit<WfValidationConfigInsert, 'workflow_id'>) => Promise<void>;
  onClose: () => void;
}

export function WfValidationAddDialog({ steps, existingKeys, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [validationKey, setValidationKey] = useState('');
  const [objectType, setObjectType] = useState('task');
  const [sourceStepKey, setSourceStepKey] = useState('');
  const [validatorType, setValidatorType] = useState('requester_manager');
  const [onApproved, setOnApproved] = useState('advance_step');
  const [onRejected, setOnRejected] = useState('return_to_task');
  const [isSaving, setIsSaving] = useState(false);

  const editableSteps = steps.filter(s => s.step_type !== 'start' && s.step_type !== 'end');

  const generateKey = (n: string) => {
    const base = n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    let key = `val_${base}`;
    if (existingKeys.includes(key)) key = `${key}_${Date.now().toString(36).slice(-4)}`;
    return key;
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!validationKey || validationKey === generateKey(name)) setValidationKey(generateKey(v));
  };

  const handleSave = async () => {
    if (!name.trim() || !validationKey.trim()) return;
    setIsSaving(true);
    await onSave({
      validation_key: validationKey.trim(),
      name: name.trim(),
      description: null,
      is_active: true,
      order_index: 0,
      object_type: objectType,
      source_step_key: sourceStepKey || null,
      source_task_key: null,
      validator_type: validatorType,
      validator_value: null,
      validation_mode: 'simple',
      n_required: null,
      condition_json: null,
      on_approved_effect: onApproved,
      on_approved_target_step_key: null,
      on_rejected_effect: onRejected,
      on_rejected_target_step_key: null,
      target_step_key: null,
    });
    setIsSaving(false);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une validation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Libellé *</Label>
            <Input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Ex: Validation manager" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Clé technique *</Label>
            <Input value={validationKey} onChange={e => setValidationKey(e.target.value)} placeholder="val_manager" className="h-9 font-mono text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Objet validé</Label>
              <Select value={objectType} onValueChange={setObjectType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OBJECT_TYPE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Étape source</Label>
              <Select value={sourceStepKey} onValueChange={setSourceStepKey}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune</SelectItem>
                  {editableSteps.map(s => (
                    <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Validateur</Label>
              <Select value={validatorType} onValueChange={setValidatorType}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VALIDATOR_TYPE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Si validé</Label>
              <Select value={onApproved} onValueChange={setOnApproved}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ON_APPROVED_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Si refusé</Label>
              <Select value={onRejected} onValueChange={setOnRejected}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ON_REJECTED_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim() || !validationKey.trim()}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
