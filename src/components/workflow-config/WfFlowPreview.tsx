import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ArrowDown, CheckCircle, Circle, Play, Square,
  Zap, Bell, ArrowRightLeft, Shield, Cog, ListTodo, GitBranch,
} from 'lucide-react';
import type { WfStep, WfTransition, WfAction, WfNotification } from '@/types/workflow';
import { WF_STEP_TYPE_LABELS, WF_EVENT_LABELS, WF_ACTION_TYPE_LABELS } from '@/types/workflow';
import type { WfTaskConfig, WfValidationConfig } from '@/types/workflowTaskConfig';
import { COMPLETION_BEHAVIOR_LABELS } from '@/types/workflowTaskConfig';

interface Props {
  steps: WfStep[];
  transitions: WfTransition[];
  actions: WfAction[];
  notifications: WfNotification[];
  taskConfigs?: WfTaskConfig[];
  validationConfigs?: WfValidationConfig[];
}

const STEP_ICON_MAP: Record<string, React.ReactNode> = {
  start: <Play className="h-4 w-4" />,
  end: <Square className="h-4 w-4" />,
  validation: <Shield className="h-4 w-4" />,
  execution: <Cog className="h-4 w-4" />,
  assignment: <ListTodo className="h-4 w-4" />,
  automatic: <Zap className="h-4 w-4" />,
  subprocess: <GitBranch className="h-4 w-4" />,
  task_generation: <ListTodo className="h-4 w-4" />,
  request_creation: <Circle className="h-4 w-4" />,
  status_change: <ArrowRightLeft className="h-4 w-4" />,
  notification: <Bell className="h-4 w-4" />,
};

const STEP_COLOR_MAP: Record<string, string> = {
  start: 'bg-green-100 border-green-300 text-green-700',
  end: 'bg-red-100 border-red-300 text-red-700',
  validation: 'bg-blue-100 border-blue-300 text-blue-700',
  execution: 'bg-amber-100 border-amber-300 text-amber-700',
  assignment: 'bg-purple-100 border-purple-300 text-purple-700',
  automatic: 'bg-cyan-100 border-cyan-300 text-cyan-700',
  subprocess: 'bg-indigo-100 border-indigo-300 text-indigo-700',
  task_generation: 'bg-orange-100 border-orange-300 text-orange-700',
  request_creation: 'bg-emerald-100 border-emerald-300 text-emerald-700',
  status_change: 'bg-yellow-100 border-yellow-300 text-yellow-700',
};

export function WfFlowPreview({ steps, transitions, actions, notifications, taskConfigs = [], validationConfigs = [] }: Props) {
  const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);

  if (sortedSteps.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Aucune étape à afficher. Ajoutez des étapes au workflow.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          Aperçu du flux
        </CardTitle>
        <CardDescription>Vue séquentielle du workflow avec les dépendances</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-0">
          {sortedSteps.map((step, idx) => {
            const stepActions = actions.filter(a => a.step_key === step.step_key && a.is_active);
            const stepNotifs = notifications.filter(n => n.step_key === step.step_key && n.is_active);
            const stepTasks = taskConfigs.filter(t => t.step_key === step.step_key && t.is_active);
            const stepValidations = validationConfigs.filter(v => v.source_step_key === step.step_key && v.is_active);
            const transitionsOut = transitions.filter(t => t.from_step_key === step.step_key && t.is_active);
            const colorClass = STEP_COLOR_MAP[step.step_type] || 'bg-muted border-border text-foreground';
            const config = (step as any).config as Record<string, any> | null;

            return (
              <div key={step.id} className="flex flex-col items-center w-full max-w-md">
                {/* Connector arrow */}
                {idx > 0 && (
                  <div className="flex flex-col items-center gap-0 py-1">
                    <div className="w-px h-4 bg-border" />
                    {/* Show transition events */}
                    {(() => {
                      const prevStep = sortedSteps[idx - 1];
                      const connecting = transitions.filter(
                        t => t.from_step_key === prevStep?.step_key && t.to_step_key === step.step_key
                      );
                      if (connecting.length > 0) {
                        return (
                          <div className="flex gap-1 my-0.5">
                            {connecting.map(t => (
                              <Badge key={t.id} variant="outline" className="text-[9px] h-4 px-1.5 bg-background">
                                {WF_EVENT_LABELS[t.event] || t.event}
                              </Badge>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {/* Step card */}
                <div className={`w-full border rounded-xl p-3 ${colorClass} ${!step.is_active ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0 opacity-80">
                      {STEP_ICON_MAP[step.step_type] || <Circle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{step.name}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-white/50 border-current/20 shrink-0">
                          {WF_STEP_TYPE_LABELS[step.step_type]}
                        </Badge>
                      </div>
                      {step.state_label && (
                        <p className="text-[11px] opacity-70 mt-0.5">État : {step.state_label}</p>
                      )}
                      {config?.target_status && (
                        <p className="text-[11px] opacity-70 mt-0.5">→ {config.target_status}</p>
                      )}
                    </div>
                  </div>

                  {/* Tasks attached to this step */}
                  {stepTasks.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                      {stepTasks.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5 text-[10px]">
                          <ListTodo className="h-2.5 w-2.5 opacity-70" />
                          <span className="font-medium">{t.name}</span>
                          {t.completion_behavior === 'send_to_validation' || t.completion_behavior === 'wait_validation' ? (
                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-white/40 border-current/20">→ Validation</Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Validations */}
                  {stepValidations.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {stepValidations.map(v => (
                        <Badge key={v.id} className="text-[9px] h-4 px-1.5 bg-white/40 text-current border-current/20" variant="outline">
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                          {v.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions & Notifications */}
                  {(stepActions.length > 0 || stepNotifs.length > 0) && (
                    <div className="mt-2 pt-2 border-t border-current/10 flex flex-wrap gap-1">
                      {stepActions.map(a => (
                        <Badge key={a.id} className="text-[9px] h-4 px-1.5 bg-white/40 text-current border-current/20" variant="outline">
                          <Zap className="h-2.5 w-2.5 mr-0.5" />
                          {WF_ACTION_TYPE_LABELS[a.action_type]}
                        </Badge>
                      ))}
                      {stepNotifs.map(n => (
                        <Badge key={n.id} className="text-[9px] h-4 px-1.5 bg-white/40 text-current border-current/20" variant="outline">
                          <Bell className="h-2.5 w-2.5 mr-0.5" />
                          {WF_EVENT_LABELS[n.event] || n.event}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Non-linear transitions */}
                  {transitionsOut.filter(t => {
                    const nextStep = sortedSteps[idx + 1];
                    return !nextStep || t.to_step_key !== nextStep.step_key;
                  }).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                      {transitionsOut
                        .filter(t => {
                          const nextStep = sortedSteps[idx + 1];
                          return !nextStep || t.to_step_key !== nextStep.step_key;
                        })
                        .map(t => (
                          <div key={t.id} className="flex items-center gap-1 text-[10px] opacity-70">
                            <ArrowRightLeft className="h-2.5 w-2.5" />
                            <span>{WF_EVENT_LABELS[t.event] || t.event}</span>
                            <span>→</span>
                            <span className="font-medium">
                              {steps.find(s => s.step_key === t.to_step_key)?.name || t.to_step_key}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
