import { useMemo, useState } from 'react';
import { Task } from '@/types/task';
import { format, differenceInCalendarDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, eachMonthOfInterval, eachQuarterOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TicketCheck, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';

type SmqPeriod = 'month' | 'quarter' | 'year' | 'last3' | 'last6' | 'last12';
type SmqStep = 'monthly' | 'quarterly';

const PERIOD_OPTIONS: { value: SmqPeriod; label: string }[] = [
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'year', label: 'Cette année' },
  { value: 'last3', label: '3 derniers mois' },
  { value: 'last6', label: '6 derniers mois' },
  { value: 'last12', label: '12 derniers mois' },
];

const STEP_OPTIONS: { value: SmqStep; label: string }[] = [
  { value: 'monthly', label: 'Par mois' },
  { value: 'quarterly', label: 'Par trimestre' },
];

function getPeriodRange(period: SmqPeriod): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (period) {
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: fr }) };
    case 'quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now), label: `T${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}` };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now), label: `${now.getFullYear()}` };
    case 'last3':
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now), label: '3 derniers mois' };
    case 'last6':
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now), label: '6 derniers mois' };
    case 'last12':
      return { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now), label: '12 derniers mois' };
  }
}

interface SmqIndicatorsWidgetProps {
  tasks: Task[];
}

export function SmqIndicatorsWidget({ tasks }: SmqIndicatorsWidgetProps) {
  const [period, setPeriod] = useState<SmqPeriod>('last12');
  const [step, setStep] = useState<SmqStep>('monthly');

  const showStepSelector = period !== 'month';

  const { range, metrics, chartData } = useMemo(() => {
    const range = getPeriodRange(period);
    const interval = { start: range.start, end: range.end };

    // Helper: get opening date (date_demande from Planner, fallback to created_at)
    const getOpenDate = (t: Task): Date => new Date(t.date_demande || t.created_at);
    // Helper: get closing date (date_fermeture from Planner completedDateTime, fallback to updated_at)
    const getCloseDate = (t: Task): Date => new Date(t.date_fermeture || t.updated_at);
    const isClosed = (t: Task) => t.status === 'done' || t.status === 'validated';

    // Total tickets opened in the period (using Planner date)
    const createdInPeriod = tasks.filter(t => isWithinInterval(getOpenDate(t), interval));

    const closedInPeriod = tasks.filter(t => {
      return isClosed(t) && isWithinInterval(getCloseDate(t), interval);
    });

    const openCount = createdInPeriod.filter(t => !isClosed(t)).length;

    let avgDays = 0;
    if (closedInPeriod.length > 0) {
      const totalDays = closedInPeriod.reduce((sum, t) => sum + differenceInCalendarDays(getCloseDate(t), getOpenDate(t)), 0);
      avgDays = Math.round((totalDays / closedInPeriod.length) * 10) / 10;
    }

    // Build chart data by step
    let buckets: { start: Date; end: Date; label: string }[] = [];

    if (period === 'month') {
      buckets = [{ start: range.start, end: range.end, label: format(range.start, 'MMM yy', { locale: fr }) }];
    } else if (step === 'monthly') {
      const months = eachMonthOfInterval({ start: range.start, end: range.end });
      buckets = months.map(m => ({
        start: startOfMonth(m),
        end: endOfMonth(m),
        label: format(m, 'MMM yy', { locale: fr }),
      }));
    } else {
      const quarters = eachQuarterOfInterval({ start: range.start, end: range.end });
      buckets = quarters.map(q => ({
        start: startOfQuarter(q),
        end: endOfQuarter(q),
        label: `T${Math.ceil((q.getMonth() + 1) / 3)} ${format(q, 'yy')}`,
      }));
    }

    const chartData = buckets.map(bucket => {
      const bucketInterval = { start: bucket.start, end: bucket.end };

      // Tickets opened in this bucket (using Planner date)
      const created = tasks.filter(t => isWithinInterval(getOpenDate(t), bucketInterval)).length;

      // Tickets closed in this bucket
      const closedBucket = tasks.filter(t => isClosed(t) && isWithinInterval(getCloseDate(t), bucketInterval));

      let avg: number | null = null;
      if (closedBucket.length > 0) {
        const total = closedBucket.reduce((s, t) => s + differenceInCalendarDays(getCloseDate(t), getOpenDate(t)), 0);
        avg = Math.round((total / closedBucket.length) * 10) / 10;
      }

      return { name: bucket.label, ouverts: created, fermes: closedBucket.length, duree: avg };
    });

    return { range, metrics: { openCount, totalCreated: createdInPeriod.length, avgDays, closedCount: closedInPeriod.length }, chartData };
  }, [tasks, period, step]);

  const cards = [
    {
      label: `Tickets ouverts (${range.label})`,
      value: metrics.openCount,
      icon: TicketCheck,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: `Tickets fermés (${range.label})`,
      value: metrics.closedCount,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      label: 'Durée moy. traitement (j)',
      value: metrics.closedCount > 0 ? `${metrics.avgDays} j` : '—',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
  ];
  const maxDuree = Math.max(...chartData.map(d => d.duree ?? 0), 1);

  return (
    <div className="flex flex-col gap-3 h-full px-2 py-1 overflow-auto">
      <div className="flex gap-2">
        <Select value={period} onValueChange={(v) => setPeriod(v as SmqPeriod)}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showStepSelector && (
          <Select value={step} onValueChange={(v) => setStep(v as SmqStep)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STEP_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex gap-3">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border bg-card shadow-sm flex-1 min-w-0">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", card.bgColor)}>
                <Icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xl leading-tight">{card.value}</span>
                <span className="text-[10px] text-muted-foreground truncate">{card.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {chartData.length > 1 && (
        <div className="flex-1 min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 40, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                allowDecimals={false}
                label={{ value: 'Tickets', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                domain={[0, Math.ceil(maxDuree * 1.2)]}
                label={{ value: 'Jours', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                formatter={(value: number, name: string) => {
                  if (name === 'Durée moy. (j)') return value !== null ? [`${value} j`, name] : ['—', name];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="ouverts" name="Tickets ouverts" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="ouverts" position="top" style={{ fontSize: 9, fill: 'hsl(var(--foreground))' }} />
              </Bar>
              <Bar yAxisId="left" dataKey="fermes" name="Tickets fermés" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="fermes" position="top" style={{ fontSize: 9, fill: 'hsl(var(--foreground))' }} />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="duree"
                name="Durée moy. (j)"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--chart-2))' }}
                connectNulls
                label={{ position: 'top', style: { fontSize: 9, fill: 'hsl(var(--chart-2))' }, formatter: (v: number) => v !== null ? `${v}j` : '' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}