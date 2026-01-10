import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { useTasks } from '@/hooks/useTasks';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
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
    addTask,
    deleteTask,
  } = useTasks();

  const getTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Tableau de bord';
      case 'tasks':
        return 'Gestion des tâches';
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
          />
        );
      case 'tasks':
        return (
          <>
            <TaskFilters
              statusFilter={statusFilter}
              priorityFilter={priorityFilter}
              onStatusChange={setStatusFilter}
              onPriorityChange={setPriorityFilter}
            />
            <TaskList 
              tasks={tasks} 
              onStatusChange={updateTaskStatus}
              onDelete={deleteTask}
            />
          </>
        );
      case 'analytics':
        return (
          <div className="flex items-center justify-center h-64 bg-card rounded-xl shadow-card">
            <p className="text-muted-foreground">Module analytiques à venir...</p>
          </div>
        );
      case 'team':
        return (
          <div className="flex items-center justify-center h-64 bg-card rounded-xl shadow-card">
            <p className="text-muted-foreground">Module équipe à venir...</p>
          </div>
        );
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
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title={getTitle()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddTask={() => setIsAddDialogOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>

      <AddTaskDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={addTask}
      />
    </div>
  );
};

export default Index;
