import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Save, Loader2 } from 'lucide-react';
import type { WfStep, WfStepInsert, WfStepUpdate, WfAssignmentRule, WfStepType, WfValidationMode } from '@/types/workflow';
import { WF_STEP_TYPE_LABELS, WF_VALIDATION_MODE_LABELS } from '@/types/workflow';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  assignmentRules: WfAssignmentRule[];
  existingSteps: WfStep[];
  mode: 'add' | 'edit';
  initialData?: WfStep;
  maxOrderIndex: number;
}

const EDITABLE_STEP_TYPES: WfStepType[] = ['validation', 'execution', 'assignment', 'automatic', 'subprocess', 'notification'];

export function WfStepDrawer({ open, onClose, onSave, assignmentRules, existingSteps, mode, initialData, maxOrderIndex }: Props) {
  const [name, setName] = useState('');
  const [stepType, setStepType] = useState<WfStepType>('execution');
  const [stateLabel, setStateLabel] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [assignmentRuleId, setAssignmentRuleId] = useState<string | null>(null);
  const [validationMode, setValidationMode] = useState<WfValidationMode>('none');
  const [nRequired, setNRequired] = useState<number | null>(null);
  const [orderIndex, setOrderIndex] = useState(maxOrderIndex);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setStepType(initialData.step_type);
      setStateLabel(initialData.state_label || '');
      setIsRequired(initialData.is_required);
      setIsActive(initialData.is_active);
      setAssignmentRuleId(initialData.assignment_rule_id);
      setValidationMode(initialData.validation_mode);
      setNRequired(initialData.n_required);
      setOrderIndex(initialData.order_index);
    } else {
      setName('');
      setStepType('execution');
      setStateLabel('');
      setIsRequired(true);
      setIsActive(true);
      setAssignmentRuleId(null);
      setValidationMode('none');
      setNRequired(null);
      // Place before end step
      const endStep = existingSteps.find(s => s.step_type === 'end');
      setOrderIndex(endStep ? endStep.order_index - 1 : maxOrderIndex + 1);
    }
  }, [initialData, open, existingSteps, maxOrderIndex]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      if (mode === 'add') {
        const data: Omit<WfStepInsert, 'workflow_id'> = {
          step_key: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: name.trim(),
          step_type: stepType,
          state_label: stateLabel || null,
          is_required: isRequired,
          is_active: isActive,
          assignment_rule_id: assignmentRuleId,
          validation_mode: stepType === 'validation' ? validationMode : 'none',
          n_required: validationMode === 'n_of_m' ? nRequired : null,
          order_index: orderIndex,
        };
        await onSave(data);
      } else {
        const updates: WfStepUpdate = {
          name: name.trim(),
          step_type: stepType,
          state_label: stateLabel || null,
          is_required: isRequired,
          is_active: isActive,
          assignment_rule_id: assignmentRuleId,
          validation_mode: stepType === 'validation' ? validationMode : 'none',
          n_required: validationMode === 'n_of_m' ? nRequired : null,
          order_index: orderIndex,
        };
        await onSave(updates);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === 'add' ? 'Ajouter une étape' : 'Modifier l\'étape'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nom de l'étape *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Validation manager" />
          </div>

          <div className="space-y-2">
            <Label>Type d'étape</Label>
            <Select value={stepType} onValueChange={v => setStepType(v as WfStepType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_STEP_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{WF_STEP_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Libellé d'état (affiché)</Label>
            <Input value={stateLabel} onChange={e => setStateLabel(e.target.value)} placeholder="Ex: En attente de validation" />
          </div>

          <div className="space-y-2">
            <Label>Position (ordre)</Label>
            <Input type="number" value={orderIndex} onChange={e => setOrderIndex(parseInt(e.target.value) || 0)} />
          </div>

          <div className="space-y-2">
            <Label>Règle d'affectation</Label>
            <Select value={assignmentRuleId || '__none__'} onValueChange={v => setAssignmentRuleId(v === '__none__' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucune</SelectItem>
                {assignmentRules.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {stepType === 'validation' && (
            <>
              <div className="space-y-2">
                <Label>Mode de validation</Label>
                <Select value={validationMode} onValueChange={v => setValidationMode(v as WfValidationMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple (1 validateur)</SelectItem>
                    <SelectItem value="n_of_m">N sur M (pool)</SelectItem>
                    <SelectItem value="sequence">Séquence (ordonné)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {validationMode === 'n_of_m' && (
                <div className="space-y-2">
                  <Label>N requis</Label>
                  <Input type="number" min={1} value={nRequired || ''} onChange={e => setNRequired(parseInt(e.target.value) || null)} placeholder="Ex: 2" />
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <Label>Étape obligatoire</Label>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <Label>Actif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {mode === 'add' ? 'Ajouter' : 'Enregistrer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
