import { Card, CardContent } from '@/components/ui/card';
import {
  ListChecks,
  Receipt,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BEBudgetKpiCardsProps {
  nbAffaires: number;
  /** CA engage = somme CCN (commandes client). */
  caEngage: number;
  /** CA constate = somme FCN (factures client). */
  caConstate: number;
  /** COGS engage = somme CFN (commandes fournisseur). */
  cogsEngage?: number;
  /** COGS constate = somme FFN (factures fournisseur). */
  cogsConstate: number;
  /** Marge constatee = CA constate - COGS constate. */
  margeConstatee: number;
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
  margeConstatee,
}: BEBudgetKpiCardsProps) {
  // Carnet de commandes = CA engage non encore facture (= CCN - FCN)
  const carnet = Math.max(caEngage - caConstate, 0);
  // Taux de marge constatee
  const tauxMarge = caConstate > 0 ? Math.round((margeConstatee / caConstate) * 100) : null;
  const margeNegative = margeConstatee < 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Kpi
        label="Affaires"
        value={String(nbAffaires)}
        icon={ListChecks}
        accent="bg-slate-500/10 text-slate-600"
      />
      <Kpi
        label="CA Engagé"
        value={eur(caEngage)}
        icon={Wallet}
        accent="bg-blue-500/10 text-blue-600"
        hint={carnet > 0 ? `Carnet : ${eur(carnet)}` : undefined}
      />
      <Kpi
        label="CA Constaté"
        value={eur(caConstate)}
        icon={Receipt}
        accent="bg-indigo-500/10 text-indigo-600"
      />
      <Kpi
        label="COGS Constaté"
        value={eur(cogsConstate)}
        icon={ReceiptText}
        accent="bg-amber-500/10 text-amber-600"
      />
      <Kpi
        label={margeNegative ? 'Marge négative' : 'Marge Constatée'}
        value={eur(margeConstatee)}
        icon={margeNegative ? TrendingDown : TrendingUp}
        accent={
          margeNegative
            ? 'bg-red-500/10 text-red-600'
            : 'bg-emerald-500/10 text-emerald-600'
        }
        hint={tauxMarge != null ? `${tauxMarge}% du CA` : undefined}
        emphasis
      />
    </div>
  );
}
