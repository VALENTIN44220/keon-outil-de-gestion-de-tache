import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamMemberWorkload } from '@/types/workload';

interface GanttMemberRowProps {
  member: TeamMemberWorkload;
  isCompact?: boolean;
}

export function GanttMemberRow({ member, isCompact = false }: GanttMemberRowProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  // Calculate capacity usage
  const capacityMetrics = useMemo(() => {
    const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
    const used = member.usedSlots;
    const percentage = available > 0 ? Math.min(100, Math.round((used / available) * 100)) : 0;
    const isOverloaded = percentage > 100;
    const isHigh = percentage >= 80 && percentage <= 100;
    const isMedium = percentage >= 50 && percentage < 80;
    
    return { available, used, percentage, isOverloaded, isHigh, isMedium };
  }, [member]);
  
  const getCapacityColor = () => {
    if (capacityMetrics.isOverloaded) return 'bg-red-500';
    if (capacityMetrics.isHigh) return 'bg-amber-500';
    if (capacityMetrics.isMedium) return 'bg-blue-500';
    return 'bg-emerald-500';
  };
  
  return (
    <div className={cn(
      "sticky left-0 z-10 bg-card border-r-2 border-border/50",
      "flex items-center gap-3 px-4",
      isCompact ? "w-48 h-10" : "w-60 h-16"
    )}>
      <Avatar className={cn(
        "shrink-0 ring-2 ring-background shadow-sm",
        isCompact ? "h-7 w-7" : "h-10 w-10"
      )}>
        <AvatarImage src={member.avatarUrl || undefined} />
        <AvatarFallback className={cn(
          "text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
        )}>
          {getInitials(member.memberName)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-medium truncate text-foreground",
            isCompact ? "text-xs" : "text-sm"
          )}>
            {member.memberName}
          </span>
          {capacityMetrics.isOverloaded && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
              Surcharge
            </Badge>
          )}
        </div>
        
        {!isCompact && (
          <>
            <span className="text-xs text-muted-foreground truncate block">
              {member.jobTitle || 'Collaborateur'}
            </span>
            
            {/* Capacity bar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-300", getCapacityColor())}
                      style={{ width: `${Math.min(100, capacityMetrics.percentage)}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold shrink-0 tabular-nums",
                    capacityMetrics.isOverloaded ? "text-red-600" :
                    capacityMetrics.isHigh ? "text-amber-600" :
                    capacityMetrics.isMedium ? "text-blue-600" :
                    "text-emerald-600"
                  )}>
                    {capacityMetrics.percentage}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                <div className="space-y-1">
                  <p>Capacité utilisée: <strong>{capacityMetrics.used}/{capacityMetrics.available}</strong> créneaux</p>
                  {member.leaveSlots > 0 && (
                    <p className="text-blue-600">Congés: {member.leaveSlots} créneaux</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}