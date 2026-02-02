import { TaskPriority } from '@/types/task';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TaskPriority;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const priorityConfig: Record<TaskPriority, { label: string; icon: React.ReactNode; className: string }> = {
  low: {
    label: 'Basse',
    icon: <ArrowDown className="h-3.5 w-3.5" />,
    className: 'bg-slate-100 text-slate-600 border-slate-300',
  },
  medium: {
    label: 'Moyenne',
    icon: <Minus className="h-3.5 w-3.5" />,
    className: 'bg-info/10 text-info border-info/30',
  },
  high: {
    label: 'Haute',
    icon: <ArrowUp className="h-3.5 w-3.5" />,
    className: 'bg-warning/10 text-warning border-warning/30',
  },
  urgent: {
    label: 'Urgente',
    icon: <Flame className="h-3.5 w-3.5" />,
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
};

export function PriorityBadge({ priority, showLabel = true, size = 'md' }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border-2 font-semibold transition-all',
        config.className,
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      )}
    >
      {config.icon}
      {showLabel && config.label}
    </span>
  );
}
