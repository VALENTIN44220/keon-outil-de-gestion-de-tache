import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { DashboardToolbar, KanbanGroupMode } from '@/components/dashboard/DashboardToolbar';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { CrossFiltersPanel } from '@/components/dashboard/CrossFiltersPanel';
import { CrossFilters, DEFAULT_CROSS_FILTERS } from '@/components/dashboard/types';
import { TaskList } from '@/components/tasks/TaskList';
import { AdvancedFilters, AdvancedFiltersState } from '@/components/tasks/AdvancedFilters';
import { TaskView } from '@/components/tasks/TaskViewSelector';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CalendarView } from '@/components/tasks/CalendarView';
import { DenseTableView } from '@/components/tasks/DenseTableView';
import { CreateFromTemplateDialog } from '@/components/tasks/CreateFromTemplateDialog';
import { PendingAssignmentsView } from '@/components/tasks/PendingAssignmentsView';
import { TeamModule } from '@/components/team/TeamModule';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { PlannerSyncPanel } from '@/components/planner/PlannerSyncPanel';
import { useTasks } from '@/hooks/useTasks';
import { useTaskScope, TaskScope } from '@/hooks/useTaskScope';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useNotifications } from '@/hooks/useNotifications';
import { useCommentNotifications } from '@/hooks/useCommentNotifications';
import { useUnassignedTasks } from '@/hooks/useUnassignedTasks';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Workflow, ChevronDown, ChevronUp, Eye, Zap, Tags, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { Task, TaskStats } from '@/types/task';
import { BulkCategoryAssignDialog } from '@/components/tasks/BulkCategoryAssignDialog';
import { BulkReassignDialog } from '@/components/tasks/BulkReassignDialog';

