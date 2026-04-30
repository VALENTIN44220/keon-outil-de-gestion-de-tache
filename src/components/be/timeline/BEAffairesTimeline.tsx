import { useMemo } from 'react';
import {
  addDays,
  differenceInDays,
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  format,
  isSameDay,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Flag,
  FileText,
  Receipt,
  Clock,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBEProjectTimelineEvents, type BETimelineEvent } from '@/hooks/useBEProjectTimelineEvents';
import { BE_AFFAIRE_STATUS_CONFIG } from '@/types/beAffaire';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type ZoomLevel = 'month' | 'quarter' | 'year';
type PeriodMode = 'all' | 'current_year' | 'custom';

interface BEAffairesTimelineProps {
  projectId: string | undefined;
  zoom: ZoomLevel;
  onZoomChange: (z: ZoomLevel) => void;
  periodMode: PeriodMode;
  onPeriodModeChange: (m: PeriodMode) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
  searchQuery?: string;
}

const EVENT_CONFIG: Record<
  BETimelineEvent['type'],
  { label: string; icon: React.ElementType; bg: string; ring: string; text: string }
> = {
  demarrage:  { label: 'Démarrage',           icon: Flag,     bg: 'bg-emerald-500', ring: 'ring-emerald-300/50', text: 'text-emerald-700' },
  CCN:        { label: 'Cmd. client (CCN)',    icon: FileText, bg: 'bg-blue-500',    ring: 'ring-blue-300/50',    text: 'text-blue-700' },
  CFN:        { label: 'Cmd. fournisseur (CFN)', icon: FileText, bg: 'bg-orange-500',  ring: 'ring-orange-300/50',  text: 'text-orange-700' },
  FCN:        { label: 'Facture client (FCN)', icon: Receipt,  bg: 'bg-violet-500',  ring: 'ring-violet-300/50',  text: 'text-violet-700' },
  FFN:        { label: 'Facture fournisseur (FFN)', icon: Receipt, bg: 'bg-amber-500',  ring: 'ring-amber-300/50',   text: 'text-amber-700' },
  temps_mois: { label: 'Temps Lucca (mois)',   icon: Clock,    bg: 'bg-slate-400',   ring: 'ring-slate-300/50',   text: 'text-slate-700' },
};

