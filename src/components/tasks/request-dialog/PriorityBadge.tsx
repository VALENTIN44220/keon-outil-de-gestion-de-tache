import { TaskPriority } from '@/types/task';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowDown, ArrowUp, Flame } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TaskPriority;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const priorityConfig: Record<TaskPriority, { label: string; icon: React.ReactNode; className: string }> = {
  low: {
    label: 'Basse',
    icon: <ArrowDown className="h-3.5 w-3.5" />,
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  medium: {
    label: 'Moyenne',
    icon: <ArrowUp className="h-3.5 w-3.5" />,
    className: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  high: {
    label: 'Haute',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  urgent: {
    label: 'Urgente',
    icon: <Flame className="h-3.5 w-3.5" />,
    className: 'bg-red-50 text-red-600 border-red-200',
  },
};

export function PriorityBadge({ priority, showLabel = true, size = 'md' }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      {config.icon}
      {showLabel && config.label}
    </span>
  );
}
