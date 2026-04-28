import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, ChevronRight, FileText, Receipt } from 'lucide-react';
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
  const engage = kpi?.engage_montant_brut ?? 0;
  const constate = kpi?.constate_montant_brut ?? 0;

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
        {/* Mini KPIs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-indigo-500/5 border border-indigo-500/10 p-2">
            <div className="flex items-center gap-1.5 text-[10px] text-indigo-600/80 mb-0.5">
              <FileText className="h-3 w-3" />
              <span>Engagé · {kpi?.nb_commandes ?? 0} CCN</span>
            </div>
            <p className="text-sm font-bold tabular-nums text-indigo-700">{eur(engage)}</p>
          </div>
          <div className="rounded-md bg-violet-500/5 border border-violet-500/10 p-2">
            <div className="flex items-center gap-1.5 text-[10px] text-violet-600/80 mb-0.5">
              <Receipt className="h-3 w-3" />
              <span>Constaté · {kpi?.nb_factures ?? 0} FCN</span>
            </div>
            <p className="text-sm font-bold tabular-nums text-violet-700">{eur(constate)}</p>
          </div>
        </div>

        {affaire.date_ouverture && (
          <p className="text-[11px] text-muted-foreground">
            Ouverte le {new Date(affaire.date_ouverture).toLocaleDateString('fr-FR')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