export function BEAffairesTimeline({
  projectId,
  zoom,
  onZoomChange,
  periodMode,
  onPeriodModeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  searchQuery = '',
}: BEAffairesTimelineProps) {
  const { data: rows = [], isLoading } = useBEProjectTimelineEvents(projectId);

  // Filtrage par recherche (code_affaire, libelle)
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.code_affaire.toLowerCase().includes(q) ||
        (r.libelle ?? '').toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  // Date range : selon periodMode + events
  const dateRange = useMemo(() => {
    const today = new Date();
    if (periodMode === 'current_year') {
      return { start: startOfYear(today), end: endOfYear(today) };
    }
    if (periodMode === 'custom' && customStart && customEnd) {
      try {
        return { start: new Date(customStart), end: new Date(customEnd) };
      } catch {
        // fall through
      }
    }
    // All : englobe tous les events + today
    const dates: Date[] = [today];
    for (const r of filteredRows) {
      for (const e of r.events) {
        try {
          dates.push(new Date(e.date));
        } catch {
          // ignore
        }
      }
    }
    if (dates.length === 1) {
      return { start: subDays(today, 90), end: addDays(today, 90) };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return { start: subDays(startOfMonth(min), 5), end: addDays(endOfMonth(max), 10) };
  }, [filteredRows, periodMode, customStart, customEnd]);

  const totalDays = Math.max(1, differenceInDays(dateRange.end, dateRange.start) + 1);

  // Day width selon zoom
  const dayWidth = useMemo(() => {
    switch (zoom) {
      case 'month': return 18;
      case 'quarter': return 8;
      case 'year': return 3.5;
      default: return 18;
    }
  }, [zoom]);

  // Genere la liste des mois pour le header
  const months = useMemo(
    () => eachMonthOfInterval({ start: dateRange.start, end: dateRange.end }),
    [dateRange],
  );

  // Tri : affaires avec le plus de CA en premier
  const sortedRows = useMemo(
    () => [...filteredRows].sort((a, b) => b.total_ca - a.total_ca),
    [filteredRows],
  );

  const today = new Date();
  const todayIdx = differenceInDays(today, dateRange.start);
  const leftPanelWidth = 280;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </CardContent>
      </Card>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-12 text-center text-muted-foreground">
          <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucune affaire à afficher dans la timeline.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border-border/50 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 p-3 border-b bg-muted/20 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">
              Timeline affaires
              <Badge variant="secondary" className="ml-2 text-[10px]">{sortedRows.length}</Badge>
            </h3>
            {/* Légende compacte */}
            <div className="flex items-center gap-2 ml-2 flex-wrap">
              {Object.entries(EVENT_CONFIG).map(([k, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full', cfg.bg)} />
                    {cfg.label.replace(/\s*\(.*\)/, '')}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Periode */}
            <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded">
              {(['all', 'current_year', 'custom'] as PeriodMode[]).map((m) => (
                <Button
                  key={m}
                  variant={periodMode === m ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onPeriodModeChange(m)}
                >
                  {m === 'all' ? 'Tout' : m === 'current_year' ? 'Année' : 'Custom'}
                </Button>
              ))}
            </div>
            {periodMode === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customStart ?? ''}
                  onChange={(e) => onCustomStartChange?.(e.target.value)}
                  className="h-7 w-[120px] text-[11px] rounded border border-input bg-background px-2"
                />
                <span className="text-[11px] text-muted-foreground">→</span>
                <input
                  type="date"
                  value={customEnd ?? ''}
                  onChange={(e) => onCustomEndChange?.(e.target.value)}
                  className="h-7 w-[120px] text-[11px] rounded border border-input bg-background px-2"
                />
              </div>
            )}

            {/* Zoom */}
            <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded">
              {(['month', 'quarter', 'year'] as ZoomLevel[]).map((z) => (
                <Button
                  key={z}
                  variant={zoom === z ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onZoomChange(z)}
                >
                  {z === 'month' ? 'Mois' : z === 'quarter' ? 'Trim.' : 'Année'}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex">
          {/* Left panel (affaires) */}
          <div
            className="flex-shrink-0 border-r bg-card"
            style={{ width: leftPanelWidth }}
          >
            <div className="h-12 border-b bg-muted/30 px-3 flex items-center text-xs font-medium text-muted-foreground">
              Affaire
            </div>
            <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
              {sortedRows.map((r) => {
                const sCfg = BE_AFFAIRE_STATUS_CONFIG[r.status];
                return (
                  <div
                    key={r.affaire_id}
                    className="h-12 px-3 border-b flex flex-col justify-center hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <code className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {r.code_affaire}
                      </code>
                      <Badge
                        variant="outline"
                        className={cn('text-[9px] h-4 px-1 border', sCfg.className)}
                      >
                        {sCfg.label}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate" title={r.libelle ?? ''}>
                      {r.libelle || <span className="italic">Sans libellé</span>}
                    </span>
                  </div>
                );
              })}
            </ScrollArea>
          </div>

          {/* Right panel (timeline) */}
          <ScrollArea className="flex-1">
            <div className="min-w-max">
              {/* Months header */}
              <div className="h-12 border-b bg-muted/30 flex sticky top-0 z-10">
                {months.map((m, i) => {
                  const mStart = new Date(Math.max(m.getTime(), dateRange.start.getTime()));
                  const mEnd = endOfMonth(m);
                  const actualEnd = new Date(Math.min(mEnd.getTime(), dateRange.end.getTime()));
                  const days = differenceInDays(actualEnd, mStart) + 1;
                  if (days <= 0) return null;
                  const isCurrent = isSameDay(startOfMonth(today), startOfMonth(m));
                  return (
                    <div
                      key={i}
                      className={cn(
                        'border-r flex items-center justify-center text-[11px] font-medium capitalize',
                        isCurrent && 'bg-primary/10 text-primary font-bold',
                      )}
                      style={{ width: days * dayWidth }}
                    >
                      {format(m, zoom === 'year' ? 'MMM yy' : 'MMM yyyy', { locale: fr })}
                    </div>
                  );
                })}
              </div>

              {/* Today line + rows */}
              <div className="relative">
                {/* Today vertical line */}
                {todayIdx >= 0 && todayIdx <= totalDays && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/60 pointer-events-none z-10"
                    style={{ left: todayIdx * dayWidth + dayWidth / 2 }}
                  />
                )}

                {sortedRows.map((r) => (
                  <div
                    key={r.affaire_id}
                    className="h-12 relative border-b hover:bg-muted/10 transition-colors"
                    style={{ minWidth: totalDays * dayWidth }}
                  >
                    {/* Events as dots */}
                    {r.events.map((ev) => {
                      const evDate = new Date(ev.date);
                      const idx = differenceInDays(evDate, dateRange.start);
                      if (idx < 0 || idx > totalDays) return null;
                      const left = idx * dayWidth + dayWidth / 2;
                      const cfg = EVENT_CONFIG[ev.type];
                      const Icon = cfg.icon;
                      const size = ev.type === 'temps_mois' ? 16 : 18;
                      return (
                        <Tooltip key={ev.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
                                'rounded-full flex items-center justify-center cursor-pointer',
                                'ring-2 ring-offset-1 ring-offset-background hover:scale-125 transition-transform',
                                cfg.bg,
                                cfg.ring,
                              )}
                              style={{ left, width: size, height: size }}
                            >
                              <Icon className="h-2.5 w-2.5 text-white" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-semibold flex items-center gap-1.5">
                              <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
                              {cfg.label}
                            </div>
                            <p className="text-muted-foreground">
                              {format(evDate, 'dd MMMM yyyy', { locale: fr })}
                            </p>
                            <p className="font-mono text-[11px]">{ev.label}</p>
                            {ev.tiers && (
                              <p className="text-muted-foreground text-[11px]">{ev.tiers}</p>
                            )}
                            {ev.montant_ht != null && (
                              <p className="font-semibold tabular-nums">{eur(ev.montant_ht)}</p>
                            )}
                            {ev.heures != null && (
                              <p className="font-semibold tabular-nums">
                                {ev.jours?.toFixed(1)} j · {ev.heures.toFixed(0)} h
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </Card>
    </TooltipProvider>
  );
}
