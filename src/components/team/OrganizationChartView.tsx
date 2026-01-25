import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { useTeamHierarchy, HierarchyNode, TeamMember } from '@/hooks/useTeamHierarchy';
import { useAdminData } from '@/hooks/useAdminData';
import { 
  Users, 
  ChevronDown, 
  ChevronRight, 
  UserCheck,
  Loader2,
  Building2,
  Briefcase,
  Search,
  Filter,
  ChevronUp,
  Network
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

interface OrgNodeCardProps {
  node: HierarchyNode;
  level: number;
  searchTerm: string;
  selectedCompanyId: string | null;
  selectedDepartmentId: string | null;
  expandAll: boolean;
}

function OrgNodeCard({ 
  node, 
  level, 
  searchTerm, 
  selectedCompanyId, 
  selectedDepartmentId,
  expandAll 
}: OrgNodeCardProps) {
  const [isOpen, setIsOpen] = useState(level < 2 || expandAll);

  // Update open state when expandAll changes
  useMemo(() => {
    if (expandAll) setIsOpen(true);
  }, [expandAll]);

  const hasSubordinates = node.subordinates.length > 0;

  // Filter subordinates based on company/department
  const filteredSubordinates = useMemo(() => {
    return node.subordinates.filter(sub => {
      if (selectedCompanyId && sub.company_id !== selectedCompanyId) return false;
      if (selectedDepartmentId && sub.department_id !== selectedDepartmentId) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches = 
          sub.display_name?.toLowerCase().includes(term) ||
          sub.job_title_info?.name?.toLowerCase().includes(term) ||
          sub.department_info?.name?.toLowerCase().includes(term);
        if (!matches) {
          // Check if any descendant matches
          const hasMatchingDescendant = (n: HierarchyNode): boolean => {
            if (n.display_name?.toLowerCase().includes(term) ||
                n.job_title_info?.name?.toLowerCase().includes(term) ||
                n.department_info?.name?.toLowerCase().includes(term)) {
              return true;
            }
            return n.subordinates.some(hasMatchingDescendant);
          };
          return hasMatchingDescendant(sub);
        }
      }
      return true;
    });
  }, [node.subordinates, selectedCompanyId, selectedDepartmentId, searchTerm]);

  const matchesSearch = searchTerm ? (
    node.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.job_title_info?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.department_info?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : true;

  // Virtual root styling
  if (node.id === 'virtual-root') {
    return (
      <div className="space-y-3">
        {filteredSubordinates.map((sub) => (
          <OrgNodeCard 
            key={sub.id} 
            node={sub} 
            level={0} 
            searchTerm={searchTerm}
            selectedCompanyId={selectedCompanyId}
            selectedDepartmentId={selectedDepartmentId}
            expandAll={expandAll}
          />
        ))}
      </div>
    );
  }

  const levelColors = [
    'border-l-primary',
    'border-l-blue-500',
    'border-l-emerald-500',
    'border-l-amber-500',
    'border-l-purple-500',
    'border-l-rose-500',
  ];

  const borderColor = levelColors[Math.min(level, levelColors.length - 1)];

  return (
    <div className={cn("relative", level > 0 && "ml-6")}>
      {/* Connection line */}
      {level > 0 && (
        <div className="absolute left-[-20px] top-5 w-5 border-t-2 border-border" />
      )}
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div 
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border border-l-4 bg-card transition-all hover:shadow-sm",
            borderColor,
            node.isCurrentUser && "ring-2 ring-primary ring-offset-2",
            !matchesSearch && searchTerm && "opacity-60"
          )}
        >
          {filteredSubordinates.length > 0 ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-7" />
          )}
          
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={node.avatar_url || undefined} alt={node.display_name || 'User'} />
            <AvatarFallback className={cn(
              "text-sm font-medium",
              node.isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {getInitials(node.display_name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "font-medium truncate",
                matchesSearch && searchTerm && "bg-yellow-200 dark:bg-yellow-900 px-1 rounded"
              )}>
                {node.display_name || 'Sans nom'}
              </span>
              {node.isCurrentUser && (
                <Badge variant="default" className="text-xs shrink-0">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Vous
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {node.job_title_info?.name && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  <span className={cn(
                    matchesSearch && searchTerm && node.job_title_info.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
                    "bg-yellow-200 dark:bg-yellow-900 px-1 rounded"
                  )}>
                    {node.job_title_info.name}
                  </span>
                </span>
              )}
              {node.department_info?.name && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  <span className={cn(
                    matchesSearch && searchTerm && node.department_info.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
                    "bg-yellow-200 dark:bg-yellow-900 px-1 rounded"
                  )}>
                    {node.department_info.name}
                  </span>
                </span>
              )}
            </div>
          </div>
          
          {filteredSubordinates.length > 0 && (
            <Badge variant="outline" className="text-xs shrink-0">
              {filteredSubordinates.length}
            </Badge>
          )}
        </div>
        
        {filteredSubordinates.length > 0 && (
          <CollapsibleContent>
            <div className="space-y-2 mt-2 border-l-2 border-border ml-3 pl-1">
              {filteredSubordinates.map((sub) => (
                <OrgNodeCard 
                  key={sub.id} 
                  node={sub} 
                  level={level + 1}
                  searchTerm={searchTerm}
                  selectedCompanyId={selectedCompanyId}
                  selectedDepartmentId={selectedDepartmentId}
                  expandAll={expandAll}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export function OrganizationChartView() {
  const { hierarchyTree, allMembers, isLoading } = useTeamHierarchy();
  const { companies, departments } = useAdminData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);

  // Filter departments by selected company
  const filteredDepartments = useMemo(() => {
    if (!selectedCompanyId) return departments;
    return departments.filter(d => d.company_id === selectedCompanyId);
  }, [departments, selectedCompanyId]);

  // Reset department when company changes
  const handleCompanyChange = useCallback((value: string) => {
    setSelectedCompanyId(value === '__all__' ? null : value);
    setSelectedDepartmentId(null);
  }, []);

  // Statistics
  const stats = useMemo(() => {
    let members = allMembers;
    if (selectedCompanyId) {
      members = members.filter(m => m.company_id === selectedCompanyId);
    }
    if (selectedDepartmentId) {
      members = members.filter(m => m.department_id === selectedDepartmentId);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      members = members.filter(m => 
        m.display_name?.toLowerCase().includes(term) ||
        m.job_title_info?.name?.toLowerCase().includes(term) ||
        m.department_info?.name?.toLowerCase().includes(term)
      );
    }

    const byDept = new Map<string, number>();
    members.forEach(m => {
      const deptName = m.department_info?.name || 'Non défini';
      byDept.set(deptName, (byDept.get(deptName) || 0) + 1);
    });

    return {
      total: members.length,
      byDepartment: Array.from(byDept.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [allMembers, selectedCompanyId, selectedDepartmentId, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un collaborateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Company filter */}
            <SearchableSelect
              value={selectedCompanyId || '__all__'}
              onValueChange={handleCompanyChange}
              placeholder="Toutes les sociétés"
              searchPlaceholder="Rechercher une société..."
              options={[
                { value: '__all__', label: 'Toutes les sociétés' },
                ...companies.map(c => ({ value: c.id, label: c.name })),
              ]}
            />

            {/* Department filter */}
            <SearchableSelect
              value={selectedDepartmentId || '__all__'}
              onValueChange={(v) => setSelectedDepartmentId(v === '__all__' ? null : v)}
              placeholder="Tous les services"
              searchPlaceholder="Rechercher un service..."
              options={[
                { value: '__all__', label: 'Tous les services' },
                ...filteredDepartments.map(d => ({ value: d.id, label: d.name })),
              ]}
            />

            {/* Expand/Collapse all */}
            <Button 
              variant="outline" 
              onClick={() => setExpandAll(!expandAll)}
              className="gap-2"
            >
              {expandAll ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Tout replier
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Tout déplier
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Collaborateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {stats.byDepartment.slice(0, 5).map(([deptName, count]) => (
          <Card key={deptName}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground truncate" title={deptName}>
                    {deptName}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Org chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Organigramme
          </CardTitle>
          <CardDescription>
            Structure hiérarchique de l'organisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hierarchyTree ? (
            <OrgNodeCard 
              node={hierarchyTree} 
              level={0} 
              searchTerm={searchTerm}
              selectedCompanyId={selectedCompanyId}
              selectedDepartmentId={selectedDepartmentId}
              expandAll={expandAll}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Network className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucune structure hiérarchique disponible</p>
              <p className="text-sm">Vérifiez que les relations manager sont définies</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
