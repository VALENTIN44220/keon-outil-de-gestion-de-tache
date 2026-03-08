import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats } from '@/hooks/useITProjectHub';
import { useITProjectSync } from '@/hooks/useITProjectSync';
import { useITProjects } from '@/hooks/useITProjects';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link2, ExternalLink, Info, Save, RefreshCw, CheckCircle2, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ITProjectHubSync() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading, refetch } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const stats = useITProjectStats(tasks, project);
  const { openLoop, openTeams, hasLoop, hasTeams } = useITProjectSync(project);
  const { updateProject } = useITProjects();

  const [teamsChannelUrl, setTeamsChannelUrl] = useState('');
  const [loopWorkspaceUrl, setLoopWorkspaceUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setTeamsChannelUrl(project.teams_channel_url || '');
      setLoopWorkspaceUrl(project.loop_workspace_url || '');
    }
  }, [project]);

  const handleSave = async () => {
    if (!project?.id) return;
    setIsSaving(true);
    await updateProject(project.id, {
      teams_channel_url: teamsChannelUrl.trim() || null,
      loop_workspace_url: loopWorkspaceUrl.trim() || null,
    });
    await refetch();
    setIsSaving(false);
  };

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
          <div className="max-w-2xl mx-auto space-y-6">

            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-sm text-blue-800 dark:text-blue-200">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600" />
              <div>
                <p className="font-semibold">Intégration Microsoft 365</p>
                <p className="text-xs mt-1 opacity-80">
                  Associez un workspace Loop et un canal Teams à ce projet. Les liens apparaîtront dans le header et la synthèse pour un accès direct depuis KEON.
                </p>
              </div>
            </div>

            {/* Microsoft Loop */}
            <Card className={cn('border-2 transition-colors', hasLoop ? 'border-violet-200' : 'border-border')}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl', hasLoop ? 'bg-violet-100' : 'bg-muted')}>
                    <Link2 className={cn('h-5 w-5', hasLoop ? 'text-violet-600' : 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Microsoft Loop</CardTitle>
                    <CardDescription>Workspace collaboratif Loop associé au projet</CardDescription>
                  </div>
                  {hasLoop && (
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Configuré
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loop-url">URL du workspace Loop</Label>
                  <Input
                    id="loop-url"
                    placeholder="https://loop.microsoft.com/p/..."
                    value={loopWorkspaceUrl}
                    onChange={e => setLoopWorkspaceUrl(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dans Microsoft Loop → ouvrez le workspace → "Partager" → "Copier le lien"
                  </p>
                </div>
                {loopWorkspaceUrl && (
                  <Button variant="outline" size="sm" className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50" onClick={openLoop}>
                    <ExternalLink className="h-3.5 w-3.5" /> Tester l'ouverture
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Microsoft Teams */}
            <Card className={cn('border-2 transition-colors', hasTeams ? 'border-blue-200' : 'border-border')}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl', hasTeams ? 'bg-blue-100' : 'bg-muted')}>
                    <MessageSquareText className={cn('h-5 w-5', hasTeams ? 'text-blue-600' : 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Microsoft Teams</CardTitle>
                    <CardDescription>Canal Teams du projet (lien d'accès direct)</CardDescription>
                  </div>
                  {hasTeams && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Configuré
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teams-url">URL du canal Teams</Label>
                  <Input
                    id="teams-url"
                    placeholder="https://teams.microsoft.com/l/channel/..."
                    value={teamsChannelUrl}
                    onChange={e => setTeamsChannelUrl(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Teams → clic droit sur le canal → "Obtenir le lien vers le canal"
                  </p>
                </div>
                {teamsChannelUrl && (
                  <Button variant="outline" size="sm" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={openTeams}>
                    <ExternalLink className="h-3.5 w-3.5" /> Tester l'ouverture
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Save */}
            <Button
              className="w-full gap-2 h-11 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/20"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer les liens
            </Button>

            {/* Liens actifs */}
            {(hasLoop || hasTeams) && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Liens actifs sur ce projet</p>
                <div className="space-y-2">
                  {hasLoop && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-violet-50 border border-violet-100 cursor-pointer hover:bg-violet-100 transition-colors" onClick={openLoop}>
                      <Link2 className="h-4 w-4 text-violet-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-violet-700">Microsoft Loop</p>
                        <p className="text-[10px] text-violet-500 truncate">{loopWorkspaceUrl}</p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                    </div>
                  )}
                  {hasTeams && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors" onClick={openTeams}>
                      <MessageSquareText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-blue-700">Microsoft Teams</p>
                        <p className="text-[10px] text-blue-500 truncate">{teamsChannelUrl}</p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
