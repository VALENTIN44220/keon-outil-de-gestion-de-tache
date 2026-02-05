import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { AdvancedFilters, AdvancedFiltersState } from '@/components/tasks/AdvancedFilters';
import { TaskViewSelector, TaskView } from '@/components/tasks/TaskViewSelector';
import { TaskList } from '@/components/tasks/TaskList';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CalendarView } from '@/components/tasks/CalendarView';
import { PendingAssignmentsView } from '@/components/tasks/PendingAssignmentsView';
import { NewRequestDialog } from '@/components/tasks/NewRequestDialog';
// BERequestDialog removed - unified into NewRequestDialog
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { NewTaskDialog } from '@/components/tasks/NewTaskDialog';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { useNotifications } from '@/hooks/useNotifications';
import { useCommentNotifications } from '@/hooks/useCommentNotifications';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useCategories } from '@/hooks/useCategories';
import { useTasks } from '@/hooks/useTasks';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Plus, 
  FileText, 
  ClipboardList, 
  Users,
  Building2,
  Inbox,
  User,
  FolderOpen,
  Workflow,
  ChevronRight,
  CheckSquare,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { RequestCard } from '@/components/tasks/RequestCard';
import { ServiceProcessCard } from '@/components/tasks/ServiceProcessCard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

interface RequestComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
}

