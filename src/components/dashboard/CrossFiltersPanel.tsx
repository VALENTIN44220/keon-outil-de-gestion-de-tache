import { useState, useEffect } from 'react';
import { CrossFilters, DEFAULT_CROSS_FILTERS } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Building2, 
  Tags, 
  Filter, 
  X, 
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface CrossFiltersPanelProps {
  filters: CrossFilters;
  onFiltersChange: (filters: CrossFilters) => void;
  onClose?: () => void;
  onSave?: () => void;
}

const PERIODS = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Tout' },
];

const STATUSES = [
  { value: 'todo', label: 'À faire', color: 'bg-keon-orange' },
  { value: 'in-progress', label: 'En cours', color: 'bg-keon-blue' },
  { value: 'done', label: 'Terminé', color: 'bg-keon-green' },
];

const PRIORITIES = [
  { value: 'urgent', label: 'Urgente', color: 'bg-red-500' },
  { value: 'high', label: 'Haute', color: 'bg-keon-terose' },
  { value: 'medium', label: 'Moyenne', color: 'bg-keon-orange' },
  { value: 'low', label: 'Basse', color: 'bg-keon-green' },
];

export function CrossFiltersPanel({ filters, onFiltersChange, onClose }: CrossFiltersPanelProps) {
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [profilesRes, depsRes, catsRes, procsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').eq('status', 'active'),
        supabase.from('departments').select('id, name'),
        supabase.from('categories').select('id, name'),
        supabase.from('process_templates').select('id, name'),
      ]);
      
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (depsRes.data) setDepartments(depsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
      if (procsRes.data) setProcesses(procsRes.data);
    };
    fetchData();
  }, []);

  const handleReset = () => {
    onFiltersChange(DEFAULT_CROSS_FILTERS);
  };

  const handleMultiSelect = (
    key: 'assigneeIds' | 'departmentIds' | 'categoryIds' | 'processIds',
    value: string,
    checked: boolean
  ) => {
    const current = filters[key];
    const updated = checked
      ? [...current, value]
      : current.filter(v => v !== value);
    onFiltersChange({ ...filters, [key]: updated });
  };

  const handleStatusToggle = (status: string, checked: boolean) => {
    const updated = checked
      ? [...filters.statuses, status as any]
      : filters.statuses.filter(s => s !== status);
    onFiltersChange({ ...filters, statuses: updated });
  };

  const handlePriorityToggle = (priority: string, checked: boolean) => {
    const updated = checked
      ? [...filters.priorities, priority as any]
      : filters.priorities.filter(p => p !== priority);
    onFiltersChange({ ...filters, priorities: updated });
  };

  const activeFiltersCount = 
    filters.assigneeIds.length + 
    filters.departmentIds.length + 
    filters.categoryIds.length + 
    filters.processIds.length + 
    filters.statuses.length + 
    filters.priorities.length +
    (filters.dateRange.start ? 1 : 0);

  return (
    <div className="bg-gradient-to-r from-white to-keon-50 border-2 border-keon-200 rounded-xl p-4 mb-4 shadow-keon">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-keon-blue" />
          <h3 className="font-semibold text-keon-900">Filtres croisés</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="bg-keon-blue">
              {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-keon-600">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Period selector */}
        <div className="space-y-2">
          <Label className="text-xs text-keon-600 flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            Période
          </Label>
          <Select
            value={filters.period}
            onValueChange={(value) => onFiltersChange({ ...filters, period: value as any })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="space-y-2">
          <Label className="text-xs text-keon-600">Plage de dates</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateRange.start ? (
                  filters.dateRange.end ? (
                    <>
                      {format(filters.dateRange.start, 'dd/MM', { locale: fr })} - {format(filters.dateRange.end, 'dd/MM', { locale: fr })}
                    </>
                  ) : (
                    format(filters.dateRange.start, 'dd/MM/yy', { locale: fr })
                  )
                ) : (
                  <span className="text-muted-foreground">Sélectionner</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: filters.dateRange.start || undefined, to: filters.dateRange.end || undefined }}
                onSelect={(range) => onFiltersChange({ 
                  ...filters, 
                  dateRange: { start: range?.from || null, end: range?.to || null } 
                })}
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Assignees */}
        <div className="space-y-2">
          <Label className="text-xs text-keon-600 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Assignés ({filters.assigneeIds.length})
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 justify-between">
                <span className="truncate">
                  {filters.assigneeIds.length > 0 ? `${filters.assigneeIds.length} sélectionné(s)` : 'Tous'}
                </span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {profiles.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`assignee-${p.id}`}
                        checked={filters.assigneeIds.includes(p.id)}
                        onCheckedChange={(checked) => handleMultiSelect('assigneeIds', p.id, !!checked)}
                      />
                      <Label htmlFor={`assignee-${p.id}`} className="text-sm cursor-pointer">
                        {p.display_name || 'Sans nom'}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        {/* Departments */}
        <div className="space-y-2">
          <Label className="text-xs text-keon-600 flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Départements ({filters.departmentIds.length})
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 justify-between">
                <span className="truncate">
                  {filters.departmentIds.length > 0 ? `${filters.departmentIds.length} sélectionné(s)` : 'Tous'}
                </span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {departments.map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`dept-${d.id}`}
                        checked={filters.departmentIds.includes(d.id)}
                        onCheckedChange={(checked) => handleMultiSelect('departmentIds', d.id, !!checked)}
                      />
                      <Label htmlFor={`dept-${d.id}`} className="text-sm cursor-pointer">{d.name}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        {/* Categories */}
        <div className="space-y-2">
          <Label className="text-xs text-keon-600 flex items-center gap-1">
            <Tags className="h-3 w-3" />
            Catégories ({filters.categoryIds.length})
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 justify-between">
                <span className="truncate">
                  {filters.categoryIds.length > 0 ? `${filters.categoryIds.length} sélectionné(s)` : 'Toutes'}
                </span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {categories.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${c.id}`}
                        checked={filters.categoryIds.includes(c.id)}
                        onCheckedChange={(checked) => handleMultiSelect('categoryIds', c.id, !!checked)}
                      />
                      <Label htmlFor={`cat-${c.id}`} className="text-sm cursor-pointer">{c.name}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        {/* Status & Priority toggles */}
        <div className="space-y-2">
          <Label className="text-xs text-keon-600">Statut / Priorité</Label>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map(s => (
              <Badge
                key={s.value}
                variant={filters.statuses.includes(s.value as any) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer text-xs transition-all',
                  filters.statuses.includes(s.value as any) ? s.color + ' text-white' : ''
                )}
                onClick={() => handleStatusToggle(s.value, !filters.statuses.includes(s.value as any))}
              >
                {s.label}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {PRIORITIES.map(p => (
              <Badge
                key={p.value}
                variant={filters.priorities.includes(p.value as any) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer text-xs transition-all',
                  filters.priorities.includes(p.value as any) ? p.color + ' text-white' : ''
                )}
                onClick={() => handlePriorityToggle(p.value, !filters.priorities.includes(p.value as any))}
              >
                {p.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
