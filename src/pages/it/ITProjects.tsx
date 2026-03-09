import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useITProjects } from '@/hooks/useITProjects';
import { ITProject, ITProjectStatus, ITProjectPilier, IT_PROJECT_STATUS_CONFIG, IT_PROJECT_TYPE_CONFIG, IT_PROJECT_PHASES, IT_PROJECT_PILIER_CONFIG, STATUT_FDR_CONFIG, StatutFDR, ITProjectPhase } from '@/types/itProject';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus, Monitor, Search, Download, Save, RotateCcw, Filter,
  FolderKanban, AlertTriangle, TrendingUp, ArrowUpDown, ChevronRight, Target,
  FolderOpen, Bookmark
} from 'lucide-react';
import { format, subMonths, startOfMonth, startOfYear, isAfter } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ITProjectFormDialog } from '@/components/it/ITProjectFormDialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { toast } from 'sonner';

const NONE = '__none__';
const LS_KEY = 'it_project_filters';
const LS_CONTEXTS_KEY = 'it_project_filter_contexts';

type PeriodFilter = 'all' | 'month' | 'last3' | 'last6' | 'year';
type ProgressFilter = 'all' | 'lt25' | '25-50' | '50-75' | 'gt75' | '100';

interface Filters {
  period: PeriodFilter;
  entiteId: string;
  responsableItId: string;
  statut: string;
  progress: ProgressFilter;
  pilier: string;
  search: string;
  statutFdr: string;
  phase: string;
}

interface FilterContext {
  name: string;
  filters: Filters;
  isDefault?: boolean;
}

const DEFAULT_FILTERS: Filters = {
  period: 'all',
  entiteId: NONE,
  responsableItId: NONE,
  statut: 'all',
  progress: 'all',
  pilier: 'all',
  search: '',
  statutFdr: 'all',
  phase: 'all',
};

const STANDARD_CONTEXT: FilterContext = {
  name: 'Standard',
  isDefault: true,
  filters: {
    ...DEFAULT_FILTERS,
    statut: 'en_cours',
    statutFdr: 'fdr_2027',
  },
};

