import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ProcessCard } from '@/components/templates/ProcessCard';
import { TemplateAdvancedFilters, TemplateFiltersState, defaultFilters } from '@/components/templates/TemplateAdvancedFilters';
import { AddProcessDialog } from '@/components/templates/AddProcessDialog';
import { DeleteProcessDialog } from '@/components/templates/DeleteProcessDialog';
import { SubProcessTemplatesList } from '@/components/templates/SubProcessTemplatesList';
import { AddIndependentSubProcessDialog } from '@/components/templates/AddIndependentSubProcessDialog';
import { NewPrestationBEWizard } from '@/components/templates/NewPrestationBEWizard';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useAllSubProcessTemplates } from '@/hooks/useAllSubProcessTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Layers, GitBranch, Plus } from 'lucide-react';
import { ProcessWithTasks } from '@/types/template';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Templates = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('templates');
  const [activeTab, setActiveTab] = useState<'processes' | 'subprocesses'>('processes');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddSubProcessDialogOpen, setIsAddSubProcessDialogOpen] = useState(false);
  const [isPrestationBEWizardOpen, setIsPrestationBEWizardOpen] = useState(false);
  const [deletingProcess, setDeletingProcess] = useState<ProcessWithTasks | null>(null);
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

  const { user } = useAuth();

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

  const handleViewDetails = (id: string) => {
    navigate(`/templates/process/${id}`);
  };

  const handleEditProcess = handleViewDetails;

  const handleDeleteProcess = (id: string) => {
    const process = processes.find((p) => p.id === id);
    if (process) {
      setDeletingProcess(process);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingProcess) {
      await deleteProcess(deletingProcess.id);
      setDeletingProcess(null);
    }
  };

  const handleArchiveProcess = async () => {
    if (deletingProcess) {
      await updateProcess(deletingProcess.id, { visibility_level: 'private' });
      toast.success('Processus archivé');
      setDeletingProcess(null);
    }
  };

  const getAddButtonAction = () => {
    switch (activeTab) {
      case 'processes':
        return () => setIsAddDialogOpen(true);
      case 'subprocesses':
        return () => setIsAddSubProcessDialogOpen(true);
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
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
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
                      onDelete={() => handleDeleteProcess(process.id)}
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
                      onDelete={() => handleDeleteProcess(process.id)}
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
              <div className="flex justify-end mb-3">
                <Button
                  size="sm"
                  onClick={() => setIsPrestationBEWizardOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nouvelle prestation BE
                </Button>
              </div>
              <SubProcessTemplatesList
                subProcesses={filteredSubProcesses}
                isLoading={isLoadingSubProcesses}
                onDelete={deleteSubProcess}
                onRefresh={refetchSubProcesses}
                viewMode={viewMode}
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

      <AddIndependentSubProcessDialog
        open={isAddSubProcessDialogOpen}
        onClose={() => setIsAddSubProcessDialogOpen(false)}
        onSuccess={refetchSubProcesses}
      />

      <NewPrestationBEWizard
        open={isPrestationBEWizardOpen}
        onClose={() => setIsPrestationBEWizardOpen(false)}
        onSuccess={refetchSubProcesses}
      />

      <DeleteProcessDialog
        processId={deletingProcess?.id || null}
        processName={deletingProcess?.name || ''}
        open={!!deletingProcess}
        onClose={() => setDeletingProcess(null)}
        onConfirmDelete={handleConfirmDelete}
        onConfirmArchive={handleArchiveProcess}
      />
    </div>
  );
};

export default Templates;
