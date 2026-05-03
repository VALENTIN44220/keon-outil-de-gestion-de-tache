import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ListChecks,
  Receipt,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Clock,
  Coins,
  ChevronRight,
  Building2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useBEProjectsSyntheseKpi,
  type BEProjectSyntheseKPI,
} from '@/hooks/useBEProjectsSyntheseKpi';
import type { BEProject } from '@/types/beProject';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = (n: number, frac = 1) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: frac });

type SortKey =
  | 'code_projet'
  | 'nb_affaires'
  | 'ca_constate'
  | 'cogs'
  | 'marge_brute'
  | 'cout_rh'
  | 'marge_directe'
  | 'jours';

type FilterMode = 'all' | 'with_ca' | 'with_rh' | 'neg_margin' | 'pos_margin';

interface BEProjectsAffairesViewProps {
  projects: BEProject[];
  hubBasePath: string;
}

function kpiSortValue(k: BEProjectSyntheseKPI, key: SortKey): number {
  switch (key) {
    case 'nb_affaires': return k.nb_affaires;
    case 'ca_constate': return k.ca_constate_brut;
    case 'cogs': return k.cogs_constate_brut;
    case 'marge_brute': return k.marge_brute_brut ?? k.marge_constatee_brut;
    case 'cout_rh': return k.cout_rh_declare;
    case 'marge_directe':
      return k.marge_directe_brut ?? (k.marge_constatee_brut - k.cout_rh_declare);
    case 'jours': return k.jours_declares;
    default: return 0;
  }
}

