import { TaskStats } from '@/types/task';
import { CheckCircle2, Clock, AlertCircle, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsSummaryWidgetProps {
  stats: TaskStats;
}

export function StatsSummaryWidget({ stats }: StatsSummaryWidgetProps) {
  const items = [
    { label: 'Total', value: stats.total, icon: ListTodo, color: 'text-keon-blue', bg: 'bg-keon-blue/10' },
    { label: 'À faire', value: stats.todo, icon: AlertCircle, color: 'text-keon-orange', bg: 'bg-keon-orange/10' },
    { label: 'En cours', value: stats.inProgress, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Terminées', value: stats.done, icon: CheckCircle2, color: 'text-keon-green', bg: 'bg-keon-green/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className={cn(
              'rounded-lg p-3 flex flex-col items-center justify-center transition-transform hover:scale-105',
              item.bg
            )}
          >
            <Icon className={cn('h-6 w-6 mb-1', item.color)} />
            <span className="text-2xl font-bold text-keon-900">{item.value}</span>
            <span className="text-xs text-keon-600">{item.label}</span>
          </div>
        );
      })}

      {/* Completion rate */}
      <div className="col-span-2 md:col-span-4 flex items-center justify-center gap-4 mt-2">
        <div className="flex-1 h-2.5 bg-keon-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-keon-green to-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${stats.completionRate}%` }}
          />
        </div>
        <span className="text-lg font-bold text-keon-green">{stats.completionRate}%</span>
      </div>
    </div>
  );
}
