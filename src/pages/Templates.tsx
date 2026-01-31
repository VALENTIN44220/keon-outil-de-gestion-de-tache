import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ProcessCard } from '@/components/templates/ProcessCard';
import { TemplateAdvancedFilters, TemplateFiltersState, defaultFilters } from '@/components/templates/TemplateAdvancedFilters';
import { AddProcessDialog } from '@/components/templates/AddProcessDialog';
import { UnifiedModelView } from '@/components/templates/UnifiedModelView';
import { SubProcessTemplatesList } from '@/components/templates/SubProcessTemplatesList';
import { TaskTemplatesList } from '@/components/templates/TaskTemplatesList';
import { CustomFieldsTab } from '@/components/templates/CustomFieldsTab';
import { AddIndependentSubProcessDialog } from '@/components/templates/AddIndependentSubProcessDialog';
import { AddIndependentTaskDialog } from '@/components/templates/AddIndependentTaskDialog';
import { BulkTaskTemplateImportDialog } from '@/components/templates/BulkTaskTemplateImportDialog';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useAllSubProcessTemplates } from '@/hooks/useAllSubProcessTemplates';
import { useAllTaskTemplates } from '@/hooks/useAllTaskTemplates';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Layers, GitBranch, ListTodo, Plus, FormInput, Upload } from 'lucide-react';
import { ProcessWithTasks } from '@/types/template';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const Templates = () => {
  const [activeView, setActiveView] = useState('templates');
  const [activeTab, setActiveTab] = useState<'processes' | 'subprocesses' | 'tasks' | 'fields'>('processes');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddSubProcessDialogOpen, setIsAddSubProcessDialogOpen] = useState(false);
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const [isBulkTaskImportOpen, setIsBulkTaskImportOpen] = useState(false);
  const [viewingProcess, setViewingProcess] = useState<ProcessWithTasks | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TemplateFiltersState>(defaultFilters);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const {
    processes,
    isLoading: isLoadingProcesses,
    addProcess,
    updateProcess,
    deleteProcess,
    addTaskTemplate,
    deleteTaskTemplate,
    refetch: refetchProcesses,
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
    refetch: refetchTasks,
  } = useAllTaskTemplates();

  const { user } = useAuth();
  const { allTasks } = useTasks();
  const { notifications, unreadCount, hasUrgent } = useNotifications(allTasks);

  const canCreateProcess = Boolean(user);

  // Apply filters to processes
  const filteredProcesses = processes.filter((p) => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !p.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filters.companyId && p.creator_company_id !== filters.companyId) return false;
    if (filters.departmentId && p.creator_department_id !== filters.departmentId) return false;
    if (filters.creatorId && p.user_id !== filters.creatorId) return false;
    if (filters.visibility && p.visibility_level !== filters.visibility) return false;
    if (filters.dateFrom && new Date(p.created_at) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(p.created_at) > new Date(filters.dateTo)) return false;
    return true;
  });

  // Apply filters to sub-processes
  const filteredSubProcesses = subProcesses.filter((sp) => {
    if (searchQuery && !sp.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !sp.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filters.processId && sp.process_template_id !== filters.processId) return false;
    if (filters.companyId && sp.creator_company_id !== filters.companyId) return false;
    if (filters.departmentId && sp.creator_department_id !== filters.departmentId) return false;
    if (filters.creatorId && sp.user_id !== filters.creatorId) return false;
    if (filters.visibility && sp.visibility_level !== filters.visibility) return false;
    if (filters.dateFrom && new Date(sp.created_at) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(sp.created_at) > new Date(filters.dateTo)) return false;
    return true;
  });

  // Apply filters to task templates
  const filteredTasks = taskTemplates.filter((t) => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !t.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filters.processId && t.process_template_id !== filters.processId) return false;
    if (filters.subProcessId && t.sub_process_template_id !== filters.subProcessId) return false;
    if (filters.companyId && t.creator_company_id !== filters.companyId) return false;
    if (filters.departmentId && t.creator_department_id !== filters.departmentId) return false;
    if (filters.creatorId && t.user_id !== filters.creatorId) return false;
    if (filters.visibility && t.visibility_level !== filters.visibility) return false;
    if (filters.dateFrom && new Date(t.created_at) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(t.created_at) > new Date(filters.dateTo)) return false;
    return true;
  });

  const handleViewDetails = (id: string) => {
    const process = processes.find((p) => p.id === id);
    if (process) {
      setViewingProcess(process);
    }
  };

  // handleEditProcess now redirects to the unified view (same as viewDetails)
  const handleEditProcess = handleViewDetails;

  const getAddButtonAction = () => {
    switch (activeTab) {
      case 'processes':
        return () => setIsAddDialogOpen(true);
      case 'subprocesses':
        return () => setIsAddSubProcessDialogOpen(true);
      case 'tasks':
        return () => setIsAddTaskDialogOpen(true);
      default:
        return undefined;
    }
  };

  const getAddButtonLabel = () => {
    switch (activeTab) {
      case 'processes':
        return 'Nouveau processus';
      case 'subprocesses':
        return 'Nouveau sous-processus';
      case 'tasks':
        return 'Nouvelle tâche';
      default:
        return undefined;
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
          onAddTask={canCreateProcess ? getAddButtonAction() : undefined}
          addButtonLabel={getAddButtonLabel()}
          notifications={notifications}
          unreadCount={unreadCount}
          hasUrgent={hasUrgent}
          onNotificationClick={() => {}}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4">
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
              <TabsTrigger value="fields" className="gap-2">
                <FormInput className="h-4 w-4" />
                Champs personnalisés
              </TabsTrigger>
            </TabsList>

            <TemplateAdvancedFilters
              filters={filters}
              onFiltersChange={setFilters}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              activeTab={activeTab}
            />

            <TabsContent value="processes">
              {isLoadingProcesses ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredProcesses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-card rounded-xl shadow-sm">
                  <Layers className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground text-lg mb-4">Aucun processus</p>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau processus
                  </Button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="space-y-1">
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
                      compact
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
              )}
            </TabsContent>

            <TabsContent value="subprocesses">
              <SubProcessTemplatesList
                subProcesses={filteredSubProcesses}
                isLoading={isLoadingSubProcesses}
                onDelete={deleteSubProcess}
                onRefresh={refetchSubProcesses}
                viewMode={viewMode}
              />
            </TabsContent>

            <TabsContent value="tasks">
              <div className="flex justify-end mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkTaskImportOpen(true)}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import en masse
                </Button>
              </div>
              <TaskTemplatesList
                tasks={filteredTasks}
                isLoading={isLoadingTasks}
                onDelete={deleteTask}
                onRefresh={refetchTasks}
                viewMode={viewMode}
              />
            </TabsContent>

            <TabsContent value="fields">
              <CustomFieldsTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <AddProcessDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={addProcess}
      />

      <AddIndependentSubProcessDialog
        open={isAddSubProcessDialogOpen}
        onClose={() => setIsAddSubProcessDialogOpen(false)}
        onSuccess={refetchSubProcesses}
      />

      <AddIndependentTaskDialog
        open={isAddTaskDialogOpen}
        onClose={() => setIsAddTaskDialogOpen(false)}
        onSuccess={refetchTasks}
      />

      <BulkTaskTemplateImportDialog
        open={isBulkTaskImportOpen}
        onClose={() => setIsBulkTaskImportOpen(false)}
        onSuccess={refetchTasks}
      />

      <UnifiedModelView
        process={viewingProcess}
        open={!!viewingProcess}
        onClose={() => setViewingProcess(null)}
        onUpdate={async () => {
          // Refresh the processes list from the database
          await refetchProcesses();
          // Update the viewing process with the refreshed data
          if (viewingProcess) {
            const updated = processes.find(p => p.id === viewingProcess.id);
            if (updated) setViewingProcess(updated);
          }
        }}
        canManage={Boolean(viewingProcess?.can_manage)}
      />
    </div>
  );
};

export default Templates;
