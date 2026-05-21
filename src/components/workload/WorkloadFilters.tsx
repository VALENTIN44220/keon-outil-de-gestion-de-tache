import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
  X,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, addWeeks, subWeeks, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export type ItemTypeFilter = 'all' | 'tasks' | 'leaves';

interface WorkloadFiltersProps {
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (start: Date, end: Date, viewMode?: 'week' | 'month' | 'quarter' | 'year') => void;
  selectedUserIds: string[];
  onUserIdsChange: (ids: string[]) => void;
  selectedProcessId: string | null;
  onProcessIdChange: (id: string | null) => void;
  selectedCompanyId: string | null;
  onCompanyIdChange: (id: string | null) => void;
  teamMembers: any[];
  viewMode?: 'week' | 'month' | 'quarter' | 'year';
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedStatuses?: string[];
  onStatusesChange?: (statuses: string[]) => void;
  selectedPriorities?: string[];
  onPrioritiesChange?: (priorities: string[]) => void;
  itemTypeFilter?: ItemTypeFilter;
  onItemTypeChange?: (type: ItemTypeFilter) => void;
  showOnlyOverloaded?: boolean;
  onShowOnlyOverloadedChange?: (show: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: 'to_assign', label: 'À affecter', color: 'bg-amber-500' },
  { value: 'todo', label: 'À faire', color: 'bg-slate-500' },
  { value: 'in-progress', label: 'En cours', color: 'bg-blue-500' },
  { value: 'pending_validation', label: 'En attente de validation', color: 'bg-violet-500' },
  { value: 'validated', label: 'Validé / Terminé', color: 'bg-emerald-500' },
  { value: 'done', label: 'Terminé', color: 'bg-green-500' },
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
  selectedPriorities = [],
  onPrioritiesChange,
  itemTypeFilter = 'all',
  onItemTypeChange,
  showOnlyOverloaded = false,
  onShowOnlyOverloadedChange,
}: WorkloadFiltersProps) {
  const [processes, setProcesses] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: startDate, to: endDate });
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const fetchFilters = async () => {
      const [processRes] = await Promise.all([
        supabase.from('process_templates').select('id, name').order('name'),
      ]);
      setProcesses(processRes.data || []);
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange?.(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  const handlePresetPeriod = (preset: 'week' | 'month' | 'quarter' | 'year') => {
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
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
    }
    setDateRange({ from: start, to: end });
    onDateRangeChange(start, end, preset);
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1;
    let newStart: Date, newEnd: Date;
    switch (viewMode) {
      case 'week':
        newStart = direction === 'prev' ? subWeeks(startDate, 1) : addWeeks(startDate, 1);
        newEnd = direction === 'prev' ? subWeeks(endDate, 1) : addWeeks(endDate, 1);
        break;
      case 'quarter':
        newStart = addMonths(startDate, 3 * offset);
        newEnd = endOfQuarter(newStart);
        break;
      case 'year':
        newStart = addYears(startDate, offset);
        newEnd = endOfYear(newStart);
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

  const goToToday = () => handlePresetPeriod(viewMode);

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

  const clearAllFilters = () => {
    onUserIdsChange([]);
    onProcessIdChange(null);
    onCompanyIdChange(null);
    onStatusesChange?.([]);
    onPrioritiesChange?.([]);
    onItemTypeChange?.('all');
    onShowOnlyOverloadedChange?.(false);
    setLocalSearch('');
  };

  const activeFiltersCount = [
    selectedUserIds.length > 0,
    !!selectedProcessId,
    !!selectedCompanyId,
    selectedStatuses.length > 0,
    selectedPriorities.length > 0,
    itemTypeFilter !== 'all',
    !!localSearch,
    showOnlyOverloaded,
  ].filter(Boolean).length;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const PERIOD_LABELS: Record<string, string> = {
    week: 'Semaine', month: 'Mois', quarter: 'Trim.', year: 'Année',
  };

  return (
    <>
      {/* ── Control bar ── */}
      <div className="flex items-center gap-2 px-4 h-11 bg-white border-b shrink-0">

        {/* Navigation */}
        <div className="flex items-center gap-0 bg-muted rounded-md p-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-background"
            onClick={() => navigatePeriod('prev')}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs font-medium rounded-sm hover:bg-background"
            onClick={goToToday}>
            Aujourd'hui
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-background"
            onClick={() => navigatePeriod('next')}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs font-semibold text-foreground hover:bg-muted">
              <CalendarIcon className="h-3 w-3 text-muted-foreground" />
              {format(startDate, 'd MMM', { locale: fr })} – {format(endDate, 'd MMM yyyy', { locale: fr })}
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

        <Separator orientation="vertical" className="h-4 bg-border mx-0.5" />

        {/* Period presets */}
        <div className="flex items-center gap-0 bg-muted rounded-md p-0.5">
          {(['week', 'month', 'quarter', 'year'] as const).map((preset) => (
            <Button
              key={preset}
              variant="ghost"
              size="sm"
              onClick={() => handlePresetPeriod(preset)}
              className={cn(
                'h-7 px-2.5 text-xs rounded-sm transition-all',
                viewMode === preset
                  ? 'bg-background shadow-sm font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-background/60 font-normal'
              )}
            >
              {PERIOD_LABELS[preset]}
            </Button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Filters button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs border-border"
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtres
          {activeFiltersCount > 0 && (
            <Badge className="h-[16px] min-w-[16px] px-1 text-[10px] rounded-full bg-primary text-primary-foreground">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* ── Filter sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[380px] flex flex-col p-0 gap-0">
          <SheetHeader className="px-5 py-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Filtres
              {activeFiltersCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs ml-1">
                  {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* Search */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recherche</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une tâche..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {localSearch && (
                  <button onClick={() => setLocalSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Type */}
            {onItemTypeChange && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type d'élément</p>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  {([
                    { value: 'all', label: 'Tout', icon: ListFilter },
                    { value: 'tasks', label: 'Tâches', icon: CheckCircle2 },
                    { value: 'leaves', label: 'Congés', icon: Palmtree },
                  ] as const).map(({ value, label, icon: Icon }) => (
                    <Button key={value} variant="ghost" size="sm"
                      onClick={() => onItemTypeChange(value)}
                      className={cn('flex-1 h-8 text-xs gap-1.5',
                        itemTypeFilter === value ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
                      )}>
                      <Icon className="h-3 w-3" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Collaborateurs */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Collaborateurs
                </p>
                {selectedUserIds.length > 0 && (
                  <button onClick={() => onUserIdsChange([])}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                    <X className="h-3 w-3" /> Effacer
                  </button>
                )}
              </div>
              <ScrollArea className="h-[160px] rounded-lg border">
                <div className="p-2 space-y-0.5">
                  {teamMembers.map(member => (
                    <label key={member.id}
                      className={cn('flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors',
                        selectedUserIds.includes(member.id) ? 'bg-primary/10' : 'hover:bg-muted'
                      )}>
                      <Checkbox
                        checked={selectedUserIds.includes(member.id)}
                        onCheckedChange={() => handleUserToggle(member.id)}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="text-[10px] bg-muted">
                          {getInitials(member.display_name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-none truncate">{member.display_name}</p>
                        {member.job_title && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{member.job_title}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Processus */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Processus
                </p>
                {selectedProcessId && (
                  <button onClick={() => onProcessIdChange(null)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                    <X className="h-3 w-3" /> Effacer
                  </button>
                )}
              </div>
              <ScrollArea className="h-[140px] rounded-lg border">
                <div className="p-2 space-y-0.5">
                  <button onClick={() => onProcessIdChange(null)}
                    className={cn('w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      !selectedProcessId ? 'bg-primary/10 font-medium' : 'hover:bg-muted text-muted-foreground'
                    )}>
                    Tous les processus
                  </button>
                  {processes.map(p => (
                    <button key={p.id} onClick={() => onProcessIdChange(p.id)}
                      className={cn('w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        selectedProcessId === p.id ? 'bg-primary/10 font-medium' : 'hover:bg-muted text-muted-foreground'
                      )}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Statut */}
            {onStatusesChange && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Statut
                  </p>
                  {selectedStatuses.length > 0 && (
                    <button onClick={() => onStatusesChange([])}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                      <X className="h-3 w-3" /> Effacer
                    </button>
                  )}
                </div>
                <div className="rounded-lg border p-2 space-y-0.5">
                  {STATUS_OPTIONS.map(status => (
                    <label key={status.value}
                      className={cn('flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors',
                        selectedStatuses.includes(status.value) ? 'bg-primary/10' : 'hover:bg-muted'
                      )}>
                      <Checkbox
                        checked={selectedStatuses.includes(status.value)}
                        onCheckedChange={() => handleStatusToggle(status.value)}
                      />
                      <div className={cn('w-2 h-2 rounded-full shrink-0', status.color)} />
                      <span className="text-sm">{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Surcharge */}
            {onShowOnlyOverloadedChange && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alertes</p>
                <label className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  showOnlyOverloaded ? 'border-red-300 bg-red-50' : 'hover:bg-muted'
                )}>
                  <Checkbox
                    checked={showOnlyOverloaded}
                    onCheckedChange={(v) => onShowOnlyOverloadedChange(!!v)}
                  />
                  <AlertTriangle className={cn('h-4 w-4', showOnlyOverloaded ? 'text-red-500' : 'text-muted-foreground')} />
                  <span className="text-sm">Afficher uniquement les surchargés</span>
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          {activeFiltersCount > 0 && (
            <div className="p-4 border-t shrink-0">
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5" onClick={clearAllFilters}>
                <X className="h-3.5 w-3.5" />
                Réinitialiser tous les filtres ({activeFiltersCount})
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
