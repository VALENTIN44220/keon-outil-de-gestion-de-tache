/**
 * ITDispatch — vue de dispatch des demandes IT.
 *
 * KPIs + filtres (statut, prestation, demandeur) + tableau extensible.
 * Workflow par boutons : todo -> en_cours -> en_attente_complement /
 * en_attente_retour_externe -> realisee.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Monitor, Plus, Search, RefreshCw, Loader2, Clock, CheckCircle2, ListChecks, AlertCircle, ChevronRight, ChevronDown,
  TableProperties, Columns, Calendar as CalendarIcon,
} from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CalendarView } from '@/components/tasks/CalendarView';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useITRequests, ITRequest, IT_PRESTATIONS, IT_TEAM_PROFILE_IDS } from '@/hooks/useITRequests';
import { useITProjects } from '@/hooks/useITProjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserCog, BarChart3, Layers } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { Task, TaskStats } from '@/types/task';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { ITRequestDetailDialog } from '@/components/it/ITRequestDetailDialog';

const STATUS_LABELS: Record<string, string> = {
  todo: 'À affecter',
  affectee: 'Affectée',
  in_progress: 'En cours',
  'in-progress': 'En cours',
  en_attente_complement_demandeur: 'Attente compléments',
  en_attente_retour_externe: 'Attente tiers',
  en_attente_retour_ticket_itp: 'Attente ticket ITP',
  en_attente_retour_ticket_blc: 'Attente ticket BLC',
  en_attente_chiffrage: 'Attente chiffrage',
  realisee: 'Réalisée',
  done: 'Terminée',
  cancelled: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-amber-100 text-amber-800 border-amber-300',
  affectee: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-violet-100 text-violet-800 border-violet-300',
  'in-progress': 'bg-violet-100 text-violet-800 border-violet-300',
  en_attente_complement_demandeur: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  en_attente_retour_externe: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_retour_ticket_itp: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_retour_ticket_blc: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_chiffrage: 'bg-amber-100 text-amber-800 border-amber-300',
  realisee: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  done: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-300',
};

export default function ITDispatch() {
  const navigate = useNavigate();
  const { requests, isLoading, refetch } = useITRequests();
  const { projects: itProjects } = useITProjects();
  const [activeView, setActiveView] = useState('it-dispatch');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPrestation, setFilterPrestation] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'calendar'>('table');

  // Map id -> display_name pour tous les profils referenced (requester, assignee, referent_metier)
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const ids = new Set<string>();
    for (const r of requests) {
      if (r.requester_id) ids.add(r.requester_id);
      if (r.assignee_id) ids.add(r.assignee_id);
      const ref = r.module_data?.referent_metier_profile_id;
      if (ref) ids.add(ref as string);
    }
    if (ids.size === 0) return;
    void supabase.from('profiles').select('id, display_name').in('id', Array.from(ids))
      .then(({ data }) => {
        if (data) setProfilesMap(new Map(data.map(p => [p.id, p.display_name ?? '?'] as [string, string])));
      });
  }, [requests]);

  // Map des membres de l equipe IT pour le selecteur de reassignation
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; display_name: string }>>([]);
  useEffect(() => {
    if (IT_TEAM_PROFILE_IDS.length === 0) return;
    void supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', IT_TEAM_PROFILE_IDS)
      .then(({ data }) => {
        if (data) setTeamMembers(data as any);
      });
  }, []);

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of itProjects) {
      m.set(p.id, p.code_projet_digital ? `${p.code_projet_digital} — ${p.nom_projet}` : p.nom_projet);
    }
    return m;
  }, [itProjects]);

  const assigneeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teamMembers) m.set(t.id, t.display_name);
    return m;
  }, [teamMembers]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterPrestation !== 'all' && r.source_process_template_id !== filterPrestation) return false;
      if (filterProject !== 'all') {
        const pid = (r as any).it_project_id;
        if (filterProject === 'none' && pid) return false;
        if (filterProject !== 'none' && pid !== filterProject) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.title?.toLowerCase().includes(q) &&
            !r.description?.toLowerCase().includes(q) &&
            !(r.module_data?.prestation as string)?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [requests, filterStatus, filterPrestation, search]);

  const kpis = useMemo(() => {
    const actives = requests.filter(r => !['realisee', 'done', 'cancelled'].includes(r.status)).length;
    const enCours = requests.filter(r => ['in_progress', 'in-progress'].includes(r.status)).length;
    const enAttente = requests.filter(r => ['en_attente_complement_demandeur', 'en_attente_retour_externe', 'en_attente_retour_ticket_itp', 'en_attente_retour_ticket_blc', 'en_attente_chiffrage'].includes(r.status)).length;
    const realiseesMois = requests.filter(r => {
      if (!['realisee', 'done'].includes(r.status)) return false;
      const d = new Date(r.updated_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { actives, enCours, enAttente, realiseesMois };
  }, [requests]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Statut → ${STATUS_LABELS[newStatus] ?? newStatus}`);
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  const reassign = async (id: string, newAssigneeId: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ assignee_id: newAssigneeId }).eq('id', id);
      if (error) throw error;
      const name = assigneeMap.get(newAssigneeId) ?? 'membre IT';
      toast.success(`Réaffecté à ${name}`);
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  const linkProject = async (id: string, projectId: string | null) => {
    try {
      const { error } = await supabase.from('tasks').update({ it_project_id: projectId }).eq('id', id);
      if (error) throw error;
      toast.success(projectId ? 'Lié au projet' : 'Détaché du projet');
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Stats Task[] pour ConfigurableDashboard (vue analytique)
  const tasksAsAny = requests as unknown as Task[];
  const stats: TaskStats = useMemo(() => {
    const total = requests.length;
    const todo = requests.filter(t => t.status === 'todo').length;
    const inProgress = requests.filter(t => t.status === 'in-progress' || t.status === 'in_progress').length;
    const done = requests.filter(t => t.status === 'realisee' || t.status === 'done').length;
    const pendingValidation = requests.filter(t => t.status === 'pending_validation_1' || t.status === 'pending_validation_2').length;
    const validated = requests.filter(t => t.status === 'validated').length;
    const refused = requests.filter(t => t.status === 'refused').length;
    const completionRate = total > 0 ? Math.round(((done + validated) / total) * 100) : 0;
    return { total, todo, inProgress, done, pendingValidation, validated, refused, completionRate };
  }, [requests]);

  const [analyticsTask, setAnalyticsTask] = useState<Task | null>(null);
  const [detailRequest, setDetailRequest] = useState<ITRequest | null>(null);

  // Deep-link via /it/dispatch?openTask=<id> (depuis cloche notifs)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get('openTask');
    if (!openId) return;
    // Cherche d abord dans la liste deja chargee
    const found = requests.find(r => r.id === openId);
    if (found) {
      setDetailRequest(found);
      const next = new URLSearchParams(searchParams);
      next.delete('openTask');
      setSearchParams(next, { replace: true });
      return;
    }
    // Sinon fetch direct
    void supabase.from('tasks').select('*').eq('id', openId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDetailRequest(data as unknown as ITRequest);
          const next = new URLSearchParams(searchParams);
          next.delete('openTask');
          setSearchParams(next, { replace: true });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, requests]);

  // Dialog "Demander complement" : on demande la question puis on poste
  // un commentaire ET on change le status. Sans question -> bloque.
  const [complementDialogReq, setComplementDialogReq] = useState<ITRequest | null>(null);
  const [complementMsg, setComplementMsg] = useState('');
  const [isPostingComplement, setIsPostingComplement] = useState(false);
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const myProfile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const submitComplement = async () => {
    if (!complementDialogReq || !myProfile?.id || !complementMsg.trim()) return;
    setIsPostingComplement(true);
    try {
      // 1. Insert le commentaire (BE-010 trigger notifie demandeur + manager)
      const { error: cErr } = await supabase.from('task_comments').insert({
        task_id: complementDialogReq.id,
        author_id: myProfile.id,
        content: '[Complément demandé] ' + complementMsg.trim(),
      });
      if (cErr) throw cErr;

      // 2. Change le status
      const { error: sErr } = await supabase
        .from('tasks')
        .update({ status: 'en_attente_complement_demandeur' })
        .eq('id', complementDialogReq.id);
      if (sErr) throw sErr;

      toast.success('Complément demandé — message posté');
      setComplementDialogReq(null);
      setComplementMsg('');
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setIsPostingComplement(false);
    }
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
        <Header title="Demandes IT" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10">
                  <Monitor className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold">IT — Demandes</h1>
                  <p className="text-sm text-muted-foreground">
                    7 prestations / auto-affectation à la cible
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4 mr-2" />Actualiser
                </Button>
                <Button onClick={() => navigate('/it/new')}>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={ListChecks} label="Actives" value={kpis.actives} color="bg-slate-100 text-slate-700" />
              <KpiCard icon={Clock} label="En cours" value={kpis.enCours} color="bg-violet-100 text-violet-700" />
              <KpiCard icon={AlertCircle} label="En attente" value={kpis.enAttente} color="bg-amber-100 text-amber-700" />
              <KpiCard icon={CheckCircle2} label="Réalisées ce mois" value={kpis.realiseesMois} color="bg-emerald-100 text-emerald-700" />
            </div>

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
                  <Select value={filterPrestation} onValueChange={setFilterPrestation}>
                    <SelectTrigger className="w-[230px]"><SelectValue placeholder="Prestation" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes prestations</SelectItem>
                      {IT_PRESTATIONS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-[230px]"><SelectValue placeholder="Projet IT" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous projets</SelectItem>
                      <SelectItem value="none">Sans projet</SelectItem>
                      {itProjects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code_projet_digital ? `${p.code_projet_digital} — ` : ''}{p.nom_projet}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
                <TableProperties className="h-4 w-4 mr-1" /> Tableau
              </Button>
              <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('kanban')}>
                <Columns className="h-4 w-4 mr-1" /> Kanban
              </Button>
              <Button variant={viewMode === 'calendar' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('calendar')}>
                <CalendarIcon className="h-4 w-4 mr-1" /> Calendrier
              </Button>
            </div>

            <Card>
              <CardContent className={cn(viewMode === 'table' ? 'p-0' : 'p-4')}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune demande IT.{' '}
                    <button className="text-primary underline" onClick={() => navigate('/it/new')}>
                      Créer une demande
                    </button>
                  </div>
                ) : viewMode === 'kanban' ? (
                  <KanbanBoard
                    tasks={filtered as unknown as Task[]}
                    onStatusChange={async (taskId, newStatus) => updateStatus(taskId, newStatus as string)}
                    onDelete={async () => {}}
                    progressMap={new Map()}
                    onTaskUpdated={refetch}
                    kanbanGroupMode="status"
                  />
                ) : viewMode === 'calendar' ? (
                  <CalendarView
                    tasks={filtered as unknown as Task[]}
                    onStatusChange={async (taskId, newStatus) => updateStatus(taskId, newStatus as string)}
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
                        <TableHead>Prestation</TableHead>
                        <TableHead>Projet IT</TableHead>
                        <TableHead>Assigné</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <RequestRow
                          key={r.id}
                          request={r}
                          projectMap={projectMap}
                          assigneeMap={assigneeMap}
                          teamMembers={teamMembers}
                          itProjects={itProjects}
                          expanded={expandedIds.has(r.id)}
                          onToggle={() => toggleExpand(r.id)}
                          onOpenDetail={() => setDetailRequest(r)}
                          onStatusChange={updateStatus}
                          onReassign={reassign}
                          onLinkProject={linkProject}
                          onAskComplement={() => { setComplementDialogReq(r); setComplementMsg(''); }}
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
                  tasks={tasksAsAny}
                  stats={stats}
                  globalProgress={stats.completionRate}
                  processId="it-module"
                  canEdit={true}
                  crossFiltersDefaultCollapsed={true}
                  onTaskClick={(task) => setAnalyticsTask(task)}
                />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {analyticsTask && analyticsTask.type === 'request' ? (
        <RequestDetailDialog
          task={analyticsTask}
          open={!!analyticsTask}
          onClose={() => setAnalyticsTask(null)}
          onStatusChange={() => {}}
          onTaskMutated={refetch}
        />
      ) : (
        <TaskDetailDialog
          task={analyticsTask}
          open={!!analyticsTask}
          onClose={() => setAnalyticsTask(null)}
          onStatusChange={() => {}}
          onTaskMutated={refetch}
        />
      )}

      {/* Detail dialog dedie IT (compact, hauteur < page, statuts specifiques) */}
      {detailRequest && (
        <ITRequestDetailDialog
          request={detailRequest}
          open={!!detailRequest}
          onClose={() => setDetailRequest(null)}
          onMutated={refetch}
          profilesMap={profilesMap}
          itProjectMap={projectMap}
        />
      )}

      {/* Dialog 'Demander complement' */}
      <Dialog open={!!complementDialogReq} onOpenChange={(open) => { if (!open) setComplementDialogReq(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un complément</DialogTitle>
            <DialogDescription>
              Pose ta question au demandeur. Elle sera postée dans le chat de la tâche
              et le demandeur recevra une notification. La demande passera en
              « Attente compléments » jusqu'à sa réponse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              rows={4}
              value={complementMsg}
              onChange={(e) => setComplementMsg(e.target.value)}
              placeholder="Quelle info manque-t-il ? Ex. peux-tu préciser le navigateur utilisé ? le n° de poste ? un screenshot ?"
              disabled={isPostingComplement}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplementDialogReq(null)} disabled={isPostingComplement}>
              Annuler
            </Button>
            <Button onClick={submitComplement} disabled={isPostingComplement || !complementMsg.trim()}>
              {isPostingComplement ? 'Envoi...' : 'Poster + demander complément'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestRow({
  request, projectMap, assigneeMap, teamMembers, itProjects, expanded,
  onToggle, onOpenDetail, onStatusChange, onReassign, onLinkProject, onAskComplement,
}: {
  request: ITRequest;
  projectMap: Map<string, string>;
  assigneeMap: Map<string, string>;
  teamMembers: Array<{ id: string; display_name: string }>;
  itProjects: any[];
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  onStatusChange: (id: string, newStatus: string) => void;
  onReassign: (id: string, newAssigneeId: string) => void;
  onLinkProject: (id: string, projectId: string | null) => void;
  onAskComplement: () => void;
}) {
  const data = request.module_data ?? {};
  const itProjectId = (request as any).it_project_id as string | null;

  const renderActions = () => {
    switch (request.status) {
      case 'todo':
      case 'affectee':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'in-progress'); }}>Démarrer</Button>
        );
      case 'in_progress':
      case 'in-progress':
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onAskComplement(); }}>Demander complément</Button>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'realisee'); }}>Réalisée</Button>
          </div>
        );
      case 'en_attente_complement_demandeur':
      case 'en_attente_retour_externe':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'in-progress'); }}>Reprendre</Button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-accent/30" onClick={onOpenDetail}>
        <TableCell onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium max-w-[260px] truncate text-primary hover:underline">
          {request.title}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">{data.prestation ?? '—'}</Badge>
        </TableCell>
        <TableCell className="text-xs">
          {itProjectId ? (
            <Badge variant="secondary" className="text-xs">{projectMap.get(itProjectId) ?? itProjectId.slice(0, 6)}</Badge>
          ) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-xs">
          <div onClick={e => e.stopPropagation()}>
            <Select
              value={request.assignee_id ?? ''}
              onValueChange={(v) => onReassign(request.id, v)}
            >
              <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {teamMembers.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[request.status])}>
            {STATUS_LABELS[request.status] ?? request.status}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: fr })}
        </TableCell>
        <TableCell className="text-right">
          <div onClick={e => e.stopPropagation()} className="flex items-center justify-end gap-1">
            {renderActions()}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground">Lier à un projet IT :</span>
              <Select
                value={itProjectId ?? 'none'}
                onValueChange={(v) => onLinkProject(request.id, v === 'none' ? null : v)}
              >
                <SelectTrigger className="h-7 text-xs w-[300px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun projet —</SelectItem>
                  {itProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code_projet_digital ? `${p.code_projet_digital} — ` : ''}{p.nom_projet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
                <p>{request.description ?? '—'}</p>
              </div>
              {data.nom_dossier_sharepoint && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Dossier SharePoint</p>
                  <p>{data.nom_dossier_sharepoint}</p>
                </div>
              )}
              {data.emails_acces && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Emails accès</p>
                  <p className="text-xs">{data.emails_acces}</p>
                </div>
              )}
              {data.num_ticket_itp && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">N° ticket ITP</p>
                  <p>{data.num_ticket_itp}</p>
                </div>
              )}
              {data.num_ticket_blc && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">N° ticket BLC</p>
                  <p>{data.num_ticket_blc}</p>
                </div>
              )}
              {data.champ_complementaire_cible && (
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Précisions cible</p>
                  <p>{data.champ_complementaire_cible}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
