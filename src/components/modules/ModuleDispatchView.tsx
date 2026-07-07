/**
 * ModuleDispatchView — composant generique de dispatch de module.
 *
 * Mutualise le squelette commun a IT / Maintenance / Logistique :
 *   - chrome (Sidebar + Header)
 *   - titre + actions (refresh, "Nouvelle demande", extras)
 *   - tabs Demandes / Analyse
 *   - grille KPI variable
 *   - ModuleQuickFilters (table / kanban / calendar + masquer terminees + mes demandes)
 *   - CrossFiltersPanel (contextes sauvegardables)
 *   - Filtres (search + statut + filtres extras)
 *   - Tableau / Kanban / Calendrier
 *   - Detail dialog
 *   - ConfigurableDashboard pour l'onglet Analyse
 *
 * Les specificites par module sont passees via la prop `config`.
 */
import { useState, useMemo, ReactNode, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, RefreshCw, Loader2, BarChart3, Layers, ChevronRight, ChevronDown,
  TableProperties, Columns, Calendar as CalendarIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { FilterDrawerButton } from '@/components/dashboard/FilterDrawerButton';
import { CrossFilters, DEFAULT_CROSS_FILTERS } from '@/components/dashboard/types';
import { ModuleQuickFilters, ModuleViewMode } from '@/components/modules/ModuleQuickFilters';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CalendarView } from '@/components/tasks/CalendarView';
import { Task, TaskStats } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface ModuleKpi {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
}

export interface ModuleColumn<TRequest> {
  key: string;
  header: ReactNode;
  cell: (r: TRequest, ctx: ModuleRowCtx) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface ModuleRowCtx {
  isAdmin: boolean;
  myProfileId?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenDetail: () => void;
  refetch: () => void;
}

export interface ModuleStatusFilterOption {
  value: string;
  label: string;
}

export interface ModuleExtraFilterRender<TFilter> {
  value: TFilter;
  onChange: (next: TFilter) => void;
  requests: any[];
}

export interface ModuleDispatchConfig<TRequest extends { id?: string; status?: string }, TExtraFilter = unknown> {
  // Identite & chrome
  moduleCode: string;
  activeView: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  newRoute: string;
  newButtonLabel?: string;
  contextId: string;       // CrossFiltersPanel
  processId: string;       // ConfigurableDashboard

  // Donnees
  useRequests: () => { requests: TRequest[]; isLoading: boolean; refetch: () => void };
  getId: (r: TRequest) => string;
  getStatus: (r: TRequest) => string;
  getRequesterId?: (r: TRequest) => string | null | undefined;
  getAssigneeId?: (r: TRequest) => string | null | undefined;

  // Statuts
  statusLabels: Record<string, string>;
  terminalStatuses: string[];

  // KPIs (4 ou 5 colonnes auto-detectees)
  computeKpis: (requests: TRequest[]) => ModuleKpi[];

  // Stats pour ConfigurableDashboard
  computeStats: (requests: TRequest[]) => TaskStats;

  // Filtres
  searchableFields: (r: TRequest) => Array<string | undefined | null>;
  statusFilterOptions?: ModuleStatusFilterOption[]; // par defaut derive de statusLabels

  // Filtres extras (optionnel, ex: filiale, urgent, prestation, projet)
  extraFilterInitial?: TExtraFilter;
  ExtraFilters?: (props: ModuleExtraFilterRender<TExtraFilter>) => ReactNode;
  applyExtraFilters?: (r: TRequest, value: TExtraFilter) => boolean;

  // Tableau
  columns: ModuleColumn<TRequest>[];
  expandedPanel?: (r: TRequest, ctx: ModuleRowCtx) => ReactNode;
  rowActions?: (r: TRequest, ctx: ModuleRowCtx) => ReactNode;
  rowOnClickOpensDetail?: boolean; // default true

  // Vues
  enableKanban?: boolean;
  enableCalendar?: boolean;

  // Detail dialog
  DetailDialog?: (props: {
    request: TRequest;
    open: boolean;
    onClose: () => void;
    refetch: () => void;
    isAdmin: boolean;
    myProfileId?: string;
    profilesMap: Map<string, string>;
  }) => ReactNode;
  /** Profile ids supplementaires a charger (referent metier, validateurs...). Default: aucun. */
  extraProfileIds?: (r: TRequest) => Array<string | null | undefined>;

