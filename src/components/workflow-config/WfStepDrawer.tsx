import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Save, Loader2, Info } from 'lucide-react';
import type { WfStep, WfStepInsert, WfStepUpdate, WfStepType, WfValidationMode } from '@/types/workflow';
import { WF_STEP_TYPE_LABELS, WF_VALIDATION_MODE_LABELS } from '@/types/workflow';
import type { EnrichedAssignmentRule } from '@/lib/workflowAssignmentRules';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  assignmentRules: EnrichedAssignmentRule[];
  existingSteps: WfStep[];
  mode: 'add' | 'edit';
  initialData?: WfStep;
  maxOrderIndex: number;
}

const EDITABLE_STEP_TYPES: WfStepType[] = ['request_creation', 'validation', 'execution', 'assignment', 'automatic', 'subprocess', 'notification', 'task_generation', 'status_change'];

// Types d'étapes qui nécessitent une règle d'affectation
const TYPES_WITH_ASSIGNMENT: WfStepType[] = ['validation', 'execution', 'assignment', 'task_generation'];

// Types d'étapes qui n'ont PAS besoin de obligatoire/actif toggles complexes
const TYPES_ALWAYS_REQUIRED: WfStepType[] = ['request_creation', 'start', 'end'];

// Statuts cibles possibles pour le changement d'état
const TARGET_STATUSES = [
  { value: 'todo', label: 'À faire' },
  { value: 'in-progress', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'review', label: 'À revoir' },
  { value: 'pending_validation_1', label: 'En attente de validation N1' },
  { value: 'pending_validation_2', label: 'En attente de validation N2' },
  { value: 'validated', label: 'Validé' },
  { value: 'refused', label: 'Refusé' },
];

// Descriptions d'aide par type d'étape
const STEP_TYPE_HELP: Partial<Record<WfStepType, string>> = {
  request_creation: 'Étape initiale : la demande est créée par le demandeur. Permet de lier des notifications ou actions à la création.',
  validation: 'Un ou plusieurs valideurs doivent approuver ou rejeter avant de passer à l\'étape suivante.',
  execution: 'L\'exécutant réalise la tâche assignée.',
  assignment: 'Affectation de la tâche à un utilisateur, groupe ou service.',
  task_generation: 'Génère une nouvelle tâche à ce stade du workflow (ex: après une validation).',
  status_change: 'Change le statut de la tâche. Utile quand l\'exécutant termine lui-même (sans validation). Permet de lier des actions et notifications à ce changement.',
  notification: 'Envoi de notifications aux destinataires configurés.',
  automatic: 'Action automatique exécutée par le système (ex: mise à jour BDD, appel API).',
  subprocess: 'Déclenche un sous-processus enfant.',
};

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

  // Champs spécifiques par type
  const [targetStatus, setTargetStatus] = useState('done');
  const [statusChangeActor, setStatusChangeActor] = useState<'assignee' | 'requester' | 'system'>('assignee');

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
      // Parse config JSON si présent
      const cfg = (initialData as any).config;
      if (cfg && typeof cfg === 'object') {
        setTargetStatus(cfg.target_status || 'done');
        setStatusChangeActor(cfg.actor || 'assignee');
      }
    } else {
      setName('');
      setStepType('execution');
      setStateLabel('');
      setIsRequired(true);
      setIsActive(true);
      setAssignmentRuleId(null);
      setValidationMode('none');
      setNRequired(null);
      setTargetStatus('done');
      setStatusChangeActor('assignee');
      const endStep = existingSteps.find(s => s.step_type === 'end');
      setOrderIndex(endStep ? endStep.order_index - 1 : maxOrderIndex + 1);
    }
  }, [initialData, open, existingSteps, maxOrderIndex]);

  const showAssignment = TYPES_WITH_ASSIGNMENT.includes(stepType);
  const showToggles = !TYPES_ALWAYS_REQUIRED.includes(stepType);

  const buildConfigJson = () => {
    if (stepType === 'status_change') {
      return { target_status: targetStatus, actor: statusChangeActor };
    }
    return null;
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const config = buildConfigJson();
      if (mode === 'add') {
        const data: Omit<WfStepInsert, 'workflow_id'> = {
          step_key: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: name.trim(),
          step_type: stepType,
          state_label: stateLabel || null,
          is_required: isRequired,
          is_active: isActive,
          assignment_rule_id: showAssignment ? assignmentRuleId : null,
          validation_mode: stepType === 'validation' ? validationMode : 'none',
          n_required: validationMode === 'n_of_m' ? nRequired : null,
          order_index: orderIndex,
          ...(config ? { config } : {}),
        };
        await onSave(data);
      } else {
        const updates: WfStepUpdate = {
          name: name.trim(),
          step_type: stepType,
          state_label: stateLabel || null,
          is_required: isRequired,
          is_active: isActive,
          assignment_rule_id: showAssignment ? assignmentRuleId : null,
          validation_mode: stepType === 'validation' ? validationMode : 'none',
          n_required: validationMode === 'n_of_m' ? nRequired : null,
          order_index: orderIndex,
          ...(config ? { config } : {}),
        };
        await onSave(updates);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Ajouter une étape' : 'Modifier l\'étape'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nom */}
          <div className="space-y-2">
            <Label>Nom de l'étape *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Validation manager" />
          </div>

          {/* Type */}
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
            {STEP_TYPE_HELP[stepType] && (
              <div className="flex gap-2 items-start p-2.5 rounded-md bg-muted/60 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{STEP_TYPE_HELP[stepType]}</span>
              </div>
            )}
          </div>

          {/* Libellé d'état */}
          <div className="space-y-2">
            <Label>Libellé d'état (affiché)</Label>
            <Input value={stateLabel} onChange={e => setStateLabel(e.target.value)} placeholder="Ex: En attente de validation" />
          </div>

          {/* === Champs spécifiques : Changement d'état === */}
          {stepType === 'status_change' && (
            <>
              <div className="space-y-2">
                <Label>Statut cible</Label>
                <Select value={targetStatus} onValueChange={setTargetStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Déclenché par</Label>
                <Select value={statusChangeActor} onValueChange={v => setStatusChangeActor(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assignee">L'exécutant (assigné)</SelectItem>
                    <SelectItem value="requester">Le demandeur</SelectItem>
                    <SelectItem value="system">Automatique (système)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* === Règle d'affectation (conditionnelle) === */}
          {showAssignment && (
            <div className="space-y-2">
              <Label>Règle d'affectation</Label>
              <Select
                value={assignmentRuleId || '__none__'}
                onValueChange={v => setAssignmentRuleId(v === '__none__' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {assignmentRules.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignmentRules.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucune règle d'affectation configurée.</p>
              )}
            </div>
          )}

          {/* === Validation === */}
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

          {/* Toggles */}
          {showToggles && (
            <>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label>Étape obligatoire</Label>
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label>Actif</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {mode === 'add' ? 'Ajouter' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
