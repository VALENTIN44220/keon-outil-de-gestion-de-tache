import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, ShieldCheck, Users, Zap, Bell, ArrowRight,
  Play, Square, Shield, Cog, ListTodo, GitBranch,
} from 'lucide-react';
import {
  DEFAULT_STANDARD_OPTIONS,
  generateStandardStructure,
  ASSIGNMENT_MODE_LABELS,
  EXECUTOR_TYPE_STANDARD_LABELS,
  COMPLETION_BEHAVIOR_OPTIONS,
  MANAGER_RESOLUTION_LABELS,
  FALLBACK_BEHAVIOR_LABELS,
} from '@/lib/standardWorkflowTemplate';
import type { StandardWorkflowOptions } from '@/lib/standardWorkflowTemplate';
import { EXECUTOR_TYPE_LABELS } from '@/types/workflowTaskConfig';

interface Props {
  options: StandardWorkflowOptions;
  canManage: boolean;
  onOptionsChange: (options: StandardWorkflowOptions) => void;
  onApply: (options: StandardWorkflowOptions) => Promise<void>;
  isApplying?: boolean;
}

const STEP_ICON: Record<string, React.ReactNode> = {
  start: <Play className="h-3.5 w-3.5" />,
  end: <Square className="h-3.5 w-3.5" />,
  validation: <Shield className="h-3.5 w-3.5" />,
  execution: <Cog className="h-3.5 w-3.5" />,
  assignment: <ListTodo className="h-3.5 w-3.5" />,
  request_creation: <GitBranch className="h-3.5 w-3.5" />,
};