  // Onglets supplementaires apres Demandes / Analyse
  extraTabs?: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
    content: (props: { requests: TRequest[]; isAdmin: boolean; refetch: () => void }) => ReactNode;
  }>;

  // Header extras (boutons supplementaires a cote de "Nouvelle demande")
  HeaderExtras?: (props: { isAdmin: boolean; refetch: () => void }) => ReactNode;

  // Permettre la suppression admin (utilisee par defaut par les configs)
  allowDelete?: boolean;
  onKanbanStatusChange?: (id: string, newStatus: string) => Promise<void>;
  onCalendarStatusChange?: (id: string, newStatus: string) => Promise<void>;
  fetchById?: (id: string) => Promise<TRequest | null>;
}

interface ModuleDispatchViewProps<TRequest extends { id?: string; status?: string }, TExtraFilter> {
  config: ModuleDispatchConfig<TRequest, TExtraFilter>;
}

export function ModuleDispatchView<
  TRequest extends { id?: string; status?: string },
  TExtraFilter = unknown,
>({ config }: ModuleDispatchViewProps<TRequest, TExtraFilter>) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { requests, isLoading, refetch } = config.useRequests();
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const myProfile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  const { isAdmin: realIsAdmin } = useUserRole();
  const isAdmin = realIsAdmin && !isSimulating;

  const [activeView, setActiveView] = useState(config.activeView);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ModuleViewMode>('table');
  const [hideTerminated, setHideTerminated] = useState(true);
  const [onlyMine, setOnlyMine] = useState(false);
  const [crossFilters, setCrossFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  const [detailRequest, setDetailRequest] = useState<TRequest | null>(null);
  const [extraFilter, setExtraFilter] = useState<TExtraFilter>(
    (config.extraFilterInitial ?? ({} as TExtraFilter)) as TExtraFilter,
  );
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());

  // Charge la map id -> display_name pour requester / assignee / profils extras
  useEffect(() => {
    const ids = new Set<string>();
    for (const r of requests) {
      const a = config.getAssigneeId?.(r); if (a) ids.add(a);
      const q = config.getRequesterId?.(r); if (q) ids.add(q);
      const extras = config.extraProfileIds?.(r) ?? [];
      for (const e of extras) if (e) ids.add(e);
    }
    if (ids.size === 0) { setProfilesMap(new Map()); return; }
    void supabase.from('profiles').select('id, display_name').in('id', Array.from(ids))
      .then(({ data }) => {
        if (data) setProfilesMap(new Map(data.map(p => [p.id, p.display_name ?? '?'] as [string, string])));
      });
  }, [requests, config]);

  // Re-sync detailRequest avec la dernière version de la liste après refetch
  // (sinon le dialog ouvert affiche un état périmé après une action statut).
  useEffect(() => {
    if (!detailRequest) return;
    const id = config.getId(detailRequest);
    const fresh = requests.find((r) => config.getId(r) === id);
    if (fresh && fresh !== detailRequest) {
      setDetailRequest(fresh);
    }
  }, [requests, detailRequest, config]);

  // Deep-link ?openTask=<id> : ouvre le detail au chargement
  useEffect(() => {
    const openId = searchParams.get('openTask');
    if (!openId || isLoading) return;
    if (detailRequest) return;
    const found = requests.find(r => config.getId(r) === openId);
    if (found) {
      setDetailRequest(found);
      return;
    }
    if (config.fetchById) {
      config.fetchById(openId).then(r => { if (r) setDetailRequest(r); });
    }
  }, [searchParams, isLoading, requests, config, detailRequest]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const status = config.getStatus(r);
      if (hideTerminated && config.terminalStatuses.includes(status)) return false;
      if (onlyMine) {
        const assignee = config.getAssigneeId?.(r);
        const requester = config.getRequesterId?.(r);
        if (assignee !== myProfile?.id && requester !== myProfile?.id) return false;
      }
      if (filterStatus !== 'all' && status !== filterStatus) return false;
      if (config.applyExtraFilters && !config.applyExtraFilters(r, extraFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const fields = config.searchableFields(r).filter(Boolean) as string[];
        if (!fields.some(f => f.toLowerCase().includes(q))) return false;
      }
      // Cross-filters (contextes)
      if (crossFilters.searchQuery) {
        const fields = config.searchableFields(r).filter(Boolean) as string[];
        if (!fields.some(f => f.toLowerCase().includes(crossFilters.searchQuery.toLowerCase()))) return false;
      }
      if (crossFilters.statuses?.length > 0 && !crossFilters.statuses.includes(status as any)) return false;
      if (crossFilters.assigneeIds?.length > 0) {
        const assignee = config.getAssigneeId?.(r) ?? '';
        if (!crossFilters.assigneeIds.includes(assignee)) return false;
      }
      return true;
    });
  }, [requests, filterStatus, search, hideTerminated, onlyMine, myProfile?.id, crossFilters, extraFilter, config]);

  const stats = useMemo(() => config.computeStats(requests), [requests, config]);
  const kpis = useMemo(() => config.computeKpis(requests), [requests, config]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const closeDetail = () => {
    setDetailRequest(null);
    if (searchParams.get('openTask')) {
      const next = new URLSearchParams(searchParams);
      next.delete('openTask');
      setSearchParams(next, { replace: true });
    }
  };

  const statusOptions = config.statusFilterOptions
    ?? Object.entries(config.statusLabels).map(([value, label]) => ({ value, label }));

  const kpiCols = kpis.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
  const Icon = config.icon;
  const enableKanban = config.enableKanban ?? true;
  const enableCalendar = config.enableCalendar ?? true;
  const rowOnClickOpensDetail = config.rowOnClickOpensDetail ?? true;

  const buildRowCtx = (r: TRequest): ModuleRowCtx => ({
    isAdmin,
    myProfileId: myProfile?.id,
    expanded: expandedIds.has(config.getId(r)),
    onToggleExpand: () => toggleExpand(config.getId(r)),
    onOpenDetail: () => setDetailRequest(r),
    refetch,
  });

  const totalColSpan = config.columns.length + 2; // +1 toggle, +1 actions

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={config.title} searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-3">
            {/* ── Row 0 : Titre + actions ── */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn('p-1.5 rounded-lg shrink-0', config.iconBgClass)}>
                  <Icon className={cn('h-4 w-4', config.iconColorClass)} />
                </div>
                <h1 className="text-xl font-display font-bold leading-none whitespace-nowrap">{config.title}</h1>
              </div>
              <div className="flex items-center gap-1.5">
                {config.HeaderExtras && <config.HeaderExtras isAdmin={isAdmin} refetch={refetch} />}
                <Button variant="ghost" size="sm" onClick={refetch} className="h-8 gap-1.5 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" />Actualiser
                </Button>
                <Button size="sm" onClick={() => navigate(config.newRoute)} className="h-8 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />{config.newButtonLabel ?? 'Nouvelle demande'}
                </Button>
              </div>
            </div>

            <Tabs defaultValue="demandes" className="w-full">
              {/* ── Row 1 : Tabs ── */}
              <TabsList className="h-9 p-0.5 bg-muted rounded-lg">
                <TabsTrigger value="demandes" className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  <Layers className="h-3.5 w-3.5" /> Demandes
                </TabsTrigger>
                <TabsTrigger value="analyse" className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  <BarChart3 className="h-3.5 w-3.5" /> Analyse
                </TabsTrigger>
                {config.extraTabs?.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                    {tab.icon} {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="demandes" className="space-y-3 mt-3">
                {/* ── Row 2 : Vue + Filtres ── */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className={cn(
                        'h-7 px-2.5 gap-1.5 text-xs rounded-md',
                        viewMode === 'table' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
                      )}
                    >
                      <TableProperties className="h-3.5 w-3.5" /> Tableau
                    </Button>
                    {enableKanban && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('kanban')}
                        className={cn(
                          'h-7 px-2.5 gap-1.5 text-xs rounded-md',
                          viewMode === 'kanban' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
                        )}
                      >
                        <Columns className="h-3.5 w-3.5" /> Kanban
                      </Button>
                    )}
                    {enableCalendar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode('calendar')}
                        className={cn(
                          'h-7 px-2.5 gap-1.5 text-xs rounded-md',
                          viewMode === 'calendar' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="h-3.5 w-3.5" /> Calendrier
                      </Button>
                    )}
                  </div>

                  <FilterDrawerButton
                    filters={crossFilters}
                    onFiltersChange={setCrossFilters}
                    contextId={config.contextId}
                    isAdmin={isAdmin}
                    disableAutoApplyDefault={true}
                  />
                </div>

                <Card>
                  <CardContent className={cn(viewMode === 'table' ? 'p-0' : 'p-4')}>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        Aucune demande.{' '}
                        <button className="text-primary underline" onClick={() => navigate(config.newRoute)}>
                          Créer une demande
                        </button>
                      </div>
                    ) : viewMode === 'kanban' && enableKanban ? (
                      <KanbanBoard
                        tasks={filtered as unknown as Task[]}
                        onStatusChange={async (id, ns) => {
                          if (config.onKanbanStatusChange) await config.onKanbanStatusChange(id, ns as string);
                        }}
                        onDelete={async () => {}}
                        progressMap={new Map()}
                        onTaskUpdated={refetch}
                        kanbanGroupMode="status"
                      />
                    ) : viewMode === 'calendar' && enableCalendar ? (
                      <CalendarView
                        tasks={filtered as unknown as Task[]}
                        onStatusChange={async (id, ns) => {
                          if (config.onCalendarStatusChange) await config.onCalendarStatusChange(id, ns as string);
                        }}
                        onDelete={async () => {}}
                        progressMap={new Map()}
                        onTaskUpdated={refetch}
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            {config.columns.map(c => (
                              <TableHead key={c.key} className={c.headerClassName}>{c.header}</TableHead>
                            ))}
                            {config.rowActions && <TableHead className="text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((r) => {
                            const id = config.getId(r);
                            const ctx = buildRowCtx(r);
                            const isExpanded = ctx.expanded;
                            return (
                              <ModuleRow
                                key={id}
                                request={r}
                                ctx={ctx}
                                config={config}
                                colSpan={totalColSpan}
                                rowOnClickOpensDetail={rowOnClickOpensDetail}
                                isExpanded={isExpanded}
                              />
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analyse" className="space-y-6 mt-4">
                <ConfigurableDashboard
                  tasks={requests as unknown as Task[]}
                  stats={stats}
                  globalProgress={stats.completionRate}
                  processId={config.processId}
                  canEdit={true}
                  crossFiltersDefaultCollapsed={true}
                  onTaskClick={(task) => {
                    const r = requests.find(x => config.getId(x) === task.id);
                    if (r) setDetailRequest(r);
                  }}
                />
              </TabsContent>

              {config.extraTabs?.map(tab => (
                <TabsContent key={tab.value} value={tab.value} className="space-y-4 mt-4">
                  {tab.content({ requests, isAdmin, refetch })}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </main>
      </div>

      {detailRequest && config.DetailDialog && (
        <config.DetailDialog
          request={detailRequest}
          open={!!detailRequest}
          onClose={closeDetail}
          refetch={refetch}
          isAdmin={isAdmin}
          myProfileId={myProfile?.id}
          profilesMap={profilesMap}
        />
      )}
    </div>
  );
}

interface ModuleRowProps<TRequest extends { id?: string; status?: string }, TExtraFilter> {
  request: TRequest;
  ctx: ModuleRowCtx;
  config: ModuleDispatchConfig<TRequest, TExtraFilter>;
  colSpan: number;
  rowOnClickOpensDetail: boolean;
  isExpanded: boolean;
}

function ModuleRow<TRequest extends { id?: string; status?: string }, TExtraFilter>({
  request, ctx, config, colSpan, rowOnClickOpensDetail, isExpanded,
}: ModuleRowProps<TRequest, TExtraFilter>) {
  return (
    <>
      <TableRow
        className={cn(rowOnClickOpensDetail && 'cursor-pointer hover:bg-accent/30')}
        onClick={() => { if (rowOnClickOpensDetail) ctx.onOpenDetail(); }}
      >
        <TableCell onClick={(e) => { e.stopPropagation(); ctx.onToggleExpand(); }} className="cursor-pointer">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        {config.columns.map(c => (
          <TableCell key={c.key} className={c.className}>{c.cell(request, ctx)}</TableCell>
        ))}
        {config.rowActions && (
          <TableCell className="text-right">
            <div onClick={e => e.stopPropagation()} className="flex items-center justify-end gap-1">
              {config.rowActions(request, ctx)}
            </div>
          </TableCell>
        )}
      </TableRow>
      {isExpanded && config.expandedPanel && (
        <TableRow>
          <TableCell colSpan={colSpan} className="bg-muted/30 p-4">
            {config.expandedPanel(request, ctx)}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
