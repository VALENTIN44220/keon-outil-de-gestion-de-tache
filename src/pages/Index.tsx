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
import { Loader2, Workflow, ChevronDown, ChevronUp, Zap, Settings2, ShieldCheck, LayoutGrid, Columns, Calendar, TableProperties, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { Task, TaskStats } from '@/types/task';
import { BulkActionDialog } from '@/components/tasks/BulkActionDialog';
import { PendingValidationsPanel } from '@/components/dashboard/PendingValidationsPanel';
import { PendingTaskValidationsPanel } from '@/components/dashboard/PendingTaskValidationsPanel';
import { usePendingValidationRequests } from '@/hooks/usePendingValidationRequests';
import { usePendingTaskValidations } from '@/hooks/usePendingTaskValidations';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const Index = () => {
  const { profile } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [taskView, setTaskView] = useState<TaskView>('table');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showFullStats, setShowFullStats] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<'tasks' | 'planner' | 'validations'>('tasks');
  const [taskSubMode, setTaskSubMode] = useState<'grid' | 'kanban' | 'calendar' | 'table' | 'analytics'>('table');
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [kanbanGroupMode, setKanbanGroupMode] = useState<KanbanGroupMode>('status');
  const [crossFilters, setCrossFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  
  // All requests for analytics mode
  const [allRequests, setAllRequests] = useState<Task[]>([]);
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
  const { requests: pendingValidations, count: pendingValidationCount, isLoading: isLoadingValidations, refetch: refetchValidations } = usePendingValidationRequests();
  const { tasks: pendingTaskValidations, count: pendingTaskValidationCount, isLoading: isLoadingTaskValidations, refetch: refetchTaskValidations } = usePendingTaskValidations();
  const totalValidationCount = pendingValidationCount + pendingTaskValidationCount;
  
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

  // Fetch all requests for analytics mode
  const fetchAllRequests = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'request')
        .order('created_at', { ascending: false });
      setAllRequests((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching all requests:', error);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (taskSubMode === 'analytics') fetchAllRequests();
  }, [taskSubMode, fetchAllRequests]);

  // Merge tasks + requests for analytics mode
  const analyticsTasksAndRequests = useMemo(() => {
    const merged = [...allTasks];
    const existingIds = new Set(merged.map(t => t.id));
    for (const r of allRequests) {
      if (!existingIds.has(r.id)) {
        merged.push(r);
      }
    }
    return merged;
  }, [allTasks, allRequests]);

  // Fetch profiles for group labels + process→service_group mapping
  const [processServiceGroupMap, setProcessServiceGroupMap] = useState<Map<string, string>>(new Map());
  const [deptServiceGroupMap, setDeptServiceGroupMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const fetchData = async () => {
      const [profilesRes, ptRes, sgDeptRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name'),
        supabase.from('process_templates').select('id, service_group_id'),
        (supabase as any).from('service_group_departments').select('service_group_id, department_id'),
      ]);
      
      if (profilesRes.data) {
        const map = new Map<string, string>();
        profilesRes.data.forEach(p => map.set(p.id, p.display_name || 'Sans nom'));
        setProfilesMap(map);
      }
      if (ptRes.data) {
        const map = new Map<string, string>();
        ptRes.data.forEach(pt => { if (pt.service_group_id) map.set(pt.id, pt.service_group_id); });
        setProcessServiceGroupMap(map);
      }
      if (sgDeptRes.data) {
        const map = new Map<string, string>();
        sgDeptRes.data.forEach((r: any) => map.set(r.department_id, r.service_group_id));
        setDeptServiceGroupMap(map);
      }
    };
    fetchData();
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
      if (crossFilters.serviceGroupIds.length > 0) {
        const sgId = 
          (task.source_process_template_id ? processServiceGroupMap.get(task.source_process_template_id) : null) ||
          ((task as any).process_template_id ? processServiceGroupMap.get((task as any).process_template_id) : null) ||
          (task.target_department_id ? deptServiceGroupMap.get(task.target_department_id) : null);
        if (!sgId || !crossFilters.serviceGroupIds.includes(sgId)) return false;
      }
      if (crossFilters.dateRange.start && task.created_at) {
        const taskDate = new Date(task.created_at);
        if (taskDate < crossFilters.dateRange.start) return false;
      }
      if (crossFilters.dateRange.end && task.created_at) {
        const taskDate = new Date(task.created_at);
        if (taskDate > crossFilters.dateRange.end) return false;
      }
      if (crossFilters.itProjectIds && crossFilters.itProjectIds.length > 0) {
        const hasNone = crossFilters.itProjectIds.includes('__none__');
        const projectIds = crossFilters.itProjectIds.filter(id => id !== '__none__');
        if (hasNone && !task.it_project_id) {
          // matches "Sans projet IT"
        } else if (projectIds.length > 0 && task.it_project_id && projectIds.includes(task.it_project_id)) {
          // matches a specific project
        } else {
          return false;
        }
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

  const renderTasksSubContent = () => {
    if (taskSubMode === 'analytics') {
      return (
        <ConfigurableDashboard
          tasks={analyticsTasksAndRequests}
          stats={stats}
          globalProgress={globalProgress}
          onTaskClick={(task) => {
            if (task.type === 'request') {
              setSelectedRequest(task);
              setIsRequestDetailOpen(true);
            } else {
              setSelectedTaskForComment(task);
              setIsCommentDetailOpen(true);
            }
          }}
        />
      );
    }
    // Task management views (grid/kanban/calendar/table)
    return (
      <>
        <CrossFiltersPanel
          filters={crossFilters}
          onFiltersChange={setCrossFilters}
          contextId="tasks"
          defaultCollapsed={true}
        />
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
        <div className="flex justify-end gap-2 mb-4">
          <Button
            variant="outline"
            onClick={() => setIsBulkActionOpen(true)}
            className="gap-2 border-keon-300 text-keon-700 hover:bg-keon-100"
          >
            <Settings2 className="h-4 w-4" />
            Actions en masse
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
        {renderTaskView()}
      </>
    );
  };

  const taskSubModeOptions = [
    { value: 'grid' as const, label: 'Grille', icon: LayoutGrid },
    { value: 'kanban' as const, label: 'Kanban', icon: Columns },
    { value: 'calendar' as const, label: 'Calendrier', icon: Calendar },
    { value: 'table' as const, label: 'Tableau', icon: TableProperties },
  ];

  const renderDashboardContent = () => (
    <Tabs value={dashboardMode} onValueChange={(v) => setDashboardMode(v as any)} className="w-full">
      <TabsList className="mb-0 bg-white border-b border-keon-200 rounded-none w-full justify-start h-10 px-0 gap-0">
        <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-keon-blue data-[state=active]:text-keon-blue data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-10">
          Tâches & Demandes
        </TabsTrigger>
        <TabsTrigger value="planner" className="rounded-none border-b-2 border-transparent data-[state=active]:border-keon-blue data-[state=active]:text-keon-blue data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-10 gap-1">
          <Zap className="h-3.5 w-3.5" /> Planner
        </TabsTrigger>
        <TabsTrigger value="validations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-keon-blue data-[state=active]:text-keon-blue data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-10 gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Validations
          {totalValidationCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{totalValidationCount}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tasks" className="mt-0">
        {/* Sub-navigation for tasks tab */}
        <div className="flex items-center bg-keon-50 border-b border-keon-200 px-0 mb-4">
          {taskSubModeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setTaskSubMode(value); setTaskView(value as TaskView); }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-xs border-b-2 transition-colors",
                taskSubMode === value
                  ? "border-keon-blue text-keon-blue bg-white font-medium"
                  : "border-transparent text-keon-600 hover:text-keon-900 hover:bg-keon-100"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}

          {/* Kanban group selector */}
          {taskSubMode === 'kanban' && (
            <div className="flex items-center gap-1.5 ml-2 pr-2">
              <Layers className="h-3.5 w-3.5 text-keon-700" />
              <Select value={kanbanGroupMode} onValueChange={(v) => setKanbanGroupMode(v as KanbanGroupMode)}>
                <SelectTrigger className="h-7 text-xs w-[130px] border-keon-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Par statut</SelectItem>
                  <SelectItem value="category">Par catégorie</SelectItem>
                  <SelectItem value="priority">Par priorité</SelectItem>
                  <SelectItem value="assignee">Par assigné</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="w-px bg-keon-300 mx-1 my-1.5 self-stretch" />

          <button
            onClick={() => { setTaskSubMode('analytics'); fetchAllRequests(); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs border-b-2 transition-colors",
              taskSubMode === 'analytics'
                ? "border-keon-blue text-keon-blue bg-white font-medium"
                : "border-transparent text-keon-600 hover:text-keon-900 hover:bg-keon-100"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analytique
          </button>

        </div>

        {renderTasksSubContent()}
      </TabsContent>

      <TabsContent value="planner" className="mt-4">
        <PlannerSyncPanel />
      </TabsContent>

      <TabsContent value="validations" className="mt-4">
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="requests" className="gap-1.5">
              Validation demandes
              {pendingValidationCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {pendingValidationCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5">
              Validation tâches
              {pendingTaskValidationCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {pendingTaskValidationCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="requests">
            <PendingValidationsPanel
              requests={pendingValidations}
              isLoading={isLoadingValidations}
              onRefresh={refetchValidations}
              onRequestClick={(request) => {
                setSelectedRequest(request);
                setIsRequestDetailOpen(true);
              }}
            />
          </TabsContent>
          <TabsContent value="tasks">
            <PendingTaskValidationsPanel
              tasks={pendingTaskValidations}
              isLoading={isLoadingTaskValidations}
              onRefresh={refetchTaskValidations}
              onTaskClick={(task) => {
                setSelectedTaskForComment(task);
                setIsCommentDetailOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
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
          pendingValidations={pendingValidations}
          pendingValidationCount={totalValidationCount}
          onValidationClick={(taskId) => {
            setDashboardMode('validations');
          }}
        />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
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
          }}
          onStatusChange={updateTaskStatus}
        />
      )}

      <BulkActionDialog
        open={isBulkActionOpen}
        onOpenChange={setIsBulkActionOpen}
        tasks={allTasks}
        onComplete={refetch}
        canReassign={canAssignToTeam}
      />
    </div>
  );
};

export default Index;