// Helper to load contexts from localStorage
function loadContexts(): FilterContext[] {
  try {
    const stored = localStorage.getItem(LS_CONTEXTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [STANDARD_CONTEXT];
}

function saveContexts(contexts: FilterContext[]) {
  localStorage.setItem(LS_CONTEXTS_KEY, JSON.stringify(contexts));
}

const STATUS_COLORS: Record<string, string> = {
  backlog: '#94a3b8',
  en_cours: '#3b82f6',
  recette: '#f59e0b',
  deploye: '#10b981',
  cloture: '#6b7280',
  suspendu: '#ef4444',
};

const TYPE_COLORS = ['#8b5cf6', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#94a3b8'];

const PILIER_COLORS: Record<string, string> = {
  P1: '#3b82f6',
  P2: '#8b5cf6',
  P3: '#f59e0b',
  P4: '#ef4444',
  P5: '#10b981',
};

type SortKey = 'code_projet_digital' | 'nom_projet' | 'type_projet' | 'statut' | 'phase_courante' | 'progress' | 'date_fin_prevue';

export default function ITProjects() {
  const navigate = useNavigate();
  const { projects, isLoading } = useITProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [contextName, setContextName] = useState('');

  // Lookup data
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);

  // Filter contexts
  const [contexts, setContexts] = useState<FilterContext[]>(loadContexts);

  // Filters — initialize from localStorage or standard context
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) return { ...DEFAULT_FILTERS, ...JSON.parse(stored) };
    } catch {}
    // Apply standard context on first load
    const ctxs = loadContexts();
    const standard = ctxs.find(c => c.isDefault);
    return standard ? { ...DEFAULT_FILTERS, ...standard.filters } : DEFAULT_FILTERS;
  });

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('code_projet_digital');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    supabase.from('companies').select('id, name').order('name').then(({ data }) => setCompanies(data || []));
    supabase.from('profiles').select('id, display_name').order('display_name').then(({ data }) => setProfiles(data || []));
  }, []);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleSaveContext = () => {
    if (!contextName.trim()) return;
    const newCtx: FilterContext = { name: contextName.trim(), filters: { ...filters } };
    const updated = [...contexts.filter(c => c.name !== newCtx.name), newCtx];
    setContexts(updated);
    saveContexts(updated);
    setShowSaveDialog(false);
    setContextName('');
    toast.success(`Contexte "${newCtx.name}" sauvegardé`);
  };

  const loadContext = (ctx: FilterContext) => {
    const merged = { ...DEFAULT_FILTERS, ...ctx.filters };
    setFilters(merged);
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
    toast.success(`Contexte "${ctx.name}" chargé`);
  };

  const deleteContext = (name: string) => {
    const updated = contexts.filter(c => c.name !== name);
    setContexts(updated);
    saveContexts(updated);
    toast.success(`Contexte "${name}" supprimé`);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    localStorage.removeItem(LS_KEY);
  };

  // Apply filters
  const filtered = useMemo(() => {
    const now = new Date();
    const q = filters.search?.toLowerCase() || '';
    return projects.filter(p => {
      // Search multi-columns
      if (q) {
        const haystack = [
          p.nom_projet,
          p.code_projet_digital,
          p.description,
          p.fdr_commentaires,
          p.pilier,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Period
      if (filters.period !== 'all' && p.created_at) {
        let cutoff: Date;
        switch (filters.period) {
          case 'month': cutoff = startOfMonth(now); break;
          case 'last3': cutoff = startOfMonth(subMonths(now, 2)); break;
          case 'last6': cutoff = startOfMonth(subMonths(now, 5)); break;
          case 'year': cutoff = startOfYear(now); break;
          default: cutoff = new Date(0);
        }
        if (!isAfter(new Date(p.created_at), cutoff)) return false;
      }
      if (filters.entiteId !== NONE && p.company_id !== filters.entiteId) return false;
      if (filters.responsableItId !== NONE && p.chef_projet_it_id !== filters.responsableItId) return false;
      if (filters.statut !== 'all' && p.statut !== filters.statut) return false;
      if (filters.pilier !== 'all' && p.pilier !== filters.pilier) return false;
      if (filters.statutFdr !== 'all' && (p.statut_fdr || '') !== filters.statutFdr) return false;
      if (filters.phase !== 'all' && (p.phase_courante || '') !== filters.phase) return false;
      // Progress
      const prog = p.progress || 0;
      switch (filters.progress) {
        case 'lt25': if (prog >= 25) return false; break;
        case '25-50': if (prog < 25 || prog > 50) return false; break;
        case '50-75': if (prog < 50 || prog > 75) return false; break;
        case 'gt75': if (prog <= 75 || prog >= 100) return false; break;
        case '100': if (prog < 100) return false; break;
      }
      return true;
    });
  }, [projects, filters]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: any = a[sortKey] ?? '';
      let vb: any = b[sortKey] ?? '';
      if (sortKey === 'progress') { va = a.progress || 0; vb = b.progress || 0; }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const enCours = filtered.filter(p => p.statut === 'en_cours').length;
    const enRetard = filtered.filter(p => {
      if (!p.date_fin_prevue) return false;
      if (['deploye', 'cloture'].includes(p.statut)) return false;
      return new Date(p.date_fin_prevue) < today;
    }).length;
    const avgProgress = filtered.length > 0
      ? Math.round(filtered.reduce((s, p) => s + (p.progress || 0), 0) / filtered.length)
      : 0;
    return { total: filtered.length, enCours, enRetard, avgProgress };
  }, [filtered]);

  // Chart: par statut
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(p => { counts[p.statut] = (counts[p.statut] || 0) + 1; });
    return Object.entries(IT_PROJECT_STATUS_CONFIG).map(([key, cfg]) => ({
      name: cfg.label, value: counts[key] || 0, fill: STATUS_COLORS[key] || '#94a3b8',
    })).filter(d => d.value > 0);
  }, [filtered]);

  // Chart: par type
  const typeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(p => { const t = p.type_projet || 'autre'; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(IT_PROJECT_TYPE_CONFIG).map(([key, cfg]) => ({
      name: cfg.label, value: counts[key] || 0,
    })).filter(d => d.value > 0);
  }, [filtered]);

  // Chart: par pilier
  const pilierChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(p => { if (p.pilier) counts[p.pilier] = (counts[p.pilier] || 0) + 1; });
    return (Object.entries(IT_PROJECT_PILIER_CONFIG) as [string, typeof IT_PROJECT_PILIER_CONFIG['P1']][]).map(([key, cfg]) => ({
      name: `${key} — ${cfg.label}`,
      value: counts[key] || 0,
      fill: PILIER_COLORS[key] || '#94a3b8',
    })).filter(d => d.value > 0);
  }, [filtered]);

  // Chart: par phase
  const phaseChartData = useMemo(() => {
    return IT_PROJECT_PHASES.map(phase => {
      const inPhase = filtered.filter(p => p.phase_courante === phase.value);
      const avgProg = inPhase.length > 0
        ? Math.round(inPhase.reduce((s, p) => s + (p.progress || 0), 0) / inPhase.length)
        : 0;
      return { name: phase.label.split(' /')[0].split(' &')[0], count: inPhase.length, avgProgress: avgProg };
    });
  }, [filtered]);

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-background/95 backdrop-blur">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Projets IT — Tableau de bord</h1>
                <p className="text-sm text-muted-foreground">Vue consolidée du portefeuille projets digitaux</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/it/projects/import-fdr')} className="gap-2">
                <Download className="h-4 w-4" /> Importer FDR
              </Button>
              <Button onClick={() => setShowCreate(true)} className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25">
                <Plus className="h-4 w-4" /> Nouveau projet
              </Button>
            </div>
          </div>

          {/* Filters bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Filter className="h-4 w-4" /> FILTRES
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher projet..."
                  value={filters.search}
                  onChange={e => setFilter('search', e.target.value)}
                  className="h-8 text-xs w-[200px] pl-8"
                />
              </div>
              <Select value={filters.period} onValueChange={v => setFilter('period', v as PeriodFilter)}>
                <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Période" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                  <SelectItem value="last3">3 derniers mois</SelectItem>
                  <SelectItem value="last6">6 derniers mois</SelectItem>
                  <SelectItem value="year">Cette année</SelectItem>
                </SelectContent>
              </Select>
              <SearchableSelect
                value={filters.entiteId}
                onValueChange={v => setFilter('entiteId', v)}
                options={[{ value: NONE, label: 'Toutes sociétés' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
                placeholder="Société"
                searchPlaceholder="Rechercher société..."
                triggerClassName="h-8 text-xs w-[180px]"
              />
              <SearchableSelect
                value={filters.responsableItId}
                onValueChange={v => setFilter('responsableItId', v)}
                options={[{ value: NONE, label: 'Tous responsables' }, ...profiles.map(p => ({ value: p.id, label: p.display_name }))]}
                placeholder="Responsable IT"
                searchPlaceholder="Rechercher responsable..."
                triggerClassName="h-8 text-xs w-[200px]"
              />
              <Select value={filters.statut} onValueChange={v => setFilter('statut', v)}>
                <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {Object.entries(IT_PROJECT_STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.statutFdr} onValueChange={v => setFilter('statutFdr', v)}>
                <SelectTrigger className="h-8 text-xs w-[170px]"><SelectValue placeholder="Statut FDR" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts FDR</SelectItem>
                  {(Object.entries(STATUT_FDR_CONFIG) as [StatutFDR, typeof STATUT_FDR_CONFIG['non_soumis']][]).map(([k, cfg]) => (
                    <SelectItem key={k} value={k}>{cfg.icon} {cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.phase} onValueChange={v => setFilter('phase', v)}>
                <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Phase" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes phases</SelectItem>
                  {IT_PROJECT_PHASES.map(ph => (
                    <SelectItem key={ph.value} value={ph.value}>{ph.label.split(' /')[0]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.pilier} onValueChange={v => setFilter('pilier', v)}>
                <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Pilier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous piliers</SelectItem>
                  {(Object.entries(IT_PROJECT_PILIER_CONFIG) as [string, typeof IT_PROJECT_PILIER_CONFIG['P1']][]).map(([k, cfg]) => (
                    <SelectItem key={k} value={k}>{k} — {cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.progress} onValueChange={v => setFilter('progress', v as ProgressFilter)}>
                <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Avancement" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="lt25">{'< 25%'}</SelectItem>
                  <SelectItem value="25-50">25–50%</SelectItem>
                  <SelectItem value="50-75">50–75%</SelectItem>
                  <SelectItem value="gt75">{'> 75%'}</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Context actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowSaveDialog(true)}>
                <Save className="h-3 w-3" /> Enregistrer
              </Button>
              {/* Load context dropdown */}
              <Select value="__load__" onValueChange={name => {
                const ctx = contexts.find(c => c.name === name);
                if (ctx) loadContext(ctx);
              }}>
                <SelectTrigger className="h-7 text-xs w-[160px]">
                  <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Charger contexte</span>
                </SelectTrigger>
                <SelectContent>
                  {contexts.length === 0 ? (
                    <SelectItem value="__load__" disabled>Aucun contexte</SelectItem>
                  ) : (
                    contexts.map(ctx => (
                      <SelectItem key={ctx.name} value={ctx.name}>
                        <span className="flex items-center gap-1.5">
                          {ctx.isDefault && <Bookmark className="h-3 w-3 text-amber-500" />}
                          {ctx.name}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={resetFilters}>
                <RotateCcw className="h-3 w-3" /> Réinitialiser
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total projets', value: kpis.total, icon: FolderKanban, color: 'text-foreground', bg: 'bg-muted' },
                  { label: 'En cours', value: kpis.enCours, icon: Monitor, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'En retard', value: kpis.enRetard, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
                  { label: 'Avancement moyen', value: `${kpis.avgProgress}%`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
                ].map(k => {
                  const Icon = k.icon;
                  return (
                    <Card key={k.label}>
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', k.bg)}>
                          <Icon className={cn('h-6 w-6', k.color)} />
                        </div>
                        <div>
                          <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
                          <p className="text-xs text-muted-foreground">{k.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Par statut */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Par statut</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusChartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={70} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                          <Bar dataKey="value" name="Projets" radius={[0, 4, 4, 0]}>
                            {statusChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Par type (Donut) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Par type de projet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={typeChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}
                            label={({ name, percent }) => percent > 0.05 ? `${name} (${Math.round(percent * 100)}%)` : ''}>
                            {typeChartData.map((_, i) => (
                              <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Par pilier (Donut) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-violet-600" /> Par pilier
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      {pilierChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pilierChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}
                              label={({ name, percent }) => percent > 0.05 ? `${name.split(' — ')[0]} (${Math.round(percent * 100)}%)` : ''}>
                              {pilierChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Aucun pilier renseigné</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Par phase */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Avancement par phase</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {phaseChartData.map(phase => (
                      <div key={phase.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{phase.name}</span>
                          <span className="font-medium">{phase.count} projets · {phase.avgProgress}%</span>
                        </div>
                        <Progress value={phase.avgProgress} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-violet-600" />
                    Projets filtrés ({sorted.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          {([
                            ['code_projet_digital', 'Code'],
                            ['nom_projet', 'Nom'],
                            ['type_projet', 'Type'],
                            ['statut', 'Statut'],
                            ['phase_courante', 'Phase'],
                            ['progress', 'Avancement'],
                            ['date_fin_prevue', 'Date fin'],
                          ] as [SortKey, string][]).map(([key, label]) => (
                            <th
                              key={key}
                              className="text-left px-3 py-2 font-medium text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none"
                              onClick={() => toggleSort(key)}
                            >
                              <span className="flex items-center gap-1">
                                {label}
                                <ArrowUpDown className={cn('h-3 w-3', sortKey === key ? 'text-violet-600' : 'opacity-30')} />
                              </span>
                            </th>
                          ))}
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Pilier</th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">FDR</th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Chef IT</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map(p => {
                          const sc = IT_PROJECT_STATUS_CONFIG[p.statut] || IT_PROJECT_STATUS_CONFIG.backlog;
                          const tc = p.type_projet ? IT_PROJECT_TYPE_CONFIG[p.type_projet] : null;
                          const pc = p.pilier ? IT_PROJECT_PILIER_CONFIG[p.pilier as ITProjectPilier] : null;
                          const fdrCfg = p.statut_fdr ? STATUT_FDR_CONFIG[p.statut_fdr as StatutFDR] : null;
                          const today = new Date(); today.setHours(0, 0, 0, 0);
                          const isLate = p.date_fin_prevue && !['deploye', 'cloture'].includes(p.statut) && new Date(p.date_fin_prevue) < today;
                          return (
                            <tr
                              key={p.id}
                              className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                              onClick={() => navigate(`/it/projects/${p.code_projet_digital}/overview`)}
                            >
                              <td className="px-3 py-2.5 font-mono text-xs text-violet-600 font-medium">{p.code_projet_digital}</td>
                              <td className="px-3 py-2.5 font-medium max-w-[250px] truncate">{p.nom_projet}</td>
                              <td className="px-3 py-2.5 text-xs">{tc ? `${tc.icon} ${tc.label}` : '—'}</td>
                              <td className="px-3 py-2.5">
                                <Badge className={cn(sc.className, 'border text-[10px]')}>{sc.label}</Badge>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                {p.phase_courante ? IT_PROJECT_PHASES.find(ph => ph.value === p.phase_courante)?.label.split(' /')[0] || p.phase_courante : '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Progress value={p.progress || 0} className="h-1.5 w-16" />
                                  <span className="text-xs font-medium w-8">{p.progress || 0}%</span>
                                </div>
                              </td>
                              <td className={cn('px-3 py-2.5 text-xs', isLate && 'text-red-500 font-medium')}>
                                {p.date_fin_prevue ? format(new Date(p.date_fin_prevue), 'dd/MM/yy') : '—'}
                                {isLate && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                              </td>
                              <td className="px-3 py-2.5">
                                {pc ? (
                                  <Badge className={cn(pc.className, 'border text-[10px]')}>{p.pilier}</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {fdrCfg ? (
                                  <Badge className={cn(fdrCfg.className, 'border text-[10px]')}>{fdrCfg.icon} {fdrCfg.label}</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[120px]">
                                {p.chef_projet_it?.display_name || '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </td>
                            </tr>
                          );
                        })}
                        {sorted.length === 0 && (
                          <tr>
                            <td colSpan={11} className="text-center py-12 text-muted-foreground">
                              Aucun projet ne correspond aux filtres
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <ITProjectFormDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Save context dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Save className="h-4 w-4" /> Enregistrer le contexte de filtres
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label className="text-xs">Nom du contexte</Label>
              <Input
                placeholder="Ex: Projets FDR 2027 actifs"
                value={contextName}
                onChange={e => setContextName(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleSaveContext()}
              />
            </div>
            {contexts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium">Contextes existants :</p>
                <div className="flex flex-wrap gap-1">
                  {contexts.map(ctx => (
                    <Badge key={ctx.name} variant="outline" className="text-[10px] gap-1">
                      {ctx.isDefault && <Bookmark className="h-2.5 w-2.5 text-amber-500" />}
                      {ctx.name}
                      {!ctx.isDefault && (
                        <button
                          onClick={() => deleteContext(ctx.name)}
                          className="ml-1 text-destructive hover:text-destructive/80"
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(false)}>Annuler</Button>
              <Button size="sm" onClick={handleSaveContext} disabled={!contextName.trim()}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
