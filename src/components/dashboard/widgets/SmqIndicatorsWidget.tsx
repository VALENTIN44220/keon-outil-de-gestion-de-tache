import { useMemo, useState } from 'react';
import { Task } from '@/types/task';
import { format, differenceInCalendarDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TicketCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SmqPeriod = 'month' | 'quarter' | 'year' | 'last3' | 'last6' | 'last12';

const PERIOD_OPTIONS: { value: SmqPeriod; label: string }[] = [
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'year', label: 'Cette année' },
  { value: 'last3', label: '3 derniers mois' },
  { value: 'last6', label: '6 derniers mois' },
  { value: 'last12', label: '12 derniers mois' },
];

function getPeriodRange(period: SmqPeriod): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (period) {
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: fr }) };
    case 'quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now), label: `T${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}` };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now), label: `${now.getFullYear()}` };
    case 'last3':
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now), label: '3 derniers mois' };
    case 'last6':
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now), label: '6 derniers mois' };
    case 'last12':
      return { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now), label: '12 derniers mois' };
  }
}

interface SmqIndicatorsWidgetProps {
  tasks: Task[];
}

export function SmqIndicatorsWidget({ tasks }: SmqIndicatorsWidgetProps) {
  const [period, setPeriod] = useState<SmqPeriod>('month');

  const { range, metrics } = useMemo(() => {
    const range = getPeriodRange(period);
    const interval = { start: range.start, end: range.end };

    const openCount = tasks.filter(t => {
      const created = new Date(t.created_at);
      return (
        isWithinInterval(created, interval) &&
        t.status !== 'done' &&
        t.status !== 'validated'
      );
    }).length;

    const closedTasks = tasks.filter(t => {
      const updated = new Date(t.updated_at);
      return (
        (t.status === 'done' || t.status === 'validated') &&
        isWithinInterval(updated, interval)
      );
    });

    let avgDays = 0;
    if (closedTasks.length > 0) {
      const totalDays = closedTasks.reduce((sum, t) => {
        return sum + differenceInCalendarDays(new Date(t.updated_at), new Date(t.created_at));
      }, 0);
      avgDays = Math.round((totalDays / closedTasks.length) * 10) / 10;
    }

    return { range, metrics: { openCount, avgDays, closedCount: closedTasks.length } };
  }, [tasks, period]);

  const cards = [
    {
      label: `Tickets ouverts (${range.label})`,
      value: metrics.openCount,
      icon: TicketCheck,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Durée moy. traitement (j)',
      value: metrics.closedCount > 0 ? `${metrics.avgDays} j` : '—',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
  ];

  return (
    <div className="flex flex-col gap-3 h-full px-2 py-1">
      <Select value={period} onValueChange={(v) => setPeriod(v as SmqPeriod)}>
        <SelectTrigger className="h-8 text-xs w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-col gap-3 flex-1 justify-center">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="flex items-center gap-4 p-4 rounded-xl border bg-card shadow-sm"
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                card.bgColor
              )}>
                <Icon className={cn("h-6 w-6", card.color)} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-2xl leading-tight">
                  {card.value}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {card.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
