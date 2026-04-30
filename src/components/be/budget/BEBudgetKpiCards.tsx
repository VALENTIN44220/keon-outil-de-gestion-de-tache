import { Card, CardContent } from '@/components/ui/card';
import {
  ListChecks,
  Receipt,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Coins,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BEBudgetKpiCardsProps {
  nbAffaires: number;
  caEngage: number;
  caConstate: number;
  cogsConstate: number;
  /** Marge brute = CA - COGS (- NDF a venir). */
  margeBrute: number;
  /** Cout RH declare (Lucca x TJM). */
  coutRhDeclare: number;
  /** Marge sur couts directs = Marge brute - Cout RH. */
  margeDirecte: number;
}

interface KpiProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  hint?: string;
  emphasis?: boolean;
}

function Kpi({ label, value, icon: Icon, accent, hint, emphasis }: KpiProps) {
  return (
    <Card className={cn('border-border/50', emphasis && 'border-primary/30 bg-primary/[0.02]')}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg', accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums truncate" title={value}>
            {value}
          </p>
          {hint && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function BEBudgetKpiCards({
  nbAffaires,
  caEngage,
  caConstate,
  cogsConstate,
  margeBrute,
  coutRhDeclare,
  margeDirecte,
}: BEBudgetKpiCardsProps) {
  const carnet = Math.max(caEngage - caConstate, 0);
  const tauxBrute = caConstate > 0 ? Math.round((margeBrute / caConstate) * 100) : null;
  const tauxDirecte = caConstate > 0 ? Math.round((margeDirecte / caConstate) * 100) : null;
  const bruteNeg = margeBrute < 0;
  const directeNeg = margeDirecte < 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Kpi
        label="Affaires"
        value={String(nbAffaires)}
        icon={ListChecks}
        accent="bg-slate-500/10 text-slate-600"
        hint={caEngage > 0 ? `Engagé ${eur(caEngage)}` : undefined}
      />
      <Kpi
        label="CA Constaté"
        value={eur(caConstate)}
        icon={Receipt}
        accent="bg-indigo-500/10 text-indigo-600"
        hint={carnet > 0 ? `Carnet ${eur(carnet)}` : undefined}
      />
      <Kpi
        label="COGS Constaté"
        value={eur(cogsConstate)}
        icon={ReceiptText}
        accent="bg-amber-500/10 text-amber-600"
      />
      <Kpi
        label="Marge brute"
        value={eur(margeBrute)}
        icon={bruteNeg ? TrendingDown : TrendingUp}
        accent={bruteNeg ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}
        hint={tauxBrute != null ? `${tauxBrute}% du CA` : undefined}
        emphasis
      />
      <Kpi
        label="Coût RH déclaré"
        value={eur(coutRhDeclare)}
        icon={Coins}
        accent="bg-violet-500/10 text-violet-600"
      />
      <Kpi
        label={directeNeg ? 'Marge directe -' : 'Marge sur coûts directs'}
        value={eur(margeDirecte)}
        icon={directeNeg ? TrendingDown : Wallet}
        accent={directeNeg ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}
        hint={tauxDirecte != null ? `${tauxDirecte}% du CA` : undefined}
        emphasis
      />
    </div>
  );
}
