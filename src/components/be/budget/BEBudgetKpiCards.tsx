import { Card, CardContent } from '@/components/ui/card';
import { Wallet, TrendingDown, FileCheck2, AlertTriangle, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BEBudgetKpiCardsProps {
  budget: number;
  engage: number;
  constate: number;
  nbAffaires: number;
  /** Si fourni : ratio (constate/budget) en %. */
  tauxConsommation?: number;
}

interface KpiProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  hint?: string;
}

function Kpi({ label, value, icon: Icon, accent, hint }: KpiProps) {
  return (
    <Card className="border-border/50">
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
  budget,
  engage,
  constate,
  nbAffaires,
  tauxConsommation,
}: BEBudgetKpiCardsProps) {
  const reste = budget - constate;
  const enDepassement = constate > budget && budget > 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Kpi
        label="Affaires"
        value={String(nbAffaires)}
        icon={ListChecks}
        accent="bg-slate-500/10 text-slate-600"
      />
      <Kpi
        label="Budget total"
        value={eur(budget)}
        icon={Wallet}
        accent="bg-blue-500/10 text-blue-600"
      />
      <Kpi
        label="Engagé (CCN)"
        value={eur(engage)}
        icon={FileCheck2}
        accent="bg-indigo-500/10 text-indigo-600"
      />
      <Kpi
        label="Constaté (FCN)"
        value={eur(constate)}
        icon={TrendingDown}
        accent="bg-violet-500/10 text-violet-600"
        hint={tauxConsommation != null ? `${tauxConsommation}% du budget` : undefined}
      />
      <Kpi
        label={enDepassement ? 'Dépassement' : 'Reste'}
        value={eur(Math.abs(reste))}
        icon={AlertTriangle}
        accent={
          enDepassement
            ? 'bg-red-500/10 text-red-600'
            : 'bg-emerald-500/10 text-emerald-600'
        }
      />
    </div>
  );
}
