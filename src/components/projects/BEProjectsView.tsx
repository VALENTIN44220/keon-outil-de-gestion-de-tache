import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBEProjects } from '@/hooks/useBEProjects';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useProjectViewConfig } from '@/hooks/useProjectViewConfig';
import { BEProject } from '@/types/beProject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, Building2, FolderOpen, Loader2, FileDown, Filter, LayoutDashboard, LayoutGrid, List, Kanban } from 'lucide-react';
import { BEProjectDialog } from './BEProjectDialog';
import { ALL_PROJECT_COLUMNS, ColumnDefinition } from './ProjectColumnSelector';
import { ProjectKanbanView, GroupByField } from './ProjectKanbanView';
import { ProjectViewConfigPanel } from './ProjectViewConfigPanel';
import { useFilteredProjects } from './ProjectFilters';
import { BEProjectCardsView } from './BEProjectCardsView';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ViewType = 'cards' | 'table' | 'kanban';

export function BEProjectsView() {
  const navigate = useNavigate();
  const { projects, isLoading, searchQuery, setSearchQuery, addProject, updateProject, deleteProject } = useBEProjects();
  const { permissionProfile } = useUserPermissions();
  const { 
    activeViewType,
    isAdmin,
    saveStandardConfig,
    saveCustomConfig,
    switchView,
    getActiveConfig,
  } = useProjectViewConfig();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<BEProject | null>(null);
  const [deletingProject, setDeletingProject] = useState<BEProject | null>(null);
  
  // View state - default to cards
  const [currentView, setCurrentView] = useState<ViewType>('cards');
  const [kanbanGroupBy, setKanbanGroupBy] = useState<GroupByField>('status');

  // Get active config
  const activeConfig = getActiveConfig();
  const visibleColumns = activeConfig.visible_columns;
  const columnOrder = activeConfig.column_order;
  const columnFilters = activeConfig.column_filters;

  // Apply filters to projects
  const filteredProjects = useFilteredProjects(projects, columnFilters);

  // Get ordered columns based on config
  const orderedVisibleColumns = useMemo(() => {
    return columnOrder
      .filter(key => visibleColumns.includes(key))
      .map(key => ALL_PROJECT_COLUMNS.find(c => c.key === key))
      .filter(Boolean) as ColumnDefinition[];
  }, [columnOrder, visibleColumns]);

  const activeFiltersCount = Object.keys(columnFilters).filter(k => columnFilters[k]?.value).length;

  const canCreate = permissionProfile?.can_create_be_projects ?? false;
  const canEdit = permissionProfile?.can_edit_be_projects ?? false;
  const canDelete = permissionProfile?.can_delete_be_projects ?? false;

  const handleAddProject = () => {
    setEditingProject(null);
    setIsDialogOpen(true);
  };

  const handleEditProject = (project: BEProject) => {
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  const handleSaveProject = async (projectData: Omit<BEProject, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingProject) {
      await updateProject(editingProject.id, projectData);
    } else {
      await addProject(projectData);
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

  const handleExportCSV = () => {
    if (filteredProjects.length === 0) {
      toast({
        title: 'Aucun projet',
        description: 'Aucun projet à exporter',
        variant: 'destructive',
      });
      return;
    }

    const headers = [
      'code_projet',
      'nom_projet',
      'description',
      'adresse_site',
      'adresse_societe',
      'pays',
      'pays_site',
      'region',
      'departement',
      'code_divalto',
      'siret',
      'date_cloture_bancaire',
      'date_cloture_juridique',
      'date_os_etude',
      'date_os_travaux',
      'actionnariat',
      'regime_icpe',
      'typologie',
      'status',
    ];

    const csvContent = [
      headers.join(';'),
      ...filteredProjects.map(project => 
        headers.map(header => {
          const value = (project as any)[header];
          if (value === null || value === undefined) return '';
          const strValue = String(value);
          if (strValue.includes(';') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        }).join(';')
      ),
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `projets_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export terminé',
      description: `${filteredProjects.length} projets exportés en CSV`,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      active: { className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', label: 'Actif' },
      closed: { className: 'bg-slate-500/10 text-slate-600 border-slate-500/20', label: 'Clôturé' },
      on_hold: { className: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: 'En attente' },
    };
    const config = variants[status] || { className: 'bg-slate-500/10 text-slate-600', label: status };
    return <Badge className={cn('border', config.className)}>{config.label}</Badge>;
  };

  const renderCellValue = (project: BEProject, key: string) => {
    const value = (project as any)[key];
    
    if (value === null || value === undefined) return '-';
    
    if (key === 'status') {
      return getStatusBadge(value);
    }
    
    if (['date_cloture_bancaire', 'date_cloture_juridique', 'date_os_etude', 'date_os_travaux', 'created_at'].includes(key)) {
      try {
        return format(new Date(value), 'dd MMM yyyy', { locale: fr });
      } catch {
        return value;
      }
    }
    
    return String(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <FolderOpen className="h-7 w-7 text-primary" />
            </div>
            PROJETS
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Gérez vos projets BE, suivez leur avancement et accédez au hub détaillé de chaque projet.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>

          {canCreate && (
            <Button onClick={handleAddProject} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Nouveau projet
            </Button>
          )}
        </div>
      </div>

      {/* Search and View Controls */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou nom de projet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
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

            {currentView === 'table' && (
              <ProjectViewConfigPanel
                config={activeConfig}
                isAdmin={isAdmin}
                onSaveStandard={saveStandardConfig}
                onSaveCustom={saveCustomConfig}
                activeViewType={activeViewType}
                onSwitchView={switchView}
              />
            )}
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="gap-1 px-3 py-1">
                <Filter className="h-3 w-3" />
                {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Projects View */}
      {currentView === 'cards' && (
        <BEProjectCardsView
          projects={filteredProjects}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={handleEditProject}
          onDelete={setDeletingProject}
        />
      )}

      {currentView === 'kanban' && (
        <ProjectKanbanView
          projects={filteredProjects}
          groupBy={kanbanGroupBy}
          onGroupByChange={setKanbanGroupBy}
          onProjectClick={canEdit ? handleEditProject : undefined}
          canEdit={canEdit}
        />
      )}

      {currentView === 'table' && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Liste des projets
              <Badge variant="secondary" className="ml-2">
                {filteredProjects.length}{filteredProjects.length !== projects.length ? ` / ${projects.length}` : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery || activeFiltersCount > 0 ? 'Aucun projet trouvé pour ces critères' : 'Aucun projet créé'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      {orderedVisibleColumns.map(col => (
                        <TableHead key={col.key} className="font-semibold">
                          <div className="flex items-center gap-1">
                            {col.label}
                            {columnFilters[col.key]?.value && (
                              <Filter className="h-3 w-3 text-primary" />
                            )}
                          </div>
                        </TableHead>
                      ))}
                      {(canEdit || canDelete) && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow 
                        key={project.id} 
                        className="group cursor-pointer hover:bg-muted/30"
                        onClick={() => navigate(`/be/projects/${project.code_projet}/overview`)}
                      >
                        {orderedVisibleColumns.map(col => (
                          <TableCell 
                            key={col.key} 
                            className={cn(
                              col.key === 'code_projet' && 'font-mono font-medium text-primary',
                              col.key === 'nom_projet' && 'font-medium',
                              !['code_projet', 'nom_projet', 'status'].includes(col.key) && 'text-muted-foreground'
                            )}
                          >
                            {renderCellValue(project, col.key)}
                          </TableCell>
                        ))}
                        {(canEdit || canDelete) && (
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/be/projects/${project.code_projet}/overview`)}
                                title="Ouvrir le HUB projet"
                              >
                                <LayoutDashboard className="h-4 w-4" />
                              </Button>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditProject(project)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingProject(project)}
                                >
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

      {/* Project Dialog */}
      <BEProjectDialog
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingProject(null);
        }}
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
              Cette action est irréversible.
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
  );
}
