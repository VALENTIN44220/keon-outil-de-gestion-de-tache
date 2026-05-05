/**
 * Requests — page « Demandes ».
 *
 * Refonte simplifiée (chantier 2 de la roadmap MON ESPACE) :
 *  - 1 grille de gros boutons « Créer une demande » (par type)
 *  - 1 zone « Mes demandes » en dessous (suivi des demandes que j'ai faites)
 *
 * Plus d'onglets. Plus de drilldown long. Les types non couverts par un dialog
 * dédié (IT, service achat générique...) passent par « Autre demande »
 * (NewRequestDialog drilldown générique).
 *
 * Compat legacy conservée :
 *  - `?supplierRequest=1`         → ouvre NewRequestDialog ciblant le sous-processus fournisseur
 *  - `/service-achat/nouveau-fournisseur` → idem
 *  - `?openTask=<uuid>`           → ouvre RequestDetailDialog sur la demande indiquée
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation, matchPath } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { DeadlineTasksOverrideProvider } from '@/contexts/DeadlineTasksOverrideContext';
import { NewRequestDialog } from '@/components/tasks/NewRequestDialog';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { NewTaskDialog } from '@/components/tasks/NewTaskDialog';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { NewBERequestDialog } from '@/components/be/NewBERequestDialog';
import { NewSupplierRequestDialog } from '@/components/suppliers/NewSupplierRequestDialog';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useTasks } from '@/hooks/useTasks';
import { Task, TaskStats } from '@/types/task';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FolderOpen, Building2, Lightbulb, ListChecks, ClipboardList, UserCog, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID,
  SUPPLIER_NEW_REQUEST_SUB_PROCESS_TEMPLATE_ID,
  SUPPLIER_REQUEST_QUERY_PARAM,
  SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH,
} from '@/lib/supplierRequestFlow';

// ─── Type d'action de la grille de boutons ──────────────────────────────────

interface RequestAction {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Couleur d'accent (Tailwind) — fond + texte sur le badge icône. */
  accent: string;
  onClick: () => void;
  /** Si false → bouton masqué (ex. tâche équipe pour non-managers). */
  visible: boolean;
}

