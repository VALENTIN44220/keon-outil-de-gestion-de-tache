import { useState, useEffect, useMemo } from 'react';
import { CrossFilters, DEFAULT_CROSS_FILTERS } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Building2, 
  Tags, 
  Filter, 
  X, 
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
  Save,
  FolderOpen,
  Trash2,
  Star,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CrossFiltersPanelProps {
  filters: CrossFilters;
  onFiltersChange: (filters: CrossFilters) => void;
  onClose?: () => void;
  processId?: string;
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
  { value: 'to_assign', label: 'À affecter', color: 'bg-amber-500' },
  { value: 'todo', label: 'À faire', color: 'bg-slate-500' },
  { value: 'in-progress', label: 'En cours', color: 'bg-blue-500' },
  { value: 'done', label: 'Terminé', color: 'bg-green-500' },
  { value: 'pending_validation_1', label: 'En attente de validation', color: 'bg-violet-500' },
  { value: 'pending_validation_2', label: 'Validation N2', color: 'bg-violet-500' },
  { value: 'validated', label: 'Validé / Terminé', color: 'bg-emerald-500' },
  { value: 'refused', label: 'Refusé', color: 'bg-red-500' },
  { value: 'review', label: 'À corriger', color: 'bg-purple-500' },
  { value: 'cancelled', label: 'Annulé', color: 'bg-gray-400' },
];

const PRIORITIES = [
  { value: 'urgent', label: 'Urgente', color: 'bg-red-500' },
  { value: 'high', label: 'Haute', color: 'bg-keon-terose' },
  { value: 'medium', label: 'Moyenne', color: 'bg-keon-orange' },
  { value: 'low', label: 'Basse', color: 'bg-keon-green' },
];

interface FilterPreset {
  id: string;
  name: string;
  filters: any;
  is_default?: boolean;
}

