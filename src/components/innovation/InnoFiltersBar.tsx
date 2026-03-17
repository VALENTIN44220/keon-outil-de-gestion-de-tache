import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG, type InnoFilters } from './constants';

interface Props {
  filters: InnoFilters;
  onChange: (f: InnoFilters) => void;
  distinctValues: {
    statuses: string[];
    entites: string[];
    codeProjets: string[];
    usages: string[];
  };
}

export function InnoFiltersBar({ filters, onChange, distinctValues }: Props) {
  const set = (patch: Partial<InnoFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Rechercher..."
        value={filters.search}
        onChange={e => set({ search: e.target.value })}
        className="w-52"
      />
      <Select value={filters.status || 'all'} onValueChange={v => set({ status: v })}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous statuts</SelectItem>
          {distinctValues.statuses.map(s => (
            <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.entite || 'all'} onValueChange={v => set({ entite: v })}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Entité" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes entités</SelectItem>
          {distinctValues.entites.map(e => (
            <SelectItem key={e} value={e}>{e}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.codeProjet || 'all'} onValueChange={v => set({ codeProjet: v })}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Code" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous codes</SelectItem>
          {distinctValues.codeProjets.map(c => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.usage || 'all'} onValueChange={v => set({ usage: v })}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Usage" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous usages</SelectItem>
          {distinctValues.usages.map(u => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('gap-1', filters.dateFrom && 'text-foreground')}>
            <CalendarIcon className="w-3.5 h-3.5" />
            {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yy', { locale: fr }) : 'Depuis'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dateFrom}
            onSelect={d => set({ dateFrom: d || undefined })}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('gap-1', filters.dateTo && 'text-foreground')}>
            <CalendarIcon className="w-3.5 h-3.5" />
            {filters.dateTo ? format(filters.dateTo, 'dd/MM/yy', { locale: fr }) : "Jusqu'à"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dateTo}
            onSelect={d => set({ dateTo: d || undefined })}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {(filters.search || filters.status !== 'all' || filters.entite !== 'all' || filters.codeProjet !== 'all' || filters.usage !== 'all' || filters.dateFrom || filters.dateTo) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ search: '', status: 'all', entite: 'all', codeProjet: 'all', usage: 'all', theme: 'all', dateFrom: undefined, dateTo: undefined })}
        >
          <X className="w-3.5 h-3.5 mr-1" /> Effacer
        </Button>
      )}
    </div>
  );
}
