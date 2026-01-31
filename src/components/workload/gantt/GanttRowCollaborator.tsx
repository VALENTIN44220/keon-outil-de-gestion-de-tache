import { useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamMemberWorkload } from '@/types/workload';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface GanttRowCollaboratorProps {
  member: TeamMemberWorkload;
  isCompact?: boolean;
  columnWidth?: number;
  isSelected?: boolean;
  onSelect?: () => void;
}

// Use memo to prevent unnecessary re-renders
export const GanttRowCollaborator = memo(function GanttRowCollaborator({
  member,
  isCompact = false,
  columnWidth = 260,
  isSelected = false,
  onSelect,
}: GanttRowCollaboratorProps) {
  // Calculate capacity metrics
  const capacityMetrics = useMemo(() => {
    const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
    const used = member.usedSlots;
    const percentage = available > 0 ? Math.min(200, Math.round((used / available) * 100)) : 0;
    const isOverloaded = percentage > 100;
    const isHigh = percentage >= 80 && percentage <= 100;
    const isMedium = percentage >= 50 && percentage < 80;
    const isLow = percentage < 50;

    return { available, used, percentage, isOverloaded, isHigh, isMedium, isLow };
  }, [member.totalSlots, member.leaveSlots, member.holidaySlots, member.usedSlots]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getCapacityColor = () => {
    if (capacityMetrics.isOverloaded) return 'text-red-600';
    if (capacityMetrics.isHigh) return 'text-amber-600';
    if (capacityMetrics.isMedium) return 'text-blue-600';
    return 'text-emerald-600';
  };

  const getProgressColor = () => {
    if (capacityMetrics.isOverloaded) return 'bg-red-500';
    if (capacityMetrics.isHigh) return 'bg-amber-500';
    if (capacityMetrics.isMedium) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getTrendIcon = () => {
    if (capacityMetrics.isOverloaded) return TrendingUp;
    if (capacityMetrics.isLow) return TrendingDown;
    return Minus;
  };

  const TrendIcon = getTrendIcon();

  return (
    <div
      className={cn(
        "sticky left-0 z-20 bg-card border-r-2 border-border/50",
        "flex items-center gap-3 px-3 shrink-0",
        "hover:bg-muted/30 transition-colors cursor-pointer",
        isSelected && "bg-primary/5 border-r-primary",
        isCompact ? "h-14" : "h-20"
      )}
      style={{ width: columnWidth }}
      onClick={onSelect}
      role="rowheader"
      tabIndex={0}
      aria-label={`${member.memberName}, ${capacityMetrics.percentage}% de charge`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      {/* Avatar with status ring */}
      <Avatar className={cn(
        "shrink-0 ring-2 ring-offset-2 ring-offset-card shadow-sm transition-all",
        capacityMetrics.isOverloaded && "ring-red-400",
        capacityMetrics.isHigh && "ring-amber-400",
        capacityMetrics.isMedium && "ring-blue-400",
        capacityMetrics.isLow && "ring-emerald-400",
        isCompact ? "h-9 w-9" : "h-11 w-11"
      )}>
        <AvatarImage src={member.avatarUrl || undefined} alt={member.memberName} />
        <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
          {getInitials(member.memberName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Name and overload badge */}
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold truncate text-foreground",
            isCompact ? "text-xs" : "text-sm"
          )}>
            {member.memberName}
          </span>
          {capacityMetrics.isOverloaded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="destructive" 
                  className="text-[9px] px-1.5 py-0 h-4 gap-0.5 shrink-0 animate-pulse"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {!isCompact && 'Surcharge'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Ce collaborateur a {capacityMetrics.percentage}% de charge, supérieur à sa capacité
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Job title */}
        {!isCompact && (
          <span className="text-xs text-muted-foreground truncate block mt-0.5">
            {member.jobTitle || member.department || 'Collaborateur'}
          </span>
        )}

        {/* Capacity bar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-2", isCompact ? "mt-1" : "mt-2")}>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    getProgressColor()
                  )}
                  style={{ width: `${Math.min(100, capacityMetrics.percentage)}%` }}
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <TrendIcon className={cn("h-3 w-3", getCapacityColor())} />
                <span className={cn(
                  "text-[10px] font-bold tabular-nums min-w-[32px] text-right",
                  getCapacityColor()
                )}>
                  {capacityMetrics.percentage}%
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <div className="space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", getProgressColor())} />
                Charge de travail
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Utilisé:</span>
                <span className="font-medium text-right">{capacityMetrics.used} créneaux</span>
                <span className="text-muted-foreground">Disponible:</span>
                <span className="font-medium text-right">{capacityMetrics.available} créneaux</span>
                {member.leaveSlots > 0 && (
                  <>
                    <span className="text-cyan-600">Congés:</span>
                    <span className="text-cyan-600 text-right">{member.leaveSlots}</span>
                  </>
                )}
                {member.holidaySlots > 0 && (
                  <>
                    <span className="text-amber-600">Fériés:</span>
                    <span className="text-amber-600 text-right">{member.holidaySlots}</span>
                  </>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

// Group header component for department/company grouping
interface GanttRowGroupHeaderProps {
  title: string;
  memberCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  columnWidth?: number;
  stats?: {
    overloaded: number;
    totalTasks: number;
  };
}

export const GanttRowGroupHeader = memo(function GanttRowGroupHeader({
  title,
  memberCount,
  isExpanded,
  onToggle,
  columnWidth = 260,
  stats,
}: GanttRowGroupHeaderProps) {
  return (
    <div
      className={cn(
        "sticky left-0 z-20 bg-muted/80 border-r-2 border-border/50",
        "flex items-center gap-2 px-3 h-10 cursor-pointer",
        "hover:bg-muted transition-colors"
      )}
      style={{ width: columnWidth }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`${title}, ${memberCount} collaborateurs`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* Expand/Collapse indicator */}
      <div className={cn(
        "shrink-0 w-5 h-5 rounded flex items-center justify-center",
        "bg-background/50 text-muted-foreground transition-transform",
        isExpanded && "rotate-90"
      )}>
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M4.5 2L9 6L4.5 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {/* Title */}
      <span className="font-semibold text-sm text-foreground flex-1 truncate">
        {title}
      </span>

      {/* Stats */}
      <div className="flex items-center gap-2 shrink-0">
        {stats?.overloaded && stats.overloaded > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 h-5">
            <AlertTriangle className="h-3 w-3 mr-0.5" />
            {stats.overloaded}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] px-2 h-5">
          {memberCount}
        </Badge>
      </div>
    </div>
  );
});
