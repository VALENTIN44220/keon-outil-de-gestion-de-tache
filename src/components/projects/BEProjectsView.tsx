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
import { Plus, Search, Pencil, Trash2, Building2, FolderOpen, Loader2, FileDown, Filter, LayoutDashboard } from 'lucide-react';
import { BEProjectDialog } from './BEProjectDialog';
import { ALL_PROJECT_COLUMNS, ColumnDefinition } from './ProjectColumnSelector';
import { ProjectViewSelector, ProjectView } from './ProjectViewSelector';
import { ProjectKanbanView, GroupByField } from './ProjectKanbanView';
import { ProjectViewConfigPanel } from './ProjectViewConfigPanel';
import { useFilteredProjects } from './ProjectFilters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

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
  
  // View state
  const [currentView, setCurrentView] = useState<ProjectView>('table');
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
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: 'Actif' },
      closed: { variant: 'secondary', label: 'Clôturé' },
      on_hold: { variant: 'outline', label: 'En attente' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            PROJETS
          </h1>
          <p className="text-muted-foreground mt-1">
            Liste des projets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>

          {canCreate && (
            <Button onClick={handleAddProject} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau projet
            </Button>
          )}
        </div>
      </div>

      {/* Search and View Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou nom de projet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <ProjectViewSelector currentView={currentView} onViewChange={setCurrentView} />
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
              <Badge variant="secondary" className="gap-1">
                <Filter className="h-3 w-3" />
                {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Projects View */}
      {currentView === 'kanban' ? (
        <ProjectKanbanView
          projects={filteredProjects}
          groupBy={kanbanGroupBy}
          onGroupByChange={setKanbanGroupBy}
          onProjectClick={canEdit ? handleEditProject : undefined}
          canEdit={canEdit}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Liste des projets ({filteredProjects.length}{filteredProjects.length !== projects.length ? ` / ${projects.length}` : ''})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || activeFiltersCount > 0 ? 'Aucun projet trouvé pour ces critères' : 'Aucun projet créé'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {orderedVisibleColumns.map(col => (
                        <TableHead key={col.key}>
                          <div className="flex items-center gap-1">
                            {col.label}
                            {columnFilters[col.key]?.value && (
                              <Filter className="h-3 w-3 text-keon-blue" />
                            )}
                          </div>
                        </TableHead>
                      ))}
                      {(canEdit || canDelete) && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        {orderedVisibleColumns.map(col => (
                          <TableCell key={col.key} className={col.key === 'code_projet' ? 'font-mono font-medium' : col.key === 'nom_projet' ? 'font-medium' : 'text-muted-foreground'}>
                            {renderCellValue(project, col.key)}
                          </TableCell>
                        ))}
                        {(canEdit || canDelete) && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/be/projects/${project.code_projet}/overview`)}
                                title="Ouvrir le HUB projet"
                              >
                                <LayoutDashboard className="h-4 w-4" />
                              </Button>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditProject(project)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingProject(project)}
                                  className="text-destructive hover:text-destructive"
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
