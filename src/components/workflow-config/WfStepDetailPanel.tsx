import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  X, Hash, Zap, Bell, ArrowRightLeft, CheckCircle, ListTodo,
  User, AlertTriangle, ArrowRight, Eye, EyeOff,
} from 'lucide-react';
import type { WfStep, WfTransition, WfNotification, WfAction } from '@/types/workflow';
import { WF_STEP_TYPE_LABELS, WF_VALIDATION_MODE_LABELS, WF_EVENT_LABELS, WF_ACTION_TYPE_LABELS } from '@/types/workflow';
import type { EnrichedAssignmentRule } from '@/lib/workflowAssignmentRules';
import type { WfTaskConfig, WfValidationConfig } from '@/types/workflowTaskConfig';
import { EXECUTOR_TYPE_LABELS, COMPLETION_BEHAVIOR_LABELS } from '@/types/workflowTaskConfig';

interface Props {
  step: WfStep;
  steps: WfStep[];
  transitions: WfTransition[];
  notifications: WfNotification[];
  actions: WfAction[];
  assignmentRules: EnrichedAssignmentRule[];
  taskConfigs?: WfTaskConfig[];
  validationConfigs?: WfValidationConfig[];
  onClose: () => void;
}

export function WfStepDetailPanel({
  step, steps, transitions, notifications, actions, assignmentRules,
  taskConfigs = [], validationConfigs = [], onClose,
}: Props) {
  const getStepName = (key: string) => steps.find(s => s.step_key === key)?.name || key;
  const assignmentRule = assignmentRules.find(r => r.id === step.assignment_rule_id);

  // Related data for this step
  const stepTransitionsOut = transitions.filter(t => t.from_step_key === step.step_key);
  const stepTransitionsIn = transitions.filter(t => t.to_step_key === step.step_key);
  const stepNotifications = notifications.filter(n => n.step_key === step.step_key);
  const stepActions = actions.filter(a => a.step_key === step.step_key);
  const stepTasks = taskConfigs.filter(t => t.step_key === step.step_key);
  const stepValidations = validationConfigs.filter(v => v.source_step_key === step.step_key);

  // Actions linked to transitions from this step
  const transitionIds = stepTransitionsOut.map(t => t.id);
  const transitionActions = actions.filter(a => a.transition_id && transitionIds.includes(a.transition_id));
  const allStepActions = [...stepActions, ...transitionActions];

  // Task summary
  const tasksToValidation = stepTasks.filter(t => t.completion_behavior === 'send_to_validation' || t.completion_behavior === 'wait_validation');
  const tasksDirect = stepTasks.filter(t => t.completion_behavior === 'close_task' || t.completion_behavior === 'close_and_advance_step');

  // Parse config
  const config = (step as any).config as Record<string, any> | null;

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {step.order_index}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{step.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] h-4 font-mono">{step.step_key}</Badge>
              <Badge variant="secondary" className="text-[10px] h-4">{WF_STEP_TYPE_LABELS[step.step_type]}</Badge>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Properties */}
        <div className="grid grid-cols-2 gap-3">
          <InfoItem label="État affiché" value={step.state_label || '—'} />
          <InfoItem label="Obligatoire" value={step.is_required ? 'Oui' : 'Non'} />
          <InfoItem label="Actif" value={step.is_active ? 'Oui' : 'Non'} />
          {step.step_type === 'validation' && (
            <InfoItem
              label="Mode validation"
              value={`${WF_VALIDATION_MODE_LABELS[step.validation_mode]}${step.n_required ? ` (${step.n_required})` : ''}`}
            />
          )}
          {config?.target_status && (
            <InfoItem label="Statut cible" value={config.target_status} />
          )}
          {config?.actor && (
            <InfoItem label="Déclenché par" value={config.actor === 'assignee' ? 'Exécutant' : config.actor === 'requester' ? 'Demandeur' : 'Système'} />
          )}
        </div>

        {/* Assignment */}
        {assignmentRule && (
          <>
            <Separator />
            <div>
              <SectionTitle icon={<User className="h-3.5 w-3.5" />} label="Affectation" />
              <div className="mt-2 p-2.5 bg-muted/40 rounded-lg text-sm flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{assignmentRule.display_name}</Badge>
              </div>
            </div>
          </>
        )}

        {/* Tasks linked to this step */}
        {stepTasks.length > 0 && (
          <>
            <Separator />
            <div>
              <SectionTitle icon={<ListTodo className="h-3.5 w-3.5" />} label={`Tâches (${stepTasks.length})`} />
              <div className="mt-2 space-y-1.5">
                {stepTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs">
                    <ListTodo className="h-3 w-3 text-orange-600 shrink-0" />
                    <span className="font-medium truncate">{t.name}</span>
                    <Badge variant="outline" className="text-[9px] h-4 ml-auto shrink-0">
                      {COMPLETION_BEHAVIOR_LABELS[t.completion_behavior] || t.completion_behavior}
                    </Badge>
                  </div>
                ))}
              </div>
              {(tasksToValidation.length > 0 || tasksDirect.length > 0) && (
                <div className="mt-2 flex gap-2 text-[10px]">
                  {tasksDirect.length > 0 && (
                    <span className="text-muted-foreground">{tasksDirect.length} clôture(s) directe(s)</span>
                  )}
                  {tasksToValidation.length > 0 && (
                    <span className="text-amber-700">{tasksToValidation.length} vers validation</span>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Validations linked to this step */}
        {stepValidations.length > 0 && (
          <>
            <Separator />
            <div>
              <SectionTitle icon={<CheckCircle className="h-3.5 w-3.5" />} label={`Validations (${stepValidations.length})`} />
              <div className="mt-2 space-y-1.5">
                {stepValidations.map(v => (
                  <div key={v.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs">
                    <CheckCircle className="h-3 w-3 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">{v.name}</span>
                    <Badge variant="outline" className="text-[9px] h-4 ml-auto shrink-0">
                      {v.object_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Transitions IN */}
        {stepTransitionsIn.length > 0 && (
          <>
            <Separator />
            <div>
              <SectionTitle icon={<ArrowRightLeft className="h-3.5 w-3.5" />} label={`Entrées (${stepTransitionsIn.length})`} />
              <div className="mt-2 space-y-1.5">
                {stepTransitionsIn.map(t => (
                  <TransitionRow key={t.id} from={getStepName(t.from_step_key)} event={t.event} to={step.name} direction="in" isActive={t.is_active} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Transitions OUT */}
        {stepTransitionsOut.length > 0 && (
          <>
            <Separator />
            <div>
              <SectionTitle icon={<ArrowRight className="h-3.5 w-3.5" />} label={`Sorties (${stepTransitionsOut.length})`} />
              <div className="mt-2 space-y-1.5">
                {stepTransitionsOut.map(t => (
                  <TransitionRow key={t.id} from={step.name} event={t.event} to={getStepName(t.to_step_key)} direction="out" isActive={t.is_active} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Notifications */}
        {stepNotifications.length > 0 && (
          <>
            <Separator />
            <div>
              <SectionTitle icon={<Bell className="h-3.5 w-3.5" />} label={`Notifications (${stepNotifications.length})`} />
              <div className="mt-2 space-y-1.5">
                {stepNotifications.map(n => (
                  <div key={n.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs">
                    {n.is_active ? (
                      <Eye className="h-3 w-3 text-green-600 shrink-0" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <Badge variant="outline" className="text-[10px]">{WF_EVENT_LABELS[n.event] || n.event}</Badge>
                    <span className="text-muted-foreground truncate">{n.subject_template || 'Notification'}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        {allStepActions.length > 0 && (
          <>
            <Separator />
            <div>
              <SectionTitle icon={<Zap className="h-3.5 w-3.5" />} label={`Actions auto. (${allStepActions.length})`} />
              <div className="mt-2 space-y-1.5">
                {allStepActions.map(a => (
                  <div key={a.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs">
                    {a.is_active ? (
                      <Zap className="h-3 w-3 text-amber-600 shrink-0" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {WF_ACTION_TYPE_LABELS[a.action_type]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {a.transition_id ? '(sur transition)' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {stepTransitionsIn.length === 0 && stepTransitionsOut.length === 0 && stepNotifications.length === 0 && allStepActions.length === 0 && !assignmentRule && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 mx-auto mb-1 opacity-50" />
            Aucune configuration rattachée à cette étape
          </div>
        )}
      </div>
    </div>
  );
}

// Small helper components
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-muted/30 rounded-lg">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
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

function TransitionRow({ from, event, to, direction, isActive }: { from: string; event: string; to: string; direction: 'in' | 'out'; isActive: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isActive ? 'bg-muted/30' : 'bg-muted/10 opacity-50'}`}>
      <span className="font-medium truncate">{from}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
      <Badge variant="outline" className="text-[10px] shrink-0">{WF_EVENT_LABELS[event] || event}</Badge>
      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="font-medium truncate">{to}</span>
    </div>
  );
}
