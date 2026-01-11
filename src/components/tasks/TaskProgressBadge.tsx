import { cn } from '@/lib/utils';

interface TaskProgressBadgeProps {
  progress: number;
  completed: number;
  total: number;
  size?: 'sm' | 'md';
}

export function TaskProgressBadge({ progress, completed, total, size = 'sm' }: TaskProgressBadgeProps) {
  if (total === 0) return null;

  const getColor = () => {
    if (progress === 100) return 'bg-success text-success-foreground';
    if (progress >= 50) return 'bg-info text-info-foreground';
    if (progress > 0) return 'bg-warning text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className={cn(
      "flex items-center gap-1 rounded-full font-medium",
      size === 'sm' ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1",
      getColor()
    )}>
      <div className={cn(
        "rounded-full bg-current/20",
        size === 'sm' ? "w-3 h-3" : "w-4 h-4"
      )}>
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            opacity="0.3"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={`${progress * 0.88} 88`}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span>{completed}/{total}</span>
    </div>
  );
}
