import { ITProject } from '@/types/itProject';
import { toast } from '@/hooks/use-toast';

// ================================================
// Hook useITProjectSync — Intégration Microsoft Loop (lien direct)
// ================================================
export function useITProjectSync(project: ITProject | null | undefined) {

  // Ouvrir le workspace Loop dans un nouvel onglet
  const openLoop = () => {
    if (project?.loop_workspace_url) {
      window.open(project.loop_workspace_url, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: 'Loop non configuré',
        description: "Aucun workspace Loop n'est associé à ce projet. Ajoutez l'URL dans les paramètres.",
        variant: 'destructive',
      });
    }
  };

  // Ouvrir Teams si configuré
  const openTeams = () => {
    if (project?.teams_channel_url) {
      window.open(project.teams_channel_url, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: 'Teams non configuré',
        description: "Aucun canal Teams n'est associé à ce projet.",
        variant: 'destructive',
      });
    }
  };

  const hasLoop = !!project?.loop_workspace_url;
  const hasTeams = !!project?.teams_channel_url;

  return { openLoop, openTeams, hasLoop, hasTeams, isSyncing: false };
}
