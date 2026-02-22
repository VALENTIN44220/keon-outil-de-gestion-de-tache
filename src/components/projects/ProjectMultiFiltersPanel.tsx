import { useState, useMemo, useEffect } from 'react';
import { BEProject } from '@/types/beProject';
import { ProjectFiltersState, FilterPreset, DEFAULT_PROJECT_FILTERS } from '@/hooks/useProjectFilters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Filter, X, RotateCcw, Search, Save, Trash2, Star,
  ChevronDown, ChevronUp, CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectMultiFiltersPanelProps {
  filters: ProjectFiltersState;
  onFiltersChange: (filters: ProjectFiltersState) => void;
  projects: BEProject[];
  activeFiltersCount: number;
  // Presets
  presets: FilterPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onLoadPreset: (preset: FilterPreset) => void;
  onToggleDefault: (id: string) => void;
  onClear: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'closed', label: 'Clôturé' },
  { value: 'on_hold', label: 'En attente' },
];

const TYPOLOGIE_OPTIONS = [
  { value: 'metha_agricole', label: 'Métha Agricole' },
  { value: 'metha_territoriale', label: 'Métha Territoriale' },
  { value: 'autre', label: 'Autre' },
];

const ACTIONNARIAT_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: 'minoritaire', label: 'Minoritaire' },
  { value: 'majoritaire', label: 'Majoritaire' },
  { value: 'paritaire', label: 'Paritaire' },
];

const DATE_FIELDS = [
  { key: 'date_os_etude', label: 'Date OS Étude' },
  { key: 'date_os_travaux', label: 'Date OS Travaux' },
  { key: 'date_cloture_bancaire', label: 'Clôture Bancaire' },
  { key: 'date_cloture_juridique', label: 'Clôture Juridique' },
];

