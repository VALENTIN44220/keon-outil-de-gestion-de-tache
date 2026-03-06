import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  X, Hash, User, Play, Target, CheckCircle, AlertTriangle, ArrowRight, Save, Loader2,
} from 'lucide-react';
import type { WfStep } from '@/types/workflow';
import type { WfTaskConfig, WfTaskConfigUpdate, WfValidationConfig } from '@/types/workflowTaskConfig';
import {
  EXECUTOR_TYPE_LABELS, ASSIGNMENT_MODE_LABELS, TRIGGER_MODE_LABELS,
  COMPLETION_BEHAVIOR_LABELS, INITIAL_STATUS_LABELS,
} from '@/types/workflowTaskConfig';

interface Props {
  task: WfTaskConfig;
  steps: WfStep[];
  validationConfigs: WfValidationConfig[];
  taskConfigs: WfTaskConfig[];
  canManage: boolean;
  onUpdate: (id: string, u: WfTaskConfigUpdate) => Promise<void>;
  onClose: () => void;
}

export function WfTaskDetailPanel({ task, steps, validationConfigs, taskConfigs, canManage, onUpdate, onClose }: Props) {
  const [edits, setEdits] = useState<WfTaskConfigUpdate>({});
  const [isSaving, setIsSaving] = useState(false);
  const hasChanges = Object.keys(edits).length > 0;

  const val = <K extends keyof WfTaskConfig>(key: K) =>
    (edits as any)[key] !== undefined ? (edits as any)[key] : task[key];

  const set = (updates: WfTaskConfigUpdate) => setEdits(prev => ({ ...prev, ...updates }));

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    await onUpdate(task.id, edits);
    setEdits({});
    setIsSaving(false);
  };

  const getStepName = (key: string | null) => {
    if (!key) return '—';
    return steps.find(s => s.step_key === key)?.name || key;
  };

  // Outcome behaviors
  const outcomes = (val('outcome_behaviors_json') as Record<string, any>) || {};
  const OUTCOME_LABELS: Record<string, string> = {
    done: 'Terminé', refused: 'Refusé', cancelled: 'Annulé', review: 'Renvoyé', validated: 'Validé',
  };
  const EFFECT_LABELS: Record<string, string> = {
    advance_step: "Avancer l'étape", goto_step: 'Aller à étape', stay: 'Rester', close: 'Fermer',
    create_task: 'Créer tâche', trigger_action: 'Action auto.',
  };

  return (
    <div className="border rounded-xl bg-card overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm shrink-0">
            {task.order_index}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{task.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] h-4 font-mono">{task.task_key}</Badge>
              {task.is_required && <Badge variant="outline" className="text-[10px] h-4 border-amber-300 text-amber-700">Requis</Badge>}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* A. General info */}
        <SectionTitle icon={<Hash className="h-3.5 w-3.5" />} label="Informations générales" />
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Libellé</Label>
            <Input value={val('name')} onChange={e => set({ name: e.target.value })} disabled={!canManage} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={val('description') || ''} onChange={e => set({ description: e.target.value || null })} disabled={!canManage} rows={2} className="text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Étape parent</Label>
              <Select value={val('step_key')} onValueChange={v => set({ step_key: v })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {steps.filter(s => s.step_type !== 'start' && s.step_type !== 'end').map(s => (
                    <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={val('is_active')} onCheckedChange={v => set({ is_active: v })} disabled={!canManage} />
              <Label className="text-xs">Actif</Label>
              <Switch checked={val('is_required')} onCheckedChange={v => set({ is_required: v })} disabled={!canManage} />
              <Label className="text-xs">Requis</Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* B. Execution */}
        <SectionTitle icon={<User className="h-3.5 w-3.5" />} label="Exécution" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type d'exécutant</Label>
            <Select value={val('executor_type')} onValueChange={v => set({ executor_type: v })} disabled={!canManage}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EXECUTOR_TYPE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mode d'affectation</Label>
            <Select value={val('assignment_mode')} onValueChange={v => set({ assignment_mode: v })} disabled={!canManage}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ASSIGNMENT_MODE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(val('executor_type') === 'specific_user' || val('executor_type') === 'role' || val('executor_type') === 'field_value') && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">
                {val('executor_type') === 'specific_user' ? 'ID utilisateur' :
                  val('executor_type') === 'role' ? 'Nom du rôle' : 'Clé du champ'}
              </Label>
              <Input value={val('executor_value') || ''} onChange={e => set({ executor_value: e.target.value || null })} disabled={!canManage} className="h-8 text-sm" />
            </div>
          )}
        </div>

        <Separator />

        {/* Trigger */}
        <SectionTitle icon={<Play className="h-3.5 w-3.5" />} label="Déclenchement" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <Select value={val('trigger_mode')} onValueChange={v => set({ trigger_mode: v })} disabled={!canManage}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_MODE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Statut initial</Label>
            <Select value={val('initial_status')} onValueChange={v => set({ initial_status: v })} disabled={!canManage}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INITIAL_STATUS_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {val('trigger_mode') === 'after_task' && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Après la tâche</Label>
              <Select value={val('trigger_task_key') || ''} onValueChange={v => set({ trigger_task_key: v || null })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {taskConfigs.filter(t => t.id !== task.id).map(t => (
                    <SelectItem key={t.task_key} value={t.task_key}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator />

        {/* D. Completion behavior - PROMINENT */}
        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3 space-y-3">
          <SectionTitle icon={<Target className="h-3.5 w-3.5" />} label="Comportement à la fin de la tâche" />
          <Select value={val('completion_behavior')} onValueChange={v => set({ completion_behavior: v })} disabled={!canManage}>
            <SelectTrigger className="h-9 text-sm font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(COMPLETION_BEHAVIOR_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(val('completion_behavior') === 'close_and_goto_step' || val('completion_behavior') === 'send_to_validation') && (
            <div className="space-y-1.5">
              <Label className="text-xs">Étape cible</Label>
              <Select value={val('completion_target_step_key') || ''} onValueChange={v => set({ completion_target_step_key: v || null })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {steps.filter(s => s.step_type !== 'start').map(s => (
                    <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {val('completion_behavior') === 'send_to_validation' && validationConfigs.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Validation liée</Label>
              <Select value={val('validation_config_id') || ''} onValueChange={v => set({ validation_config_id: v || null })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {validationConfigs.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator />

        {/* Outcome behaviors */}
        <SectionTitle icon={<ArrowRight className="h-3.5 w-3.5" />} label="Comportement par résultat" />
        <div className="space-y-1.5">
          {Object.entries(OUTCOME_LABELS).map(([outcome, label]) => {
            const behavior = outcomes[outcome];
            return (
              <div key={outcome} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs">
                <Badge variant="outline" className="text-[10px] min-w-[60px] justify-center">{label}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  {behavior?.effect ? (EFFECT_LABELS[behavior.effect] || behavior.effect) : 'Non configuré'}
                </span>
                {behavior?.target && (
                  <Badge variant="secondary" className="text-[9px] h-4 ml-auto">{getStepName(behavior.target)}</Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Save */}
        {canManage && hasChanges && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-1">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Enregistrer
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {icon}
      {label}
    </div>
  );
}