const Index = () => {
  const { profile } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [taskView, setTaskView] = useState<TaskView>('grid');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showFullStats, setShowFullStats] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<'tasks' | 'analytics' | 'tracking' | 'planner'>('tasks');
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [isBulkReassignOpen, setIsBulkReassignOpen] = useState(false);
  const [kanbanGroupMode, setKanbanGroupMode] = useState<KanbanGroupMode>('status');
  const [crossFilters, setCrossFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  
  // Request tracking state
  const [myRequests, setMyRequests] = useState<Task[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null);
  const [isRequestDetailOpen, setIsRequestDetailOpen] = useState(false);
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
  
  // Use task scope hook for scope management
  const { scope, setScope, availableScopes } = useTaskScope();
  
  const {
    tasks,
    allTasks,
    stats,
    isLoading,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    searchQuery,
    setSearchQuery,
    updateTaskStatus,
    deleteTask,
    refetch,
  } = useTasks(scope);

  const { categories } = useCategories();
  const { notifications, unreadCount, hasUrgent } = useNotifications(allTasks);
  const { commentNotifications, markAsRead: markCommentAsRead } = useCommentNotifications();
  const { count: unassignedCount, refetch: refetchUnassigned } = useUnassignedTasks();
  const { getPendingCount, refetch: refetchPending } = usePendingAssignments();
  const { canAssignToTeam } = useUserPermissions();
  const pendingCount = getPendingCount();
  
  // State for comment notification task detail
  const [selectedTaskForComment, setSelectedTaskForComment] = useState<Task | null>(null);
  const [isCommentDetailOpen, setIsCommentDetailOpen] = useState(false);
  
  // Get progress for all tasks
  const taskIds = useMemo(() => allTasks.map(t => t.id), [allTasks]);
  const { progressMap, globalProgress, globalStats } = useTasksProgress(taskIds);

  // Check if advanced filters have active values
  const hasActiveAdvancedFilters = useMemo(() => {
    return Object.entries(advancedFilters).some(([key, value]) => {
      if (key === 'groupBy') return value !== 'none';
      return value !== 'all';
    });
  }, [advancedFilters]);

  // Fetch user's requests for tracking tab
  const fetchMyRequests = useCallback(async () => {
    if (!profile?.id) return;
    setIsLoadingRequests(true);
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'request')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false });
      setMyRequests((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (dashboardMode === 'tracking') {
      fetchMyRequests();
    }
  }, [dashboardMode, fetchMyRequests]);

  // Stats for request tracking dashboard
  const requestStats = useMemo((): TaskStats => {
    const total = myRequests.length;
    const todo = myRequests.filter(t => t.status === 'todo').length;
    const inProgress = myRequests.filter(t => t.status === 'in-progress').length;
    const done = myRequests.filter(t => t.status === 'done').length;
    const pendingValidation = myRequests.filter(t => t.status === 'pending_validation_1' || t.status === 'pending_validation_2').length;
    const validated = myRequests.filter(t => t.status === 'validated').length;
    const refused = myRequests.filter(t => t.status === 'refused').length;
    return {
      total, todo, inProgress, done, pendingValidation, validated, refused,
      completionRate: total > 0 ? Math.round(((done + validated) / total) * 100) : 0,
    };
  }, [myRequests]);

  const requestGlobalProgress = requestStats.completionRate;

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

  // Apply advanced filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Advanced filters
      if (advancedFilters.assigneeId !== 'all' && task.assignee_id !== advancedFilters.assigneeId) return false;
      if (advancedFilters.requesterId !== 'all' && task.requester_id !== advancedFilters.requesterId) return false;
      if (advancedFilters.reporterId !== 'all' && task.reporter_id !== advancedFilters.reporterId) return false;
      if (advancedFilters.categoryId !== 'all' && task.category_id !== advancedFilters.categoryId) return false;
      if (advancedFilters.subcategoryId !== 'all' && task.subcategory_id !== advancedFilters.subcategoryId) return false;
      
      // Cross filters
      if (crossFilters.searchQuery && !task.title?.toLowerCase().includes(crossFilters.searchQuery.toLowerCase())) return false;
      if (crossFilters.statuses.length > 0 && !crossFilters.statuses.includes(task.status)) return false;
      if (crossFilters.priorities.length > 0 && task.priority && !crossFilters.priorities.includes(task.priority)) return false;
      if (crossFilters.assigneeIds.length > 0 && !crossFilters.assigneeIds.includes(task.assignee_id || '')) return false;
      if (crossFilters.categoryIds.length > 0 && !crossFilters.categoryIds.includes(task.category_id || '')) return false;
      if (crossFilters.departmentIds.length > 0) {
        // Department filter requires profile lookup - skip if no match possible
      }
      if (crossFilters.dateRange.start && task.created_at) {
        const taskDate = new Date(task.created_at);
        if (taskDate < crossFilters.dateRange.start) return false;
      }
      if (crossFilters.dateRange.end && task.created_at) {
        const taskDate = new Date(task.created_at);
        if (taskDate > crossFilters.dateRange.end) return false;
      }
      return true;
    });
  }, [tasks, advancedFilters, crossFilters]);

  // Build group labels map
  const groupLabels = useMemo(() => {
    const labels = new Map<string, string>();
    
    // Add profile names
    profilesMap.forEach((name, id) => labels.set(id, name));
    
    // Add category names
    categories.forEach(cat => {
      labels.set(cat.id, cat.name);
      cat.subcategories.forEach(sub => labels.set(sub.id, sub.name));
    });
    
    // Add defaults
    labels.set('Non assigné', 'Non assigné');
    labels.set('Non défini', 'Non défini');
    labels.set('Sans catégorie', 'Sans catégorie');
    labels.set('Sans sous-catégorie', 'Sans sous-catégorie');
    
    return labels;
  }, [profilesMap, categories]);

  // Category map for kanban
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(cat => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  // Assignee map for kanban
  const assigneeMap = useMemo(() => {
    const map = new Map<string, { display_name: string; avatar_url?: string }>();
    profilesMap.forEach((name, id) => map.set(id, { display_name: name }));
    return map;
  }, [profilesMap]);

  const handleNotificationClick = (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
      setSearchQuery(task.title);
      toast.info(`Tâche sélectionnée: ${task.title}`);
    }
  };

  const handleCommentNotificationClick = useCallback((taskId: string, notificationId: string) => {
    markCommentAsRead(notificationId);
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTaskForComment(task);
      setIsCommentDetailOpen(true);
    } else {
      toast.info('Ouverture de la demande...');
    }
  }, [allTasks, markCommentAsRead]);

  const handleScopeChange = (newScope: TaskScope) => {
    setScope(newScope);
  };

  const getTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Tableau de bord';
      case 'to-assign':
        return 'Tâches à affecter';
      case 'team':
        return 'Équipe';
      default:
        return 'Tableau de bord';
    }
  };

  const renderTaskView = () => {
    switch (taskView) {
      case 'kanban':
        return (
          <KanbanBoard
            tasks={filteredTasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupBy={advancedFilters.groupBy}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={refetch}
            kanbanGroupMode={kanbanGroupMode}
            categoryMap={categoryMap}
            assigneeMap={assigneeMap}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            tasks={filteredTasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupBy={advancedFilters.groupBy}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={refetch}
          />
        );
      case 'table':
        return (
          <DenseTableView
            tasks={filteredTasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            progressMap={progressMap}
            onTaskUpdated={refetch}
          />
        );
      default:
        return (
          <TaskList 
            tasks={filteredTasks} 
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            groupBy={advancedFilters.groupBy}
            groupLabels={groupLabels}
            progressMap={progressMap}
            onTaskUpdated={refetch}
          />
        );
    }
  };

  const renderDashboardContent = () => (
    <>
      {/* Mode toggle: Tasks vs Analytics vs Tracking */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex bg-white rounded-lg border-2 border-keon-200 p-1">
          <Button
            variant={dashboardMode === 'tasks' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDashboardMode('tasks')}
            className="text-xs"
          >
            Gestion des tâches
          </Button>
          <Button
            variant={dashboardMode === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDashboardMode('analytics')}
            className="text-xs"
          >
            Tableau de bord analytique
          </Button>
          <Button
            variant={dashboardMode === 'tracking' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDashboardMode('tracking')}
            className="text-xs gap-1"
          >
            <Eye className="h-3.5 w-3.5" />
            Suivi des demandes
            {myRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {myRequests.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={dashboardMode === 'planner' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDashboardMode('planner')}
            className="text-xs gap-1"
          >
            <Zap className="h-3.5 w-3.5" />
            Planner
          </Button>
        </div>
      </div>

      {dashboardMode === 'planner' ? (
        <PlannerSyncPanel />
      ) : dashboardMode === 'tracking' ? (
        /* Request tracking dashboard */
        isLoadingRequests ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ConfigurableDashboard
            tasks={myRequests}
            stats={requestStats}
            globalProgress={requestGlobalProgress}
            onTaskClick={(task) => {
              setSelectedRequest(task);
              setIsRequestDetailOpen(true);
            }}
          />
        )
      ) : dashboardMode === 'analytics' ? (
        /* Configurable Dashboard with widgets */
        <ConfigurableDashboard
          tasks={allTasks}
          stats={stats}
          globalProgress={globalProgress}
          onTaskClick={(task) => {
            setSearchQuery(task.title);
          }}
        />
      ) : (
        /* Task management view */
        <>
          {/* Unified Toolbar */}
          <DashboardToolbar
            currentView={taskView}
            onViewChange={setTaskView}
            kanbanGroupMode={kanbanGroupMode}
            onKanbanGroupModeChange={setKanbanGroupMode}
          />

          {/* Cross Filters Panel */}
          <CrossFiltersPanel
            filters={crossFilters}
            onFiltersChange={setCrossFilters}
          />

          {/* Collapsible Stats */}
          <div className="mb-4">
            <button
              onClick={() => setShowFullStats(!showFullStats)}
              className="flex items-center gap-2 text-sm text-keon-700 hover:text-keon-900 mb-2"
            >
              {showFullStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showFullStats ? 'Masquer les statistiques' : 'Afficher les statistiques détaillées'}
            </button>
            
            <DashboardStats
              stats={stats}
              globalProgress={globalProgress}
              globalStats={globalStats}
              unassignedCount={canAssignToTeam ? (unassignedCount + pendingCount) : 0}
              onViewUnassigned={() => setActiveView('to-assign')}
              collapsed={!showFullStats}
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 mb-4">
            {canAssignToTeam && (
              <Button 
                variant="outline" 
                onClick={() => setIsBulkReassignOpen(true)}
                className="gap-2 border-keon-300 text-keon-700 hover:bg-keon-100"
              >
                <Users className="h-4 w-4" />
                Réaffecter en masse
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setIsBulkCategoryOpen(true)}
              className="gap-2 border-keon-300 text-keon-700 hover:bg-keon-100"
            >
              <Tags className="h-4 w-4" />
              Catégoriser en masse
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsTemplateDialogOpen(true)}
              className="gap-2 border-keon-300 text-keon-700 hover:bg-keon-100"
            >
              <Workflow className="h-4 w-4" />
              Depuis un modèle
            </Button>
          </div>

          {/* Task View */}
          {renderTaskView()}
        </>
      )}
    </>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    switch (activeView) {
      case 'dashboard':
        return renderDashboardContent();
      case 'to-assign':
        return <PendingAssignmentsView />;
      case 'team':
        return <TeamModule />;
      default:
        return renderDashboardContent();
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title={getTitle()}
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

      <CreateFromTemplateDialog
        open={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        onTasksCreated={refetch}
      />

      {selectedTaskForComment && (
        <TaskDetailDialog
          task={selectedTaskForComment}
          open={isCommentDetailOpen}
          onClose={() => {
            setIsCommentDetailOpen(false);
            setSelectedTaskForComment(null);
          }}
          onStatusChange={updateTaskStatus}
        />
      )}

      {selectedRequest && (
        <RequestDetailDialog
          task={selectedRequest}
          open={isRequestDetailOpen}
          onClose={() => {
            setIsRequestDetailOpen(false);
            setSelectedRequest(null);
            fetchMyRequests();
          }}
          onStatusChange={updateTaskStatus}
        />
      )}

      <BulkCategoryAssignDialog
        open={isBulkCategoryOpen}
        onOpenChange={setIsBulkCategoryOpen}
        tasks={allTasks}
        onComplete={refetch}
      />

      <BulkReassignDialog
        open={isBulkReassignOpen}
        onOpenChange={setIsBulkReassignOpen}
        tasks={allTasks}
        onComplete={refetch}
      />
    </div>
  );
};

export default Index;
