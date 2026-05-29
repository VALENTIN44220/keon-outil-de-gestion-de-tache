import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { ProjectQuestionnairePage } from '@/components/project/questionnaire/ProjectQuestionnairePage';
import { useBEProjectByCode } from '@/hooks/useBEProjectHub';
import { useBEProjectHubCode } from '@/hooks/useBEProjectHubCode';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert } from 'lucide-react';
import { usePermissionsContext } from '@/contexts/PermissionsContext';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * L'accès au questionnaire dépend des droits SPV : il faut au moins UN
 * `qst_pilier_*_read = true` dans le permission_profile, ou être admin.
 * Sans ces droits, le RLS de project_questionnaire renvoyait un tableau vide
 * et la page restait blanche — on affiche désormais un message explicite.
 */
function hasAnyPilierRead(profile: ReturnType<typeof usePermissionsContext>['permissionProfile']): boolean {
  if (!profile) return false;
  const keys: (keyof typeof profile)[] = [
    'qst_pilier_00_read',
    'qst_pilier_02_read',
    'qst_pilier_04_read',
    'qst_pilier_05_read',
    'qst_pilier_06_read',
    'qst_pilier_07_read',
  ];
  return keys.some((k) => profile[k] === true);
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6 text-center">
      <div className="rounded-full bg-amber-100 p-3 mb-4">
        <ShieldAlert className="h-8 w-8 text-amber-600" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Accès refusé</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Le questionnaire projet est réservé aux profils disposant des droits SPV
        (lecture sur au moins un pilier <code className="font-mono text-xs">qst_pilier_*_read</code>).
        Demande à un administrateur d'ajuster ton profil de permissions si tu
        as besoin d'y accéder.
      </p>
    </div>
  );
}

export default function BEProjectHubQuestionnaire() {
  const code = useBEProjectHubCode();
  const { data: project, isLoading } = useBEProjectByCode(code);
  const { permissionProfile, isLoading: permsLoading } = usePermissionsContext();
  const { isAdmin } = useUserRole();

  const canRead = isAdmin || hasAnyPilierRead(permissionProfile);

  return (
    <BEProjectHubLayout>
      {isLoading || permsLoading || !project ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : !canRead ? (
        <AccessDenied />
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