function MultiSelectFilter({ 
  label, options, selected, onToggle, searchable = false 
}: { 
  label: string; 
  options: { value: string; label: string }[]; 
  selected: string[]; 
  onToggle: (value: string) => void;
  searchable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return options;
    return options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
      {searchable && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      )}
      <ScrollArea className={cn("pr-2", filtered.length > 6 ? "h-36" : "")}>
        <div className="space-y-1">
          {filtered.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer text-sm">
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => onToggle(opt.value)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">Aucun résultat</p>
          )}
        </div>
      </ScrollArea>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(v => {
            const opt = options.find(o => o.value === v);
            return (
              <Badge key={v} variant="secondary" className="text-xs gap-1 pr-1">
                {opt?.label || v}
                <X className="h-3 w-3 cursor-pointer" onClick={() => onToggle(v)} />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DateRangeFilter({
  label, fromValue, toValue, onFromChange, onToChange,
}: {
  label: string;
  fromValue: string | null;
  toValue: string | null;
  onFromChange: (v: string | null) => void;
  onToChange: (v: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
      <div className="flex items-center gap-2">
        <DatePickerSmall value={fromValue} onChange={onFromChange} placeholder="Du" />
        <span className="text-xs text-muted-foreground">→</span>
        <DatePickerSmall value={toValue} onChange={onToChange} placeholder="Au" />
      </div>
    </div>
  );
}

function DatePickerSmall({ value, onChange, placeholder }: { value: string | null; onChange: (v: string | null) => void; placeholder: string }) {
  const date = value ? new Date(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1 flex-1 justify-start", !value && "text-muted-foreground")}>
          <CalendarIcon className="h-3 w-3" />
          {date ? format(date, 'dd/MM/yy') : placeholder}
          {value && <X className="h-3 w-3 ml-auto" onClick={e => { e.stopPropagation(); onChange(null); }} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : null)}
          locale={fr}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

export function ProjectMultiFiltersPanel({
  filters, onFiltersChange, projects, activeFiltersCount,
  presets, onSavePreset, onDeletePreset, onLoadPreset, onToggleDefault, onClear,
}: ProjectMultiFiltersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Extract distinct values from projects
  const paysOptions = useMemo(() => {
    const set = new Set(projects.map(p => p.pays).filter(Boolean) as string[]);
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [projects]);

  const regionOptions = useMemo(() => {
    const set = new Set(projects.map(p => p.region).filter(Boolean) as string[]);
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [projects]);

  const regimeOptions = useMemo(() => {
    const set = new Set(projects.map(p => p.regime_icpe).filter(Boolean) as string[]);
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [projects]);

  const toggleValue = (key: keyof ProjectFiltersState, value: string) => {
    const current = filters[key] as string[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    onSavePreset(presetName.trim());
    setPresetName('');
  };

  return (
    <div className="space-y-0">
      {/* Toggle button */}
      <Button
        variant={activeFiltersCount > 0 ? 'default' : 'outline'}
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Filter className="h-4 w-4" />
        Filtres
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-background/20 text-current">
            {activeFiltersCount}
          </Badge>
        )}
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {/* Panel */}
      {isOpen && (
        <div className="mt-3 rounded-lg border bg-card p-4 shadow-sm space-y-4">
          {/* Presets row */}
          <div className="flex items-center gap-2 flex-wrap border-b pb-3">
            <span className="text-xs font-medium text-muted-foreground">Contextes :</span>
            {presets.map(preset => (
              <div key={preset.id} className="flex items-center gap-0.5">
                <Button
                  variant={preset.is_default ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onLoadPreset(preset)}
                >
                  {preset.is_default && <Star className="h-3 w-3 fill-current" />}
                  {preset.name}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onToggleDefault(preset.id)}
                  title={preset.is_default ? 'Retirer par défaut' : 'Définir par défaut'}
                >
                  <Star className={cn("h-3 w-3", preset.is_default ? "fill-primary text-primary" : "text-muted-foreground")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => onDeletePreset(preset.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <Input
                placeholder="Nom du contexte..."
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                className="h-7 text-xs w-36"
                onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
              />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleSavePreset} disabled={!presetName.trim()}>
                <Save className="h-3 w-3" />
                Sauver
              </Button>
            </div>
          </div>

          {/* Filter grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <MultiSelectFilter
              label="Statut"
              options={STATUS_OPTIONS}
              selected={filters.statuses}
              onToggle={v => toggleValue('statuses', v)}
            />
            <MultiSelectFilter
              label="Pays"
              options={paysOptions}
              selected={filters.pays}
              onToggle={v => toggleValue('pays', v)}
              searchable
            />
            <MultiSelectFilter
              label="Région"
              options={regionOptions}
              selected={filters.regions}
              onToggle={v => toggleValue('regions', v)}
              searchable
            />
            <MultiSelectFilter
              label="Typologie"
              options={TYPOLOGIE_OPTIONS}
              selected={filters.typologies}
              onToggle={v => toggleValue('typologies', v)}
            />
            <MultiSelectFilter
              label="Actionnariat"
              options={ACTIONNARIAT_OPTIONS}
              selected={filters.actionnariats}
              onToggle={v => toggleValue('actionnariats', v)}
            />
            <MultiSelectFilter
              label="Régime ICPE"
              options={regimeOptions}
              selected={filters.regimes_icpe}
              onToggle={v => toggleValue('regimes_icpe', v)}
              searchable
            />
          </div>

          {/* Date filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
            {DATE_FIELDS.map(df => (
              <DateRangeFilter
                key={df.key}
                label={df.label}
                fromValue={(filters as any)[`${df.key}_from`]}
                toValue={(filters as any)[`${df.key}_to`]}
                onFromChange={v => onFiltersChange({ ...filters, [`${df.key}_from`]: v })}
                onToChange={v => onFiltersChange({ ...filters, [`${df.key}_to`]: v })}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={onClear}>
              <RotateCcw className="h-3 w-3" />
              Réinitialiser
            </Button>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setIsOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