const Requests = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierServiceAchatPathHandledRef = useRef(false);
  const [activeView, setActiveView] = useState('requests');

  // Dialogs
  const [isBERequestOpen, setIsBERequestOpen] = useState(false);
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState<string | undefined>();
  const [selectedSubProcessTemplateId, setSelectedSubProcessTemplateId] = useState<string | undefined>();

  // Data
  const [requests, setRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const {
    allTasks,
    searchQuery,
    setSearchQuery,
    updateTaskStatus,
    addTask,
  } = useTasks();

  const { refetch: refetchPending } = usePendingAssignments();
  const { isManager } = useUserPermissions();

  // ── Compat legacy : ?supplierRequest=1 → ouvre NewRequestDialog ciblé ────
  useEffect(() => {
    if (searchParams.get(SUPPLIER_REQUEST_QUERY_PARAM) !== '1') return;
    setSelectedProcessTemplateId(SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID);
    setSelectedSubProcessTemplateId(SUPPLIER_NEW_REQUEST_SUB_PROCESS_TEMPLATE_ID);
    setIsNewRequestOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete(SUPPLIER_REQUEST_QUERY_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // ── Compat legacy : /service-achat/nouveau-fournisseur ────────────────────
  useEffect(() => {
    const onServiceAchatPath = matchPath(
      { path: SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH, end: true },
      location.pathname,
    );
    if (!onServiceAchatPath) {
      supplierServiceAchatPathHandledRef.current = false;
      return;
    }
    if (supplierServiceAchatPathHandledRef.current) return;
    supplierServiceAchatPathHandledRef.current = true;
    setSelectedProcessTemplateId(SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID);
    setSelectedSubProcessTemplateId(SUPPLIER_NEW_REQUEST_SUB_PROCESS_TEMPLATE_ID);
    setIsNewRequestOpen(true);
  }, [location.pathname]);

  const handleCloseNewRequestDialog = useCallback(() => {
    setIsNewRequestOpen(false);
    setSelectedProcessTemplateId(undefined);
    setSelectedSubProcessTemplateId(undefined);
    if (
      matchPath({ path: SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH, end: true }, location.pathname)
    ) {
      navigate('/requests', { replace: true });
    }
  }, [location.pathname, navigate]);

  // ── Chargement des demandes (RLS-aware) ──────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'request')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Live-update : statuts des demandes en temps réel
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('requests-live-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: 'type=eq.request' },
        (payload: any) => {
          const updated = payload?.new;
          if (!updated?.id) return;
          setRequests((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
          );
          setSelectedRequest((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Ne montrer que mes demandes (= demandes que J'AI faites)
  const myRequests = useMemo(() => {
    if (!profile?.id) return [];
    return requests.filter(r => r.requester_id === profile.id);
  }, [requests, profile?.id]);

  // Stats pour ConfigurableDashboard
  const dashboardStats = useMemo((): TaskStats => {
    const total = myRequests.length;
    const todo = myRequests.filter(t => t.status === 'todo').length;
    const inProgress = myRequests.filter(t => t.status === 'in-progress').length;
    const done = myRequests.filter(t => t.status === 'done').length;
    const pendingValidation = myRequests.filter(
      t => t.status === 'pending_validation_1' || t.status === 'pending_validation_2',
    ).length;
    const validated = myRequests.filter(t => t.status === 'validated').length;
    const refused = myRequests.filter(t => t.status === 'refused').length;
    return {
      total, todo, inProgress, done, pendingValidation, validated, refused,
      completionRate: total > 0 ? Math.round(((done + validated) / total) * 100) : 0,
    };
  }, [myRequests]);

  const globalProgress = dashboardStats.completionRate;

  // Deep-link `?openTask=…` depuis la cloche/sidebar
  const openNotificationTarget = useCallback(
    async (taskId: string) => {
      let task = requests.find((r) => r.id === taskId) || allTasks.find((t) => t.id === taskId);
      if (!task) {
        const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
        if (error || !data) {
          toast.error('Élément introuvable ou inaccessible');
          return;
        }
        task = data as Task;
      }
      setSelectedRequest(task);
      setIsDetailOpen(true);
    },
    [requests, allTasks],
  );

  useEffect(() => {
    const taskId = searchParams.get('openTask');
    if (!taskId) return;
    void openNotificationTarget(taskId);
    const next = new URLSearchParams(searchParams);
    next.delete('openTask');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openNotificationTarget]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRefresh = () => {
    fetchRequests();
    refetchPending();
  };

  const handleRequestStatusChange = useCallback(
    async (taskId: string, status: any) => {
      await updateTaskStatus(taskId, status);
      const now = new Date().toISOString();
      setRequests((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status, updated_at: now } : t)),
      );
      setSelectedRequest((prev) => (prev && prev.id === taskId ? { ...prev, status, updated_at: now } : prev));
    },
    [updateTaskStatus],
  );

  const handleViewRequest = (request: Task) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  // ── Liste des actions / boutons ────────────────────────────────────────────
  const actions: RequestAction[] = [
    {
      key: 'be',
      label: 'Demande BE',
      description: 'Bureau d\'études : prestations, dossiers, plans',
      icon: FolderOpen,
      accent: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      onClick: () => setIsBERequestOpen(true),
      visible: true,
    },
    {
      key: 'supplier',
      label: 'Nouveau fournisseur',
      description: 'Référencer un nouveau fournisseur (Achats)',
      icon: Building2,
      accent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      // Même flux que le bouton « Demande de nouveau fournisseur » sur /suppliers :
      // NewSupplierRequestDialog (formulaire dédié, pas le drilldown générique).
      onClick: () => setIsSupplierOpen(true),
      visible: true,
    },
    {
      key: 'innovation',
      label: 'Innovation',
      description: 'Nouvelle idée ou demande d\'innovation',
      icon: Lightbulb,
      accent: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      onClick: () => navigate('/innovation/requests'),
      visible: true,
    },
    {
      key: 'other',
      label: 'Autre demande',
      description: 'IT, service achat, ou autre processus configuré',
      icon: ClipboardList,
      accent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      onClick: () => {
        setSelectedProcessTemplateId(undefined);
        setSelectedSubProcessTemplateId(undefined);
        setIsNewRequestOpen(true);
      },
      visible: true,
    },
    {
      key: 'personal',
      label: 'Tâche personnelle',
      description: 'Une note ou une tâche pour moi-même',
      icon: ListChecks,
      accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      onClick: () => setIsAddTaskOpen(true),
      visible: true,
    },
    {
      key: 'team',
      label: 'Tâche pour mon équipe',
      description: 'Confier une tâche à un collaborateur (N-1)',
      icon: UserCog,
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      onClick: () => setIsNewTaskOpen(true),
      visible: isManager,
    },
  ];

  const visibleActions = actions.filter((a) => a.visible);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DeadlineTasksOverrideProvider value={allTasks}>
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Demandes"
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
            <div className="space-y-8">
              {/* ── Section 1 : Créer une demande ───────────────────────── */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold tracking-tight">Créer une demande</h2>
                  <span className="text-xs text-muted-foreground">
                    Choisis le type qui correspond à ton besoin
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleActions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={a.onClick}
                        className="text-left transition-transform hover:-translate-y-0.5"
                      >
                        <Card className="border-border/60 hover:shadow-md hover:border-primary/40 h-full">
                          <CardContent className="p-4 flex items-start gap-3">
                            <div className={cn('p-2.5 rounded-xl shrink-0', a.accent)}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{a.label}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {a.description}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── Section 2 : Suivi de mes demandes ─────────────────────── */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-bold tracking-tight">Mes demandes</h2>
                  {myRequests.length > 0 && (
                    <Badge variant="secondary">{myRequests.length}</Badge>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : myRequests.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                    Tu n'as pas encore de demandes en cours. Utilise les boutons ci-dessus pour en créer une.
                  </div>
                ) : (
                  <ConfigurableDashboard
                    tasks={myRequests}
                    stats={dashboardStats}
                    globalProgress={globalProgress}
                    onTaskClick={handleViewRequest}
                  />
                )}
              </section>
            </div>
          </main>
        </div>

        {/* ── Dialogs ──────────────────────────────────────────────────────── */}
        <NewBERequestDialog
          open={isBERequestOpen}
          onOpenChange={setIsBERequestOpen}
          onCreated={handleRefresh}
        />

        <NewSupplierRequestDialog
          open={isSupplierOpen}
          onClose={() => setIsSupplierOpen(false)}
        />

        <AddTaskDialog
          open={isAddTaskOpen}
          onClose={() => setIsAddTaskOpen(false)}
          onAdd={addTask}
        />

        <NewTaskDialog
          open={isNewTaskOpen}
          onClose={() => setIsNewTaskOpen(false)}
          mode="team"
          onAdd={addTask}
        />

        <NewRequestDialog
          open={isNewRequestOpen}
          onClose={handleCloseNewRequestDialog}
          onAdd={addTask}
          initialProcessTemplateId={selectedProcessTemplateId}
          initialSubProcessTemplateId={selectedSubProcessTemplateId}
          onTasksCreated={handleRefresh}
        />

        {selectedRequest && (
          <RequestDetailDialog
            task={selectedRequest}
            open={isDetailOpen}
            onClose={() => {
              setIsDetailOpen(false);
              setSelectedRequest(null);
              handleRefresh();
            }}
            onStatusChange={handleRequestStatusChange}
            onTaskMutated={handleRefresh}
          />
        )}
      </div>
    </DeadlineTasksOverrideProvider>
  );
};

export default Requests;
