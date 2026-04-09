import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { NewRequestDialog } from '@/components/tasks/NewRequestDialog';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { NewTaskDialog } from '@/components/tasks/NewTaskDialog';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useTasks } from '@/hooks/useTasks';
import { Task, TaskStats } from '@/types/task';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Plus, 
  Building2,
  Eye,
} from 'lucide-react';
import { ServiceProcessCard } from '@/components/tasks/ServiceProcessCard';
import { DraggableActionCards } from '@/components/requests/DraggableActionCards';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID,
  SUPPLIER_REQUEST_QUERY_PARAM,
} from '@/lib/supplierRequestFlow';

interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
}

interface SubProcessTemplate {
  id: string;
  process_template_id: string;
  name: string;
  description: string | null;
  assignment_type: string;
  show_quick_launch?: boolean;
}

interface ProcessWithSubProcesses extends ProcessTemplate {
  sub_processes: SubProcessTemplate[];
}

const Requests = () => {
  const { profile, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('requests');
  const [mainTab, setMainTab] = useState('create');
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [requests, setRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processes, setProcesses] = useState<ProcessWithSubProcesses[]>([]);
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState<string | undefined>();
  const [selectedSubProcessTemplateId, setSelectedSubProcessTemplateId] = useState<string | undefined>();
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const {
    allTasks,
    searchQuery,
    setSearchQuery,
    updateTaskStatus,
    deleteTask,
    addTask,
    refetch,
  } = useTasks();

  const { getPendingCount, refetch: refetchPending } = usePendingAssignments();
  const { canAssignToTeam, isManager } = useUserPermissions();

  // Fetch processes for service requests
  useEffect(() => {
    fetchProcesses();
  }, []);

  // Redirection depuis /suppliers : ouvrir le formulaire « Demande de nouveau fournisseur »
  useEffect(() => {
    if (searchParams.get(SUPPLIER_REQUEST_QUERY_PARAM) !== '1') return;
    setMainTab('create');
    setSelectedProcessTemplateId(SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID);
    setSelectedSubProcessTemplateId(undefined);
    setIsNewRequestOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete(SUPPLIER_REQUEST_QUERY_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const fetchProcesses = async () => {
    const { data: processData } = await supabase
      .from('process_templates')
      .select('id, name, description, target_department_id, departments:target_department_id(name)')
      .eq('is_shared', true)
      .order('name');
    
    if (!processData) {
      setProcesses([]);
      return;
    }

    const { data: subProcessData } = await supabase
      .from('sub_process_templates')
      .select('id, process_template_id, name, description, assignment_type, show_quick_launch')
      .eq('is_shared', true)
      .order('order_index');

    const processesWithSubs: ProcessWithSubProcesses[] = processData.map((process: any) => ({
      ...process,
      // Ensure card displays the real linked department name (FK) rather than legacy text field.
      department: process.departments?.name || null,
      sub_processes: (subProcessData || []).filter(sp => sp.process_template_id === process.id)
    }));

    setProcesses(processesWithSubs);
  };

  // Fetch all requests where user is requester
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Fetch all requests the user has access to (RLS handles filtering)
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

  // Live-update request statuses without full refresh.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('requests-live-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: 'type=eq.request',
        },
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Get progress for all requests
  const requestIds = useMemo(() => requests.map(r => r.id), [requests]);
  const { progressMap } = useTasksProgress(requestIds);

  // Filter to user's own outgoing requests for the dashboard
  const myRequests = useMemo(() => {
    if (!profile?.id) return [];
    return requests.filter(r => r.requester_id === profile.id);
  }, [requests, profile?.id]);

  // Compute stats for ConfigurableDashboard
  const dashboardStats = useMemo((): TaskStats => {
    const total = myRequests.length;
    const todo = myRequests.filter(t => t.status === 'todo').length;
    const inProgress = myRequests.filter(t => t.status === 'in-progress').length;
    const done = myRequests.filter(t => t.status === 'done').length;
    const pendingValidation = myRequests.filter(t => t.status === 'pending_validation_1' || t.status === 'pending_validation_2').length;
    const validated = myRequests.filter(t => t.status === 'validated').length;
    const refused = myRequests.filter(t => t.status === 'refused').length;
    return {
      total,
      todo,
      inProgress,
      done,
      pendingValidation,
      validated,
      refused,
      completionRate: total > 0 ? Math.round(((done + validated) / total) * 100) : 0,
    };
  }, [myRequests]);

  const globalProgress = dashboardStats.completionRate;

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
    [requests, allTasks]
  );

  const handleNotificationClick = (taskId: string) => {
    void openNotificationTarget(taskId);
  };

  const handleCommentNotificationClick = useCallback(
    (taskId: string, _notificationId: string) => {
      void openNotificationTarget(taskId);
    },
    [openNotificationTarget]
  );

  const handleRefresh = () => {
    fetchRequests();
    refetchPending();
  };

  // Requests are loaded in local state (not from useTasks), so we must update them locally too.
  const handleRequestStatusChange = useCallback(
    async (taskId: string, status: any) => {
      await updateTaskStatus(taskId, status);
      const now = new Date().toISOString();
      setRequests((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status, updated_at: now } : t))
      );
      setSelectedRequest((prev) => (prev && prev.id === taskId ? { ...prev, status, updated_at: now } : prev));
    },
    [updateTaskStatus]
  );

  const handleOpenRequest = (task: Task, subProcessId?: string, processId?: string) => {
    setSelectedProcessTemplateId(processId);
    setSelectedSubProcessTemplateId(subProcessId);
    setIsNewRequestOpen(true);
  };

  const handleViewRequest = (request: Task) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  // Collect all quick launch sub-processes with color index
  const quickLaunchItems = useMemo(() => {
    const items: { subProcess: SubProcessTemplate; processId: string; processName: string; colorIndex: number }[] = [];
    for (let i = 0; i < processes.length; i++) {
      const process = processes[i];
      for (const sp of process.sub_processes) {
        if (sp.show_quick_launch) {
          items.push({ subProcess: sp, processId: process.id, processName: process.name, colorIndex: i });
        }
      }
    }
    return items;
  }, [processes]);

  const renderCreateTab = () => (
    <div className="space-y-6">
      {/* Draggable quick action cards */}
      <DraggableActionCards
        isManager={isManager}
        quickLaunchItems={quickLaunchItems}
        onPersonalTask={() => setIsAddTaskOpen(true)}
        onTeamTask={() => setIsNewTaskOpen(true)}
        onCustomRequest={() => setIsNewRequestOpen(true)}
        onQuickLaunch={(subProcessId, processId) => handleOpenRequest(null as any, subProcessId, processId)}
      />

      {/* Service requests by process */}
      {processes.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold tracking-tight">
              Demandes aux services
            </h3>
            <Badge variant="secondary" className="ml-auto">
              {processes.length} processus
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {processes.map((process, index) => (
              <ServiceProcessCard
                key={process.id}
                id={process.id}
                name={process.name}
                department={process.department}
                subProcesses={process.sub_processes}
                onCreateRequest={(processId) => handleOpenRequest(null as any, undefined, processId)}
                onQuickLaunch={(processId, subProcessId) => handleOpenRequest(null as any, subProcessId, processId)}
                colorIndex={index}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Main tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="create" className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle demande
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-2">
              <Eye className="h-4 w-4" />
              Suivi des demandes
              {myRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {myRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            {renderCreateTab()}
          </TabsContent>

          <TabsContent value="tracking" className="mt-6">
            <ConfigurableDashboard
              tasks={myRequests}
              stats={dashboardStats}
              globalProgress={globalProgress}
              onTaskClick={handleViewRequest}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Demandes"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notificationTasks={allTasks}
          onNotificationClick={handleNotificationClick}
          onCommentNotificationClick={handleCommentNotificationClick}
        />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          {renderContent()}
        </main>
      </div>

      {/* Dialogs */}
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
        onClose={() => setIsNewRequestOpen(false)}
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
        />
      )}
    </div>
  );
};

export default Requests;
