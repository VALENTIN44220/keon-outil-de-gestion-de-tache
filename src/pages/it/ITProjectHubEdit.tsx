import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats } from '@/hooks/useITProjectHub';
import { ITProjectForm } from '@/components/it/ITProjectForm';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { useITProjects } from '@/hooks/useITProjects';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ITProjectHubEdit() {
  const code = useITProjectHubCode();
  const navigate = useNavigate();
  const { data: project, isLoading, refetch } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const stats = useITProjectStats(tasks, project);
  const { isAdmin } = useUserRole();
  const { deleteProject } = useITProjects();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isLoading || !project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const backToOverview = () => navigate(`/it/projects/${project.code_projet_digital}/overview`);

  const handleDelete = async () => {
    setIsDeleting(true);
    const ok = await deleteProject(project.id);
    setIsDeleting(false);
    if (ok) {
      setDeleteOpen(false);
      navigate('/it/projects');
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <ITProjectForm
              project={project}
              onCancel={backToOverview}
              onSaved={() => {
                toast.success('Projet mis à jour');
                refetch();
                backToOverview();
              }}
            />

            {/* Zone de danger — suppression réservée aux administrateurs */}
            {isAdmin && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-destructive">Supprimer le projet</p>
                    <p className="text-xs text-muted-foreground">
                      Action irréversible : le projet et ses données associées (jalons, tâches liées) seront supprimés.
                    </p>
                  </div>
                  <Button variant="destructive" className="gap-2 shrink-0" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={open => { if (!isDeleting) setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Supprimer le projet IT
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-1">
              <span className="block">
                Êtes-vous sûr de vouloir supprimer définitivement{' '}
                <span className="font-mono font-semibold text-foreground">{project.code_projet_digital}</span>
                {' '}— <span className="font-medium text-foreground">{project.nom_projet}</span> ?
              </span>
              <span className="block text-xs text-destructive/80 font-medium">
                Cette action est irréversible.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={e => { e.preventDefault(); void handleDelete(); }}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
