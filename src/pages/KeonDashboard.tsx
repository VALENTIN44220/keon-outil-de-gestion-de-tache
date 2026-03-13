import { Layout } from '@/components/layout/Layout';
import { useBEProjects } from '@/hooks/useBEProjects';
import { useQuestionnaireProjectData } from '@/hooks/useQuestionnaireProjectData';
import { BEProjectsKeonView } from '@/components/projects/BEProjectsKeonView';
import { Loader2 } from 'lucide-react';

export default function KeonDashboard() {
  const { projects, isLoading } = useBEProjects();
  const { qstData, keonProjectIds } = useQuestionnaireProjectData(projects);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <span className="text-2xl">🌿</span>
            Dashboard KEON
          </h1>
          <p className="text-muted-foreground mt-2">
            Vue consolidée des projets KEON et de leurs indicateurs questionnaire.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <BEProjectsKeonView
            projects={projects}
            qstData={qstData}
            keonProjectIds={keonProjectIds}
          />
        )}
      </div>
    </Layout>
  );
}
