import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats } from '@/hooks/useITProjectHub';
import { useITProjectLoad } from '@/hooks/useITProjectLoad';
import { ITProjectROITab } from '@/components/it/ITProjectROITab';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { ITProjectFormDialog } from '@/components/it/ITProjectFormDialog';

export default function ITProjectHubROI() {
  const code = useITProjectHubCode();
  const { data: project, isLoading } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const stats = useITProjectStats(tasks, project);
  const { data: loads = [] } = useITProjectLoad(project?.id);
  const [showEditDialog, setShowEditDialog] = useState(false);

  if (isLoading || !project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col min-h-full">
        <ITProjectHubHeader project={project} stats={stats} onEditProject={() => setShowEditDialog(true)} />
        <div className="flex-1 p-6">
          <ITProjectROITab project={project} loads={loads} />
        </div>
      </div>
      {showEditDialog && (
        <ITProjectFormDialog
          project={project}
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
        />
      )}
    </Layout>
  );
}
