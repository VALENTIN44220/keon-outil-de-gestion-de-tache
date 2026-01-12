import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { AdvancedFilters, AdvancedFiltersState } from '@/components/tasks/AdvancedFilters';
import { TaskViewSelector, TaskView } from '@/components/tasks/TaskViewSelector';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CalendarView } from '@/components/tasks/CalendarView';
import { CreateFromTemplateDialog } from '@/components/tasks/CreateFromTemplateDialog';
import { UnassignedTasksView } from '@/components/tasks/UnassignedTasksView';
import { PendingAssignmentsView } from '@/components/tasks/PendingAssignmentsView';
import { TeamModule } from '@/components/team/TeamModule';
import { useTasks } from '@/hooks/useTasks';
import { useTasksProgress } from '@/hooks/useChecklists';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnassignedTasks } from '@/hooks/useUnassignedTasks';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Button } from '@/components/ui/button';
import { Loader2, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';

const Index = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
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
  } = useTasks();

  const { categories } = useCategories();
  const { notifications, unreadCount, hasUrgent } = useNotifications(allTasks);
  const { count: unassignedCount, refetch: refetchUnassigned } = useUnassignedTasks();
  const { getPendingCount, refetch: refetchPending } = usePendingAssignments();
  const { canAssignToTeam } = useUserPermissions();
  const pendingCount = getPendingCount();
  
  // Get progress for all tasks
  const taskIds = useMemo(() => allTasks.map(t => t.id), [allTasks]);
  const { progressMap, globalProgress, globalStats } = useTasksProgress(taskIds);

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
      if (advancedFilters.assigneeId !== 'all' && task.assignee_id !== advancedFilters.assigneeId) return false;
      if (advancedFilters.requesterId !== 'all' && task.requester_id !== advancedFilters.requesterId) return false;
      if (advancedFilters.reporterId !== 'all' && task.reporter_id !== advancedFilters.reporterId) return false;
      if (advancedFilters.categoryId !== 'all' && task.category_id !== advancedFilters.categoryId) return false;
      if (advancedFilters.subcategoryId !== 'all' && task.subcategory_id !== advancedFilters.subcategoryId) return false;
      return true;
    });
  }, [tasks, advancedFilters]);

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

  const handleNotificationClick = (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
      setActiveView('tasks');
      setSearchQuery(task.title);
      toast.info(`Tâche sélectionnée: ${task.title}`);
    }
  };

  const getTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Tableau de bord';
      case 'tasks':
        return 'Gestion des tâches';
      case 'to-assign':
        return 'Tâches à affecter';
      case 'analytics':
        return 'Analytiques';
      case 'team':
        return 'Équipe';
      case 'settings':
        return 'Paramètres';
      default:
        return 'TaskFlow';
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
        return (
          <Dashboard 
            stats={stats} 
            recentTasks={allTasks.slice(0, 6)}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            globalProgress={globalProgress}
            globalStats={globalStats}
            progressMap={progressMap}
            unassignedCount={canAssignToTeam ? (unassignedCount + pendingCount) : 0}
            onViewUnassigned={() => setActiveView('to-assign')}
          />
        );
      case 'to-assign':
        return <PendingAssignmentsView />;
      case 'tasks':
        return (
          <>
            <div className="flex flex-col gap-4 mb-6">
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
                <Button 
                  variant="outline" 
                  onClick={() => setIsTemplateDialogOpen(true)}
                  className="gap-2"
                >
                  <Workflow className="h-4 w-4" />
                  Depuis un modèle
                </Button>
              </div>
              <AdvancedFilters
                filters={advancedFilters}
                onFiltersChange={setAdvancedFilters}
              />
            </div>
            {renderTaskView()}
          </>
        );
      case 'analytics':
        return (
          <div className="flex items-center justify-center h-64 bg-card rounded-xl shadow-card">
            <p className="text-muted-foreground">Module analytiques à venir...</p>
          </div>
        );
      case 'team':
        return <TeamModule />;
      case 'settings':
        return (
          <div className="flex items-center justify-center h-64 bg-card rounded-xl shadow-card">
            <p className="text-muted-foreground">Paramètres à venir...</p>
          </div>
        );
      default:
        return null;
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
          unreadCount={unreadCount}
          hasUrgent={hasUrgent}
          onNotificationClick={handleNotificationClick}
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
    </div>
  );
};

export default Index;
