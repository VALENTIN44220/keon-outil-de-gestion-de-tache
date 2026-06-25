import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats } from '@/hooks/useITProjectHub';
import { ITProjectForm } from '@/components/it/ITProjectForm';

export default function ITProjectHubEdit() {
  const code = useITProjectHubCode();
  const navigate = useNavigate();
  const { data: project, isLoading, refetch } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const stats = useITProjectStats(tasks, project);

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

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto">
            <ITProjectForm
              project={project}
              onCancel={backToOverview}
              onSaved={() => {
                toast.success('Projet mis à jour');
                refetch();
                backToOverview();
              }}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
