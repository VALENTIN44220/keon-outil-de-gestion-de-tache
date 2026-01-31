import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Users, 
  Layers, 
  CheckCircle2,
  Palmtree,
  ListFilter,
  X
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, addWeeks, subWeeks, subMonths, startOfQuarter, endOfQuarter, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

export type ItemTypeFilter = 'all' | 'tasks' | 'leaves';

interface WorkloadFiltersProps {
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (start: Date, end: Date, viewMode?: 'week' | 'month' | 'quarter') => void;
  selectedUserIds: string[];
  onUserIdsChange: (ids: string[]) => void;
  selectedProcessId: string | null;
  onProcessIdChange: (id: string | null) => void;
  selectedCompanyId: string | null;
  onCompanyIdChange: (id: string | null) => void;
  teamMembers: any[];
  viewMode?: 'week' | 'month' | 'quarter';
  // New filters
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedStatuses?: string[];
  onStatusesChange?: (statuses: string[]) => void;
  itemTypeFilter?: ItemTypeFilter;
  onItemTypeChange?: (type: ItemTypeFilter) => void;
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'À faire', color: 'bg-slate-500' },
  { value: 'in-progress', label: 'En cours', color: 'bg-blue-500' },
  { value: 'to_assign', label: 'À affecter', color: 'bg-amber-500' },
  { value: 'pending_validation_1', label: 'En validation', color: 'bg-purple-500' },
  { value: 'done', label: 'Terminé', color: 'bg-emerald-500' },
];

