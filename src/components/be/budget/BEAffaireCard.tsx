import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, ChevronRight, Receipt, ReceiptText, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BEAffaire,
  BEAffaireBudgetKPI,
  BE_AFFAIRE_STATUS_CONFIG,
} from '@/types/beAffaire';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BEAffaireCardProps {
  affaire: BEAffaire;
  kpi?: BEAffaireBudgetKPI;
  onSelect: () => void;
  onEdit: () => void;
}

export function BEAffaireCard({ affaire, kpi, onSelect, onEdit }: BEAffaireCardProps) {
  const statusCfg = BE_AFFAIRE_STATUS_CONFIG[affaire.status];
  const caConstate = kpi?.ca_constate_brut ?? 0;
  const cogsConstate = kpi?.cogs_constate_brut ?? 0;
  const marge = kpi?.marge_constatee_brut ?? (caConstate - cogsConstate);
  const margeNeg = marge < 0;

  return (
    <Card
      className="border-border/50 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {affaire.code_affaire}
              </code>
              <Badge variant="outline" className={cn('text-[10px] border', statusCfg.className)}>
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-sm font-medium truncate" title={affaire.libelle ?? ''}>
              {affaire.libelle || <span className="text-muted-foreground italic">Sans libellé</span>}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Mini KPIs CA / COGS / Marge */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-md bg-indigo-500/5 border border-indigo-500/10 p-2">
            <div className="flex items-center gap-1 text-[10px] text-indigo-600/80 mb-0.5">
              <Receipt className="h-3 w-3" />
              <span>CA</span>
            </div>
            <p className="text-xs font-bold tabular-nums text-indigo-700 truncate" title={eur(caConstate)}>
              {eur(caConstate)}
            </p>
          </div>
          <div className="rounded-md bg-amber-500/5 border border-amber-500/10 p-2">
            <div className="flex items-center gap-1 text-[10px] text-amber-600/80 mb-0.5">
              <ReceiptText className="h-3 w-3" />
              <span>COGS</span>
            </div>
            <p className="text-xs font-bold tabular-nums text-amber-700 truncate" title={eur(cogsConstate)}>
              {eur(cogsConstate)}
            </p>
          </div>
          <div
            className={cn(
              'rounded-md border p-2',
              margeNeg
                ? 'bg-red-500/5 border-red-500/10'
                : 'bg-emerald-500/5 border-emerald-500/10',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-1 text-[10px] mb-0.5',
                margeNeg ? 'text-red-600/80' : 'text-emerald-600/80',
              )}
            >
              {margeNeg ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              <span>Marge</span>
            </div>
            <p
              className={cn(
                'text-xs font-bold tabular-nums truncate',
                margeNeg ? 'text-red-700' : 'text-emerald-700',
              )}
              title={eur(marge)}
            >
              {eur(marge)}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {(kpi?.nb_commandes ?? 0)} cmd · {(kpi?.nb_factures ?? 0)} fact
          {affaire.date_ouverture && (
            <> · ouverte le {new Date(affaire.date_ouverture).toLocaleDateString('fr-FR')}</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
