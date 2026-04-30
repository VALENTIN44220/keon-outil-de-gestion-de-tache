import { Badge } from '@/components/ui/badge';
import {
  Receipt,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BEGroupeKPI } from '@/hooks/useBEGroupeKpi';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BEGroupeHeaderProps {
  codeGroupe: string;
  /** Nb de be_affaires (8 chars + 5 chars) presentes dans ce groupe. */
  nbAffaires: number;
  kpi?: BEGroupeKPI;
}

/**
 * Header d'un groupe d'affaires partageant le meme prefixe 5 chars
 * (= "affaire globale"). Affiche les KPIs sommes Divalto + Lucca au dessus
 * des cards d'activites.
 */
export function BEGroupeHeader({ codeGroupe, nbAffaires, kpi }: BEGroupeHeaderProps) {
  const ca = kpi?.ca_constate_brut ?? 0;
  const cogs = kpi?.cogs_constate_brut ?? 0;
  const marge = kpi?.marge_constatee_brut ?? (ca - cogs);
  const margeNeg = marge < 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg border-l-4 border-primary/40">
      <div className="flex items-center gap-2 min-w-0">
        <Layers className="h-4 w-4 text-primary/70 shrink-0" />
        <code className="text-sm font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
          {codeGroupe}
        </code>
        <Badge variant="secondary" className="text-[10px]">
          {nbAffaires} {nbAffaires > 1 ? 'activités' : 'activité'}
        </Badge>
        {kpi?.nb_activites_divalto != null && kpi.nb_activites_divalto > 0 && (
          <span className="text-[10px] text-muted-foreground">
            · {kpi.nb_activites_divalto} en Divalto
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3 flex-wrap">
        <KpiInline label="CA" icon={Receipt} value={eur(ca)} accent="text-indigo-600" />
        <KpiInline label="COGS" icon={ReceiptText} value={eur(cogs)} accent="text-amber-600" />
        <KpiInline
          label={margeNeg ? 'Marge négative' : 'Marge'}
          icon={margeNeg ? TrendingDown : TrendingUp}
          value={eur(marge)}
          accent={margeNeg ? 'text-red-600' : 'text-emerald-600'}
        />
        {kpi && kpi.jours_declares > 0 && (
          <KpiInline
            label="Déclaré"
            icon={Clock}
            value={`${kpi.jours_declares.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`}
            accent="text-slate-600"
          />
        )}
        {kpi && kpi.nb_collaborateurs > 0 && (
          <KpiInline
            label=""
            icon={Users}
            value={String(kpi.nb_collaborateurs)}
            accent="text-slate-500"
          />
        )}
      </div>
    </div>
  );
}

interface KpiInlineProps {
  label: string;
  icon: React.ElementType;
  value: string;
  accent: string;
}

function KpiInline({ label, icon: Icon, value, accent }: KpiInlineProps) {
  return (
    <span className="flex items-center gap-1 text-xs">
      <Icon className={cn('h-3 w-3', accent)} />
      {label && <span className="text-muted-foreground">{label}</span>}
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
