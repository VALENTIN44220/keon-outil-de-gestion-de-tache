import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DailyCapacityBarProps {
  totalHours: number;
  maxHours?: number;
  className?: string;
  compact?: boolean;
}

export function DailyCapacityBar({ totalHours, maxHours = 8, className, compact = false }: DailyCapacityBarProps) {
  const percentage = Math.min((totalHours / maxHours) * 100, 100);
  const isOverloaded = totalHours > maxHours;
  const remainingHours = Math.max(0, maxHours - totalHours);

  const getBarColor = () => {
    if (isOverloaded) return 'bg-destructive';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-primary';
    if (percentage > 0) return 'bg-primary/60';
    return 'bg-muted';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1', className)}>
            <div className={cn(
              'rounded-full overflow-hidden bg-muted/50',
              compact ? 'w-8 h-1.5' : 'w-full h-2'
            )}>
              <div
                className={cn('h-full rounded-full transition-all', getBarColor())}
                style={{ width: `${percentage}%` }}
              />
            </div>
            {!compact && (
              <span className={cn(
                'text-[10px] tabular-nums whitespace-nowrap',
                isOverloaded ? 'text-destructive font-medium' : 'text-muted-foreground'
              )}>
                {totalHours}h/{maxHours}h
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{totalHours}h / {maxHours}h utilisées</p>
          {isOverloaded ? (
            <p className="text-destructive">⚠️ Surchargé de {totalHours - maxHours}h</p>
          ) : (
            <p>{remainingHours}h disponible{remainingHours > 1 ? 's' : ''}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
