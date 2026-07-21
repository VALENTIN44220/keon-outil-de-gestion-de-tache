/**
 * BEBudgetGlobal — Vue globale du budget Bureau d'Études.
 *
 * Affiche :
 *  - KPI globaux (CA, COGS, marges, RH)
 *  - Tableau par projet (triable, filtrable)
 *  - Affaires dépliables pour chaque projet
 *  - Clic sur une affaire → /be/projects/:code/budget/:codeAffaire
 */

import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import {
  useBEProjectsSyntheseKpi,
  type BEProjectSyntheseKPI,
} from '@/hooks/useBEProjectsSyntheseKpi';
import { useBEProjects } from '@/hooks/useBEProjects';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ListChecks,
  Receipt,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Coins,
  Building2,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ExternalLink,
  FolderTree,
  Rows3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BEAffaire, BEAffaireBudgetKPI } from '@/types/beAffaire';
import {
  BE_AFFAIRE_STATUS_CONFIG,
  extractActiviteFromAffaire,
  extractProjectCodeFromAffaire,
} from '@/types/beAffaire';
import type { BEProject } from '@/types/beProject';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sb = supabase as any;

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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  hint?: string;
  emphasis?: boolean;
}

function KpiCard({ label, value, icon: Icon, accent, hint, emphasis }: KpiCardProps) {
  return (
    <Card className={cn('border-border/50', emphasis && 'border-primary/30 bg-primary/[0.02]')}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg shrink-0', accent)}>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BEBudgetGlobal() {
  const navigate = useNavigate();

  const [sortKey, setSortKey] = useState<SortKey>('ca_constate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedActivites, setSelectedActivites] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'projet' | 'affaire'>('projet');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // BUG-00017 / 00018 : filtres par statut d'affaire et par période (date_ouverture).
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodMode, setPeriodMode] = useState<'all' | 'year' | 'after' | 'before' | 'between'>('all');
  const [periodYear, setPeriodYear] = useState<string>('');
  const [periodFrom, setPeriodFrom] = useState<string>('');
  const [periodTo, setPeriodTo] = useState<string>('');

  const { data: kpis = [], isLoading: kpisLoading } = useBEProjectsSyntheseKpi();
  const { projects } = useBEProjects();

  // Fetch all affaires (lean select)
  const { data: allAffaires = [] } = useQuery<BEAffaire[]>({
    queryKey: ['all-be-affaires-budget'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('be_affaires')
        .select('id, be_project_id, code_affaire, libelle, status, date_ouverture, date_cloture')
        .order('code_affaire');
      // Propager l'erreur au lieu de retomber silencieusement sur une liste vide
      // (sinon un timeout/echec DB affiche « tout à 0 » sans le signaler).
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch all affaire-level KPIs
  const { data: affaireKpis = [], isError: affaireKpisError } = useQuery<BEAffaireBudgetKPI[]>({
    queryKey: ['all-be-affaire-kpis-budget'],
    queryFn: async () => {
      const { data, error } = await sb.from('v_be_affaire_budget_kpi').select('*');
      // Idem : un echec ne doit pas se traduire par des KPI à 0 silencieux.
      if (error) throw error;
      return data ?? [];
    },
  });

  // Index by project id
  const affairesByProject = useMemo(() => {
    const map = new Map<string, BEAffaire[]>();
    for (const a of allAffaires) {
      if (!map.has(a.be_project_id)) map.set(a.be_project_id, []);
      map.get(a.be_project_id)!.push(a);
    }
    return map;
  }, [allAffaires]);

  // Liste des activités disponibles (dérivée dynamiquement)
  const availableActivites = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAffaires) {
      const act = extractActiviteFromAffaire(a.code_affaire);
      if (act) set.add(act);
    }
    return [...set].sort();
  }, [allAffaires]);

  const toggleActivite = (act: string) =>
    setSelectedActivites((prev) => {
      const next = new Set(prev);
      if (next.has(act)) next.delete(act);
      else next.add(act);
      return next;
    });

  // True si l'affaire correspond au filtre activité (ou si aucun filtre actif)
  const affaireMatchesActivite = (a: BEAffaire): boolean => {
    if (selectedActivites.size === 0) return true;
    const act = extractActiviteFromAffaire(a.code_affaire);
    return act !== null && selectedActivites.has(act);
  };

  // BUG-00017 : filtre par statut d'affaire.
  const affaireMatchesStatus = (a: BEAffaire): boolean =>
    statusFilter === 'all' || a.status === statusFilter;

  // BUG-00018 : filtre par période sur la date d'ouverture (année / après / avant / entre).
  const affaireMatchesPeriod = (a: BEAffaire): boolean => {
    if (periodMode === 'all') return true;
    const d = a.date_ouverture ? String(a.date_ouverture).slice(0, 10) : null;
    if (!d) return false;
    switch (periodMode) {
      case 'year':    return !periodYear || d.slice(0, 4) === periodYear;
      case 'after':   return !periodFrom || d >= periodFrom;
      case 'before':  return !periodTo || d <= periodTo;
      case 'between': return (!periodFrom || d >= periodFrom) && (!periodTo || d <= periodTo);
      default:        return true;
    }
  };

  // Prédicat combiné appliqué partout (vues projet + affaire).
  const affaireMatchesAll = (a: BEAffaire): boolean =>
    affaireMatchesActivite(a) && affaireMatchesStatus(a) && affaireMatchesPeriod(a);

  // Statuts et années réellement présents dans les données.
  const availableStatuts = useMemo(() => {
    const s = new Set<string>();
    for (const a of allAffaires) if (a.status) s.add(a.status);
    return [...s].sort();
  }, [allAffaires]);
  const availableAnnees = useMemo(() => {
    const s = new Set<string>();
    for (const a of allAffaires) if (a.date_ouverture) s.add(String(a.date_ouverture).slice(0, 4));
    return [...s].sort().reverse();
  }, [allAffaires]);

  const affaireKpisById = useMemo(() => {
    const map = new Map<string, BEAffaireBudgetKPI>();
    for (const k of affaireKpis) map.set(k.be_affaire_id, k);
    return map;
  }, [affaireKpis]);

  const projectsById = useMemo(() => {
    const m = new Map<string, BEProject>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  // Un filtre au niveau affaire (activité, statut ou période) est actif → il faut
  // recalculer les métriques projet sur les seules affaires correspondantes.
  const affaireFilterActive =
    selectedActivites.size > 0 || statusFilter !== 'all' || periodMode !== 'all';

  // Agrège les KPIs d'une liste d'affaires en métriques de ligne.
  const aggregateAffaires = (list: BEAffaire[]) => {
    const m = {
      nb_affaires: 0, ca_engage: 0, ca_constate: 0, cogs_constate: 0,
      marge_brute: 0, cout_rh: 0, marge_directe: 0, jours: 0,
    };
    for (const a of list) {
      m.nb_affaires += 1;
      const k = affaireKpisById.get(a.id);
      if (!k) continue;
      m.ca_engage += k.ca_engage_brut;
      m.ca_constate += k.ca_constate_brut;
      m.cogs_constate += k.cogs_constate_brut;
      m.marge_brute += k.marge_brute_brut;
      m.cout_rh += k.cout_rh_declare;
      m.marge_directe += k.marge_directe_brut;
      m.jours += k.jours_declares;
    }
    return m;
  };

  // Vue "Par projet" : { k, m } où m = métriques affichées. Quand un filtre
  // activité est actif, m est recalculé sur les SEULES affaires correspondantes
  // (pour ne pas afficher les chiffres des autres activités du projet).
  const projectRows = useMemo(() => {
    let rows = kpis.map((k) => {
      const m = affaireFilterActive
        ? aggregateAffaires(
            (affairesByProject.get(k.be_project_id) ?? []).filter(affaireMatchesAll),
          )
        : {
            nb_affaires: k.nb_affaires,
            ca_engage: k.ca_engage_brut,
            ca_constate: k.ca_constate_brut,
            cogs_constate: k.cogs_constate_brut,
            marge_brute: k.marge_brute_brut,
            cout_rh: k.cout_rh_declare,
            marge_directe: k.marge_directe_brut,
            jours: k.jours_declares,
          };
      return { k, m };
    });

    // Filtre affaire (activité / statut / période) : ne garde que les projets
    // ayant ≥1 affaire correspondante.
    if (affaireFilterActive) rows = rows.filter((r) => r.m.nb_affaires > 0);

    // Filtres rapides (appliqués sur les métriques effectives).
    if (filterMode === 'with_ca') rows = rows.filter((r) => r.m.ca_constate > 0 || r.m.ca_engage > 0);
    else if (filterMode === 'with_rh') rows = rows.filter((r) => r.m.jours > 0);
    else if (filterMode === 'neg_margin') rows = rows.filter((r) => r.m.marge_brute < 0);
    else if (filterMode === 'pos_margin') rows = rows.filter((r) => r.m.marge_brute > 0);

    const metricKey: Record<Exclude<SortKey, 'code_projet'>, keyof typeof rows[number]['m']> = {
      nb_affaires: 'nb_affaires',
      ca_constate: 'ca_constate',
      cogs: 'cogs_constate',
      marge_brute: 'marge_brute',
      cout_rh: 'cout_rh',
      marge_directe: 'marge_directe',
      jours: 'jours',
    };
    rows.sort((a, b) => {
      if (sortKey === 'code_projet') {
        const cmp = a.k.code_projet.localeCompare(b.k.code_projet);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const f = metricKey[sortKey];
      return sortDir === 'asc' ? a.m[f] - b.m[f] : b.m[f] - a.m[f];
    });
    return rows;
  }, [kpis, sortKey, sortDir, filterMode, affaireFilterActive, selectedActivites, statusFilter, periodMode, periodYear, periodFrom, periodTo, affairesByProject, affaireKpisById]);

  // Vue "Par affaire" : liste plate, sans regroupement projet, filtrée par
  // activité + filtre rapide. Permet de voir toutes les affaires d'une activité.
  const affaireRows = useMemo(() => {
    let rows = allAffaires
      .filter(affaireMatchesAll)
      .map((a) => ({
        a,
        k: affaireKpisById.get(a.id),
        project: projectsById.get(a.be_project_id),
      }));

    if (filterMode === 'with_ca')
      rows = rows.filter((r) => (r.k?.ca_constate_brut ?? 0) > 0 || (r.k?.ca_engage_brut ?? 0) > 0);
    else if (filterMode === 'with_rh')
      rows = rows.filter((r) => (r.k?.jours_declares ?? 0) > 0);
    else if (filterMode === 'neg_margin')
      rows = rows.filter((r) => (r.k?.marge_brute_brut ?? 0) < 0);
    else if (filterMode === 'pos_margin')
      rows = rows.filter((r) => (r.k?.marge_brute_brut ?? 0) > 0);

    const val = (r: (typeof rows)[number]): number | string => {
      switch (sortKey) {
        case 'ca_constate':   return r.k?.ca_constate_brut ?? 0;
        case 'cogs':          return r.k?.cogs_constate_brut ?? 0;
        case 'marge_brute':   return r.k?.marge_brute_brut ?? 0;
        case 'cout_rh':       return r.k?.cout_rh_declare ?? 0;
        case 'marge_directe': return r.k?.marge_directe_brut ?? 0;
        case 'jours':         return r.k?.jours_declares ?? 0;
        default:              return r.a.code_affaire; // code_projet / nb_affaires -> tri par code
      }
    };
    rows.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [allAffaires, affaireKpisById, projectsById, filterMode, sortKey, sortDir, selectedActivites, statusFilter, periodMode, periodYear, periodFrom, periodTo]);

  // Nombre d'éléments affichés selon le mode courant.
  const currentCount = viewMode === 'affaire' ? affaireRows.length : projectRows.length;

  // Totaux globaux (cohérents avec le mode + les filtres actifs).
  const totals = useMemo(() => {
    const t = {
      nb_projets: 0, nb_affaires: 0, ca_engage: 0, ca_constate: 0,
      cogs_constate: 0, marge_brute: 0, cout_rh_declare: 0, marge_directe: 0,
      jours_declares: 0,
    };
    if (viewMode === 'affaire') {
      const projSet = new Set<string>();
      for (const r of affaireRows) {
        projSet.add(r.a.be_project_id);
        t.nb_affaires += 1;
        if (!r.k) continue;
        t.ca_engage += r.k.ca_engage_brut;
        t.ca_constate += r.k.ca_constate_brut;
        t.cogs_constate += r.k.cogs_constate_brut;
        t.marge_brute += r.k.marge_brute_brut;
        t.cout_rh_declare += r.k.cout_rh_declare;
        t.marge_directe += r.k.marge_directe_brut;
        t.jours_declares += r.k.jours_declares;
      }
      t.nb_projets = projSet.size;
    } else {
      t.nb_projets = projectRows.length;
      for (const { m } of projectRows) {
        t.nb_affaires += m.nb_affaires;
        t.ca_engage += m.ca_engage;
        t.ca_constate += m.ca_constate;
        t.cogs_constate += m.cogs_constate;
        t.marge_brute += m.marge_brute;
        t.cout_rh_declare += m.cout_rh;
        t.marge_directe += m.marge_directe;
        t.jours_declares += m.jours;
      }
    }
    return t;
  }, [viewMode, projectRows, affaireRows]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
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
      className={cn(
        'cursor-pointer select-none hover:text-foreground whitespace-nowrap',
        className,
      )}
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

  // ─── Render ───────────────────────────────────────────────────────────────

  if (kpisLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView="be-budget" onViewChange={() => {}} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Budget BE" />
          <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-72" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView="be-budget" onViewChange={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Budget BE" />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          <div className="space-y-4">

            {affaireKpisError && (
              <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                Les montants (CA, COGS, RH…) n'ont pas pu être chargés — les valeurs affichées peuvent être incomplètes.
                Réessayez dans un instant ; si le problème persiste, signalez-le.
              </div>
            )}

            {/* ── KPI globaux ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Affaires actives"
                value={`${totals.nb_affaires}`}
                icon={ListChecks}
                accent="bg-slate-500/10 text-slate-600"
                hint={`${totals.nb_projets} projets`}
              />
              <KpiCard
                label="CA Constaté"
                value={eur(totals.ca_constate)}
                icon={Receipt}
                accent="bg-indigo-500/10 text-indigo-600"
                hint={`Engagé ${eur(totals.ca_engage)}`}
              />
              <KpiCard
                label="COGS Constaté"
                value={eur(totals.cogs_constate)}
                icon={ReceiptText}
                accent="bg-amber-500/10 text-amber-600"
              />
              <KpiCard
                label={totals.marge_brute < 0 ? 'Marge brute —' : 'Marge brute'}
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
              <KpiCard
                label="Coût RH déclaré"
                value={eur(totals.cout_rh_declare)}
                icon={Coins}
                accent="bg-violet-500/10 text-violet-600"
                hint={`${num(totals.jours_declares)} j déclarés`}
              />
              <KpiCard
                label={totals.marge_directe < 0 ? 'Marge directe —' : 'Marge directe'}
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

            {/* ── Tableau ───────────────────────────────────────────────── */}
            <Card className="border-border/50">
              {/* Filter chips + sélecteur d'affichage */}
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
                <span className="text-xs text-muted-foreground ml-1">
                  — {currentCount}{' '}
                  {viewMode === 'affaire'
                    ? `affaire${currentCount !== 1 ? 's' : ''}`
                    : `projet${currentCount !== 1 ? 's' : ''}`}
                </span>

                {/* Bouton liste déroulante : regroupement par projet ou liste plate d'affaires */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="ml-auto gap-1.5 h-8">
                      {viewMode === 'affaire' ? (
                        <Rows3 className="h-3.5 w-3.5" />
                      ) : (
                        <FolderTree className="h-3.5 w-3.5" />
                      )}
                      {viewMode === 'affaire' ? 'Par affaire' : 'Par projet'}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Affichage</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={viewMode}
                      onValueChange={(v) => setViewMode(v as 'projet' | 'affaire')}
                    >
                      <DropdownMenuRadioItem value="projet">
                        <FolderTree className="h-3.5 w-3.5 mr-2" />
                        Regroupé par projet
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="affaire">
                        <Rows3 className="h-3.5 w-3.5 mr-2" />
                        Liste des affaires
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Filtre par code activité (3 dernières lettres du code affaire) */}
              {availableActivites.length > 0 && (
                <div className="flex items-center gap-1.5 px-4 pt-2 pb-0 flex-wrap">
                  <span className="text-[11px] font-medium text-muted-foreground mr-0.5">
                    Activité
                  </span>
                  {availableActivites.map((act) => {
                    const active = selectedActivites.has(act);
                    return (
                      <button
                        key={act}
                        onClick={() => toggleActivite(act)}
                        className={cn(
                          'text-xs font-mono px-2.5 py-1 rounded-full border transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                        )}
                      >
                        {act}
                      </button>
                    );
                  })}
                  {selectedActivites.size > 0 && (
                    <button
                      onClick={() => setSelectedActivites(new Set())}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
                    >
                      effacer
                    </button>
                  )}
                </div>
              )}

              {/* Filtre par statut d'affaire (BUG-00017) */}
              {availableStatuts.length > 0 && (
                <div className="flex items-center gap-1.5 px-4 pt-2 pb-0 flex-wrap">
                  <span className="text-[11px] font-medium text-muted-foreground mr-0.5">Statut</span>
                  {['all', ...availableStatuts].map((st) => {
                    const active = statusFilter === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-colors capitalize',
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                        )}
                      >
                        {st === 'all' ? 'Tous' : st.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Filtre par période sur la date d'ouverture (BUG-00018) */}
              <div className="flex items-center gap-2 px-4 pt-2 pb-0 flex-wrap">
                <span className="text-[11px] font-medium text-muted-foreground mr-0.5">Période (ouverture)</span>
                <select
                  value={periodMode}
                  onChange={(e) => setPeriodMode(e.target.value as typeof periodMode)}
                  className="h-8 text-xs border rounded-md bg-background px-2"
                >
                  <option value="all">Toutes</option>
                  <option value="year">Année</option>
                  <option value="after">Après le</option>
                  <option value="before">Avant le</option>
                  <option value="between">Entre</option>
                </select>
                {periodMode === 'year' && (
                  <select
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    className="h-8 text-xs border rounded-md bg-background px-2"
                  >
                    <option value="">— année —</option>
                    {availableAnnees.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
                {(periodMode === 'after' || periodMode === 'between') && (
                  <input
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    className="h-8 text-xs border rounded-md bg-background px-2"
                  />
                )}
                {periodMode === 'between' && <span className="text-xs text-muted-foreground">→</span>}
                {(periodMode === 'before' || periodMode === 'between') && (
                  <input
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    className="h-8 text-xs border rounded-md bg-background px-2"
                  />
                )}
                {(periodMode !== 'all' || statusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setPeriodMode('all'); setPeriodYear(''); setPeriodFrom(''); setPeriodTo('');
                      setStatusFilter('all');
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
                  >
                    réinitialiser
                  </button>
                )}
              </div>

              <CardContent className="p-0 mt-3">
                {currentCount === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {viewMode === 'affaire'
                      ? 'Aucune affaire pour ces critères.'
                      : 'Aucun projet BE pour ces critères.'}
                  </div>
                ) : viewMode === 'affaire' ? (
                  /* ── Vue plate : liste des affaires (sans regroupement projet) ── */
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <SortableHead label="Affaire" k="code_projet" />
                          <TableHead className="whitespace-nowrap">Projet</TableHead>
                          <SortableHead label="CA Constaté" k="ca_constate" className="text-right" />
                          <SortableHead label="COGS" k="cogs" className="text-right" />
                          <SortableHead label="Marge brute" k="marge_brute" className="text-right" />
                          <SortableHead label="Coût RH" k="cout_rh" className="text-right" />
                          <SortableHead label="Marge directe" k="marge_directe" className="text-right" />
                          <SortableHead label="Jours décl." k="jours" className="text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {affaireRows.map(({ a, k, project }) => {
                          const sc = BE_AFFAIRE_STATUS_CONFIG[a.status];
                          const aMarge = k?.marge_brute_brut ?? 0;
                          const aDirecte = k?.marge_directe_brut ?? 0;
                          const codeProjet =
                            project?.code_projet ??
                            extractProjectCodeFromAffaire(a.code_affaire) ??
                            '';
                          return (
                            <TableRow
                              key={a.id}
                              className="hover:bg-muted/30 cursor-pointer"
                              onClick={() =>
                                codeProjet &&
                                navigate(`/be/projects/${codeProjet}/budget/${a.code_affaire}`)
                              }
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    {a.code_affaire}
                                  </code>
                                  <span className="text-xs truncate max-w-[220px]">
                                    {a.libelle ?? '—'}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[10px] px-1.5 h-4 shrink-0 border', sc.className)}
                                  >
                                    {sc.label}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge variant="outline" className="font-mono text-[10px] h-5">
                                    {codeProjet || '—'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                                    {project?.nom_projet ?? ''}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">
                                {k && k.ca_constate_brut > 0 ? eur(k.ca_constate_brut) : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {k && k.cogs_constate_brut > 0 ? eur(k.cogs_constate_brut) : '—'}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right tabular-nums font-semibold',
                                  aMarge < 0 && 'text-red-600',
                                  aMarge > 0 && 'text-emerald-600',
                                )}
                              >
                                {aMarge !== 0 ? eur(aMarge) : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {k && k.cout_rh_declare > 0 ? eur(k.cout_rh_declare) : '—'}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right tabular-nums font-semibold',
                                  aDirecte < 0 && 'text-red-600',
                                  aDirecte > 0 && 'text-emerald-600',
                                )}
                              >
                                {aDirecte !== 0 ? eur(aDirecte) : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {k && k.jours_declares > 0 ? `${num(k.jours_declares)} j` : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  /* ── Vue regroupée par projet ── */
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          {/* expand + link col */}
                          <TableHead className="w-16" />
                          <SortableHead label="Projet" k="code_projet" />
                          <SortableHead label="Affaires" k="nb_affaires" className="text-right" />
                          <SortableHead label="CA Constaté" k="ca_constate" className="text-right" />
                          <SortableHead label="COGS" k="cogs" className="text-right" />
                          <SortableHead label="Marge brute" k="marge_brute" className="text-right" />
                          <SortableHead label="Coût RH" k="cout_rh" className="text-right" />
                          <SortableHead label="Marge directe" k="marge_directe" className="text-right" />
                          <SortableHead label="Jours décl." k="jours" className="text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectRows.map(({ k, m }) => {
                          const project = projectsById.get(k.be_project_id);
                          const margeBrute = m.marge_brute;
                          const margeDirecte = m.marge_directe;
                          const isExpanded = expanded.has(k.be_project_id);
                          const projectAffaires = (
                            affairesByProject.get(k.be_project_id) ?? []
                          ).filter(affaireMatchesActivite);

                          return (
                            <Fragment key={k.be_project_id}>
                              {/* Project row */}
                              <TableRow
                                className="hover:bg-muted/20 cursor-pointer"
                                onClick={() => toggleExpand(k.be_project_id)}
                              >
                                <TableCell className="w-16 pr-0">
                                  <div className="flex items-center gap-1">
                                    {isExpanded
                                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      title="Ouvrir page budget projet"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/be/projects/${k.code_projet}/budget`);
                                      }}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    </Button>
                                  </div>
                                </TableCell>
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
                                  {m.nb_affaires}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">
                                  {m.ca_constate > 0 ? eur(m.ca_constate) : '—'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {m.cogs_constate > 0 ? eur(m.cogs_constate) : '—'}
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
                                  {m.cout_rh > 0 ? eur(m.cout_rh) : '—'}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    'text-right tabular-nums font-semibold',
                                    margeDirecte < 0 && 'text-red-600',
                                    margeDirecte > 0 && 'text-emerald-600',
                                  )}
                                >
                                  {margeDirecte !== 0 ? eur(margeDirecte) : '—'}
                                  {m.ca_constate > 0 && margeDirecte !== 0 && (
                                    <span className="block text-[10px] font-normal text-muted-foreground">
                                      {Math.round((margeDirecte / m.ca_constate) * 100)}% du CA
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {m.jours > 0 ? `${num(m.jours)} j` : '—'}
                                </TableCell>
                              </TableRow>

                              {/* Affaires rows (expanded) */}
                              {isExpanded && (
                                projectAffaires.length === 0 ? (
                                  <TableRow key={`${k.be_project_id}-empty`} className="bg-muted/10">
                                    <TableCell colSpan={9} className="pl-12 py-2 text-xs text-muted-foreground italic">
                                      Aucune affaire pour ce projet
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  projectAffaires.map((affaire) => {
                                    const akpi = affaireKpisById.get(affaire.id);
                                    const sc = BE_AFFAIRE_STATUS_CONFIG[affaire.status];
                                    const aMarge = akpi?.marge_brute_brut ?? 0;
                                    const aDirecte = akpi?.marge_directe_brut ?? 0;
                                    return (
                                      <TableRow
                                        key={affaire.id}
                                        className="bg-muted/10 hover:bg-muted/30 cursor-pointer border-l-2 border-l-primary/20"
                                        onClick={() =>
                                          navigate(
                                            `/be/projects/${k.code_projet}/budget/${affaire.code_affaire}`,
                                          )
                                        }
                                      >
                                        <TableCell />
                                        <TableCell className="pl-10">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                              {affaire.code_affaire}
                                            </span>
                                            <span className="text-xs truncate">
                                              {affaire.libelle ?? '—'}
                                            </span>
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                'text-[10px] px-1.5 h-4 shrink-0 border',
                                                sc.className,
                                              )}
                                            >
                                              {sc.label}
                                            </Badge>
                                          </div>
                                        </TableCell>
                                        <TableCell />
                                        <TableCell className="text-right tabular-nums text-sm">
                                          {akpi && akpi.ca_constate_brut > 0
                                            ? eur(akpi.ca_constate_brut)
                                            : '—'}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                          {akpi && akpi.cogs_constate_brut > 0
                                            ? eur(akpi.cogs_constate_brut)
                                            : '—'}
                                        </TableCell>
                                        <TableCell
                                          className={cn(
                                            'text-right tabular-nums text-sm',
                                            aMarge < 0 && 'text-red-600',
                                            aMarge > 0 && 'text-emerald-600',
                                          )}
                                        >
                                          {aMarge !== 0 ? eur(aMarge) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                          {akpi && akpi.cout_rh_declare > 0
                                            ? eur(akpi.cout_rh_declare)
                                            : '—'}
                                        </TableCell>
                                        <TableCell
                                          className={cn(
                                            'text-right tabular-nums text-sm',
                                            aDirecte < 0 && 'text-red-600',
                                            aDirecte > 0 && 'text-emerald-600',
                                          )}
                                        >
                                          {aDirecte !== 0 ? eur(aDirecte) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm">
                                          {akpi && akpi.jours_declares > 0
                                            ? `${num(akpi.jours_declares)} j`
                                            : '—'}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                )
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