const Requests = () => {
  const { profile, user } = useAuth();
  const [activeView, setActiveView] = useState('requests');
  const [mainTab, setMainTab] = useState('create');
  const [subTab, setSubTab] = useState('my-requests');
  const [taskView, setTaskView] = useState<TaskView>('grid');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>({
    assigneeId: 'all',
    requesterId: 'all',
    reporterId: 'all',
    company: 'all',
    department: 'all',
    categoryId: 'all',
    subcategoryId: 'all',
    groupBy: 'none',
  });
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  // BERequestDialog state removed - unified into NewRequestDialog
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [requests, setRequests] = useState<Task[]>([]);
  const [myOutgoingRequests, setMyOutgoingRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processes, setProcesses] = useState<ProcessWithSubProcesses[]>([]);
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState<string | undefined>();
  const [selectedSubProcessTemplateId, setSelectedSubProcessTemplateId] = useState<string | undefined>();
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<RequestComment[]>([]);

  const {
    allTasks,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    searchQuery,
    setSearchQuery,
    updateTaskStatus,
    deleteTask,
    addTask,
    refetch,
  } = useTasks();

  const { categories } = useCategories();
  const { notifications, unreadCount, hasUrgent } = useNotifications(allTasks);
  const { commentNotifications, markAsRead: markCommentAsRead } = useCommentNotifications();
  const { getPendingCount, refetch: refetchPending } = usePendingAssignments();
  const { canAssignToTeam, canViewBEProjects, isManager } = useUserPermissions();
  const pendingCount = getPendingCount();

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

  // Fetch all requests
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch requests where user is assignee or in target department (received)
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

  // Fetch user's outgoing requests
  const fetchMyOutgoingRequests = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'request')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyOutgoingRequests((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching outgoing requests:', error);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchRequests();
    fetchMyOutgoingRequests();
  }, [fetchRequests, fetchMyOutgoingRequests]);

  // Get progress for all requests
  const requestIds = useMemo(() => [...requests, ...myOutgoingRequests].map(r => r.id), [requests, myOutgoingRequests]);
  const { progressMap } = useTasksProgress(requestIds);

  // Fetch profiles for group labels
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name');
      
      if (data) {
        const map = new Map<string, string>();
        data.forEach(p => map.set(p.id, p.display_name || 'Sans nom'));
        setProfilesMap(map);
      }
    };
    fetchProfiles();
  }, []);

  // Filter requests based on tab and filters
  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Filter by sub-tab
    if (subTab === 'my-requests') {
      filtered = filtered.filter(r => r.requester_id === profile?.id);
    } else if (subTab === 'received') {
      filtered = filtered.filter(r => r.assignee_id === profile?.id || r.target_department_id === profile?.department_id);
    }

    // By default, hide cancelled requests when status filter is set to "all"
    if (statusFilter === 'all') {
      filtered = filtered.filter(r => r.status !== 'cancelled');
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(r => r.priority === priorityFilter);
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        // Search by request number (D-XXX-XXXXX format)
        r.request_number?.toLowerCase().includes(query) ||
        // Search by task number (T-XXX-XXXX format)
        r.task_number?.toLowerCase().includes(query)
      );
    }

    // Apply advanced filters
    if (advancedFilters.assigneeId !== 'all') {
      filtered = filtered.filter(r => r.assignee_id === advancedFilters.assigneeId);
    }
    if (advancedFilters.requesterId !== 'all') {
      filtered = filtered.filter(r => r.requester_id === advancedFilters.requesterId);
    }
    if (advancedFilters.categoryId !== 'all') {
      filtered = filtered.filter(r => r.category_id === advancedFilters.categoryId);
    }
    if (advancedFilters.subcategoryId !== 'all') {
      filtered = filtered.filter(r => r.subcategory_id === advancedFilters.subcategoryId);
    }

    return filtered;
  }, [requests, subTab, profile?.id, profile?.department_id, statusFilter, priorityFilter, searchQuery, advancedFilters]);

  // Build group labels map
  const groupLabels = useMemo(() => {
    const labels = new Map<string, string>();
    profilesMap.forEach((name, id) => labels.set(id, name));
    categories.forEach(cat => {
      labels.set(cat.id, cat.name);
      cat.subcategories.forEach(sub => labels.set(sub.id, sub.name));
    });
    labels.set('Non assigné', 'Non assigné');
    labels.set('Non défini', 'Non défini');
    labels.set('Sans catégorie', 'Sans catégorie');
    labels.set('Sans sous-catégorie', 'Sans sous-catégorie');
    return labels;
  }, [profilesMap, categories]);

  const handleNotificationClick = (taskId: string) => {
    const task = requests.find(r => r.id === taskId);
    if (task) {
      setSearchQuery(task.title);
      toast.info(`Demande sélectionnée: ${task.title}`);
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
    fetchMyOutgoingRequests();
    refetchPending();
  };

  const handleOpenRequest = (task: Task, subProcessId?: string, processId?: string) => {
    setSelectedProcessTemplateId(processId);
    setSelectedSubProcessTemplateId(subProcessId);
    setIsNewRequestOpen(true);
  };

  // handleOpenBERequest removed - use unified NewRequestDialog

  const handleViewRequest = (request: Task) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'review':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'to_assign':
        return <Users className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      to_assign: 'À affecter',
      todo: 'À faire',
      in_progress: 'En cours',
      'in-progress': 'En cours',
      review: 'En révision',
      done: 'Terminé',
      cancelled: 'Annulé',
    };
    return labels[status] || status;
  };

  const renderRequestView = () => {
    switch (taskView) {
      case 'kanban':
        return (
          <KanbanBoard
            tasks={filteredRequests}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupBy={advancedFilters.groupBy}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={handleRefresh}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            tasks={filteredRequests}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupBy={advancedFilters.groupBy}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={handleRefresh}
          />
        );
      default:
        return (
          <TaskList 
            tasks={filteredRequests} 
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupBy={advancedFilters.groupBy}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={handleRefresh}
          />
        );
    }
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

  const renderMyRequestsTab = () => (
    <div className="space-y-6">
      {myOutgoingRequests.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Aucune demande envoyée</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Vos demandes envoyées à d'autres services apparaîtront ici
          </p>
          <Button 
            className="mt-4" 
            onClick={() => setMainTab('create')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer une demande
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <TaskFilters
              statusFilter={statusFilter}
              priorityFilter={priorityFilter}
              onStatusChange={setStatusFilter}
              onPriorityChange={setPriorityFilter}
            />
          </div>

          {/* Request cards - Using enriched RequestCard component */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {myOutgoingRequests
              .filter(r => (statusFilter === 'all' ? r.status !== 'cancelled' : r.status === statusFilter))
              .filter(r => priorityFilter === 'all' || r.priority === priorityFilter)
              .map(request => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onClick={() => handleViewRequest(request)}
                  progressData={progressMap[request.id]}
                  onRequestUpdated={handleRefresh}
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
              {myOutgoingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {myOutgoingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            {renderCreateTab()}
          </TabsContent>

          <TabsContent value="tracking" className="mt-6">
            <Tabs value={subTab} onValueChange={setSubTab}>
              <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="my-requests" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Envoyées
                  <Badge variant="secondary" className="ml-1">
                    {myOutgoingRequests.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="received" className="gap-2">
                  <Inbox className="h-4 w-4" />
                  Reçues
                  <Badge variant="secondary" className="ml-1">
                    {requests.filter(r => r.assignee_id === profile?.id || r.target_department_id === profile?.department_id).length}
                  </Badge>
                </TabsTrigger>
                {canAssignToTeam && (
                  <TabsTrigger value="to-assign" className="gap-2">
                    <Users className="h-4 w-4" />
                    À affecter
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="ml-1">
                        {pendingCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="my-requests" className="mt-6">
                {renderMyRequestsTab()}
              </TabsContent>

              <TabsContent value="received" className="mt-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <TaskViewSelector currentView={taskView} onViewChange={setTaskView} />
                        <TaskFilters
                          statusFilter={statusFilter}
                          priorityFilter={priorityFilter}
                          onStatusChange={setStatusFilter}
                          onPriorityChange={setPriorityFilter}
                        />
                      </div>
                    </div>
                    <AdvancedFilters
                      filters={advancedFilters}
                      onFiltersChange={setAdvancedFilters}
                    />
                  </div>
                  {renderRequestView()}
                </div>
              </TabsContent>

              {canAssignToTeam && (
                <TabsContent value="to-assign" className="mt-6">
                  <PendingAssignmentsView />
                </TabsContent>
              )}
            </Tabs>
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
      
      {/* BERequestDialog removed - functionality unified into NewRequestDialog */}

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