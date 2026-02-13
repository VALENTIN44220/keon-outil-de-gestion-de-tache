import { ReactNode, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useBEProjectByCode, useBEProjectTasks, useBEProjectStats } from '@/hooks/useBEProjectHub';
import { Sidebar } from '@/components/layout/Sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Building2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BEProjectHubHeader } from './BEProjectHubHeader';
import { BEProjectDialog } from '@/components/projects/BEProjectDialog';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BEProjectHubLayoutProps {
  children: ReactNode;
}

export function BEProjectHubLayout({ children }: BEProjectHubLayoutProps) {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const { data: project, isLoading: projectLoading, error } = useBEProjectByCode(code);
  const { data: tasks = [], isLoading: tasksLoading } = useBEProjectTasks(project?.id);
  
  const stats = useBEProjectStats(project?.id, tasks);

  const handleSaveProject = async (data: any) => {
    if (!project) return;
    const { error } = await supabase
      .from('be_projects')
      .update(data)
      .eq('id', project.id);
    
    if (error) {
      toast.error('Erreur lors de la mise à jour');
      return;
    }
    toast.success('Projet mis à jour');
    queryClient.invalidateQueries({ queryKey: ['be-project', code] });
    setEditDialogOpen(false);
  };

  if (projectLoading || tasksLoading) {
    return (
      <div className="flex min-h-screen bg-muted/20">
        <Sidebar activeView="projects" onViewChange={() => {}} />
        <main className="flex-1 p-6">
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[500px] w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen bg-muted/20">
        <Sidebar activeView="projects" onViewChange={() => {}} />
        <main className="flex-1 p-6">
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="p-4 rounded-full bg-muted">
              <Building2 className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Projet non trouvé</h2>
            <p className="text-muted-foreground">
              Le projet avec le code "{code}" n'existe pas.
            </p>
            <Button onClick={() => navigate('/projects')} variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour aux projets
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar activeView="projects" onViewChange={() => {}} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <BEProjectHubHeader 
          project={project} 
          stats={stats} 
          onEditProject={() => setEditDialogOpen(true)} 
        />

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>

      <BEProjectDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        project={project}
        onSave={handleSaveProject}
      />
    </div>
  );
}
