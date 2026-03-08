import { ITProject } from '@/types/itProject';
import { toast } from '@/hooks/use-toast';

export function useITProjectSync(project: ITProject | null | undefined) {
  const openLoop = () => {
    if (project?.loop_workspace_url) {
      window.open(project.loop_workspace_url, '_blank', 'noopener,noreferrer');
    } else {
      toast({ title: 'Loop non configuré', description: "Ajoutez l'URL Loop dans les paramètres du projet.", variant: 'destructive' });
    }
  };
  const openTeams = () => {
    if (project?.teams_channel_url) {
      window.open(project.teams_channel_url, '_blank', 'noopener,noreferrer');
    } else {
      toast({ title: 'Teams non configuré', description: "Ajoutez l'URL Teams dans les paramètres du projet.", variant: 'destructive' });
    }
  };
  return { openLoop, openTeams, hasLoop: !!project?.loop_workspace_url, hasTeams: !!project?.teams_channel_url, isSyncing: false };
}
