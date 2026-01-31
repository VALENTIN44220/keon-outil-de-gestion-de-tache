import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Users,
  Layers,
  CheckCircle2,
  Flag,
  Palmtree,
  ListFilter,
  X,
  Building2,
  AlertTriangle,
  Zap,
  RotateCcw,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { WorkloadFiltersState, ItemTypeFilter } from '@/hooks/useWorkloadFilters';

interface WorkloadAdvancedFiltersProps {
  filters: WorkloadFiltersState;
  onSearchChange: (query: string) => void;
  onUserIdsChange: (ids: string[]) => void;
  onProcessIdChange: (id: string | null) => void;
  onCompanyIdChange: (id: string | null) => void;
  onDepartmentIdChange: (id: string | null) => void;
  onStatusesChange: (statuses: string[]) => void;
  onPrioritiesChange: (priorities: string[]) => void;
  onItemTypeChange: (type: ItemTypeFilter) => void;
  onShowOnlyOverloadedChange: (show: boolean) => void;
  onShowOnlyWithConflictsChange: (show: boolean) => void;
  onClearFilters: () => void;
  teamMembers: any[];
  hasActiveFilters: boolean;
  activeFiltersCount: number;
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'À faire', color: 'bg-slate-500' },
  { value: 'in-progress', label: 'En cours', color: 'bg-blue-500' },
  { value: 'to_assign', label: 'À affecter', color: 'bg-amber-500' },
  { value: 'pending-validation', label: 'En validation', color: 'bg-purple-500' },
  { value: 'done', label: 'Terminé', color: 'bg-emerald-500' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgente', color: 'bg-red-500' },
  { value: 'high', label: 'Haute', color: 'bg-orange-500' },
  { value: 'medium', label: 'Moyenne', color: 'bg-blue-500' },
  { value: 'low', label: 'Basse', color: 'bg-emerald-500' },
];

