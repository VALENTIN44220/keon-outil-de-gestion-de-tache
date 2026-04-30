import { useMemo } from 'react';
import {
  startOfYear,
  startOfMonth,
  startOfWeek,
  subMonths,
  format,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CalendarRange } from 'lucide-react';

export type BEPeriodMode =
  | 'all'
  | 'this_year'
  | 'last_12m'
  | 'this_month'
  | 'last_30d'
  | 'this_week'
  | 'custom';

export interface BEPeriodValue {
  mode: BEPeriodMode;
  /** Date from (ISO yyyy-MM-dd), null = pas de borne. */
  from: string | null;
  /** Date to (ISO yyyy-MM-dd), null = pas de borne. */
  to: string | null;
  /** Custom start date as ISO string. */
  customStart?: string;
  /** Custom end date as ISO string. */
  customEnd?: string;
}

/** Calcule le range from/to selon le mode. */
export function computePeriodRange(
  mode: BEPeriodMode,
  customStart?: string,
  customEnd?: string,
): { from: string | null; to: string | null } {
  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (mode) {
    case 'all':
      return { from: null, to: null };
    case 'this_year':
      return { from: fmt(startOfYear(today)), to: fmt(today) };
    case 'last_12m':
      return { from: fmt(subMonths(today, 12)), to: fmt(today) };
    case 'this_month':
      return { from: fmt(startOfMonth(today)), to: fmt(today) };
    case 'last_30d':
      return { from: fmt(subMonths(today, 1)), to: fmt(today) };
    case 'this_week':
      return { from: fmt(startOfWeek(today, { locale: fr })), to: fmt(today) };
    case 'custom':
      return { from: customStart || null, to: customEnd || null };
    default:
      return { from: null, to: null };
  }
}

interface BEPeriodSelectorProps {
  value: BEPeriodValue;
  onChange: (v: BEPeriodValue) => void;
  /** Affichage compact (label court). Defaut : false. */
  compact?: boolean;
}

/**
 * Selecteur de periode pour filtrer les KPIs (Temps, CA, COGS) par date.
 * Modes : Tout / Annee / 12 derniers mois / Mois / 30 jours / Semaine / Custom
 */
export function BEPeriodSelector({ value, onChange, compact }: BEPeriodSelectorProps) {
  const handleModeChange = (mode: BEPeriodMode) => {
    const range = computePeriodRange(mode, value.customStart, value.customEnd);
    onChange({
      mode,
      from: range.from,
      to: range.to,
      customStart: value.customStart,
      customEnd: value.customEnd,
    });
  };

  const handleCustomChange = (key: 'customStart' | 'customEnd', val: string) => {
    const updated = { ...value, [key]: val };
    if (value.mode === 'custom') {
      const range = computePeriodRange('custom', updated.customStart, updated.customEnd);
      updated.from = range.from;
      updated.to = range.to;
    }
    onChange(updated);
  };

  const labelMap: Record<BEPeriodMode, string> = {
    all: 'Tout',
    this_year: 'Année',
    last_12m: '12 derniers mois',
    this_month: 'Mois courant',
    last_30d: '30 derniers jours',
    this_week: 'Semaine courante',
    custom: 'Personnalisé',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select value={value.mode} onValueChange={(v) => handleModeChange(v as BEPeriodMode)}>
        <SelectTrigger className={compact ? 'h-7 w-[150px] text-xs' : 'h-8 w-[180px] text-xs'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(labelMap) as [BEPeriodMode, string][]).map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.mode === 'custom' && (
        <>
          <Input
            type="date"
            value={value.customStart ?? ''}
            onChange={(e) => handleCustomChange('customStart', e.target.value)}
            className={compact ? 'h-7 w-[130px] text-xs' : 'h-8 w-[140px] text-xs'}
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={value.customEnd ?? ''}
            onChange={(e) => handleCustomChange('customEnd', e.target.value)}
            className={compact ? 'h-7 w-[130px] text-xs' : 'h-8 w-[140px] text-xs'}
          />
        </>
      )}
    </div>
  );
}
