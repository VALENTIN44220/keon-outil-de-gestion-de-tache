import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ProcessList } from '@/components/templates/ProcessList';
import { TemplateFilters } from '@/components/templates/TemplateFilters';
import { AddProcessDialog } from '@/components/templates/AddProcessDialog';
import { EditProcessDialog } from '@/components/templates/EditProcessDialog';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { Loader2 } from 'lucide-react';
import { ProcessTemplate } from '@/types/template';

const Templates = () => {
  const [activeView, setActiveView] = useState('templates');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const {
    processes,
    isLoading,
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

  const { allTasks } = useTasks();
  const { notifications, unreadCount, hasUrgent } = useNotifications(allTasks);

  // Filter processes by search
  const filteredProcesses = processes.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditProcess = (id: string) => {
    const process = processes.find(p => p.id === id);
    if (process) {
      setEditingProcess(process);
    }
  };

  const handleUpdateProcess = async (updates: Partial<ProcessTemplate>) => {
    if (editingProcess) {
      await updateProcess(editingProcess.id, updates);
      setEditingProcess(null);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Modèles de processus"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddTask={() => setIsAddDialogOpen(true)}
          addButtonLabel="Nouveau processus"
          notifications={notifications}
          unreadCount={unreadCount}
          hasUrgent={hasUrgent}
          onNotificationClick={() => {}}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
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
              <ProcessList
                processes={filteredProcesses}
                onDelete={deleteProcess}
                onEdit={handleEditProcess}
                onAddTask={addTaskTemplate}
                onDeleteTask={deleteTaskTemplate}
              />
            </>
          )}
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
    </div>
  );
};

export default Templates;