export function WorkloadFilters({
  startDate,
  endDate,
  onDateRangeChange,
  selectedUserIds,
  onUserIdsChange,
  selectedProcessId,
  onProcessIdChange,
  selectedCompanyId,
  onCompanyIdChange,
  teamMembers,
  viewMode = 'month',
  searchQuery = '',
  onSearchChange,
  selectedStatuses = [],
  onStatusesChange,
  itemTypeFilter = 'all',
  onItemTypeChange,
}: WorkloadFiltersProps) {
  const [processes, setProcesses] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: startDate, to: endDate });
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    const fetchFilters = async () => {
      const [processRes, companyRes] = await Promise.all([
        supabase.from('process_templates').select('id, name').order('name'),
        supabase.from('companies').select('id, name').order('name'),
      ]);
      setProcesses(processRes.data || []);
      setCompanies(companyRes.data || []);
    };
    fetchFilters();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange?.(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  const handlePresetPeriod = (preset: 'week' | 'month' | 'quarter') => {
    const now = new Date();
    let start: Date, end: Date;
    
    switch (preset) {
      case 'week':
        start = startOfWeek(now, { locale: fr });
        end = endOfWeek(now, { locale: fr });
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'quarter':
        start = startOfQuarter(now);
        end = endOfQuarter(now);
        break;
    }
    
    setDateRange({ from: start, to: end });
    onDateRangeChange(start, end, preset);
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    let newStart: Date, newEnd: Date;
    const offset = direction === 'prev' ? -1 : 1;
    
    switch (viewMode) {
      case 'week':
        newStart = direction === 'prev' ? subWeeks(startDate, 1) : addWeeks(startDate, 1);
        newEnd = direction === 'prev' ? subWeeks(endDate, 1) : addWeeks(endDate, 1);
        break;
      case 'quarter':
        newStart = addMonths(startDate, 3 * offset);
        newEnd = endOfQuarter(newStart);
        break;
      case 'month':
      default:
        newStart = addMonths(startDate, offset);
        newEnd = endOfMonth(newStart);
        break;
    }
    
    setDateRange({ from: newStart, to: newEnd });
    onDateRangeChange(newStart, newEnd, viewMode);
  };

  const goToToday = () => {
    handlePresetPeriod(viewMode);
  };

  const handleUserToggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onUserIdsChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onUserIdsChange([...selectedUserIds, userId]);
    }
  };

  const handleStatusToggle = (status: string) => {
    if (!onStatusesChange) return;
    if (selectedStatuses.includes(status)) {
      onStatusesChange(selectedStatuses.filter(s => s !== status));
    } else {
      onStatusesChange([...selectedStatuses, status]);
    }
  };

  const clearFilters = () => {
    onUserIdsChange([]);
    onProcessIdChange(null);
    onCompanyIdChange(null);
    onStatusesChange?.([]);
    onItemTypeChange?.('all');
    setLocalSearch('');
  };

  const hasActiveFilters = selectedUserIds.length > 0 || selectedProcessId || selectedCompanyId || selectedStatuses.length > 0 || itemTypeFilter !== 'all' || localSearch;
  const activeFiltersCount = [
    selectedUserIds.length > 0,
    !!selectedProcessId,
    !!selectedCompanyId,
    selectedStatuses.length > 0,
    itemTypeFilter !== 'all',
  ].filter(Boolean).length;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-3">
      {/* Main filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-card rounded-xl border shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une tâche..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Period presets */}
        <div className="flex items-center rounded-lg bg-muted p-0.5">
          {(['week', 'month', 'quarter'] as const).map((preset) => (
            <Button 
              key={preset}
              variant="ghost"
              size="sm" 
              onClick={() => handlePresetPeriod(preset)}
              className={cn(
                "h-8 px-3 text-xs font-medium transition-all",
                viewMode === preset 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-transparent"
              )}
            >
              {preset === 'week' ? 'Semaine' : preset === 'month' ? 'Mois' : 'Trimestre'}
            </Button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted"
            onClick={() => navigatePeriod('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="h-8 px-3 text-xs font-medium"
          >
            Aujourd'hui
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted"
            onClick={() => navigatePeriod('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Date range display */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2 font-medium">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="text-xs">
                {format(startDate, 'd MMM', { locale: fr })} - {format(endDate, 'd MMM yyyy', { locale: fr })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to });
                  onDateRangeChange(range.from, range.to);
                }
              }}
              locale={fr}
              className="p-3"
            />
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6" />

        {/* Collaborators filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={selectedUserIds.length > 0 ? "default" : "outline"} 
              size="sm" 
              className={cn(
                "h-8 gap-2",
                selectedUserIds.length > 0 && "bg-primary/90"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs">Collaborateurs</span>
              {selectedUserIds.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-white/20 text-white">
                  {selectedUserIds.length}
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
                      selectedUserIds.includes(member.id) 
                        ? "bg-primary/10" 
                        : "hover:bg-muted"
                    )}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(member.id)}
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
            {selectedUserIds.length > 0 && (
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

        {/* Process filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={selectedProcessId ? "default" : "outline"} 
              size="sm" 
              className={cn(
                "h-8 gap-2",
                selectedProcessId && "bg-primary/90"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="text-xs">
                {selectedProcessId 
                  ? processes.find(p => p.id === selectedProcessId)?.name || 'Processus'
                  : 'Processus'
                }
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="p-3 border-b">
              <h4 className="text-sm font-semibold">Filtrer par processus</h4>
            </div>
            <ScrollArea className="h-[220px]">
              <div className="p-2 space-y-1">
                <button
                  onClick={() => onProcessIdChange(null)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    !selectedProcessId ? "bg-primary/10 font-medium" : "hover:bg-muted"
                  )}
                >
                  Tous les processus
                </button>
                {processes.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onProcessIdChange(p.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      selectedProcessId === p.id ? "bg-primary/10 font-medium" : "hover:bg-muted"
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Status filter */}
        {onStatusesChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={selectedStatuses.length > 0 ? "default" : "outline"} 
                size="sm" 
                className={cn(
                  "h-8 gap-2",
                  selectedStatuses.length > 0 && "bg-primary/90"
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-xs">Statut</span>
                {selectedStatuses.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-white/20 text-white">
                    {selectedStatuses.length}
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
                      selectedStatuses.includes(status.value) 
                        ? "bg-primary/10" 
                        : "hover:bg-muted"
                    )}
                  >
                    <Checkbox
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={() => handleStatusToggle(status.value)}
                    />
                    <div className={cn("w-2.5 h-2.5 rounded-full", status.color)} />
                    <span className="text-sm">{status.label}</span>
                  </label>
                ))}
              </div>
              {selectedStatuses.length > 0 && (
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
        )}

        {/* Type filter: Tasks / Leaves / Both */}
        {onItemTypeChange && (
          <div className="flex items-center rounded-lg bg-muted p-0.5">
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => onItemTypeChange('all')}
              className={cn(
                "h-7 px-2.5 text-xs gap-1.5",
                itemTypeFilter === 'all' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-transparent"
              )}
            >
              <ListFilter className="h-3 w-3" />
              Tout
            </Button>
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => onItemTypeChange('tasks')}
              className={cn(
                "h-7 px-2.5 text-xs gap-1.5",
                itemTypeFilter === 'tasks' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-transparent"
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              Tâches
            </Button>
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => onItemTypeChange('leaves')}
              className={cn(
                "h-7 px-2.5 text-xs gap-1.5",
                itemTypeFilter === 'leaves' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-transparent"
              )}
            >
              <Palmtree className="h-3 w-3" />
              Congés
            </Button>
          </div>
        )}

        {/* Clear all filters */}
        {hasActiveFilters && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters} 
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Effacer ({activeFiltersCount})
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
