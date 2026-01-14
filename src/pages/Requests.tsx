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
import { BERequestDialog } from '@/components/tasks/BERequestDialog';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useCategories } from '@/hooks/useCategories';
import { useTasks } from '@/hooks/useTasks';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Plus, 
  FileText, 
  ClipboardList, 
  Users,
  Building2,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

const Requests = () => {
  const [activeView, setActiveView] = useState('requests');
  const [activeTab, setActiveTab] = useState('my-requests');
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
  const [isBERequestOpen, setIsBERequestOpen] = useState(false);
  const [requests, setRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  const { getPendingCount, refetch: refetchPending } = usePendingAssignments();
  const { canAssignToTeam, canViewBEProjects } = useUserPermissions();
  const pendingCount = getPendingCount();

  // Fetch only requests (type = 'request')
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

    // Filter by tab
    if (activeTab === 'my-requests') {
      filtered = filtered.filter(r => r.requester_id !== null);
    } else if (activeTab === 'received') {
      filtered = filtered.filter(r => r.target_department_id !== null);
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
        r.description?.toLowerCase().includes(query)
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
  }, [requests, activeTab, statusFilter, priorityFilter, searchQuery, advancedFilters]);

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

  const handleRefresh = () => {
    fetchRequests();
    refetchPending();
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
        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setIsNewRequestOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle demande
          </Button>
          {canViewBEProjects && (
            <Button variant="outline" onClick={() => setIsBERequestOpen(true)} className="gap-2">
              <Building2 className="h-4 w-4" />
              Demande Bureau d'Études
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="my-requests" className="gap-2">
              <FileText className="h-4 w-4" />
              Mes demandes
              <Badge variant="secondary" className="ml-1">
                {requests.filter(r => r.requester_id !== null).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="received" className="gap-2">
              <Inbox className="h-4 w-4" />
              Reçues
              <Badge variant="secondary" className="ml-1">
                {requests.filter(r => r.target_department_id !== null).length}
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
          unreadCount={unreadCount}
          hasUrgent={hasUrgent}
          onNotificationClick={handleNotificationClick}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>

      {/* Dialogs */}
      <NewRequestDialog
        open={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        onAdd={addTask}
        onTasksCreated={handleRefresh}
      />
      
      <BERequestDialog
        open={isBERequestOpen}
        onClose={() => setIsBERequestOpen(false)}
      />
    </div>
  );
};

export default Requests;