export function WorkloadAdvancedFilters({
  filters,
  onSearchChange,
  onUserIdsChange,
  onProcessIdChange,
  onCompanyIdChange,
  onDepartmentIdChange,
  onStatusesChange,
  onPrioritiesChange,
  onItemTypeChange,
  onShowOnlyOverloadedChange,
  onShowOnlyWithConflictsChange,
  onClearFilters,
  teamMembers,
  hasActiveFilters,
  activeFiltersCount,
}: WorkloadAdvancedFiltersProps) {
  const [processes, setProcesses] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);

  useEffect(() => {
    const fetchFilters = async () => {
      const [processRes, companyRes, deptRes] = await Promise.all([
        supabase.from('process_templates').select('id, name').order('name'),
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('departments').select('id, name, company_id').order('name'),
      ]);
      setProcesses(processRes.data || []);
      setCompanies(companyRes.data || []);
      setDepartments(deptRes.data || []);
    };
    fetchFilters();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  const handleUserToggle = (userId: string) => {
    if (filters.selectedUserIds.includes(userId)) {
      onUserIdsChange(filters.selectedUserIds.filter(id => id !== userId));
    } else {
      onUserIdsChange([...filters.selectedUserIds, userId]);
    }
  };

  const handleStatusToggle = (status: string) => {
    if (filters.selectedStatuses.includes(status)) {
      onStatusesChange(filters.selectedStatuses.filter(s => s !== status));
    } else {
      onStatusesChange([...filters.selectedStatuses, status]);
    }
  };

  const handlePriorityToggle = (priority: string) => {
    if (filters.selectedPriorities.includes(priority)) {
      onPrioritiesChange(filters.selectedPriorities.filter(p => p !== priority));
    } else {
      onPrioritiesChange([...filters.selectedPriorities, priority]);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filter departments by selected company
  const filteredDepartments = useMemo(() => {
    if (!filters.selectedCompanyId) return departments;
    return departments.filter(d => d.company_id === filters.selectedCompanyId);
  }, [departments, filters.selectedCompanyId]);

  return (
    <div className="space-y-3">
      {/* Main filter row - sticky */}
      <div className="workload-filter-bar sticky top-0 z-20 bg-card/95 backdrop-blur-sm">
        {/* Global search */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher tâches, congés..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-9 bg-keon-50 border-keon-200 focus-visible:ring-1 focus-visible:ring-primary text-sm"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Separator orientation="vertical" className="h-6 bg-keon-200" />

        {/* Item type filter - segmented */}
        <div className="flex items-center rounded-lg bg-muted p-0.5">
          {([
            { value: 'all', label: 'Tout', icon: Layers },
            { value: 'tasks', label: 'Tâches', icon: CheckCircle2 },
            { value: 'leaves', label: 'Congés', icon: Palmtree },
          ] as const).map(({ value, label, icon: Icon }) => (
            <Button 
              key={value}
              variant="ghost"
              size="sm" 
              onClick={() => onItemTypeChange(value)}
              className={cn(
                "h-8 px-3 gap-1.5 text-xs font-medium rounded-md",
                filters.itemType === value 
                  ? "bg-primary text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6 bg-keon-200" />

        {/* Collaborators filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={filters.selectedUserIds.length > 0 ? "default" : "outline"} 
              size="sm" 
              className={cn(
                "h-8 gap-2",
                filters.selectedUserIds.length > 0 && "bg-primary/90"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs hidden sm:inline">Collaborateurs</span>
              {filters.selectedUserIds.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-white/20 text-white">
                  {filters.selectedUserIds.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-3 border-b">
              <h4 className="text-sm font-semibold">Filtrer par collaborateur</h4>
              <p className="text-xs text-muted-foreground">Sélectionnez les personnes à afficher</p>
            </div>
            <ScrollArea className="h-[280px]">
              <div className="p-2 space-y-1">
                {teamMembers.map(member => (
                  <label 
                    key={member.id} 
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                      filters.selectedUserIds.includes(member.id) 
                        ? "bg-primary/10" 
                        : "hover:bg-muted"
                    )}
                  >
                    <Checkbox
                      checked={filters.selectedUserIds.includes(member.id)}
                      onCheckedChange={() => handleUserToggle(member.id)}
                    />
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="text-xs bg-muted">
                        {getInitials(member.display_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.display_name}</p>
                      {member.job_title && (
                        <p className="text-xs text-muted-foreground truncate">{member.job_title}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            {filters.selectedUserIds.length > 0 && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onUserIdsChange([])}
                  className="w-full text-xs"
                >
                  Effacer la sélection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Status filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={filters.selectedStatuses.length > 0 ? "default" : "outline"} 
              size="sm" 
              className={cn(
                "h-8 gap-2",
                filters.selectedStatuses.length > 0 && "bg-primary/90"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-xs hidden sm:inline">Statut</span>
              {filters.selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-white/20 text-white">
                  {filters.selectedStatuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <div className="p-3 border-b">
              <h4 className="text-sm font-semibold">Filtrer par statut</h4>
            </div>
            <div className="p-2 space-y-1">
              {STATUS_OPTIONS.map(status => (
                <label 
                  key={status.value} 
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                    filters.selectedStatuses.includes(status.value) 
                      ? "bg-primary/10" 
                      : "hover:bg-muted"
                  )}
                >
                  <Checkbox
                    checked={filters.selectedStatuses.includes(status.value)}
                    onCheckedChange={() => handleStatusToggle(status.value)}
                  />
                  <div className={cn("w-2.5 h-2.5 rounded-full", status.color)} />
                  <span className="text-sm">{status.label}</span>
                </label>
              ))}
            </div>
            {filters.selectedStatuses.length > 0 && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onStatusesChange([])}
                  className="w-full text-xs"
                >
                  Effacer
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Priority filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={filters.selectedPriorities.length > 0 ? "default" : "outline"} 
              size="sm" 
              className={cn(
                "h-8 gap-2",
                filters.selectedPriorities.length > 0 && "bg-primary/90"
              )}
            >
              <Flag className="h-3.5 w-3.5" />
              <span className="text-xs hidden sm:inline">Priorité</span>
              {filters.selectedPriorities.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-white/20 text-white">
                  {filters.selectedPriorities.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <div className="p-3 border-b">
              <h4 className="text-sm font-semibold">Filtrer par priorité</h4>
            </div>
            <div className="p-2 space-y-1">
              {PRIORITY_OPTIONS.map(priority => (
                <label 
                  key={priority.value} 
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                    filters.selectedPriorities.includes(priority.value) 
                      ? "bg-primary/10" 
                      : "hover:bg-muted"
                  )}
                >
                  <Checkbox
                    checked={filters.selectedPriorities.includes(priority.value)}
                    onCheckedChange={() => handlePriorityToggle(priority.value)}
                  />
                  <div className={cn("w-2.5 h-2.5 rounded-full", priority.color)} />
                  <span className="text-sm">{priority.label}</span>
                </label>
              ))}
            </div>
            {filters.selectedPriorities.length > 0 && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onPrioritiesChange([])}
                  className="w-full text-xs"
                >
                  Effacer
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 bg-keon-200" />

        {/* Quick filters */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={filters.showOnlyOverloaded ? "default" : "outline"} 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0",
                  filters.showOnlyOverloaded && "bg-red-600 hover:bg-red-700"
                )}
                onClick={() => onShowOnlyOverloadedChange(!filters.showOnlyOverloaded)}
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Afficher uniquement les collaborateurs surchargés</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={filters.showOnlyWithConflicts ? "default" : "outline"} 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0",
                  filters.showOnlyWithConflicts && "bg-amber-600 hover:bg-amber-700"
                )}
                onClick={() => onShowOnlyWithConflictsChange(!filters.showOnlyWithConflicts)}
              >
                <Zap className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Afficher uniquement les tâches avec conflits</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-muted-foreground hover:text-destructive"
            onClick={onClearFilters}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-xs hidden sm:inline">Réinitialiser</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
