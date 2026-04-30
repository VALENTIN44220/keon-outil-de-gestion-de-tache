import { useMemo } from 'react';
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

interface BEProjectsAffairesViewProps {
  /** Projets actuellement filtres dans le dashboard. */
  projects: BEProject[];
  hubBasePath: string;
}

/**
 * Vue "Synthese BE" centree sur les KPIs metier (CA / COGS / Marge / Temps / Cout RH).
 * Lit la vue v_be_project_synthese_kpi qui agrege les indicateurs des affaires
 * de chaque projet BE.
 */
export function BEProjectsAffairesView({
  projects,
  hubBasePath,
}: BEProjectsAffairesViewProps) {
  const navigate = useNavigate();
  const { data: kpis = [], isLoading } = useBEProjectsSyntheseKpi();

  // Filtre les KPIs sur les projets actuellement visibles
  const visibleProjectIds = useMemo(
    () => new Set(projects.map((p) => p.id)),
    [projects],
  );
  const filteredKpis = useMemo(
    () => kpis.filter((k) => visibleProjectIds.has(k.be_project_id)),
    [kpis, visibleProjectIds],
  );

  // Totaux globaux (toutes les KPIs visibles consolidees)
  const totals = useMemo(() => {
    const t = {
      nb_projets: filteredKpis.length,
      nb_affaires: 0,
      ca_engage: 0,
      ca_constate: 0,
      cogs_constate: 0,
      marge_brute: 0,
      cout_rh_declare: 0,
      marge_directe: 0,
      jours_declares: 0,
    };
    for (const k of filteredKpis) {
      t.nb_affaires += k.nb_affaires;
      t.ca_engage += k.ca_engage_brut;
      t.ca_constate += k.ca_constate_brut;
      t.cogs_constate += k.cogs_constate_brut;
      t.marge_brute += (k.marge_brute_brut ?? k.marge_constatee_brut);
      t.cout_rh_declare += k.cout_rh_declare;
      t.marge_directe += (k.marge_directe_brut ?? (k.marge_constatee_brut - k.cout_rh_declare));
      t.jours_declares += k.jours_declares;
    }
    return t;
  }, [filteredKpis]);

  const sortedKpis = useMemo(
    () =>
      [...filteredKpis].sort(
        (a, b) =>
          (b.ca_constate_brut + b.ca_engage_brut) -
          (a.ca_constate_brut + a.ca_engage_brut),
      ),
    [filteredKpis],
  );

  // Match nom_projet projet manquant via les projets actuels (si la vue ne l'a pas)
  const projectsById = useMemo(() => {
    const m = new Map<string, BEProject>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
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

      {/* Tableau par projet */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {sortedKpis.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucun projet BE avec données pour les filtres actuels.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Projet</TableHead>
                    <TableHead className="text-right">Affaires</TableHead>
                    <TableHead className="text-right">CA Constaté</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Marge brute</TableHead>
                    <TableHead className="text-right">Coût RH</TableHead>
                    <TableHead className="text-right">Marge directe</TableHead>
                    <TableHead className="text-right">Jours décl.</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedKpis.map((k) => {
                    const project = projectsById.get(k.be_project_id);
                    const margeBrute = k.marge_brute_brut ?? k.marge_constatee_brut;
                    const margeDirecte = k.marge_directe_brut
                      ?? (k.marge_constatee_brut - k.cout_rh_declare);
                    const bruteNeg = margeBrute < 0;
                    const directeNeg = margeDirecte < 0;
                    return (
                      <TableRow
                        key={k.be_project_id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => navigate(`${hubBasePath}/${k.code_projet}/budget`)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] h-5"
                              >
                                {k.code_projet}
                              </Badge>
                              <span className="font-medium text-sm truncate">
                                {k.nom_projet ?? project?.nom_projet ?? '—'}
                              </span>
                            </div>
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
                            bruteNeg && 'text-red-600',
                            !bruteNeg && margeBrute > 0 && 'text-emerald-600',
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
                            directeNeg && 'text-red-600',
                            !directeNeg && margeDirecte > 0 && 'text-emerald-600',
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
                            title="Ouvrir le budget"
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