export function BEProjectsAffairesView({
  projects,
  hubBasePath,
}: BEProjectsAffairesViewProps) {
  const navigate = useNavigate();
  const { data: kpis = [], isLoading } = useBEProjectsSyntheseKpi();

  const [sortKey, setSortKey] = useState<SortKey>('ca_constate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const visibleProjectIds = useMemo(
    () => new Set(projects.map((p) => p.id)),
    [projects],
  );

  const filteredKpis = useMemo(
    () => kpis.filter((k) => visibleProjectIds.has(k.be_project_id)),
    [kpis, visibleProjectIds],
  );

  const displayKpis = useMemo(() => {
    let result = [...filteredKpis];

    // Quick filter
    if (filterMode === 'with_ca')
      result = result.filter((k) => k.ca_constate_brut > 0 || k.ca_engage_brut > 0);
    else if (filterMode === 'with_rh')
      result = result.filter((k) => k.jours_declares > 0);
    else if (filterMode === 'neg_margin')
      result = result.filter(
        (k) => (k.marge_brute_brut ?? k.marge_constatee_brut) < 0,
      );
    else if (filterMode === 'pos_margin')
      result = result.filter(
        (k) => (k.marge_brute_brut ?? k.marge_constatee_brut) > 0,
      );

    // Sort
    result.sort((a, b) => {
      if (sortKey === 'code_projet') {
        const cmp = a.code_projet.localeCompare(b.code_projet);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const va = kpiSortValue(a, sortKey);
      const vb = kpiSortValue(b, sortKey);
      return sortDir === 'asc' ? va - vb : vb - va;
    });

    return result;
  }, [filteredKpis, sortKey, sortDir, filterMode]);

  const totals = useMemo(() => {
    const t = {
      nb_projets: displayKpis.length,
      nb_affaires: 0,
      ca_engage: 0,
      ca_constate: 0,
      cogs_constate: 0,
      marge_brute: 0,
      cout_rh_declare: 0,
      marge_directe: 0,
      jours_declares: 0,
    };
    for (const k of displayKpis) {
      t.nb_affaires += k.nb_affaires;
      t.ca_engage += k.ca_engage_brut;
      t.ca_constate += k.ca_constate_brut;
      t.cogs_constate += k.cogs_constate_brut;
      t.marge_brute += k.marge_brute_brut ?? k.marge_constatee_brut;
      t.cout_rh_declare += k.cout_rh_declare;
      t.marge_directe +=
        k.marge_directe_brut ?? (k.marge_constatee_brut - k.cout_rh_declare);
      t.jours_declares += k.jours_declares;
    }
    return t;
  }, [displayKpis]);

  const projectsById = useMemo(() => {
    const m = new Map<string, BEProject>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-1" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const SortableHead = ({
    label,
    k,
    className,
  }: { label: string; k: SortKey; className?: string }) => (
    <TableHead
      className={cn('cursor-pointer select-none hover:text-foreground whitespace-nowrap', className)}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon k={k} />
      </span>
    </TableHead>
  );

  const FILTER_CHIPS: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'with_ca', label: 'Avec CA' },
    { key: 'with_rh', label: 'Avec RH déclaré' },
    { key: 'pos_margin', label: 'Marge brute >' },
    { key: 'neg_margin', label: 'Marge brute <' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          label="Affaires actives"
          value={`${totals.nb_affaires}`}
          icon={ListChecks}
          accent="bg-slate-500/10 text-slate-600"
          hint={`${totals.nb_projets} projets`}
        />
        <Kpi
          label="CA Constaté"
          value={eur(totals.ca_constate)}
          icon={Receipt}
          accent="bg-indigo-500/10 text-indigo-600"
          hint={`Engagé ${eur(totals.ca_engage)}`}
        />
        <Kpi
          label="COGS Constaté"
          value={eur(totals.cogs_constate)}
          icon={ReceiptText}
          accent="bg-amber-500/10 text-amber-600"
        />
        <Kpi
          label={totals.marge_brute < 0 ? 'Marge brute -' : 'Marge brute'}
          value={eur(totals.marge_brute)}
          icon={totals.marge_brute < 0 ? TrendingDown : TrendingUp}
          accent={
            totals.marge_brute < 0
              ? 'bg-red-500/10 text-red-600'
              : 'bg-emerald-500/10 text-emerald-600'
          }
          hint={
            totals.ca_constate > 0
              ? `${Math.round((totals.marge_brute / totals.ca_constate) * 100)}% du CA`
              : undefined
          }
          emphasis
        />
        <Kpi
          label="Coût RH déclaré"
          value={eur(totals.cout_rh_declare)}
          icon={Coins}
          accent="bg-violet-500/10 text-violet-600"
          hint={`${num(totals.jours_declares)} j déclarés`}
        />
        <Kpi
          label={totals.marge_directe < 0 ? 'Marge directe -' : 'Marge sur coûts directs'}
          value={eur(totals.marge_directe)}
          icon={totals.marge_directe < 0 ? TrendingDown : TrendingUp}
          accent={
            totals.marge_directe < 0
              ? 'bg-red-500/10 text-red-600'
              : 'bg-emerald-500/10 text-emerald-600'
          }
          hint={
            totals.ca_constate > 0
              ? `${Math.round((totals.marge_directe / totals.ca_constate) * 100)}% du CA`
              : undefined
          }
          emphasis
        />
      </div>

      {/* Tableau */}
      <Card className="border-border/50">
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 flex-wrap">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilterMode(chip.key)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                filterMode === chip.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
              )}
            >
              {chip.label}
            </button>
          ))}
          {filterMode !== 'all' && (
            <span className="text-xs text-muted-foreground ml-1">
              — {displayKpis.length} projet{displayKpis.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <CardContent className="p-0 mt-3">
          {displayKpis.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucun projet BE pour ces critères.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <SortableHead label="Projet" k="code_projet" />
                    <SortableHead label="Affaires" k="nb_affaires" className="text-right" />
                    <SortableHead label="CA Constaté" k="ca_constate" className="text-right" />
                    <SortableHead label="COGS" k="cogs" className="text-right" />
                    <SortableHead label="Marge brute" k="marge_brute" className="text-right" />
                    <SortableHead label="Coût RH" k="cout_rh" className="text-right" />
                    <SortableHead label="Marge directe" k="marge_directe" className="text-right" />
                    <SortableHead label="Jours décl." k="jours" className="text-right" />
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayKpis.map((k) => {
                    const project = projectsById.get(k.be_project_id);
                    const margeBrute = k.marge_brute_brut ?? k.marge_constatee_brut;
                    const margeDirecte =
                      k.marge_directe_brut ??
                      (k.marge_constatee_brut - k.cout_rh_declare);
                    return (
                      <TableRow
                        key={k.be_project_id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() =>
                          navigate(`${hubBasePath}/${k.code_projet}/budget`)
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] h-5">
                              {k.code_projet}
                            </Badge>
                            <span className="font-medium text-sm truncate">
                              {k.nom_projet ?? project?.nom_projet ?? '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {k.nb_affaires}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {k.ca_constate_brut > 0 ? eur(k.ca_constate_brut) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {k.cogs_constate_brut > 0 ? eur(k.cogs_constate_brut) : '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums font-semibold',
                            margeBrute < 0 && 'text-red-600',
                            margeBrute > 0 && 'text-emerald-600',
                          )}
                        >
                          {margeBrute !== 0 ? eur(margeBrute) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {k.cout_rh_declare > 0 ? eur(k.cout_rh_declare) : '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums font-semibold',
                            margeDirecte < 0 && 'text-red-600',
                            margeDirecte > 0 && 'text-emerald-600',
                          )}
                        >
                          {margeDirecte !== 0 ? eur(margeDirecte) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {k.jours_declares > 0 ? `${num(k.jours_declares)} j` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${hubBasePath}/${k.code_projet}/budget`);
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
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

interface KpiInlineProps {
  label: string;
  icon: React.ElementType;
  value: string;
}

export function KpiInline({ label, icon: Icon, value }: KpiInlineProps) {
  return (
    <span className="flex items-center gap-1 text-xs">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
