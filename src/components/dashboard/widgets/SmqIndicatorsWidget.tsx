import { useMemo } from 'react';
import { Task } from '@/types/task';
import { format, differenceInCalendarDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TicketCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmqIndicatorsWidgetProps {
  tasks: Task[];
}

export function SmqIndicatorsWidget({ tasks }: SmqIndicatorsWidgetProps) {
  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Open tickets this month (created this month, not done/validated)
    const openThisMonth = tasks.filter(t => {
      const created = new Date(t.created_at);
      return (
        isWithinInterval(created, { start: monthStart, end: monthEnd }) &&
        t.status !== 'done' &&
        t.status !== 'validated'
      );
    }).length;

    // Average processing time: difference between created_at and updated_at for done/validated tasks
    const closedTasks = tasks.filter(t =>
      (t.status === 'done' || t.status === 'validated')
    );

    let avgDays = 0;
    if (closedTasks.length > 0) {
      const totalDays = closedTasks.reduce((sum, t) => {
        const opened = new Date(t.created_at);
        const closed = new Date(t.updated_at);
        return sum + differenceInCalendarDays(closed, opened);
      }, 0);
      avgDays = Math.round((totalDays / closedTasks.length) * 10) / 10;
    }

    return { openThisMonth, avgDays, closedCount: closedTasks.length };
  }, [tasks]);

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: fr });

  const cards = [
    {
      label: `Tickets ouverts (${currentMonth})`,
      value: metrics.openThisMonth,
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
    <div className="flex flex-col gap-4 h-full justify-center px-2">
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
  );
}
