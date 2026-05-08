/**
 * MyDayPanel — encart « Mon jour » en haut du tableau de bord.
 *
 * 4 cartes cliquables :
 *  - 📋 Mes tâches actives (total)
 *  - ⏰ En retard
 *  - ✅ À valider (par moi — N1 ou N2)
 *  - 🎯 À faire aujourd'hui (échéance = today)
 *
 * Cliquer → applique un filtre rapide ou bascule vers l'onglet Validations.
 */
import { useMemo } from 'react';
import { Task } from '@/types/task';
import { Card, CardContent } from '@/components/ui/card';
import { ListChecks, AlertTriangle, ShieldCheck, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MyDayPanelProps {
  /** Toutes les tâches du périmètre user. */
  myTasks: Task[];
  /** Profil user courant (pour filtrer assignee_id). */
  currentUserId: string | null | undefined;
  /** Nombre de validations en attente pour le user (demandes + tâches). */
  pendingValidationCount: number;
  /** Callback pour basculer sur l'onglet Validations. */
  onGoToValidations: () => void;
  /** Callback pour appliquer un filtre rapide « overdue » sur la liste. */
  onFilterOverdue?: () => void;
  /** Callback pour appliquer un filtre rapide « due_today ». */
  onFilterToday?: () => void;
  /** Callback pour réinitialiser les filtres (reset). */
  onResetFilters?: () => void;
}

/** Statuts considérés "actifs" (= pas terminés). */
const ACTIVE_STATUSES = new Set([
  'todo', 'in-progress', 'pending_validation_1', 'pending_validation_2',
  'a_relire', 'en_cours', 'soumise', 'affectee', 'a_valider', 'a_deposer',
  'en_instruction', 'complement_demande',
]);

const TERMINAL_STATUSES = new Set(['done', 'validated', 'refused', 'cloturee', 'cancelled']);

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function MyDayPanel({
  myTasks,
  currentUserId,
  pendingValidationCount,
  onGoToValidations,
  onFilterOverdue,
  onFilterToday,
  onResetFilters,
}: MyDayPanelProps) {
  const todayStr = useMemo(() => ymd(new Date()), []);

  const counts = useMemo(() => {
    let total = 0;
    let overdue = 0;
    let today = 0;

    for (const t of myTasks) {
      // On ne compte que les tâches du user courant (assignee) — exclut les tâches d'autres users
      if (currentUserId && t.assignee_id !== currentUserId) continue;
      // On exclut les tâches terminées
      if (TERMINAL_STATUSES.has(t.status as string)) continue;
      total += 1;

      const due = t.due_date;
      if (!due) continue;
      // Comparer en YYYY-MM-DD pour éviter les surprises de fuseau
      if (due < todayStr) overdue += 1;
      else if (due === todayStr) today += 1;
    }

    return { total, overdue, today };
  }, [myTasks, currentUserId, todayStr]);

  const cards: {
    key: string;
    label: string;
    value: number;
    icon: typeof ListChecks;
    accent: string;
    onClick?: () => void;
  }[] = [
    {
      key: 'total',
      label: 'Mes tâches actives',
      value: counts.total,
      icon: ListChecks,
      accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      onClick: onResetFilters,
    },
    {
      key: 'overdue',
      label: 'En retard',
      value: counts.overdue,
      icon: AlertTriangle,
      accent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      onClick: onFilterOverdue,
    },
    {
      key: 'today',
      label: 'À faire aujourd\'hui',
      value: counts.today,
      icon: Target,
      accent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      onClick: onFilterToday,
    },
    {
      key: 'to_validate',
      label: 'À valider par moi',
      value: pendingValidationCount,
      icon: ShieldCheck,
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      onClick: onGoToValidations,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const clickable = !!c.onClick;
        const Comp: any = clickable ? 'button' : 'div';
        return (
          <Comp
            key={c.key}
            type={clickable ? 'button' : undefined}
            onClick={c.onClick}
            className={cn(
              'text-left',
              clickable && 'cursor-pointer transition-transform hover:-translate-y-0.5',
            )}
          >
            <Card
              className={cn(
                'border-border/50',
                clickable && 'hover:shadow-md hover:border-primary/30',
              )}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', c.accent)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">{c.label}</p>
                  <p className="text-2xl font-bold tabular-nums leading-tight">{c.value}</p>
                </div>
              </CardContent>
            </Card>
          </Comp>
        );
      })}
    </div>
  );
}
