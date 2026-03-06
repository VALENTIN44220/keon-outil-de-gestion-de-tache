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
  X, Hash, ShieldCheck, CheckCircle, XCircle, Save, Loader2, User, Target,
} from 'lucide-react';
import type { WfStep } from '@/types/workflow';
import type { WfValidationConfig, WfValidationConfigUpdate } from '@/types/workflowTaskConfig';
import {
  OBJECT_TYPE_LABELS, VALIDATOR_TYPE_LABELS, VALIDATION_MODE_CONFIG_LABELS,
  ON_APPROVED_LABELS, ON_REJECTED_LABELS,
} from '@/types/workflowTaskConfig';

interface Props {
  validation: WfValidationConfig;
  steps: WfStep[];
  canManage: boolean;
  onUpdate: (id: string, u: WfValidationConfigUpdate) => Promise<void>;
  onClose: () => void;
}

export function WfValidationDetailPanel({ validation, steps, canManage, onUpdate, onClose }: Props) {
  const [edits, setEdits] = useState<WfValidationConfigUpdate>({});
  const [isSaving, setIsSaving] = useState(false);
  const hasChanges = Object.keys(edits).length > 0;

  const val = <K extends keyof WfValidationConfig>(key: K) =>
    (edits as any)[key] !== undefined ? (edits as any)[key] : validation[key];

  const set = (updates: WfValidationConfigUpdate) => setEdits(prev => ({ ...prev, ...updates }));

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    await onUpdate(validation.id, edits);
    setEdits({});
    setIsSaving(false);
  };

  return (
    <div className="border rounded-xl bg-card overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{validation.name}</h3>
            <Badge variant="outline" className="text-[10px] h-4 font-mono mt-0.5">{validation.validation_key}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* General */}
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
              <Label className="text-xs">Objet validé</Label>
              <Select value={val('object_type')} onValueChange={v => set({ object_type: v })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OBJECT_TYPE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={val('is_active')} onCheckedChange={v => set({ is_active: v })} disabled={!canManage} />
              <Label className="text-xs">Actif</Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* Source */}
        <SectionTitle icon={<Target className="h-3.5 w-3.5" />} label="Source" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Étape source</Label>
            <Select value={val('source_step_key') || ''} onValueChange={v => set({ source_step_key: v || null })} disabled={!canManage}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucune" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucune</SelectItem>
                {steps.filter(s => s.step_type !== 'start' && s.step_type !== 'end').map(s => (
                  <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tâche source</Label>
            <Input value={val('source_task_key') || ''} onChange={e => set({ source_task_key: e.target.value || null })} disabled={!canManage} placeholder="Clé de tâche" className="h-8 text-sm font-mono" />
          </div>
        </div>

        <Separator />

        {/* Validator */}
        <SectionTitle icon={<User className="h-3.5 w-3.5" />} label="Validateur" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={val('validator_type')} onValueChange={v => set({ validator_type: v })} disabled={!canManage}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(VALIDATOR_TYPE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <Select value={val('validation_mode')} onValueChange={v => set({ validation_mode: v })} disabled={!canManage}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(VALIDATION_MODE_CONFIG_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(val('validator_type') === 'specific_user' || val('validator_type') === 'role' || val('validator_type') === 'group' || val('validator_type') === 'department') && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Valeur (ID ou nom)</Label>
              <Input value={val('validator_value') || ''} onChange={e => set({ validator_value: e.target.value || null })} disabled={!canManage} className="h-8 text-sm" />
            </div>
          )}
          {val('validation_mode') === 'n_of_m' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre requis</Label>
              <Input type="number" value={val('n_required') || ''} onChange={e => set({ n_required: parseInt(e.target.value) || null })} disabled={!canManage} className="h-8 text-sm" />
            </div>
          )}
        </div>

        <Separator />

        {/* Behavior on approved / rejected */}
        <div className="rounded-lg border-2 border-green-200 bg-green-50/50 p-3 space-y-3">
          <SectionTitle icon={<CheckCircle className="h-3.5 w-3.5 text-green-600" />} label="Si validé" />
          <Select value={val('on_approved_effect')} onValueChange={v => set({ on_approved_effect: v })} disabled={!canManage}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ON_APPROVED_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {val('on_approved_effect') === 'goto_step' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Étape cible</Label>
              <Select value={val('on_approved_target_step_key') || ''} onValueChange={v => set({ on_approved_target_step_key: v || null })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {steps.filter(s => s.step_type !== 'start').map(s => (
                    <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="rounded-lg border-2 border-red-200 bg-red-50/50 p-3 space-y-3">
          <SectionTitle icon={<XCircle className="h-3.5 w-3.5 text-red-600" />} label="Si refusé" />
          <Select value={val('on_rejected_effect')} onValueChange={v => set({ on_rejected_effect: v })} disabled={!canManage}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ON_REJECTED_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {val('on_rejected_effect') === 'goto_step' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Étape cible</Label>
              <Select value={val('on_rejected_target_step_key') || ''} onValueChange={v => set({ on_rejected_target_step_key: v || null })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {steps.filter(s => s.step_type !== 'end').map(s => (
                    <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
