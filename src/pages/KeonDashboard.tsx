import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useBEProjects } from '@/hooks/useBEProjects';
import { useQuestionnaireProjectData } from '@/hooks/useQuestionnaireProjectData';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useProjectFilters } from '@/hooks/useProjectFilters';
import { BEProjectsKeonView } from '@/components/projects/BEProjectsKeonView';
import { BEProjectCardsView } from '@/components/projects/BEProjectCardsView';
import { ProjectKanbanView, GroupByField } from '@/components/projects/ProjectKanbanView';
import { ProjectMultiFiltersPanel } from '@/components/projects/ProjectMultiFiltersPanel';
import { BEProject } from '@/types/beProject';
import { BEProjectDialog } from '@/components/projects/BEProjectDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Search, BarChart2, LayoutGrid, List, Kanban, Leaf, Pencil, Trash2, Building2, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadSpvWidgetConfig, SpvWidgetConfig } from '@/components/projects/SpvWidgetConfigPanel';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort } from '@/hooks/useTableSort';
import { computePilierCompletion } from '@/components/projects/keon-synthese/utils';
import { PILIERS, PilierCode } from '@/config/questionnaireConfig';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type SpvViewType = 'synthese' | 'cards' | 'table' | 'kanban';

const PILIER_CODES: PilierCode[] = ['00', '02', '04', '05', '06', '07'];

