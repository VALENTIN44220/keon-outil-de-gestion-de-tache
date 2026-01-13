import { useState } from 'react';
import { useBEProjects } from '@/hooks/useBEProjects';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useSharePointSync, PreviewData } from '@/hooks/useSharePointSync';
import { BEProject } from '@/types/beProject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Pencil, Trash2, Building2, FolderOpen, Loader2, RefreshCw, Download, Upload, Eye, FileDown } from 'lucide-react';
import { BEProjectDialog } from './BEProjectDialog';
import { SharePointPreviewDialog } from './SharePointPreviewDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

export function BEProjectsView() {
  const { projects, isLoading, searchQuery, setSearchQuery, addProject, updateProject, deleteProject, fetchProjects } = useBEProjects();
  const { permissionProfile } = useUserPermissions();
  const { 
    isLoading: isSyncing, 
    isPreviewLoading,
    previewData,
    getPreview,
    clearPreview,
    importFromSharePoint, 
    exportToSharePoint, 
    fullSync 
  } = useSharePointSync();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<BEProject | null>(null);
  const [deletingProject, setDeletingProject] = useState<BEProject | null>(null);
  const [previewAction, setPreviewAction] = useState<'import' | 'export' | 'sync' | null>(null);

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

  const handlePreviewAction = async (action: 'import' | 'export' | 'sync') => {
    setPreviewAction(action);
    await getPreview(action);
  };

  const handleConfirmSync = async () => {
    if (!previewAction) return;
    
    try {
      if (previewAction === 'import') {
        await importFromSharePoint();
      } else if (previewAction === 'export') {
        await exportToSharePoint();
      } else {
        await fullSync();
      }
      fetchProjects();
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleClosePreview = () => {
    setPreviewAction(null);
    clearPreview();
  };

  const handleExportCSV = () => {
    if (projects.length === 0) {
      toast({
        title: 'Aucun projet',
        description: 'Aucun projet à exporter',
        variant: 'destructive',
      });
      return;
    }

    // CSV headers matching SharePoint column mapping
    const headers = [
      'code_projet',
      'nom_projet',
      'description',
      'adresse_site',
      'adresse_societe',
      'pays',
      'pays_site',
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
      ...projects.map(project => 
        headers.map(header => {
          const value = (project as any)[header];
          // Escape quotes and handle special characters
          if (value === null || value === undefined) return '';
          const strValue = String(value);
          if (strValue.includes(';') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        }).join(';')
      ),
    ].join('\n');

    // Add BOM for Excel compatibility with UTF-8
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `projets_be_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export terminé',
      description: `${projects.length} projets exportés en CSV`,
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
            Projets BE
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les projets du Bureau d'Études
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export CSV */}
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>

          {/* SharePoint Sync */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={isSyncing}>
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                SharePoint
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePreviewAction('sync')}>
                <Eye className="h-4 w-4 mr-2" />
                Synchronisation complète
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePreviewAction('import')}>
                <Download className="h-4 w-4 mr-2" />
                Importer depuis Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePreviewAction('export')}>
                <Upload className="h-4 w-4 mr-2" />
                Exporter vers Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canCreate && (
            <Button onClick={handleAddProject} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau projet
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par code ou nom de projet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Liste des projets ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'Aucun projet trouvé pour cette recherche' : 'Aucun projet créé'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom du projet</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Typologie</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Créé le</TableHead>
                  {(canEdit || canDelete) && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-mono font-medium">{project.code_projet}</TableCell>
                    <TableCell className="font-medium">{project.nom_projet}</TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.typologie || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.pays || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(project.created_at), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
          )}
        </CardContent>
      </Card>

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

      {/* SharePoint Preview Dialog */}
      <SharePointPreviewDialog
        open={!!previewAction}
        onClose={handleClosePreview}
        onConfirm={handleConfirmSync}
        previewData={previewData}
        isLoading={isPreviewLoading}
        action={previewAction || 'import'}
      />
    </div>
  );
}
