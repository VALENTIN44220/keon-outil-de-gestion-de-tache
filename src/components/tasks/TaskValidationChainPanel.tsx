/**
 * TaskValidationChainPanel
 *
 * Affiche la chaîne de validation d'une tâche (niveaux 1 et 2) avec :
 *  - Le type de validateur (Manager / Demandeur / Validateur désigné)
 *  - Le nom du validateur (résolu à partir des profils)
 *  - Le statut de chaque niveau (en attente / validé / refusé)
 *  - L'horodatage + auteur de la décision si elle existe
 *  - Le commentaire éventuel
 *
 * Affiché uniquement si au moins un niveau de validation est configuré
 * sur le template de tâche (validation_level_1 ou validation_level_2 ≠ 'none').
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Clock, CheckCircle2, XCircle, User, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';
import { normalizeValidationLevel, taskRequiresValidationBeforeDone } from '@/lib/taskValidationUi';

interface Props {
  task: Task;
  /** Map id → display_name pour résoudre les noms */
  profiles: Map<string, string>;
  /** ID du manager de l'exécutant (résolu en amont par le parent) */
  managerOfAssigneeId?: string | null;
  /** ID du demandeur réel (résolu en amont par le parent) */
  requesterId?: string | null;
}

interface LevelInfo {
  level: 1 | 2;
  type: 'none' | 'manager' | 'requester' | 'free';
  typeLabel: string;
  validatorName: string | null;
  validatorMissing: boolean;
  status: 'none' | 'pending' | 'validated' | 'refused';
  decidedBy: string | null;
  decidedAt: string | null;
  comment: string | null;
}

const TYPE_LABEL: Record<NonNullable<LevelInfo['type']>, string> = {
  none:      '—',
  manager:   'Manager de l\'exécutant',
  requester: 'Demandeur',
  free:      'Validateur désigné',
};

const STATUS_META: Record<LevelInfo['status'], {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  none:      { label: '—',          className: 'bg-slate-100 text-slate-600 border-slate-200',          icon: Clock },
  pending:   { label: 'En attente', className: 'bg-amber-100 text-amber-700 border-amber-200',          icon: Clock },
  validated: { label: 'Validé',     className: 'bg-emerald-100 text-emerald-700 border-emerald-200',    icon: CheckCircle2 },
  refused:   { label: 'Refusé',     className: 'bg-red-100 text-red-700 border-red-200',                icon: XCircle },
};

export function TaskValidationChainPanel({ task, profiles, managerOfAssigneeId, requesterId }: Props) {
  if (!taskRequiresValidationBeforeDone(task)) return null;

  const getLevelInfo = (level: 1 | 2): LevelInfo => {
    const type = normalizeValidationLevel(
      level === 1 ? task.validation_level_1 : task.validation_level_2,
    );
    const validatorId = level === 1 ? task.validator_level_1_id : task.validator_level_2_id;
    const status: LevelInfo['status'] = type === 'none'
      ? 'none'
      : ((level === 1 ? task.validation_1_status : task.validation_2_status) ?? 'pending');
    const decidedBy = level === 1 ? task.validation_1_by : task.validation_2_by;
    const decidedAt = level === 1 ? task.validation_1_at : task.validation_2_at;
    const comment   = level === 1 ? task.validation_1_comment : task.validation_2_comment;

    let validatorName: string | null = null;
    let validatorMissing = false;
    if (type === 'manager') {
      validatorName = managerOfAssigneeId ? (profiles.get(managerOfAssigneeId) ?? null) : null;
      validatorMissing = !managerOfAssigneeId;
    } else if (type === 'requester') {
      validatorName = requesterId ? (profiles.get(requesterId) ?? null) : null;
      validatorMissing = !requesterId;
    } else if (type === 'free') {
      validatorName = validatorId ? (profiles.get(validatorId) ?? null) : null;
      validatorMissing = !validatorId;
    }

    return {
      level,
      type,
      typeLabel: TYPE_LABEL[type],
      validatorName,
      validatorMissing,
      status,
      decidedBy,
      decidedAt,
      comment,
    };
  };

  const levels: LevelInfo[] = [getLevelInfo(1), getLevelInfo(2)].filter((l) => l.type !== 'none');
  if (levels.length === 0) return null;

  return (
    <Card className="border-amber-200/70 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
          <ShieldCheck className="h-4 w-4" />
          Chaîne de validation
          <Badge variant="outline" className="ml-auto text-[10px] font-normal border-amber-300 bg-white/60">
            {levels.length} niveau{levels.length > 1 ? 'x' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {levels.map((info) => {
            const meta = STATUS_META[info.status];
            const StatusIcon = meta.icon;
            return (
              <li
                key={info.level}
                className={cn(
                  'flex items-start gap-3 rounded-lg border bg-white/80 p-3',
                  info.status === 'validated' && 'border-emerald-200',
                  info.status === 'refused'   && 'border-red-200',
                  info.status === 'pending'   && 'border-amber-200',
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  info.status === 'validated' && 'bg-emerald-100 text-emerald-700',
                  info.status === 'refused'   && 'bg-red-100 text-red-700',
                  info.status === 'pending'   && 'bg-amber-100 text-amber-700',
                  info.status === 'none'      && 'bg-slate-100 text-slate-600',
                )}>
                  {info.level}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">Niveau {info.level}</span>
                    <Badge variant="outline" className="text-[10px]">{info.typeLabel}</Badge>
                    <Badge variant="outline" className={cn('text-[10px] gap-1', meta.className)}>
                      <StatusIcon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>Validateur :</span>
                    {info.validatorName ? (
                      <span className="font-medium text-foreground">{info.validatorName}</span>
                    ) : info.validatorMissing ? (
                      <span className="italic text-destructive">
                        {info.type === 'manager' && 'manager non défini sur l\'exécutant'}
                        {info.type === 'requester' && 'demandeur non défini'}
                        {info.type === 'free' && 'à désigner dans le template'}
                      </span>
                    ) : (
                      <span className="italic">non résolu</span>
                    )}
                  </div>

                  {info.decidedAt && (info.status === 'validated' || info.status === 'refused') && (
                    <p className="text-[11px] text-muted-foreground">
                      {info.status === 'validated' ? 'Validé' : 'Refusé'} le{' '}
                      <span className="font-medium text-foreground">
                        {new Date(info.decidedAt).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {info.decidedBy && (
                        <> par <span className="font-medium text-foreground">{profiles.get(info.decidedBy) ?? 'utilisateur inconnu'}</span></>
                      )}
                    </p>
                  )}

                  {info.comment && (
                    <div className="flex items-start gap-1.5 mt-1.5 rounded bg-muted/50 p-2 text-xs italic">
                      <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>« {info.comment} »</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