function getQstValue(qst: Record<string, any>, ...keywords: string[]): string | null {
  const key = Object.keys(qst).find(k => keywords.every(kw => k.toLowerCase().includes(kw.toLowerCase())));
  return key ? qst[key] : null;
}
function safeFloat(v: any): number { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function avgCompletion(projectQst: Record<string, any>): number {
  const totals = PILIER_CODES.map(code => computePilierCompletion(code, projectQst));
  return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
}
function completionColor(pct: number) {
  if (pct <= 30) return 'text-destructive';
  if (pct <= 70) return 'text-amber-500';
  return 'text-emerald-500';
}

export default function KeonDashboard() {
  const navigate = useNavigate();
  const { projects, isLoading, updateProject, deleteProject } = useBEProjects();
  const { qstData, keonProjectIds, getDistinctValues: getQstDistinctValues } = useQuestionnaireProjectData(projects);
  const { permissionProfile } = useUserPermissions();

  const [currentView, setCurrentView] = useState<SpvViewType>('synthese');
  const [kanbanGroupBy, setKanbanGroupBy] = useState<GroupByField>('status');
  const [localSearch, setLocalSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProject, setEditingProject] = useState<BEProject | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<BEProject | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<SpvWidgetConfig[]>(loadSpvWidgetConfig);

  const {
    filters: multiFilters,
    setFilters: setMultiFilters,
    presets,
    savePreset,
    deletePreset,
    toggleDefault,
    loadPreset,
    clearFilters: clearMultiFilters,
    activeFiltersCount: multiFiltersCount,
    applyFilters: applyMultiFilters,
    setQuestionnaireData,
  } = useProjectFilters();

  // Sync qstData
  useMemo(() => { setQuestionnaireData(qstData); }, [qstData, setQuestionnaireData]);

  const canEdit = permissionProfile?.can_edit_be_projects ?? false;
  const canDelete = permissionProfile?.can_delete_be_projects ?? false;

  // Filter to KEON projects only, then apply multi-filters and search
  const keonProjects = useMemo(
    () => projects.filter(p => keonProjectIds.has(p.id)),
    [projects, keonProjectIds]
  );

  const filteredProjects = useMemo(() => {
    let result = applyMultiFilters(keonProjects);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.code_projet.toLowerCase().includes(q) || p.nom_projet.toLowerCase().includes(q)
      );
    }
    return result;
  }, [keonProjects, applyMultiFilters, searchQuery]);

  // Table data for table view
  const tableData = useMemo(() => {
    return filteredProjects.map(p => {
      const d = qstData[p.id] || {};
      return {
        id: p.id,
        code_projet: p.code_projet,
        nom_projet: p.nom_projet,
        region: getQstValue(d, 'region') || p.region || '—',
        typologie: getQstValue(d, 'typologie') || '—',
        spv: (getQstValue(d, 'spv') || '').toUpperCase(),
        ks: safeFloat(getQstValue(d, 'keon', 'pct') || getQstValue(d, 'ks', 'keon') || '0'),
        gisement: safeFloat(getQstValue(d, 'quantite', 'totale') || getQstValue(d, 'gisement', 'total') || '0'),
        cmas: safeFloat(getQstValue(d, 'cmax1') || '0'),
        completion: avgCompletion(d),
      };
    });
  }, [filteredProjects, qstData]);

  const { sortedData, sortConfig, handleSort } = useTableSort(tableData, 'code_projet', 'asc');

  const handleEditProject = (project: BEProject) => {
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  const handleSaveProject = async (projectData: Omit<BEProject, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingProject) {
      await updateProject(editingProject.id, projectData);
    }
    setIsDialogOpen(false);
    setEditingProject(null);
  };

  const handleConfirmDelete = async () => {
    if (deletingProject) {
      await deleteProject(deletingProject.id);
      setDeletingProject(null);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <Leaf className="h-7 w-7 text-emerald-500" />
              </div>
              Dashboard SPV
            </h1>
            <p className="text-muted-foreground mt-2">
              Vue consolidée des projets SPV et de leurs indicateurs questionnaire.
            </p>
          </div>
        </div>

        {/* Search + View Toggle + Filters */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[280px]">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
                  onClick={() => setSearchQuery(localSearch)}
                />
                <Input
                  placeholder="Rechercher par code ou nom de projet... (Entrée pour lancer)"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSearchQuery(localSearch); }}
                  className="pl-10"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                <Button
                  variant={currentView === 'synthese' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('h-8 px-3 gap-2', currentView === 'synthese' && 'shadow-sm')}
                  onClick={() => setCurrentView('synthese')}
                >
                  <BarChart2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Synthèse</span>
                </Button>
                <Button
                  variant={currentView === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('h-8 px-3 gap-2', currentView === 'cards' && 'shadow-sm')}
                  onClick={() => setCurrentView('cards')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Cards</span>
                </Button>
                <Button
                  variant={currentView === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('h-8 px-3 gap-2', currentView === 'table' && 'shadow-sm')}
                  onClick={() => setCurrentView('table')}
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Table</span>
                </Button>
                <Button
                  variant={currentView === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('h-8 px-3 gap-2', currentView === 'kanban' && 'shadow-sm')}
                  onClick={() => setCurrentView('kanban')}
                >
                  <Kanban className="h-4 w-4" />
                  <span className="hidden sm:inline">Kanban</span>
                </Button>
              </div>

            </div>

            {/* Multi-criteria filters */}
            <div className="mt-3">
              <ProjectMultiFiltersPanel
                filters={multiFilters}
                onFiltersChange={setMultiFilters}
                projects={keonProjects}
                activeFiltersCount={multiFiltersCount}
                presets={presets}
                onSavePreset={savePreset}
                onDeletePreset={deletePreset}
                onLoadPreset={loadPreset}
                onToggleDefault={toggleDefault}
                onClear={clearMultiFilters}
                getQstDistinctValues={getQstDistinctValues}
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Synthèse view */}
            {currentView === 'synthese' && (
              <BEProjectsKeonView
                projects={filteredProjects}
                qstData={qstData}
                keonProjectIds={keonProjectIds}
                widgetConfig={widgetConfig}
                onWidgetConfigChange={setWidgetConfig}
              />
            )}

            {/* Cards view */}
            {currentView === 'cards' && (
              <BEProjectCardsView
                projects={filteredProjects}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={handleEditProject}
                onDelete={setDeletingProject}
              />
            )}

            {/* Kanban view */}
            {currentView === 'kanban' && (
              <ProjectKanbanView
                projects={filteredProjects}
                groupBy={kanbanGroupBy}
                onGroupByChange={setKanbanGroupBy}
                onProjectClick={canEdit ? handleEditProject : undefined}
                canEdit={canEdit}
                qstData={qstData}
              />
            )}

            {/* Table view */}
            {currentView === 'table' && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    Projets SPV
                    <Badge variant="secondary" className="ml-2">{filteredProjects.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Aucun projet SPV trouvé pour ces critères
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <SortableTableHead sortKey="code_projet" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Code</SortableTableHead>
                            <SortableTableHead sortKey="nom_projet" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Nom projet</SortableTableHead>
                            <SortableTableHead sortKey="region" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Région</SortableTableHead>
                            <SortableTableHead sortKey="typologie" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Typologie</SortableTableHead>
                            <SortableTableHead sortKey="spv" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>SPV</SortableTableHead>
                            <SortableTableHead sortKey="ks" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>KS%</SortableTableHead>
                            <SortableTableHead sortKey="gisement" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Gisement (tMB/an)</SortableTableHead>
                            <SortableTableHead sortKey="cmas" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Cmax</SortableTableHead>
                            <SortableTableHead sortKey="completion" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Complétion %</SortableTableHead>
                            {(canEdit || canDelete) && <TableHead className="text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedData.map(row => (
                            <TableRow
                              key={row.id}
                              className="cursor-pointer hover:bg-muted/30"
                              onClick={() => navigate(`/be/projects/${row.code_projet}/overview`)}
                            >
                              <TableCell className="font-mono font-medium text-primary">{row.code_projet}</TableCell>
                              <TableCell className="font-medium">{row.nom_projet}</TableCell>
                              <TableCell className="text-muted-foreground">{row.region}</TableCell>
                              <TableCell className="text-muted-foreground">{row.typologie}</TableCell>
                              <TableCell>
                                {row.spv === 'OUI' ? <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Oui</Badge> :
                                 row.spv === 'NON' ? <Badge className="bg-destructive/10 text-destructive border border-destructive/20">Non</Badge> :
                                 <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{row.ks > 0 ? `${row.ks}%` : '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{row.gisement > 0 ? row.gisement.toLocaleString('fr-FR') : '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{row.cmas > 0 ? row.cmas.toLocaleString('fr-FR') : '—'}</TableCell>
                              <TableCell>
                                <span className={cn('font-semibold', completionColor(row.completion))}>{row.completion}%</span>
                              </TableCell>
                              {(canEdit || canDelete) && (
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/be/projects/${row.code_projet}/overview`)}>
                                      <LayoutDashboard className="h-4 w-4" />
                                    </Button>
                                    {canEdit && (
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                        const proj = filteredProjects.find(p => p.id === row.id);
                                        if (proj) handleEditProject(proj);
                                      }}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {canDelete && (
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                                        const proj = filteredProjects.find(p => p.id === row.id);
                                        if (proj) setDeletingProject(proj);
                                      }}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Edit Dialog */}
        <BEProjectDialog
          open={isDialogOpen}
          onClose={() => { setIsDialogOpen(false); setEditingProject(null); }}
          onSave={handleSaveProject}
          project={editingProject}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer le projet "{deletingProject?.nom_projet}" ({deletingProject?.code_projet}) ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
