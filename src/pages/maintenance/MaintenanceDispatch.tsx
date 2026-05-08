/**
 * MaintenanceDispatch — vue de dispatch des demandes materiel.
 *
 * KPIs en haut + filtres + tableau des demandes (1 ligne = 1 demande,
 * developpable pour voir les articles).
 *
 * Le coordinateur (Sylvain ANTZ) clique sur Valider/Refuser pour faire
 * avancer la demande dans le workflow.
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
  Package, Plus, Search, RefreshCw, Loader2, ChevronDown, ChevronRight, AlertTriangle, Clock, CheckCircle2, ListChecks,
  Trash2, BarChart3, Layers,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { CrossFiltersPanel } from '@/components/dashboard/CrossFiltersPanel';
import { CrossFilters, DEFAULT_CROSS_FILTERS } from '@/components/dashboard/types';
import { ModuleQuickFilters, ModuleViewMode } from '@/components/modules/ModuleQuickFilters';
import { Task, TaskStats } from '@/types/task';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useUserRole } from '@/hooks/useUserRole';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useMaintenanceRequests, MaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useMaterialValidation } from '@/hooks/useMaterialValidation';

const ETATS_COLORS: Record<string, string> = {
  'En attente validation': 'bg-amber-100 text-amber-800 border-amber-300',
  'Demande de devis': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Bon de commande envoyé': 'bg-blue-100 text-blue-800 border-blue-300',
  'AR reçu': 'bg-purple-100 text-purple-800 border-purple-300',
  'Commande livrée': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Commande distribuée': 'bg-green-100 text-green-800 border-green-300',
};

const MAINT_TERMINAL = ['Commande distribuee', 'Commande distribuée'];

export default function MaintenanceDispatch() {
  const navigate = useNavigate();
  const { requests, isLoading, refetch } = useMaintenanceRequests();
  const { validateMaterialRequest, refuseMaterialRequest, isProcessing } = useMaterialValidation();
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const myProfile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  const { isAdmin: realIsAdmin } = useUserRole();
  const isAdmin = realIsAdmin && !isSimulating;

  const [activeView, setActiveView] = useState('maintenance-dispatch');
  const [search, setSearch] = useState('');
  const [filterEtat, setFilterEtat] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hideTerminated, setHideTerminated] = useState(true);
  const [onlyMine, setOnlyMine] = useState(false);
  const [crossFilters, setCrossFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  const [detailRequest, setDetailRequest] = useState<any>(null);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (hideTerminated && r.etat_global && MAINT_TERMINAL.includes(r.etat_global)) return false;
      if (onlyMine && r.assignee_id !== myProfile?.id && r.requester_id !== myProfile?.id) return false;
      if (filterEtat !== 'all' && r.etat_global !== filterEtat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.title?.toLowerCase().includes(q) &&
            !r.lignes?.some((l) => l.ref.toLowerCase().includes(q) || l.des.toLowerCase().includes(q))
        ) return false;
      }
      if (crossFilters.searchQuery && !r.title?.toLowerCase().includes(crossFilters.searchQuery.toLowerCase())) return false;
      if (crossFilters.assigneeIds?.length > 0 && !crossFilters.assigneeIds.includes(r.assignee_id || '')) return false;
      return true;
    });
  }, [requests, search, filterEtat, hideTerminated, onlyMine, myProfile?.id, crossFilters]);

  const stats: TaskStats = useMemo(() => {
    const total = requests.length;
    const todo = requests.filter(t => t.status === 'todo').length;
    const inProgress = requests.length - todo;
    const done = requests.filter(t => MAINT_TERMINAL.includes(t.etat_global || '')).length;
    return {
      total, todo, inProgress, done, pendingValidation: 0, validated: 0, refused: 0,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [requests]);

  const deleteRequest = async (id: string) => {
    if (!confirm('Supprimer définitivement cette demande matériel ?')) return;
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
    const enAttenteVal = requests.filter((r) => r.etat_global === 'En attente validation').length;
    const enCours = requests.filter((r) => r.etat_global && ['Demande de devis', 'Bon de commande envoyé', 'AR reçu'].includes(r.etat_global)).length;
    const livrees = requests.filter((r) => r.etat_global === 'Commande livrée').length;
    const total = requests.length;
    return { total, enAttenteVal, enCours, livrees };
  }, [requests]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleValidate = async (taskId: string) => {
    const ok = await validateMaterialRequest(taskId);
    if (ok) refetch();
  };

  const handleRefuse = async (taskId: string) => {
    if (!confirm('Refuser cette demande ?')) return;
    const ok = await refuseMaterialRequest(taskId);
    if (ok) refetch();
  };

  const KpiCard = ({ icon: Icon, label, value, color }: { icon: typeof Package; label: string; value: number; color: string }) => (
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
        <Header title="Demandes matériel" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-warning/10">
                  <Package className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold">Demandes matériel</h1>
                  <p className="text-sm text-muted-foreground">
                    Validation coordinateur → commande logistique
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
                <Button onClick={() => navigate('/maintenance/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle demande
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={ListChecks} label="Total demandes" value={kpis.total} color="bg-slate-100 text-slate-700" />
              <KpiCard icon={AlertTriangle} label="À valider (coordinateur)" value={kpis.enAttenteVal} color="bg-amber-100 text-amber-700" />
              <KpiCard icon={Clock} label="En cours commande" value={kpis.enCours} color="bg-blue-100 text-blue-700" />
              <KpiCard icon={CheckCircle2} label="Livrées à distribuer" value={kpis.livrees} color="bg-emerald-100 text-emerald-700" />
            </div>

            <ModuleQuickFilters
              viewMode={'table'}
              onViewModeChange={() => {}}
              hideTerminated={hideTerminated}
              onHideTerminatedChange={setHideTerminated}
              onlyMine={onlyMine}
              onOnlyMineChange={setOnlyMine}
            />

            <CrossFiltersPanel
              filters={crossFilters}
              onFiltersChange={setCrossFilters}
              contextId="maintenance-module-dispatch"
              defaultCollapsed={true}
              isAdmin={isAdmin}
            />

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher (titre, ref, désignation)..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterEtat} onValueChange={setFilterEtat}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Filtrer par état" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les états</SelectItem>
                      {Object.keys(ETATS_COLORS).map((etat) => (
                        <SelectItem key={etat} value={etat}>{etat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune demande matériel.{' '}
                    <button className="text-primary underline" onClick={() => navigate('/maintenance/new')}>
                      Créer une demande
                    </button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>Articles</TableHead>
                        <TableHead>Qté</TableHead>
                        <TableHead>État global</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <RequestRow
                          key={r.task_id}
                          request={r}
                          expanded={expandedIds.has(r.task_id)}
                          onToggle={() => toggleExpand(r.task_id)}
                          onOpenDetail={() => setDetailRequest(r)}
                          onValidate={() => handleValidate(r.task_id)}
                          onRefuse={() => handleRefuse(r.task_id)}
                          onDelete={isAdmin ? () => deleteRequest(r.task_id) : undefined}
                          isProcessing={isProcessing}
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
                  processId="maintenance-module"
                  canEdit={true}
                  crossFiltersDefaultCollapsed={true}
                  onTaskClick={(task) => {
                    const r = requests.find(x => x.task_id === task.id);
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
          task={{ ...detailRequest, id: detailRequest.task_id } as unknown as Task}
          open={!!detailRequest}
          onClose={() => setDetailRequest(null)}
          onStatusChange={() => {}}
          onTaskMutated={refetch}
        />
      )}
    </div>
  );
}

function RequestRow({
  request, expanded, onToggle, onOpenDetail, onValidate, onRefuse, onDelete, isProcessing,
}: {
  request: MaintenanceRequest;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail?: () => void;
  onValidate: () => void;
  onRefuse: () => void;
  onDelete?: () => void;
  isProcessing: boolean;
}) {
  const isAwaiting = request.etat_global === 'En attente validation';
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-accent/30" onClick={() => onOpenDetail?.()}>
        <TableCell onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium max-w-[300px] truncate">{request.title}</TableCell>
        <TableCell>{request.nb_lignes}</TableCell>
        <TableCell>{request.qte_totale}</TableCell>
        <TableCell>
          {request.etat_global ? (
            <Badge variant="outline" className={cn('text-xs', ETATS_COLORS[request.etat_global])}>
              {request.etat_global}
            </Badge>
          ) : '—'}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: fr })}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {isAwaiting && (
              <>
                <Button size="sm" variant="default" onClick={onValidate} disabled={isProcessing}>
                  Valider
                </Button>
                <Button size="sm" variant="outline" onClick={onRefuse} disabled={isProcessing}>
                  Refuser
                </Button>
              </>
            )}
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
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Articles ({request.nb_lignes})
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.lignes?.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.ref}</TableCell>
                      <TableCell className="text-sm">{l.des}</TableCell>
                      <TableCell className="text-right">{l.quantite}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', ETATS_COLORS[l.etat_commande])}>
                          {l.etat_commande}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
