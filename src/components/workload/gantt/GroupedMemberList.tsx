import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TeamMemberWorkload } from '@/types/workload';
import { GroupByOption } from '@/hooks/useWorkloadPreferences';
import { ChevronDown, ChevronRight, Users, Building2, Briefcase } from 'lucide-react';
import { WorkloadSummaryChip } from './MemberHeatmapBar';

interface GroupedMemberListProps {
  members: TeamMemberWorkload[];
  groupBy: GroupByOption;
  renderMemberRow: (member: TeamMemberWorkload, index: number) => React.ReactNode;
}

interface GroupData {
  id: string;
  name: string;
  members: TeamMemberWorkload[];
  stats: {
    taskCount: number;
    leaveCount: number;
    overloadedCount: number;
    avgCapacity: number;
  };
}

export function GroupedMemberList({
  members,
  groupBy,
  renderMemberRow,
}: GroupedMemberListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = groups.map(g => g.id);
    setExpandedGroups(new Set(allIds));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  // Group members by the selected criteria
  const groups = useMemo((): GroupData[] => {
    if (groupBy === 'none') {
      return [{
        id: 'all',
        name: 'Tous les collaborateurs',
        members,
        stats: calculateGroupStats(members),
      }];
    }

    const groupMap = new Map<string, TeamMemberWorkload[]>();

    members.forEach(member => {
      let groupKey: string;
      let groupName: string;

      switch (groupBy) {
        case 'department':
          groupKey = member.department || 'unassigned';
          groupName = member.department || 'Non assigné';
          break;
        case 'company':
          groupKey = member.companyId || 'unassigned';
          groupName = member.companyId || 'Non assigné';
          break;
        case 'team':
          // Group by manager (would need manager data in TeamMemberWorkload)
          groupKey = 'team'; // Simplified for now
          groupName = 'Équipe';
          break;
        default:
          groupKey = 'all';
          groupName = 'Tous';
      }

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(member);
    });

    return Array.from(groupMap.entries())
      .map(([id, groupMembers]) => ({
        id,
        name: id === 'unassigned' ? 'Non assigné' : id,
        members: groupMembers,
        stats: calculateGroupStats(groupMembers),
      }))
      .sort((a, b) => {
        if (a.id === 'unassigned') return 1;
        if (b.id === 'unassigned') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [members, groupBy]);

  // If no grouping, just render members directly
  if (groupBy === 'none') {
    return (
      <div className="divide-y divide-border/50">
        {members.map((member, index) => renderMemberRow(member, index))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Expand/Collapse all controls */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg">
        <span className="text-xs font-medium text-muted-foreground">
          {groups.length} groupe{groups.length > 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={expandAll}
        >
          Tout déplier
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={collapseAll}
        >
          Tout replier
        </Button>
      </div>

      {/* Groups */}
      {groups.map(group => (
        <Collapsible
          key={group.id}
          open={expandedGroups.has(group.id)}
          onOpenChange={() => toggleGroup(group.id)}
        >
          <CollapsibleTrigger asChild>
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
              "bg-card border border-keon-200 hover:bg-muted/50",
              expandedGroups.has(group.id) && "rounded-b-none border-b-0"
            )}>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0 shrink-0">
                {expandedGroups.has(group.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>

              {/* Group icon */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                "bg-gradient-to-br from-primary/10 to-primary/5"
              )}>
                {groupBy === 'company' ? (
                  <Building2 className="h-4 w-4 text-primary" />
                ) : groupBy === 'department' ? (
                  <Briefcase className="h-4 w-4 text-primary" />
                ) : (
                  <Users className="h-4 w-4 text-primary" />
                )}
              </div>

              {/* Group name */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{group.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {group.members.length} collaborateur{group.members.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Stats summary */}
              <WorkloadSummaryChip
                taskCount={group.stats.taskCount}
                leaveCount={group.stats.leaveCount}
                overloadedCount={group.stats.overloadedCount}
              />

              {/* Average capacity badge */}
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] font-bold",
                  group.stats.avgCapacity > 100 && "border-red-300 text-red-700 bg-red-50",
                  group.stats.avgCapacity >= 80 && group.stats.avgCapacity <= 100 && "border-amber-300 text-amber-700 bg-amber-50",
                  group.stats.avgCapacity < 80 && "border-emerald-300 text-emerald-700 bg-emerald-50"
                )}
              >
                {group.stats.avgCapacity}% moy.
              </Badge>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className={cn(
              "border border-keon-200 border-t-0 rounded-b-lg overflow-hidden",
              "divide-y divide-border/50"
            )}>
              {group.members.map((member, index) => renderMemberRow(member, index))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

// Calculate group statistics
function calculateGroupStats(members: TeamMemberWorkload[]) {
  let taskCount = 0;
  let leaveCount = 0;
  let overloadedCount = 0;
  let totalCapacity = 0;

  members.forEach(member => {
    taskCount += member.usedSlots || 0;
    leaveCount += member.leaveSlots || 0;
    
    const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
    const percentage = available > 0 ? Math.round((member.usedSlots / available) * 100) : 0;
    totalCapacity += percentage;
    
    if (percentage > 100) overloadedCount++;
  });

  return {
    taskCount,
    leaveCount,
    overloadedCount,
    avgCapacity: members.length > 0 ? Math.round(totalCapacity / members.length) : 0,
  };
}
