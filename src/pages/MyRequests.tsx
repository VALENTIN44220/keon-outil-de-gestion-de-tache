import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { DeadlineTasksOverrideProvider } from '@/contexts/DeadlineTasksOverrideContext';
import { UnifiedTaskDetailDialog } from '@/components/tasks/UnifiedTaskDetailDialog';
import { DataTableWidget } from '@/components/dashboard/widgets/DataTableWidget';
import { FilterDrawerButton } from '@/components/dashboard/FilterDrawerButton';
import { CrossFilters, DEFAULT_CROSS_FILTERS } from '@/components/dashboard/types';
import { useTasks } from '@/hooks/useTasks';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { Task } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { toast } from 'sonner';
import { isWithinInterval, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const MyRequests = () => {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('my-requests');
  const [requests, setRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [crossFilters, setCrossFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);

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

  const filteredRequests = useMemo(() => {
    return myRequests.filter((task) => {
      const f = crossFilters;

      if (f.searchQuery && !task.title?.toLowerCase().includes(f.searchQuery.toLowerCase())) return false;

      if (f.statuses.length > 0 && !f.statuses.includes(task.status)) return false;

      if (f.priorities.length > 0 && task.priority && !f.priorities.includes(task.priority)) return false;

      if (f.categoryIds.length > 0 && !f.categoryIds.includes(task.category_id || '')) return false;

      if (f.assigneeIds.length > 0 && !f.assigneeIds.includes(task.assignee_id || '')) return false;

      if (f.dateRange.start || f.dateRange.end || f.period) {
        const taskDate = task.due_date ? new Date(task.due_date) : null;
        if (!taskDate) return false;
        if (f.period && f.period !== 'all') {
          const now = new Date();
          if (f.period === 'today') {
            if (!isWithinInterval(taskDate, { start: subDays(now, 1), end: now })) return false;
          } else if (f.period === 'week') {
            if (!isWithinInterval(taskDate, { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) })) return false;
          } else if (f.period === 'month') {
            if (!isWithinInterval(taskDate, { start: startOfMonth(now), end: endOfMonth(now) })) return false;
          } else if (f.period === '30days') {
            if (!isWithinInterval(taskDate, { start: subDays(now, 30), end: now })) return false;
          } else if (f.period === '90days') {
            if (!isWithinInterval(taskDate, { start: subDays(now, 90), end: now })) return false;
          }
        }
        if (f.dateRange.start && taskDate < new Date(f.dateRange.start)) return false;
        if (f.dateRange.end && taskDate > new Date(f.dateRange.end)) return false;
      }

      return true;
    });
  }, [myRequests, crossFilters]);

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

  const activeFilterCount = filteredRequests.length !== myRequests.length;

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
                {myRequests.length > 0 && (
                  <Badge variant="secondary">
                    {activeFilterCount ? `${filteredRequests.length} / ${myRequests.length}` : myRequests.length}
                  </Badge>
                )}
                <div className="ml-auto">
                  <FilterDrawerButton
                    filters={crossFilters}
                    onFiltersChange={setCrossFilters}
                    contextId="my-requests"
                  />
                </div>
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
                <div className="rounded-xl border bg-white overflow-hidden">
                  <DataTableWidget
                    tasks={filteredRequests}
                    onTaskClick={(req) => { navigate(`/demande/${req.id}`); }}
                    processId="my-requests"
                  />
                </div>
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
