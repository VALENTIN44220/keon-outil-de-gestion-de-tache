/**
 * LogistiqueDispatch — vue de dispatch des demandes de transport.
 *
 * KPIs + filtres + tableau (1 ligne par demande). Workflow par bouton :
 * affecter -> planifiee -> en livraison -> livree -> cloturee.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Truck, Plus, Search, RefreshCw, Loader2, AlertTriangle, Clock, CheckCircle2, ListChecks, ChevronRight, ChevronDown,
  Trash2, BarChart3, Layers,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { CrossFiltersPanel } from '@/components/dashboard/CrossFiltersPanel';
import { CrossFilters, DEFAULT_CROSS_FILTERS } from '@/components/dashboard/types';
import { ModuleQuickFilters, ModuleViewMode } from '@/components/modules/ModuleQuickFilters';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CalendarView } from '@/components/tasks/CalendarView';
import { Task, TaskStats } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useUserRole } from '@/hooks/useUserRole';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLogistiqueRequests, LogistiqueRequest } from '@/hooks/useLogistiqueRequests';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-amber-100 text-amber-800 border-amber-300',
  affectee: 'bg-blue-100 text-blue-800 border-blue-300',
  planifiee: 'bg-violet-100 text-violet-800 border-violet-300',
  en_enlevement: 'bg-orange-100 text-orange-800 border-orange-300',
  en_livraison: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  livree: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cloturee: 'bg-green-100 text-green-800 border-green-300',
  abandonnee: 'bg-gray-100 text-gray-700 border-gray-300',
  complement_demande: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'Soumise',
  affectee: 'Affectée',
  planifiee: 'Planifiée',
  en_enlevement: 'En enlèvement',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  cloturee: 'Clôturée',
  abandonnee: 'Annulée',
  complement_demande: 'Complément demandé',
};

const TERMINAL_STATUSES = ['cloturee', 'abandonnee', 'cancelled', 'done'];

export default function LogistiqueDispatch() {
  const navigate = useNavigate();
  const { requests, isLoading, refetch } = useLogistiqueRequests();
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const myProfile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  const { isAdmin: realIsAdmin } = useUserRole();
  const isAdmin = realIsAdmin && !isSimulating;

  const [activeView, setActiveView] = useState('logistique-dispatch');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFiliale, setFilterFiliale] = useState<string>('all');
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ModuleViewMode>('table');
  const [hideTerminated, setHideTerminated] = useState(true);
  const [onlyMine, setOnlyMine] = useState(false);
  const [crossFilters, setCrossFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  const [detailRequest, setDetailRequest] = useState<LogistiqueRequest | null>(null);

  const filiales = useMemo(() => {
    const set = new Set<string>();
    for (const r of requests) {
      const f = r.module_data?.filiale;
      if (f) set.add(f);
    }
    return Array.from(set).sort();
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (hideTerminated && TERMINAL_STATUSES.includes(r.status)) return false;
      if (onlyMine && r.assignee_id !== myProfile?.id && r.requester_id !== myProfile?.id) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterFiliale !== 'all' && r.module_data?.filiale !== filterFiliale) return false;
      if (filterUrgent && !r.module_data?.urgence) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const fields = [
          r.title, r.module_data?.filiale, r.module_data?.code_projet,
          r.module_data?.nature_marchandise, r.module_data?.destinataire_nom,
          r.module_data?.transporteur, r.module_data?.num_suivi,
        ].filter(Boolean) as string[];
        if (!fields.some(f => f.toLowerCase().includes(q))) return false;
      }
      // Cross-filters (contextes sauvegardables)
      if (crossFilters.searchQuery && !r.title?.toLowerCase().includes(crossFilters.searchQuery.toLowerCase())) return false;
      if (crossFilters.statuses?.length > 0 && !crossFilters.statuses.includes(r.status as any)) return false;
      if (crossFilters.assigneeIds?.length > 0 && !crossFilters.assigneeIds.includes(r.assignee_id || '')) return false;
      return true;
    });
  }, [requests, filterStatus, filterFiliale, filterUrgent, search, hideTerminated, onlyMine, myProfile?.id, crossFilters]);

  // Stats pour ConfigurableDashboard
  const stats: TaskStats = useMemo(() => {
    const total = requests.length;
    const todo = requests.filter(t => t.status === 'todo').length;
    const inProgress = requests.filter(t => ['affectee', 'planifiee', 'en_enlevement', 'en_livraison', 'in-progress'].includes(t.status)).length;
    const done = requests.filter(t => ['livree', 'cloturee', 'done'].includes(t.status)).length;
    const validated = 0;
    const refused = 0;
    const pendingValidation = 0;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, todo, inProgress, done, pendingValidation, validated, refused, completionRate };
  }, [requests]);

  const deleteRequest = async (id: string) => {
    if (!confirm('Supprimer définitivement cette demande de transport ?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      toast.success('Demande supprimée');
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  const kpis = useMemo(() => {
    const enCours = requests.filter(r => !['cloturee', 'abandonnee', 'livree'].includes(r.status)).length;
    const urgentes = requests.filter(r => r.module_data?.urgence && !['cloturee', 'abandonnee', 'livree'].includes(r.status)).length;
    const aPlanifier = requests.filter(r => ['todo', 'affectee'].includes(r.status)).length;
    const enLivraison = requests.filter(r => ['en_enlevement', 'en_livraison'].includes(r.status)).length;
    const livrees = requests.filter(r => r.status === 'livree').length;
    return { enCours, urgentes, aPlanifier, enLivraison, livrees };
  }, [requests]);

  const updateStatus = async (id: string, newStatus: string, extraData?: Record<string, any>) => {
    try {
      const updates: any = { status: newStatus };
      if (extraData) {
        const r = requests.find(x => x.id === id);
        const merged = { ...(r?.module_data ?? {}), ...extraData };
        updates.module_data = merged;
      }
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
      toast.success(`Statut → ${STATUS_LABELS[newStatus] ?? newStatus}`);
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const KpiCard = ({ icon: Icon, label, value, color }: any) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Demandes de transport" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold">Logistique — Transports</h1>
                  <p className="text-sm text-muted-foreground">
                    Demandes courantes & urgentes / suivi enlèvement & livraison
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4 mr-2" />Actualiser
                </Button>
                <Button onClick={() => navigate('/logistique/new')}>
                  <Plus className="h-4 w-4 mr-2" />Nouvelle demande
                </Button>
              </div>
            </div>

            <Tabs defaultValue="demandes" className="w-full">
              <TabsList>
                <TabsTrigger value="demandes" className="gap-2">
                  <Layers className="h-4 w-4" /> Demandes
                </TabsTrigger>
                <TabsTrigger value="analyse" className="gap-2">
                  <BarChart3 className="h-4 w-4" /> Analyse
                </TabsTrigger>
              </TabsList>

              <TabsContent value="demandes" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={ListChecks} label="En cours" value={kpis.enCours} color="bg-slate-100 text-slate-700" />
              <KpiCard icon={AlertTriangle} label="Urgentes" value={kpis.urgentes} color="bg-red-100 text-red-700" />
              <KpiCard icon={Clock} label="À planifier" value={kpis.aPlanifier} color="bg-amber-100 text-amber-700" />
              <KpiCard icon={Truck} label="En livraison" value={kpis.enLivraison} color="bg-cyan-100 text-cyan-700" />
              <KpiCard icon={CheckCircle2} label="Livrées" value={kpis.livrees} color="bg-emerald-100 text-emerald-700" />
            </div>

            <ModuleQuickFilters
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              hideTerminated={hideTerminated}
              onHideTerminatedChange={setHideTerminated}
              onlyMine={onlyMine}
              onOnlyMineChange={setOnlyMine}
            />

            <CrossFiltersPanel
              filters={crossFilters}
              onFiltersChange={setCrossFilters}
              contextId="logistique-module-dispatch"
              defaultCollapsed={true}
              isAdmin={isAdmin}
            />

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterFiliale} onValueChange={setFilterFiliale}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filiale" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes filiales</SelectItem>
                      {filiales.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant={filterUrgent ? 'default' : 'outline'} size="sm" onClick={() => setFilterUrgent(!filterUrgent)}>
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Urgentes uniquement
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className={cn(viewMode === 'table' ? 'p-0' : 'p-4')}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune demande de transport.{' '}
                    <button className="text-primary underline" onClick={() => navigate('/logistique/new')}>
                      Créer une demande
                    </button>
                  </div>
                ) : viewMode === 'kanban' ? (
                  <KanbanBoard
                    tasks={filtered as unknown as Task[]}
                    onStatusChange={async (id, ns) => updateStatus(id, ns as string)}
                    onDelete={async () => {}}
                    progressMap={new Map()}
                    onTaskUpdated={refetch}
                    kanbanGroupMode="status"
                  />
                ) : viewMode === 'calendar' ? (
                  <CalendarView
                    tasks={filtered as unknown as Task[]}
                    onStatusChange={async (id, ns) => updateStatus(id, ns as string)}
                    onDelete={async () => {}}
                    progressMap={new Map()}
                    onTaskUpdated={refetch}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Demande</TableHead>
                        <TableHead>Filiale</TableHead>
                        <TableHead>Code projet</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date demandée</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <RequestRow
                          key={r.id}
                          request={r}
                          expanded={expandedIds.has(r.id)}
                          onToggle={() => toggleExpand(r.id)}
                          onOpenDetail={() => setDetailRequest(r)}
                          onStatusChange={updateStatus}
                          onDelete={isAdmin ? () => deleteRequest(r.id) : undefined}
                        />
                      ))}
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
                  processId="logistique-module"
                  canEdit={true}
                  crossFiltersDefaultCollapsed={true}
                  onTaskClick={(task) => {
                    const r = requests.find(x => x.id === task.id);
                    if (r) setDetailRequest(r);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {detailRequest && (
        <RequestDetailDialog
          task={detailRequest as unknown as Task}
          open={!!detailRequest}
          onClose={() => setDetailRequest(null)}
          onStatusChange={() => {}}
          onTaskMutated={refetch}
        />
      )}
    </div>
  );
}

function RequestRow({ request, expanded, onToggle, onOpenDetail, onStatusChange, onDelete }: {
  request: LogistiqueRequest;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail?: () => void;
  onStatusChange: (id: string, newStatus: string, extra?: Record<string, any>) => void;
  onDelete?: () => void;
}) {
  const isUrgent = !!request.module_data?.urgence;
  const data = request.module_data ?? {};

  const renderActions = () => {
    switch (request.status) {
      case 'todo':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'affectee'); }}>Prendre en charge</Button>
        );
      case 'affectee':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'planifiee', { date_prise_en_charge: new Date().toISOString().slice(0,10) }); }}>Planifier</Button>
        );
      case 'planifiee':
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'en_enlevement'); }}>Enlèvement</Button>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'en_livraison'); }}>En livraison</Button>
          </div>
        );
      case 'en_enlevement':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'en_livraison'); }}>Enlevé</Button>
        );
      case 'en_livraison':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'livree', { date_livraison_effective: new Date().toISOString().slice(0,10) }); }}>Livré</Button>
        );
      case 'livree':
        return (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'cloturee'); }}>Clôturer</Button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-accent/30" onClick={() => onOpenDetail?.()}>
        <TableCell onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium max-w-[280px] truncate text-primary hover:underline">
          {isUrgent && <Badge variant="destructive" className="mr-2 text-[10px]">URGENT</Badge>}
          {request.title}
        </TableCell>
        <TableCell><Badge variant="outline">{data.filiale ?? '—'}</Badge></TableCell>
        <TableCell className="text-sm">{data.code_projet ?? '—'}</TableCell>
        <TableCell>
          <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[request.status])}>
            {STATUS_LABELS[request.status] ?? request.status}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {request.due_date ? format(new Date(request.due_date), 'dd/MM/yyyy', { locale: fr }) : '—'}
        </TableCell>
        <TableCell className="text-right">
          <div onClick={e => e.stopPropagation()} className="flex items-center justify-end gap-1">
            {renderActions()}
            {onDelete && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} title="Supprimer">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Marchandise</p>
                <p>{data.nature_marchandise ?? '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.nb_colis} {data.type_colis}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Expéditeur</p>
                <p>{data.depart_stock_bgn ? 'Stock BGN (Bouguenais)' : (data.expediteur_adresse ?? '—')}</p>
                {!data.depart_stock_bgn && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.expediteur_nom} — {data.expediteur_tel}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Destinataire</p>
                <p>{data.destinataire_adresse ?? '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.destinataire_nom} — {data.destinataire_tel}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Suivi</p>
                {data.transporteur && <p>Transporteur: {data.transporteur}</p>}
                {data.num_suivi && <p>N° suivi: {data.num_suivi}</p>}
                {data.date_livraison_prevue && <p>Livraison prévue: {data.date_livraison_prevue}</p>}
                {data.date_livraison_effective && <p>Livré le: {data.date_livraison_effective}</p>}
                {!data.transporteur && !data.num_suivi && !data.date_livraison_prevue && <p className="text-muted-foreground">—</p>}
              </div>
              {request.description && (
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Commentaire</p>
                  <p>{request.description}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
