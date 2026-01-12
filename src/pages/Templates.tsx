import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ProcessCard } from '@/components/templates/ProcessCard';
import { TemplateFilters } from '@/components/templates/TemplateFilters';
import { AddProcessDialog } from '@/components/templates/AddProcessDialog';
import { EditProcessDialog } from '@/components/templates/EditProcessDialog';
import { ProcessDetailView } from '@/components/templates/ProcessDetailView';
import { SubProcessTemplatesList } from '@/components/templates/SubProcessTemplatesList';
import { TaskTemplatesList } from '@/components/templates/TaskTemplatesList';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useAllSubProcessTemplates } from '@/hooks/useAllSubProcessTemplates';
import { useAllTaskTemplates } from '@/hooks/useAllTaskTemplates';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Layers, GitBranch, ListTodo } from 'lucide-react';
import { ProcessTemplate, ProcessWithTasks } from '@/types/template';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Templates = () => {
  const [activeView, setActiveView] = useState('templates');
  const [activeTab, setActiveTab] = useState<'processes' | 'subprocesses' | 'tasks'>('processes');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessTemplate | null>(null);
  const [viewingProcess, setViewingProcess] = useState<ProcessWithTasks | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    processes,
    isLoading: isLoadingProcesses,
    companyFilter,
    setCompanyFilter,
    departmentFilter,
    setDepartmentFilter,
    companies,
    departments,
    addProcess,
    updateProcess,
    deleteProcess,
    addTaskTemplate,
    deleteTaskTemplate,
  } = useProcessTemplates();

  const {
    subProcesses,
    isLoading: isLoadingSubProcesses,
    deleteSubProcess,
    refetch: refetchSubProcesses,
  } = useAllSubProcessTemplates();

  const {
    tasks: taskTemplates,
    isLoading: isLoadingTasks,
    deleteTask,
  } = useAllTaskTemplates();

  const { user } = useAuth();
  const { allTasks } = useTasks();
  const { notifications, unreadCount, hasUrgent } = useNotifications(allTasks);

  const canCreateProcess = Boolean(user);

  // Filter processes by search
  const filteredProcesses = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter sub-processes by search
  const filteredSubProcesses = subProcesses.filter(
    (sp) =>
      sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sp.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter task templates by search
  const filteredTasks = taskTemplates.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditProcess = (id: string) => {
    const process = processes.find((p) => p.id === id);
    if (process) {
      setEditingProcess(process);
    }
  };

  const handleViewDetails = (id: string) => {
    const process = processes.find((p) => p.id === id);
    if (process) {
      setViewingProcess(process);
    }
  };

  const handleUpdateProcess = async (updates: Partial<ProcessTemplate>) => {
    if (editingProcess) {
      await updateProcess(editingProcess.id, updates);
      setEditingProcess(null);
    }
  };

  const getAddButtonLabel = () => {
    switch (activeTab) {
      case 'processes':
        return 'Nouveau processus';
      case 'subprocesses':
        return undefined; // créés depuis un processus
      case 'tasks':
        return undefined; // créées depuis un processus/sous-processus
      default:
        return undefined;
    }
  };

  const handleAddClick = () => {
    if (activeTab === 'processes') {
      setIsAddDialogOpen(true);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Modèles"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddTask={canCreateProcess && activeTab === 'processes' ? handleAddClick : undefined}
          addButtonLabel={getAddButtonLabel()}
          notifications={notifications}
          unreadCount={unreadCount}
          hasUrgent={hasUrgent}
          onNotificationClick={() => {}}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-6">
              <TabsTrigger value="processes" className="gap-2">
                <Layers className="h-4 w-4" />
                Processus ({processes.length})
              </TabsTrigger>
              <TabsTrigger value="subprocesses" className="gap-2">
                <GitBranch className="h-4 w-4" />
                Sous-processus ({subProcesses.length})
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <ListTodo className="h-4 w-4" />
                Tâches ({taskTemplates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="processes">
              {isLoadingProcesses ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <TemplateFilters
                    companyFilter={companyFilter}
                    departmentFilter={departmentFilter}
                    onCompanyChange={setCompanyFilter}
                    onDepartmentChange={setDepartmentFilter}
                    companies={companies}
                    departments={departments}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProcesses.map((process) => (
                      <ProcessCard
                        key={process.id}
                        process={process}
                        onDelete={() => deleteProcess(process.id)}
                        onEdit={() => handleEditProcess(process.id)}
                        onViewDetails={() => handleViewDetails(process.id)}
                        onAddTask={(task) => addTaskTemplate(process.id, task)}
                        onDeleteTask={(taskId) => deleteTaskTemplate(process.id, taskId)}
                        canManage={Boolean(process.can_manage)}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="subprocesses">
              <SubProcessTemplatesList
                subProcesses={filteredSubProcesses}
                isLoading={isLoadingSubProcesses}
                onDelete={deleteSubProcess}
                onRefresh={refetchSubProcesses}
              />
            </TabsContent>

            <TabsContent value="tasks">
              <TaskTemplatesList
                tasks={filteredTasks}
                isLoading={isLoadingTasks}
                onDelete={deleteTask}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <AddProcessDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={addProcess}
      />

      <EditProcessDialog
        process={editingProcess}
        open={!!editingProcess}
        onClose={() => setEditingProcess(null)}
        onSave={handleUpdateProcess}
      />

      <ProcessDetailView
        process={viewingProcess}
        open={!!viewingProcess}
        onClose={() => setViewingProcess(null)}
        onAddTask={(task) => viewingProcess && addTaskTemplate(viewingProcess.id, task)}
        onDeleteTask={(taskId) => viewingProcess && deleteTaskTemplate(viewingProcess.id, taskId)}
        canManage={Boolean(viewingProcess?.can_manage)}
      />
    </div>
  );
};

export default Templates;
