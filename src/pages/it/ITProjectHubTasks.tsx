import { useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats } from '@/hooks/useITProjectHub';
import { ListTodo } from 'lucide-react';

export default function ITProjectHubTasks() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const stats = useITProjectStats(tasks, project);

  if (isLoading || !project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
            <ListTodo className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Tâches & Demandes</p>
            <p className="text-sm">Cette vue sera bientôt disponible.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
