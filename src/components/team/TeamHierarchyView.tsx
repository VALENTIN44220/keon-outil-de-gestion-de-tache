import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTeamHierarchy, HierarchyNode, TeamMember } from '@/hooks/useTeamHierarchy';
import { 
  Users, 
  ChevronDown, 
  ChevronRight, 
  User, 
  Crown, 
  UserCheck,
  Loader2,
  Building2,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

const getInitials = (name: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

interface HierarchyNodeCardProps {
  node: HierarchyNode;
  level: number;
}

function HierarchyNodeCard({ node, level }: HierarchyNodeCardProps) {
  const [isOpen, setIsOpen] = useState(level < 2 || node.isCurrentUser);
  const hasSubordinates = node.subordinates.length > 0;

  const relationColors: Record<string, string> = {
    self: 'ring-2 ring-primary ring-offset-2',
    manager: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
    subordinate: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
    peer: 'border-blue-400 bg-blue-50 dark:bg-blue-950/30',
    other: '',
  };

  const relationBadges: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    self: { label: 'Vous', variant: 'default' },
    manager: { label: 'N+' + (level === 0 ? '' : level), variant: 'outline' },
    subordinate: { label: 'N-1', variant: 'secondary' },
    peer: { label: 'Pair', variant: 'outline' },
    other: { label: '', variant: 'outline' },
  };

  return (
    <div className={cn("relative", level > 0 && "ml-8 mt-2")}>
      {/* Connection line */}
      {level > 0 && (
        <div className="absolute left-[-24px] top-6 w-6 border-t-2 border-l-2 border-border rounded-tl-lg h-[calc(100%-24px)]" />
      )}
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div 
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
            relationColors[node.relationToUser]
          )}
        >
          {hasSubordinates && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          )}
          {!hasSubordinates && <div className="w-6" />}
          
          <Avatar className="h-10 w-10">
            <AvatarImage src={node.avatar_url || undefined} alt={node.display_name || 'User'} />
            <AvatarFallback className={cn(
              "text-sm font-medium",
              node.isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {getInitials(node.display_name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{node.display_name || 'Sans nom'}</span>
              {node.relationToUser !== 'other' && relationBadges[node.relationToUser].label && (
                <Badge variant={relationBadges[node.relationToUser].variant} className="text-xs">
                  {node.relationToUser === 'self' && <UserCheck className="h-3 w-3 mr-1" />}
                  {node.relationToUser === 'manager' && <Crown className="h-3 w-3 mr-1" />}
                  {relationBadges[node.relationToUser].label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {node.job_title_info?.name && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {node.job_title_info.name}
                </span>
              )}
              {node.department_info?.name && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {node.department_info.name}
                </span>
              )}
            </div>
          </div>
          
          {hasSubordinates && (
            <Badge variant="outline" className="text-xs">
              {node.subordinates.length} subordonné{node.subordinates.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        {hasSubordinates && (
          <CollapsibleContent>
            <div className="space-y-2 mt-2">
              {node.subordinates.map((sub) => (
                <HierarchyNodeCard key={sub.id} node={sub} level={level + 1} />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

interface MemberCardProps {
  member: TeamMember;
  relation: 'manager' | 'subordinate' | 'peer';
  level?: number;
}

function MemberCard({ member, relation, level }: MemberCardProps) {
  const colors = {
    manager: 'border-l-amber-500',
    subordinate: 'border-l-emerald-500',
    peer: 'border-l-blue-500',
  };

  return (
    <div className={cn("flex items-center gap-3 p-3 bg-card rounded-lg border border-l-4", colors[relation])}>
      <Avatar className="h-9 w-9">
        <AvatarImage src={member.avatar_url || undefined} />
        <AvatarFallback className="text-sm">{getInitials(member.display_name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{member.display_name || 'Sans nom'}</span>
          {relation === 'manager' && level !== undefined && (
            <Badge variant="outline" className="text-xs">N+{level + 1}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {member.job_title_info?.name || member.job_title || 'Poste non défini'}
        </p>
      </div>
    </div>
  );
}

export function TeamHierarchyView() {
  const { hierarchyTree, managers, subordinates, peers, isLoading } = useTeamHierarchy();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left sidebar: Quick view of relations */}
      <div className="space-y-6">
        {/* Managers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Ma ligne hiérarchique
              {managers.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{managers.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {managers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun manager défini</p>
            ) : (
              managers.map((manager, idx) => (
                <MemberCard key={manager.id} member={manager} relation="manager" level={idx} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Peers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Mes pairs
              {peers.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{peers.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {peers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun pair (même N+1)</p>
            ) : (
              peers.map((peer) => (
                <MemberCard key={peer.id} member={peer} relation="peer" />
              ))
            )}
          </CardContent>
        </Card>

        {/* Subordinates summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-500" />
              Mon équipe
              {subordinates.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{subordinates.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
            {subordinates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun subordonné</p>
            ) : (
              subordinates.slice(0, 10).map((sub) => (
                <MemberCard key={sub.id} member={sub} relation="subordinate" />
              ))
            )}
            {subordinates.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Et {subordinates.length - 10} autres...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main: Full hierarchy tree */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Organigramme
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hierarchyTree ? (
              <HierarchyNodeCard node={hierarchyTree} level={0} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Aucune structure hiérarchique disponible
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
