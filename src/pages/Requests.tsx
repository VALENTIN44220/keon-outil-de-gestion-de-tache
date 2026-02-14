import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { NewRequestDialog } from '@/components/tasks/NewRequestDialog';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { NewTaskDialog } from '@/components/tasks/NewTaskDialog';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { useNotifications } from '@/hooks/useNotifications';
import { useCommentNotifications } from '@/hooks/useCommentNotifications';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useTasks } from '@/hooks/useTasks';
import { Task, TaskStats } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Plus, 
  FileText, 
  Users,
  Building2,
  User,
  Eye,
} from 'lucide-react';
import { ServiceProcessCard } from '@/components/tasks/ServiceProcessCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
}

interface ProcessWithSubProcesses extends ProcessTemplate {
  sub_processes: SubProcessTemplate[];
}

const Requests = () => {
  const { profile, user } = useAuth();
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

  const { notifications, unreadCount, hasUrgent } = useNotifications(allTasks);
  const { commentNotifications, markAsRead: markCommentAsRead } = useCommentNotifications();
  const { getPendingCount, refetch: refetchPending } = usePendingAssignments();
  const { canAssignToTeam, isManager } = useUserPermissions();

  // Fetch processes for service requests
  useEffect(() => {
    fetchProcesses();
  }, []);

  const fetchProcesses = async () => {
    const { data: processData } = await supabase
      .from('process_templates')
      .select('id, name, description, department')
      .eq('is_shared', true)
      .order('name');
    
    if (!processData) {
      setProcesses([]);
      return;
    }

    const { data: subProcessData } = await supabase
      .from('sub_process_templates')
      .select('id, process_template_id, name, description, assignment_type')
      .eq('is_shared', true)
      .order('order_index');

    const processesWithSubs: ProcessWithSubProcesses[] = processData.map(process => ({
      ...process,
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

  const handleNotificationClick = (taskId: string) => {
    const task = requests.find(r => r.id === taskId);
    if (task) {
      setSelectedRequest(task);
      setIsDetailOpen(true);
    }
  };

  const handleCommentNotificationClick = useCallback((taskId: string, notificationId: string) => {
    markCommentAsRead(notificationId);
    const task = requests.find(r => r.id === taskId) || allTasks.find(t => t.id === taskId);
    if (task) {
      setSelectedRequest(task);
      setIsDetailOpen(true);
    }
  }, [requests, allTasks, markCommentAsRead]);

  const handleRefresh = () => {
    fetchRequests();
    refetchPending();
  };

  const handleOpenRequest = (task: Task, subProcessId?: string, processId?: string) => {
    setSelectedProcessTemplateId(processId);
    setSelectedSubProcessTemplateId(subProcessId);
    setIsNewRequestOpen(true);
  };

  const handleViewRequest = (request: Task) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  const renderCreateTab = () => (
    <div className="space-y-6">
      {/* Quick action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Personal task */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
          onClick={() => setIsAddTaskOpen(true)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Tâche personnelle</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>Créer une tâche pour moi-même</CardDescription>
          </CardContent>
        </Card>

        {/* Team task */}
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50 ${!isManager ? 'opacity-50' : ''}`}
          onClick={() => isManager && setIsNewTaskOpen(true)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <CardTitle className="text-base">Affecter à mon équipe</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              {isManager ? "Affecter une tâche à un membre de votre équipe" : "Réservé aux managers"}
            </CardDescription>
          </CardContent>
        </Card>

        {/* Custom request */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-accent/50"
          onClick={() => setIsNewRequestOpen(true)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <FileText className="h-5 w-5 text-accent-foreground" />
              </div>
              <CardTitle className="text-base">Demande personnalisée</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>Créer une demande libre à un service</CardDescription>
          </CardContent>
        </Card>
      </div>

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
          notifications={notifications}
          commentNotifications={commentNotifications}
          unreadCount={unreadCount}
          hasUrgent={hasUrgent}
          onNotificationClick={handleNotificationClick}
          onCommentNotificationClick={handleCommentNotificationClick}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
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
          onStatusChange={updateTaskStatus}
        />
      )}
    </div>
  );
};

export default Requests;
