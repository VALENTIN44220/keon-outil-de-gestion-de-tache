import { useParams } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { ProjectQuestionnairePage } from '@/components/project/questionnaire/ProjectQuestionnairePage';
import { useBEProjectByCode } from '@/hooks/useBEProjectHub';
import { Skeleton } from '@/components/ui/skeleton';

export default function BEProjectHubQuestionnaire() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading } = useBEProjectByCode(code);

  return (
    <BEProjectHubLayout>
      {isLoading || !project ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <ProjectQuestionnairePage
          projectId={project.id}
          codeDivalto={project.code_divalto || ''}
          nomProjet={project.nom_projet}
        />
      )}
    </BEProjectHubLayout>
  );
}
