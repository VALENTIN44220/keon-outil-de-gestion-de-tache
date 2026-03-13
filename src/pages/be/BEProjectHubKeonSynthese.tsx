import { useParams } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { BEProjectKeonSyntheseTab } from '@/components/projects/BEProjectKeonSyntheseTab';
import { useBEProjectByCode } from '@/hooks/useBEProjectHub';
import { useQuestionnaireProjectData } from '@/hooks/useQuestionnaireProjectData';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';

export default function BEProjectHubKeonSynthese() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading } = useBEProjectByCode(code);

  const projectsArray = useMemo(() => (project ? [project] : []), [project]);
  const { qstData } = useQuestionnaireProjectData(projectsArray);

  const projectQstData = project ? (qstData[project.id] || {}) : {};

  return (
    <BEProjectHubLayout>
      {isLoading || !project ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <BEProjectKeonSyntheseTab
          project={project}
          qstData={projectQstData}
        />
      )}
    </BEProjectHubLayout>
  );
}