const STEP_COLOR: Record<string, string> = {
  start: 'bg-green-100 text-green-700 border-green-200',
  end: 'bg-slate-100 text-slate-700 border-slate-200',
  validation: 'bg-amber-100 text-amber-700 border-amber-200',
  execution: 'bg-blue-100 text-blue-700 border-blue-200',
  assignment: 'bg-purple-100 text-purple-700 border-purple-200',
  request_creation: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

export function WfStandardModePanel({ options, canManage, onOptionsChange, onApply, isApplying }: Props) {
  const [profiles, setProfiles] = useState<Array<{ id: string; display_name: string | null }>>([]);
  
  useEffect(() => {
    const loadProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, display_name').order('display_name');
      if (data) setProfiles(data);
    };
    loadProfiles();
  }, []);

  const update = (partial: Partial<StandardWorkflowOptions>) => {
    onOptionsChange({ ...options, ...partial });
  };

  const preview = useMemo(() => generateStandardStructure(options), [options]);
  const mainSteps = preview.steps.filter(s => s.step_type !== 'end' || s.step_key === 'std_closed');

  return (
    <div className="space-y-5">
      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Validations */}
        <Card className="border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              Validations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Validation de la demande</Label>
              <Switch checked={options.request_validation} onCheckedChange={v => update({ request_validation: v })} disabled={!canManage} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Validation finale</Label>
              <Switch checked={options.final_validation} onCheckedChange={v => update({ final_validation: v })} disabled={!canManage} />
            </div>
          </CardContent>
        </Card>

        {/* Execution */}
        <Card className="border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Exécution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mode d'affectation</Label>
              <Select value={options.assignment_mode} onValueChange={v => update({ assignment_mode: v as any })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSIGNMENT_MODE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Manager-specific options */}
            {options.assignment_mode === 'manager' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Résolution du manager</Label>
                  <Select value={options.manager_resolution} onValueChange={v => update({ manager_resolution: v as any })} disabled={!canManage}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MANAGER_RESOLUTION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {MANAGER_RESOLUTION_LABELS[options.manager_resolution]?.description}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Repli si manager absent</Label>
                  <Select value={options.fallback_behavior} onValueChange={v => update({ fallback_behavior: v as any })} disabled={!canManage}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FALLBACK_BEHAVIOR_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {FALLBACK_BEHAVIOR_LABELS[options.fallback_behavior]?.description}
                  </p>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Type d'exécutant principal</Label>
              <Select value={options.executor_type} onValueChange={v => update({ executor_type: v as any })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXECUTOR_TYPE_STANDARD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Executor value - shown for types that need a value */}
            {options.executor_type === 'specific_user' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Utilisateur assigné</Label>
                <Select value={options.executor_value || ''} onValueChange={v => update({ executor_value: v || null })} disabled={!canManage}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner un utilisateur" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.display_name || p.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">L'utilisateur qui exécutera les tâches de ce workflow.</p>
              </div>
            )}
            {options.executor_type === 'role' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nom du rôle</Label>
                <Select value={options.executor_value || ''} onValueChange={v => update({ executor_value: v || null })} disabled={!canManage}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                    <SelectItem value="moderator" className="text-xs">Modérateur</SelectItem>
                    <SelectItem value="user" className="text-xs">Utilisateur</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Le rôle ou poste responsable de l'exécution.</p>
              </div>
            )}
            {options.executor_type === 'field_value' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nom du champ formulaire</Label>
                <Select value={options.executor_value || ''} onValueChange={v => update({ executor_value: v || null })} disabled={!canManage}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner un champ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="responsable_projet" className="text-xs">responsable_projet</SelectItem>
                    <SelectItem value="manager" className="text-xs">manager</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Le champ du formulaire contenant l'utilisateur assigné.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task completion */}
        <Card className="border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Fin de tâche
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Comportement par défaut</Label>
              <Select value={options.completion_behavior} onValueChange={v => update({ completion_behavior: v as any })} disabled={!canManage}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPLETION_BEHAVIOR_OPTIONS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Automations */}
        <Card className="border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-600" />
              Automatisations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5"><Bell className="h-3 w-3" /> Notifications standards</Label>
              <Switch checked={options.enable_notifications} onCheckedChange={v => update({ enable_notifications: v })} disabled={!canManage} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5"><Zap className="h-3 w-3" /> Actions automatiques</Label>
              <Switch checked={options.enable_auto_actions} onCheckedChange={v => update({ enable_auto_actions: v })} disabled={!canManage} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flow Preview */}
      <Card className="border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm">Aperçu du workflow généré</CardTitle>
          <CardDescription className="text-xs">
            {preview.steps.length} étapes · {preview.taskConfigs.length} tâche(s) · {preview.validationConfigs.length} validation(s) · {preview.notifications.length} notification(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-1 flex-wrap">
            {mainSteps.map((step, i) => (
              <div key={step.step_key} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${STEP_COLOR[step.step_type] || STEP_COLOR.execution}`}>
                  {STEP_ICON[step.step_type]}
                  <span>{step.name}</span>
                  {preview.taskConfigs.some(t => t.step_key === step.step_key) && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">T</Badge>
                  )}
                  {preview.validationConfigs.some(v => v.source_step_key === step.step_key) && (
                    <Badge className="h-4 px-1 text-[9px] ml-0.5 bg-amber-200 text-amber-800 border-amber-300">V</Badge>
                  )}
                </div>
                {i < mainSteps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>

          {(preview.taskConfigs.length > 0 || preview.validationConfigs.length > 0) && (
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-3 text-xs text-muted-foreground">
              {preview.taskConfigs.map(tc => (
                <div key={tc.task_key} className="flex items-center gap-1">
                  <ListTodo className="h-3 w-3 text-blue-500" />
                  <span>{tc.name}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                    {EXECUTOR_TYPE_LABELS[tc.executor_type] || tc.executor_type}
                  </Badge>
                </div>
              ))}
              {preview.validationConfigs.map(vc => (
                <div key={vc.validation_key} className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-amber-500" />
                  <span>{vc.name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply button */}
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => onApply(options)} disabled={isApplying} className="gap-2">
            {isApplying ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Appliquer la configuration standard
          </Button>
        </div>
      )}
    </div>
  );
}
