import { useState, useMemo } from 'react';
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
import {
  Loader2, Layers, GitBranch, Plus, Wand2,
  FolderOpen, ChevronDown, ChevronRight, Settings2,
} from 'lucide-react';
import { ProcessWithTasks } from '@/types/template';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── BE process ID constant ────────────────────────────────────────────────────
const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const Templates = () => {
  const navigate = useNavigate();

  // Layout
  const [activeView, setActiveView] = useState('templates');
  const [activeTab, setActiveTab] = useState<'processes' | 'subprocesses'>('processes');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TemplateFiltersState>(defaultFilters);

  // Sub-process quick grouping state
  const [groupedCollapsed, setGroupedCollapsed] = useState<Record<string, boolean>>({});
  const [spProcessFilter, setSpProcessFilter] = useState<string>('all');

  // Dialogs
  const [isAddProcessOpen, setIsAddProcessOpen] = useState(false);
  const [isAddSubProcessOpen, setIsAddSubProcessOpen] = useState(false);
  const [isPrestationBEOpen, setIsPrestationBEOpen] = useState(false);
  const [deletingProcess, setDeletingProcess] = useState<ProcessWithTasks | null>(null);

  // Data
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
  const canCreate = Boolean(user);

  // ── Filtered processes ────────────────────────────────────────────────────
  const filteredProcesses = useMemo(() =>
    processes.filter((p) => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !p.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filters.companyId && p.creator_company_id !== filters.companyId) return false;
      if (filters.departmentId && p.creator_department_id !== filters.departmentId) return false;
      if (filters.creatorId && p.user_id !== filters.creatorId) return false;
      if (filters.visibility && p.visibility_level !== filters.visibility) return false;
      if (filters.dateFrom && new Date(p.created_at) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(p.created_at) > new Date(filters.dateTo)) return false;
      return true;
    }),
    [processes, searchQuery, filters]
  );

  // ── Filtered sub-processes ────────────────────────────────────────────────
  const filteredSubProcesses = useMemo(() => {
    let list = subProcesses;
    if (spProcessFilter !== 'all') {
      list = list.filter((sp) => sp.process_template_id === spProcessFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((sp) =>
        sp.name.toLowerCase().includes(q) ||
        (sp.description ?? '').toLowerCase().includes(q)
      );
    }
    if (filters.creatorId) list = list.filter((sp) => sp.user_id === filters.creatorId);
    if (filters.visibility) list = list.filter((sp) => sp.visibility_level === filters.visibility);
    return list;
  }, [subProcesses, spProcessFilter, searchQuery, filters]);

  // ── Group sub-processes by parent process ─────────────────────────────────
  const groupedSubProcesses = useMemo(() => {
    if (spProcessFilter !== 'all') return null; // flat when filtering by 1 process

    const map: Record<string, { processId: string | null; processName: string; items: typeof subProcesses }> = {};
    filteredSubProcesses.forEach((sp) => {
      const key = sp.process_template_id ?? '__none__';
      if (!map[key]) {
        map[key] = {
          processId: sp.process_template_id,
          processName: (sp as any).process_name ?? 'Sans processus parent',
          items: [],
        };
      }
      map[key].items.push(sp);
    });

    // Sort: BE process first, then alphabetical
    return Object.values(map).sort((a, b) => {
      if (a.processId === BE_PROCESS_ID) return -1;
      if (b.processId === BE_PROCESS_ID) return 1;
      return a.processName.localeCompare(b.processName);
    });
  }, [filteredSubProcesses, spProcessFilter]);

  // ── Process options for the quick filter dropdown ─────────────────────────
  const processOptions = useMemo(() => {
    const seen = new Set<string>();
    return subProcesses
      .filter((sp) => {
        if (!sp.process_template_id) return false;
        if (seen.has(sp.process_template_id)) return false;
        seen.add(sp.process_template_id);
        return true;
      })
      .map((sp) => ({
        id: sp.process_template_id!,
        name: (sp as any).process_name ?? sp.process_template_id!,
      }))
      .sort((a, b) => {
        if (a.id === BE_PROCESS_ID) return -1;
        if (b.id === BE_PROCESS_ID) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [subProcesses]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const bePrestations = subProcesses.filter(
    (sp) => sp.process_template_id === BE_PROCESS_ID
  );

  // ── Process CRUD ──────────────────────────────────────────────────────────
  const handleDeleteProcess = (id: string) => {
    const p = processes.find((x) => x.id === id);
    if (p) setDeletingProcess(p);
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

  const toggleGroup = (key: string) =>
    setGroupedCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Add-button per tab ────────────────────────────────────────────────────
  const addAction = activeTab === 'processes'
    ? () => setIsAddProcessOpen(true)
    : () => setIsAddSubProcessOpen(true);

  const addLabel = activeTab === 'processes' ? 'Nouveau processus' : 'Nouveau sous-processus';

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Modèles"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddTask={canCreate ? addAction : undefined}
          addButtonLabel={addLabel}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-4">

          {/* ── Stats bar ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={Layers}
              label="Processus"
              value={processes.length}
              color="bg-indigo-100 text-indigo-600"
            />
            <StatCard
              icon={GitBranch}
              label="Sous-processus"
              value={subProcesses.length}
              color="bg-sky-100 text-sky-600"
            />
            <StatCard
              icon={Wand2}
              label="Prestations BE"
              value={bePrestations.length}
              color="bg-amber-100 text-amber-600"
            />
            <StatCard
              icon={Settings2}
              label="Étapes (tâches)"
              value={subProcesses.reduce((acc, sp) => acc + sp.task_templates.length, 0)}
              color="bg-emerald-100 text-emerald-600"
            />
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="processes" className="gap-2">
                <Layers className="h-4 w-4" />
                Processus
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {filteredProcesses.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="subprocesses" className="gap-2">
                <GitBranch className="h-4 w-4" />
                Sous-processus &amp; Prestations
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {filteredSubProcesses.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── Filters bar (shared) ───────────────────────────────────── */}
            <TemplateAdvancedFilters
              filters={filters}
              onFiltersChange={setFilters}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              activeTab={activeTab}
            />

            {/* ════════════════ TAB : PROCESSUS ════════════════════════════ */}
            <TabsContent value="processes" className="mt-4">

              {/* Action bar */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {filteredProcesses.length} processus{filteredProcesses.length !== processes.length && ` sur ${processes.length}`}
                </p>
                {canCreate && (
                  <Button size="sm" onClick={() => setIsAddProcessOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nouveau processus
                  </Button>
                )}
              </div>

              {isLoadingProcesses ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredProcesses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-card rounded-xl border shadow-sm">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium mb-1">
                    {searchQuery ? 'Aucun processus ne correspond à la recherche' : 'Aucun processus'}
                  </p>
                  {canCreate && !searchQuery && (
                    <Button size="sm" className="mt-3 gap-2" onClick={() => setIsAddProcessOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Créer un processus
                    </Button>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                /* Compact list rows */
                <div className="space-y-1">
                  {filteredProcesses.map((process) => (
                    <ProcessCard
                      key={process.id}
                      process={process}
                      onDelete={() => handleDeleteProcess(process.id)}
                      onEdit={() => navigate(`/templates/process/${process.id}`)}
                      onViewDetails={() => navigate(`/templates/process/${process.id}`)}
                      onAddTask={(task) => addTaskTemplate(process.id, task)}
                      onDeleteTask={(taskId) => deleteTaskTemplate(process.id, taskId)}
                      canManage={Boolean(process.can_manage)}
                      compact
                    />
                  ))}
                </div>
              ) : (
                /* Card grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProcesses.map((process) => (
                    <ProcessCard
                      key={process.id}
                      process={process}
                      onDelete={() => handleDeleteProcess(process.id)}
                      onEdit={() => navigate(`/templates/process/${process.id}`)}
                      onViewDetails={() => navigate(`/templates/process/${process.id}`)}
                      onAddTask={(task) => addTaskTemplate(process.id, task)}
                      onDeleteTask={(taskId) => deleteTaskTemplate(process.id, taskId)}
                      canManage={Boolean(process.can_manage)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ════════════════ TAB : SOUS-PROCESSUS ═══════════════════════ */}
            <TabsContent value="subprocesses" className="mt-4">

              {/* Action bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">

                {/* Quick filter : par processus parent */}
                <Select value={spProcessFilter} onValueChange={setSpProcessFilter}>
                  <SelectTrigger className="w-56 h-9 text-sm">
                    <SelectValue placeholder="Tous les processus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les processus</SelectItem>
                    {processOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.id === BE_PROCESS_ID ? '⭐ ' : ''}{p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <p className="text-sm text-muted-foreground flex-1">
                  {filteredSubProcesses.length} sous-processus
                  {filteredSubProcesses.length !== subProcesses.length && ` sur ${subProcesses.length}`}
                </p>

                {canCreate && (
                  <div className="flex items-center gap-2">
                    {/* Secondary: generic sub-process */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddSubProcessOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Nouveau sous-processus
                    </Button>
                    {/* Primary: BE prestation wizard */}
                    <Button
                      size="sm"
                      onClick={() => setIsPrestationBEOpen(true)}
                      className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <Wand2 className="h-4 w-4" />
                      Nouvelle prestation BE
                    </Button>
                  </div>
                )}
              </div>

              {isLoadingSubProcesses ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredSubProcesses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-card rounded-xl border shadow-sm">
                  <GitBranch className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium mb-1">
                    {searchQuery || spProcessFilter !== 'all'
                      ? 'Aucune prestation ne correspond'
                      : 'Aucun sous-processus'}
                  </p>
                  {canCreate && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => setIsPrestationBEOpen(true)}
                        className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        <Wand2 className="h-4 w-4" />
                        Nouvelle prestation BE
                      </Button>
                    </div>
                  )}
                </div>
              ) : spProcessFilter !== 'all' || !groupedSubProcesses ? (
                /* ── Flat list (filtré par 1 processus) ─────────────────── */
                <SubProcessTemplatesList
                  subProcesses={filteredSubProcesses as any}
                  isLoading={false}
                  onDelete={deleteSubProcess}
                  onRefresh={refetchSubProcesses}
                  viewMode={viewMode}
                />
              ) : (
                /* ── Grouped view ────────────────────────────────────────── */
                <div className="space-y-6">
                  {groupedSubProcesses.map((group) => {
                    const key = group.processId ?? '__none__';
                    const isCollapsed = groupedCollapsed[key];
                    const isBE = group.processId === BE_PROCESS_ID;

                    return (
                      <div key={key}>
                        {/* Group header */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(key)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-3 text-left transition-colors',
                            isBE
                              ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
                              : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                          )}
                        >
                          {isCollapsed
                            ? <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          }
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isBE && <Wand2 className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                            <span className={cn(
                              'font-semibold text-sm truncate',
                              isBE ? 'text-amber-700' : 'text-slate-700'
                            )}>
                              {group.processName}
                            </span>
                            {isBE && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                                Bureau d'Études
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                            {group.items.length} prestation{group.items.length > 1 ? 's' : ''}
                          </Badge>
                          {isBE && canCreate && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px] text-amber-600 hover:bg-amber-200 flex-shrink-0"
                              onClick={(e) => { e.stopPropagation(); setIsPrestationBEOpen(true); }}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Ajouter
                            </Button>
                          )}
                        </button>

                        {/* Group content */}
                        {!isCollapsed && (
                          <SubProcessTemplatesList
                            subProcesses={group.items as any}
                            isLoading={false}
                            onDelete={deleteSubProcess}
                            onRefresh={refetchSubProcesses}
                            viewMode={viewMode}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      <AddProcessDialog
        open={isAddProcessOpen}
        onClose={() => setIsAddProcessOpen(false)}
        onAdd={addProcess}
      />

      <AddIndependentSubProcessDialog
        open={isAddSubProcessOpen}
        onClose={() => setIsAddSubProcessOpen(false)}
        onSuccess={refetchSubProcesses}
      />

      <NewPrestationBEWizard
        open={isPrestationBEOpen}
        onClose={() => setIsPrestationBEOpen(false)}
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