function MultiSelectDropdown({
  label,
  icon,
  items,
  selectedIds,
  onChange,
  idKey = 'id',
  labelKey = 'name',
  colorKey,
  colorDotKey,
}: {
  label: string;
  icon?: React.ReactNode;
  items: any[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  idKey?: string;
  labelKey?: string;
  colorKey?: string;
  colorDotKey?: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const noneSelected = selectedIds.length === 0;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => (item[labelKey] || '').toLowerCase().includes(q));
  }, [items, searchQuery, labelKey]);

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      onChange(items.map(i => i[idKey]));
    } else {
      onChange([]);
    }
  };

  const handleToggle = (value: string, checked: boolean) => {
    const updated = checked
      ? [...selectedIds, value]
      : selectedIds.filter(v => v !== value);
    onChange(updated);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-keon-600 flex items-center gap-1">
        {icon}
        {label} ({selectedIds.length})
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-9 justify-between text-sm">
            <span className="truncate">
              {noneSelected ? 'Tous' : `${selectedIds.length} sélectionné(s)`}
            </span>
            <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="h-8 pl-8 text-sm"
                autoFocus
              />
            </div>
            {/* Select All / None */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                id={`all-${label}`}
                checked={allSelected}
                onCheckedChange={(checked) => handleToggleAll(!!checked)}
              />
              <Label htmlFor={`all-${label}`} className="text-sm font-medium cursor-pointer">
                Tous
              </Label>
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {filteredItems.map(item => (
                  <div key={item[idKey]} className="flex items-center gap-2">
                    <Checkbox
                      id={`${label}-${item[idKey]}`}
                      checked={selectedIds.includes(item[idKey])}
                      onCheckedChange={(checked) => handleToggle(item[idKey], !!checked)}
                    />
                    {colorDotKey && (
                      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', item[colorDotKey])} />
                    )}
                    <Label htmlFor={`${label}-${item[idKey]}`} className="text-sm cursor-pointer truncate">
                      {item[labelKey] || 'Sans nom'}
                    </Label>
                  </div>
                ))}
                {filteredItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Aucun résultat</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CrossFiltersPanel({ filters, onFiltersChange, onClose, processId }: CrossFiltersPanelProps) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>([]);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

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

  // Load presets + apply default
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const query = (supabase as any)
        .from('user_filter_presets')
        .select('id, name, filters, is_default')
        .eq('user_id', user.id);
      if (processId) {
        query.eq('process_template_id', processId);
      } else {
        query.is('process_template_id', null);
      }
      const { data } = await query.order('created_at', { ascending: false });
      if (data) {
        setPresets(data);
        // Auto-apply default preset on first load
        const defaultPreset = data.find((p: FilterPreset) => p.is_default);
        if (defaultPreset) {
          const restored: CrossFilters = {
            ...DEFAULT_CROSS_FILTERS,
            ...defaultPreset.filters,
            dateRange: {
              start: defaultPreset.filters.dateRange?.start ? new Date(defaultPreset.filters.dateRange.start) : null,
              end: defaultPreset.filters.dateRange?.end ? new Date(defaultPreset.filters.dateRange.end) : null,
            },
          };
          onFiltersChange(restored);
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, processId]);

  const handleReset = () => {
    onFiltersChange(DEFAULT_CROSS_FILTERS);
  };

  const handleSavePreset = async () => {
    if (!user?.id || !presetName.trim()) return;
    const serialized = {
      ...filters,
      dateRange: {
        start: filters.dateRange.start?.toISOString() ?? null,
        end: filters.dateRange.end?.toISOString() ?? null,
      },
    };
    const { data, error } = await (supabase as any)
      .from('user_filter_presets')
      .insert({
        user_id: user.id,
        name: presetName.trim(),
        filters: serialized,
        process_template_id: processId ?? null,
      })
      .select('id, name, filters')
      .single();
    if (error) {
      toast.error('Erreur lors de la sauvegarde');
      return;
    }
    setPresets(prev => [data, ...prev]);
    setPresetName('');
    setShowSavePreset(false);
    toast.success('Contexte enregistré');
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    const restored: CrossFilters = {
      ...DEFAULT_CROSS_FILTERS,
      ...preset.filters,
      dateRange: {
        start: preset.filters.dateRange?.start ? new Date(preset.filters.dateRange.start) : null,
        end: preset.filters.dateRange?.end ? new Date(preset.filters.dateRange.end) : null,
      },
    };
    onFiltersChange(restored);
    toast.success(`Contexte "${preset.name}" appliqué`);
  };

  const handleDeletePreset = async (presetId: string) => {
    await (supabase as any).from('user_filter_presets').delete().eq('id', presetId);
    setPresets(prev => prev.filter(p => p.id !== presetId));
    toast.success('Contexte supprimé');
  };

  const handleSetDefault = async (presetId: string) => {
    if (!user?.id) return;
    // Remove current default for this context
    const clearQuery = (supabase as any)
      .from('user_filter_presets')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_default', true);
    if (processId) {
      clearQuery.eq('process_template_id', processId);
    } else {
      clearQuery.is('process_template_id', null);
    }
    await clearQuery;

    const clickedPreset = presets.find(p => p.id === presetId);
    const wasDefault = clickedPreset?.is_default;

    if (!wasDefault) {
      await (supabase as any)
        .from('user_filter_presets')
        .update({ is_default: true })
        .eq('id', presetId);
    }

    setPresets(prev => prev.map(p => ({
      ...p,
      is_default: wasDefault ? false : p.id === presetId,
    })));
    toast.success(wasDefault ? 'Contexte par défaut retiré' : 'Contexte défini par défaut');
  };

  const activeFiltersCount = 
    (filters.searchQuery ? 1 : 0) +
    filters.assigneeIds.length + 
    filters.departmentIds.length + 
    filters.categoryIds.length + 
    filters.processIds.length + 
    filters.statuses.length + 
    filters.priorities.length +
    (filters.dateRange.start ? 1 : 0);

  // Status/Priority items formatted for MultiSelectDropdown
  const statusItems = STATUSES.map(s => ({ id: s.value, name: s.label, color: s.color }));
  const priorityItems = PRIORITIES.map(p => ({ id: p.value, name: p.label, color: p.color }));

  return (
    <div className="bg-gradient-to-r from-white to-keon-50 border-2 border-keon-200 rounded-xl p-4 mb-4 shadow-keon">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          {collapsed ? <ChevronDown className="h-4 w-4 text-keon-600" /> : <ChevronUp className="h-4 w-4 text-keon-600" />}
          <Filter className="h-5 w-5 text-keon-blue" />
          <h3 className="font-semibold text-keon-900">Filtres croisés</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="bg-keon-blue">
              {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
            </Badge>
          )}
        </button>
        <div className="flex items-center gap-2">
          {/* Preset selector */}
          {presets.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-keon-600">
                  <FolderOpen className="h-4 w-4" />
                  Contextes
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-1">
                  {presets.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-1 p-1.5 rounded hover:bg-muted">
                      <button
                        className="text-sm text-left flex-1 truncate"
                        onClick={() => handleLoadPreset(p)}
                      >
                        {p.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleSetDefault(p.id)}
                        title={p.is_default ? 'Retirer comme défaut' : 'Définir par défaut'}
                      >
                        <Star className={cn('h-3 w-3', p.is_default ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleDeletePreset(p.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {/* Save preset */}
          <Popover open={showSavePreset} onOpenChange={setShowSavePreset}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-keon-600">
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-2">
                <Label className="text-xs">Nom du contexte</Label>
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Ex: Vue département IT"
                  className="h-8"
                />
                <Button size="sm" className="w-full" onClick={handleSavePreset} disabled={!presetName.trim()}>
                  Enregistrer
                </Button>
              </div>
            </PopoverContent>
          </Popover>
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

      {/* Filters grid - collapsible */}
      {!collapsed && (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end mt-3">
        {/* Search */}
        <div className="space-y-1.5 col-span-2 md:col-span-1">
          <Label className="text-xs text-keon-600 flex items-center gap-1">
            <Search className="h-3 w-3" />
            Recherche
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filters.searchQuery}
              onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
              placeholder="Rechercher..."
              className="h-9 pl-8"
            />
          </div>
        </div>

        {/* Period */}
        <div className="space-y-1.5">
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
        <div className="space-y-1.5">
          <Label className="text-xs text-keon-600">Plage de dates</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 justify-start text-left font-normal text-sm">
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
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
        <MultiSelectDropdown
          label="Assignés"
          icon={<Users className="h-3 w-3" />}
          items={profiles}
          selectedIds={filters.assigneeIds}
          onChange={(ids) => onFiltersChange({ ...filters, assigneeIds: ids })}
          labelKey="display_name"
        />

        {/* Departments */}
        <MultiSelectDropdown
          label="Départements"
          icon={<Building2 className="h-3 w-3" />}
          items={departments}
          selectedIds={filters.departmentIds}
          onChange={(ids) => onFiltersChange({ ...filters, departmentIds: ids })}
        />

        {/* Categories */}
        <MultiSelectDropdown
          label="Catégories"
          icon={<Tags className="h-3 w-3" />}
          items={categories}
          selectedIds={filters.categoryIds}
          onChange={(ids) => onFiltersChange({ ...filters, categoryIds: ids })}
        />

        {/* Status */}
        <MultiSelectDropdown
          label="Statut"
          items={statusItems}
          selectedIds={filters.statuses as string[]}
          onChange={(ids) => onFiltersChange({ ...filters, statuses: ids as any })}
          colorDotKey="color"
        />

        {/* Priority */}
        <MultiSelectDropdown
          label="Priorité"
          items={priorityItems}
          selectedIds={filters.priorities as string[]}
          onChange={(ids) => onFiltersChange({ ...filters, priorities: ids as any })}
          colorDotKey="color"
        />
      </div>
      )}
    </div>
  );
}
