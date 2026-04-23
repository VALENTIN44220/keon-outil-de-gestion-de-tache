import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ITBudgetLine } from '@/types/itProject';
import { BUDGET_LINE_STATUT_CONFIG } from '@/types/itProject';

interface LineExtra {
  entite?: string | null;
  annee?: number | null;
  montant_annuel?: number | null;
  projet_it_label?: string | null;
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
    render: (l) => <span className="truncate block max-w-[220px]">{l.description ?? '—'}</span>,
  },
  {
    key: 'commentaire',
    label: 'Commentaire',
    defaultVisible: false,
    render: (l) => <span className="truncate block max-w-[220px]">{l.commentaire ?? '—'}</span>,
  },
  {
    key: 'montant_budget',
    label: 'Budget initial',
    defaultVisible: true,
    align: 'right',
    render: (l, h) => <span className="tabular-nums">{h.eur(l.montant_budget ?? 0)}</span>,
  },
  {
    key: 'montant_budget_revise',
    label: 'Budget révisé',
    defaultVisible: true,
    align: 'right',
    render: (l, h) => (
      <span className="tabular-nums">{h.eur(l.montant_budget_revise ?? l.montant_budget ?? 0)}</span>
    ),
  },
  {
    key: 'montant_annuel',
    label: 'Total annuel',
    defaultVisible: true,
    align: 'right',
    render: (l, h) => {
      const montant = l.montant_annuel ?? (l.montant_budget ?? 0) * 12;
      return <span className="tabular-nums">{h.eur(montant)}</span>;
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
