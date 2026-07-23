import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ITBudgetLine } from '@/types/itProject';
import { BUDGET_LINE_STATUT_CONFIG } from '@/types/itProject';
import { lineAnnualBudget, lineAnnualBudgetRevise } from '@/lib/itBudgetTotals';

interface LineExtra {
  entite?: string | null;
  annee?: number | null;
  montant_annuel?: number | null;
  projet_it_label?: string | null;
  // Canon financier annuel HT — injecté par la page (pas en base)
  _cf_amount?: number;          // CF Divalto liées
  _ff_amount?: number;          // FF Divalto liées
  _supplier_ht_amount?: number; // Écritures comptables rattachées (HT estimé)
}

export type ITBudgetLineRow = ITBudgetLine & LineExtra;

export interface ITBudgetColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (line: ITBudgetLineRow, helpers: ColumnHelpers) => ReactNode;
}

export interface ColumnHelpers {
  eur: (n: number) => string;
  formatBudgetPeriode: (
    l: Pick<ITBudgetLineRow, 'budget_type' | 'mois_budget'>
  ) => string;
}

export const IT_BUDGET_COLUMNS: ITBudgetColumnDef[] = [
  {
    key: 'categorie',
    label: 'Catégorie',
    defaultVisible: true,
    render: (l) => <span className="font-medium">{l.categorie ?? '—'}</span>,
  },
  {
    key: 'entite',
    label: 'Entité',
    defaultVisible: true,
    render: (l) => l.entite ?? '—',
  },
  {
    key: 'projet_it_id',
    label: 'Projet IT',
    defaultVisible: true,
    render: (l) => {
      if (l.projet_it_label) return l.projet_it_label;
      const pid = l.it_project_id?.trim();
      if (!pid) return '—';
      return <span className="font-mono text-xs">{pid.slice(0, 8)}…</span>;
    },
  },
  {
    key: 'annee',
    label: 'Année',
    defaultVisible: true,
    render: (l) => l.annee ?? l.exercice ?? '—',
  },
  {
    key: 'sous_categorie',
    label: 'Sous-catégorie',
    defaultVisible: true,
    render: (l) => l.sous_categorie ?? '—',
  },
  {
    key: 'fournisseur_prevu',
    label: 'Fournisseur',
    defaultVisible: true,
    render: (l) => l.fournisseur_prevu ?? '—',
  },
  {
    key: 'type_depense',
    label: 'Type',
    defaultVisible: true,
    render: (l) => l.type_depense ?? '—',
  },
  {
    key: 'mois_budget',
    label: 'Périodicité',
    defaultVisible: true,
    render: (l, h) => h.formatBudgetPeriode(l),
  },
  {
    key: 'nature_depense',
    label: 'Nature',
    defaultVisible: false,
    render: (l) => l.nature_depense ?? '—',
  },
  {
    key: 'description',
    label: 'Description',
    defaultVisible: false,
    render: (l) => (
      <span className="flex items-center gap-1.5">
        {(l as any).is_reforecast && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-violet-100 text-violet-800 border-violet-300">
            REFORECAST
          </Badge>
        )}
        <span className="truncate block max-w-[220px]">{l.description ?? '—'}</span>
      </span>
    ),
  },
  {
    key: 'commentaire',
    label: 'Commentaire',
    defaultVisible: false,
    render: (l) => <span className="truncate block max-w-[220px]">{l.commentaire ?? '—'}</span>,
  },
  // ─── CANON FINANCIER (montants HT annuels) ────────────────────────────────
  // Convention : BUD26 = budget initial annuel, F26 = reforecast annuel.
  // Coloration des écarts pour vue rapide :
  //   • Engagé > F26      → fond rouge   (sur-engagement)
  //   • Constaté > Engagé → fond orange  (facturé au-delà des CF)
  //   • Constaté > F26    → fond rouge   (dépassement budget)
  //   • Consommation > 100% → rouge ; > 80% → orange ; sinon vert
  {
    key: 'montant_budget',
    label: 'BUD',
    defaultVisible: true,
    align: 'right',
    render: (l, h) => (
      <span className="tabular-nums">{h.eur(lineAnnualBudget(l))}</span>
    ),
  },
  {
    key: 'montant_budget_revise',
    label: 'F',
    defaultVisible: true,
    align: 'right',
    render: (l, h) => {
      const initial = lineAnnualBudget(l);
      const revise = lineAnnualBudgetRevise(l);
      const isRevised = revise !== initial;
      return (
        <span
          className={cn('tabular-nums', isRevised && 'font-semibold text-violet-700')}
          title={isRevised ? `Reforecast appliqué (BUD ${h.eur(initial)} → F ${h.eur(revise)})` : 'F = BUD (aucun reforecast)'}
        >
          {h.eur(revise)}
        </span>
      );
    },
  },
  {
    key: 'engage',
    label: 'Engagé',
    defaultVisible: true,
    align: 'right',
    render: (l, h) => {
      const cf = Number(l._cf_amount ?? 0);
      const revise = lineAnnualBudgetRevise(l);
      const engage = cf > 0 ? cf : (l.statut === 'engage_total' ? revise : 0);
      const fromStatut = cf === 0 && l.statut === 'engage_total' && engage > 0;
      // Sur-engagement vs F26 → fond rouge
      const overBudget = revise > 0 && engage > revise * 1.001; // tolérance 0,1% arrondi
      const tooltip = fromStatut
        ? 'Engagé déclaratif (statut = Engagé total, pas de CF Divalto)'
        : cf > 0
        ? `Somme CF Divalto liées : ${h.eur(cf)}${overBudget ? ` (dépasse F ${h.eur(revise)})` : ''}`
        : undefined;
      return (
        <span
          className={cn(
            'tabular-nums inline-block px-1 rounded',
            engage > 0 && !overBudget && 'text-blue-700',
            overBudget && 'bg-red-100 text-red-700 font-semibold dark:bg-red-900/30 dark:text-red-300',
          )}
          title={tooltip}
        >
          {engage > 0 ? h.eur(engage) : '—'}
          {fromStatut && <sup className="text-[8px] text-amber-600 ml-0.5">*</sup>}
        </span>
      );
    },
  },
  {
    key: 'constate',
    label: 'Constaté',
    defaultVisible: true,
    align: 'right',
    render: (l, h) => {
      const ff = Number(l._ff_amount ?? 0);
      const sup = Number(l._supplier_ht_amount ?? 0);
      const cf = Number(l._cf_amount ?? 0);
      const revise = lineAnnualBudgetRevise(l);
      const constate = ff + sup;
      const engage = cf > 0 ? cf : (l.statut === 'engage_total' ? revise : 0);
      // Constaté > Engagé → orange (facture sans commande / dépassement engagement)
      // Constaté > F26   → rouge (dépassement budget)
      const overBudget = revise > 0 && constate > revise * 1.001;
      const overEngage = engage > 0 && constate > engage * 1.001 && !overBudget;
      const tooltip = [
        ff > 0 ? `FF Divalto : ${h.eur(ff)}` : null,
        sup > 0 ? `Écritures comptables (HT est.) : ${h.eur(sup)}` : null,
        overBudget ? `⚠ dépasse F (${h.eur(revise)})` : null,
        overEngage ? `⚠ dépasse l'engagé (${h.eur(engage)})` : null,
      ].filter(Boolean).join(' · ');
      return (
        <span
          className={cn(
            'tabular-nums inline-block px-1 rounded',
            constate > 0 && !overEngage && !overBudget && 'text-emerald-700 font-medium',
            overEngage && 'bg-orange-100 text-orange-800 font-semibold dark:bg-orange-900/30 dark:text-orange-300',
            overBudget && 'bg-red-100 text-red-700 font-semibold dark:bg-red-900/30 dark:text-red-300',
          )}
          title={tooltip || undefined}
        >
          {constate > 0 ? h.eur(constate) : '—'}
        </span>
      );
    },
  },
  {
    key: 'consommation',
    label: 'Conso %',
    defaultVisible: true,
    align: 'right',
    render: (l, h) => {
      const ff = Number(l._ff_amount ?? 0);
      const sup = Number(l._supplier_ht_amount ?? 0);
      const constate = ff + sup;
      const revise = lineAnnualBudgetRevise(l);
      if (revise <= 0) return <span className="text-muted-foreground">—</span>;
      const pct = (constate / revise) * 100;
      // Couleurs : >100 rouge ; >80 orange ; >0 vert ; 0 neutre
      const tone =
        pct > 100
          ? 'bg-red-100 text-red-700 font-semibold dark:bg-red-900/30 dark:text-red-300'
          : pct > 80
          ? 'bg-orange-100 text-orange-800 font-semibold dark:bg-orange-900/30 dark:text-orange-300'
          : pct > 0
          ? 'text-emerald-700'
          : 'text-muted-foreground';
      return (
        <span
          className={cn('tabular-nums inline-block px-1 rounded', tone)}
          title={`Constaté ${h.eur(constate)} / F ${h.eur(revise)}`}
        >
          {pct.toFixed(0)}%
        </span>
      );
    },
  },
  {
    key: 'montant_annuel',
    label: 'Total annuel (legacy)',
    defaultVisible: false,
    align: 'right',
    render: (l, h) => {
      const montant = l.montant_annuel ?? lineAnnualBudgetRevise(l);
      return <span className="tabular-nums text-muted-foreground">{h.eur(montant)}</span>;
    },
  },
  {
    key: 'version',
    label: 'Version',
    defaultVisible: false,
    render: (l) => l.version ?? '—',
  },
  {
    key: 'mode_saisie',
    label: 'Saisie',
    defaultVisible: false,
    render: (l) => (
      <Badge variant="outline" className="text-[10px]">
        {l.mode_saisie ?? '—'}
      </Badge>
    ),
  },
  {
    key: 'statut',
    label: 'Statut',
    defaultVisible: true,
    render: (l) => {
      const st = BUDGET_LINE_STATUT_CONFIG[l.statut];
      return (
        <Badge variant="outline" className={cn('border', st?.className)}>
          {st?.label ?? l.statut}
        </Badge>
      );
    },
  },
];

export const DEFAULT_COLUMNS_CONFIG = {
  order: IT_BUDGET_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
  hidden: IT_BUDGET_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key),
};
