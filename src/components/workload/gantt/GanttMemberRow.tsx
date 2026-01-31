import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TeamMemberWorkload } from '@/types/workload';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

interface GanttMemberRowProps {
  member: TeamMemberWorkload;
  isCompact?: boolean;
  isGrouped?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  memberColumnWidth?: number;
}

export function GanttMemberRow({ 
  member, 
  isCompact = false,
  isGrouped = false,
  isExpanded = true,
  onToggleExpand,
  memberColumnWidth = 260
}: GanttMemberRowProps) {
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

  const getCapacityTextColor = () => {
    if (capacityMetrics.isOverloaded) return 'text-red-600';
    if (capacityMetrics.isHigh) return 'text-amber-600';
    if (capacityMetrics.isMedium) return 'text-blue-600';
    return 'text-emerald-600';
  };
  
  return (
    <div 
      className={cn(
        "sticky left-0 z-10 bg-card border-r-2 border-border/50",
        "flex items-center gap-3 px-3 shrink-0",
        "hover:bg-muted/30 transition-colors",
        isCompact ? "h-12" : "h-[72px]"
      )}
      style={{ width: memberColumnWidth }}
    >
      {/* Collapse toggle for grouped view */}
      {isGrouped && onToggleExpand && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onToggleExpand}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Avatar */}
      <Avatar className={cn(
        "shrink-0 ring-2 ring-background shadow-sm",
        isCompact ? "h-8 w-8" : "h-10 w-10"
      )}>
        <AvatarImage src={member.avatarUrl || undefined} />
        <AvatarFallback className={cn(
          "text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
        )}>
          {getInitials(member.memberName)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        {/* Name row */}
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold truncate text-foreground",
            isCompact ? "text-xs" : "text-sm"
          )}>
            {member.memberName}
          </span>
          {capacityMetrics.isOverloaded && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Surcharge
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Ce collaborateur a plus de tâches que sa capacité disponible
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {!isCompact && (
          <>
            {/* Role/Job title */}
            <span className="text-xs text-muted-foreground truncate block">
              {member.jobTitle || member.department || 'Collaborateur'}
            </span>
            
            {/* Capacity bar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-500", getCapacityColor())}
                      style={{ width: `${Math.min(100, capacityMetrics.percentage)}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold shrink-0 tabular-nums min-w-[32px] text-right",
                    getCapacityTextColor()
                  )}>
                    {capacityMetrics.percentage}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                <div className="space-y-1">
                  <p className="font-medium">Charge de travail</p>
                  <p>Utilisé: <strong>{capacityMetrics.used}</strong> créneaux</p>
                  <p>Disponible: <strong>{capacityMetrics.available}</strong> créneaux</p>
                  {member.leaveSlots > 0 && (
                    <p className="text-cyan-600">Congés: {member.leaveSlots} créneaux</p>
                  )}
                  {member.holidaySlots > 0 && (
                    <p className="text-amber-600">Fériés: {member.holidaySlots} créneaux</p>
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

// Group header for department/company grouping
interface GanttGroupHeaderProps {
  title: string;
  memberCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  memberColumnWidth?: number;
}

export function GanttGroupHeader({
  title,
  memberCount,
  isExpanded,
  onToggle,
  memberColumnWidth = 260
}: GanttGroupHeaderProps) {
  return (
    <div 
      className={cn(
        "sticky left-0 z-10 bg-muted/80 border-r-2 border-border/50",
        "flex items-center gap-2 px-3 h-10 cursor-pointer hover:bg-muted transition-colors"
      )}
      style={{ width: memberColumnWidth }}
      onClick={onToggle}
    >
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>
      
      <span className="font-semibold text-sm text-foreground flex-1 truncate">
        {title}
      </span>
      
      <Badge variant="secondary" className="text-xs">
        {memberCount}
      </Badge>
    </div>
  );
}
