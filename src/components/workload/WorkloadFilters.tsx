import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

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
}

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
}: WorkloadFiltersProps) {
  const [processes, setProcesses] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: startDate, to: endDate });

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
        start = startOfMonth(now);
        end = endOfMonth(addMonths(now, 2));
        break;
    }
    
    setDateRange({ from: start, to: end });
    onDateRangeChange(start, end, preset);
  };

  const handleUserToggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onUserIdsChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onUserIdsChange([...selectedUserIds, userId]);
    }
  };

  const clearFilters = () => {
    onUserIdsChange([]);
    onProcessIdChange(null);
    onCompanyIdChange(null);
  };

  const hasActiveFilters = selectedUserIds.length > 0 || selectedProcessId || selectedCompanyId;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
      {/* Period presets */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => handlePresetPeriod('week')}>
          Semaine
        </Button>
        <Button variant="outline" size="sm" onClick={() => handlePresetPeriod('month')}>
          Mois
        </Button>
        <Button variant="outline" size="sm" onClick={() => handlePresetPeriod('quarter')}>
          Trimestre
        </Button>
      </div>

      {/* Custom date range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            {format(startDate, 'dd MMM', { locale: fr })} - {format(endDate, 'dd MMM yyyy', { locale: fr })}
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
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <div className="h-6 w-px bg-border" />

      {/* Company filter */}
      <Select value={selectedCompanyId || '__all__'} onValueChange={(v) => onCompanyIdChange(v === '__all__' ? null : v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Société" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Toutes les sociétés</SelectItem>
          {companies.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* User filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Collaborateurs
            {selectedUserIds.length > 0 && (
              <Badge variant="secondary" className="ml-1">{selectedUserIds.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 max-h-80 overflow-y-auto">
          <div className="space-y-2">
            {teamMembers.map(member => (
              <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(member.id)}
                  onChange={() => handleUserToggle(member.id)}
                  className="rounded"
                />
                <span className="text-sm">{member.display_name}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Process filter */}
      <Select value={selectedProcessId || '__all__'} onValueChange={(v) => onProcessIdChange(v === '__all__' ? null : v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Processus" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Tous les processus</SelectItem>
          {processes.map(p => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
          <X className="h-4 w-4" />
          Effacer
        </Button>
      )}
    </div>
  );
}
