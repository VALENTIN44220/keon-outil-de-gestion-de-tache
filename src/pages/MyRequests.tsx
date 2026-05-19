/**
 * MyRequests — page « Mes demandes ».
 *
 * Suivi des demandes faites par l'utilisateur courant. Extrait de l'ancienne
 * page /requests (refonte chantier 2 : la page Demandes ne sert plus qu'à la
 * création, le suivi a sa page dédiée).
 *
 * Compat : la page conserve le deep-link `?openTask=<uuid>` pour ouvrir une
 * demande directement depuis la cloche notif sidebar.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { DeadlineTasksOverrideProvider } from '@/contexts/DeadlineTasksOverrideContext';
import { UnifiedTaskDetailDialog } from '@/components/tasks/UnifiedTaskDetailDialog';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { useTasks } from '@/hooks/useTasks';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { Task, TaskStats } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MACRO_STATE_CATEGORIES,
  BE_PROCESS_ID,
  useRequestStates,
  type MacroStateCategory,
} from '@/hooks/useRequestStates';

const MyRequests = () => {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  // En mode simulation, on raisonne avec le profil simulé pour que la page
  // « Mes demandes » reflète bien la perspective de l'utilisateur incarné
  // (sinon on continuerait d'afficher les demandes de l'admin réel).
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('my-requests');
  const [requests, setRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [macroFilter, setMacroFilter] = useState<'all' | MacroStateCategory>('all');

  // Pour l'instant on ne connaît que les états BE — on prend ce mapping pour les demandes BE.
  // Les autres processus seront alimentés au fur et à mesure (et cohabiteront sans casser).
  const { statesByCode: beStatesByCode } = useRequestStates(BE_PROCESS_ID);

  const { allTasks, searchQuery, setSearchQuery, updateTaskStatus } = useTasks();
  const { refetch: refetchPending } = usePendingAssignments();

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

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`my-requests-live-status-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: 'type=eq.request' },
        (payload: any) => {
          const updated = payload?.new;
          if (!updated?.id) return;
          setRequests((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
          setSelectedRequest((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const myRequests = useMemo(() => {
    if (!profile?.id) return [];
    return requests.filter((r) => r.requester_id === profile.id);
  }, [requests, profile?.id]);

  // Filtre par catégorie macro d'état (basé sur current_state_code)
  const filteredRequests = useMemo(() => {
    if (macroFilter === 'all') return myRequests;
    return myRequests.filter((r) => {
      const code = (r as any).current_state_code as string | null;
      if (!code) return false;
      const macro = beStatesByCode.get(code)?.state_category ?? null;
      return macro === macroFilter;
    });
  }, [myRequests, macroFilter, beStatesByCode]);

  // Compteurs par catégorie pour les chips
  const macroCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of myRequests) {
      const code = (r as any).current_state_code as string | null;
      const cat = code ? (beStatesByCode.get(code)?.state_category ?? null) : null;
      if (cat) m.set(cat, (m.get(cat) ?? 0) + 1);
    }
    return m;
  }, [myRequests, beStatesByCode]);

  const dashboardStats = useMemo((): TaskStats => {
    const total = myRequests.length;
    const todo = myRequests.filter((t) => t.status === 'todo').length;
    const inProgress = myRequests.filter((t) => t.status === 'in-progress').length;
    const done = myRequests.filter((t) => t.status === 'done').length;
    const pendingValidation = myRequests.filter(
      (t) => t.status === 'pending_validation_1' || t.status === 'pending_validation_2',
    ).length;
    const validated = myRequests.filter((t) => t.status === 'validated').length;
    const refused = myRequests.filter((t) => t.status === 'refused').length;
    return {
      total, todo, inProgress, done, pendingValidation, validated, refused,
      completionRate: total > 0 ? Math.round(((done + validated) / total) * 100) : 0,
    };
  }, [myRequests]);

  const globalProgress = dashboardStats.completionRate;

  // Deep-link openTask
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

  const handleRefresh = () => {
    fetchRequests();
    refetchPending();
  };

  const handleRequestStatusChange = useCallback(
    async (taskId: string, status: any) => {
      await updateTaskStatus(taskId, status);
      const now = new Date().toISOString();
      setRequests((prev) => prev.map((t) => (t.id === taskId ? { ...t, status, updated_at: now } : t)));
      setSelectedRequest((prev) => (prev && prev.id === taskId ? { ...prev, status, updated_at: now } : prev));
    },
    [updateTaskStatus],
  );

  return (
    <DeadlineTasksOverrideProvider value={allTasks}>
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Mes demandes" searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Suivi de mes demandes</h2>
                {myRequests.length > 0 && <Badge variant="secondary">{myRequests.length}</Badge>}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : myRequests.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                  Tu n'as pas encore créé de demandes. Va sur <a href="/requests" className="text-primary underline">Demandes</a> pour en créer une.
                </div>
              ) : (
                <>
                  {/* Filtre catégorie macro d'état */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant={macroFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setMacroFilter('all')}
                    >
                      Tous ({myRequests.length})
                    </Button>
                    {MACRO_STATE_CATEGORIES.map((c) => {
                      const count = macroCounts.get(c.key) ?? 0;
                      const active = macroFilter === c.key;
                      return (
                        <Button
                          key={c.key}
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          className={cn('h-7 text-xs', !active && count === 0 && 'opacity-50')}
                          onClick={() => setMacroFilter(c.key)}
                          disabled={count === 0 && !active}
                        >
                          {c.label} ({count})
                        </Button>
                      );
                    })}
                  </div>

                  <ConfigurableDashboard
                    tasks={filteredRequests}
                    stats={dashboardStats}
                    globalProgress={globalProgress}
                    onTaskClick={(req) => { navigate(`/demande/${req.id}`); }}
                  />
                </>
              )}
            </div>
          </main>
        </div>

        {selectedRequest && (
          <UnifiedTaskDetailDialog
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

export default MyRequests;
