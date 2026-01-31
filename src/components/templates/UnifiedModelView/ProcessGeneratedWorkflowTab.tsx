import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Workflow,
  Play,
  RefreshCw,
  History,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
  GitBranch,
  Bell,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateStandardProcessWorkflow } from '@/hooks/useWorkflowGenerator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProcessGeneratedWorkflowTabProps {
  processId: string;
  processName: string;
  canManage: boolean;
  onUpdate: () => void;
}

interface WorkflowInfo {
  id: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  updatedAt: string;
  isCustomized: boolean;
  nodeCount: number;
}

interface WorkflowVersion {
  id: string;
  version: number;
  status: string;
  created_at: string;
}

export function ProcessGeneratedWorkflowTab({
  processId,
  processName,
  canManage,
  onUpdate,
}: ProcessGeneratedWorkflowTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo | null>(null);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [subProcessCount, setSubProcessCount] = useState(0);

  useEffect(() => {
    fetchWorkflowInfo();
    fetchSubProcessCount();
  }, [processId]);

  const fetchWorkflowInfo = async () => {
    setIsLoading(true);
    try {
      // Get default workflow
      const { data: workflow } = await supabase
        .from('workflow_templates')
        .select('id, name, status, version, updated_at')
        .eq('process_template_id', processId)
        .eq('is_default', true)
        .single();

      if (workflow) {
        // Get node count
        const { count } = await supabase
          .from('workflow_nodes')
          .select('id', { count: 'exact', head: true })
          .eq('workflow_id', workflow.id);

        // Check if customized (has manual edits - simplified check)
        const isCustomized = workflow.name.includes('(personnalisé)') || 
                            workflow.name.includes('(custom)');

        setWorkflowInfo({
          id: workflow.id,
          name: workflow.name,
          status: workflow.status as 'draft' | 'published' | 'archived',
          version: workflow.version,
          updatedAt: workflow.updated_at,
          isCustomized,
          nodeCount: count || 0,
        });

        // Get versions
        const { data: versionData } = await supabase
          .from('workflow_templates')
          .select('id, version, status, created_at')
          .eq('process_template_id', processId)
          .order('version', { ascending: false });

        if (versionData) {
          setVersions(versionData);
        }
      } else {
        setWorkflowInfo(null);
      }
    } catch (error) {
      console.error('Error fetching workflow info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubProcessCount = async () => {
    const { count } = await supabase
      .from('sub_process_templates')
      .select('id', { count: 'exact', head: true })
      .eq('process_template_id', processId);
    
    setSubProcessCount(count || 0);
  };

  const handleGenerate = async (forceRegenerate = false) => {
    if (!user) return;
    
    setIsGenerating(true);
    setShowRegenerateDialog(false);

    try {
      // Delete existing workflow if regenerating
      if (forceRegenerate && workflowInfo) {
        await supabase
          .from('workflow_templates')
          .delete()
          .eq('id', workflowInfo.id);
      }

      // Generate new workflow
      const result = await generateStandardProcessWorkflow(processId, processName, user.id);

      if (result) {
        toast.success('Workflow généré avec succès');
        fetchWorkflowInfo();
        onUpdate();
      } else {
        toast.error('Erreur lors de la génération');
      }
    } catch (error) {
      console.error('Error generating workflow:', error);
      toast.error('Erreur lors de la génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!workflowInfo) return;

    try {
      await supabase
        .from('workflow_templates')
        .update({ status: 'active' })
        .eq('id', workflowInfo.id);

      toast.success('Workflow publié');
      fetchWorkflowInfo();
    } catch (error) {
      console.error('Error publishing workflow:', error);
      toast.error('Erreur lors de la publication');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Publié
          </Badge>
        );
      case 'draft':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Brouillon
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="secondary">
            <History className="h-3 w-3 mr-1" />
            Archivé
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${workflowInfo ? 'bg-primary/10' : 'bg-muted'}`}>
                <Workflow className={`h-5 w-5 ${workflowInfo ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <CardTitle className="text-base">Workflow généré</CardTitle>
                <CardDescription>
                  {workflowInfo 
                    ? `Version ${workflowInfo.version} • ${workflowInfo.nodeCount} nœuds`
                    : 'Aucun workflow configuré'
                  }
                </CardDescription>
              </div>
            </div>
            {workflowInfo && getStatusBadge(workflowInfo.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflowInfo ? (
            <>
              {workflowInfo.isCustomized && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                      Workflow personnalisé
                    </p>
                    <p className="text-amber-600 dark:text-amber-400 text-xs">
                      Ce workflow a été modifié manuellement. La régénération écrasera ces modifications.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/templates/workflow/process/${processId}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir l'éditeur
                </Button>
                
                {canManage && (
                  <>
                    {workflowInfo.status === 'draft' && (
                      <Button size="sm" onClick={handlePublish}>
                        <Play className="h-4 w-4 mr-2" />
                        Publier
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRegenerateDialog(true)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Régénérer
                    </Button>
                  </>
                )}
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground">
                Dernière modification : {format(new Date(workflowInfo.updatedAt), 'PPp', { locale: fr })}
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                Générez un workflow automatiquement à partir des paramètres du processus
              </p>
              {canManage && (
                <Button onClick={() => handleGenerate(false)} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Générer le workflow
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Structure Preview */}
      {subProcessCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Structure générée (aperçu)</CardTitle>
            <CardDescription>
              Séquence standard qui sera générée
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Badge variant="outline" className="gap-1">
                <Play className="h-3 w-3" />
                Start
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="gap-1">
                <Bell className="h-3 w-3" />
                Notif création
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              
              {subProcessCount > 1 ? (
                <>
                  <Badge className="bg-blue-100 text-blue-700">FORK</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="gap-1">
                    <GitBranch className="h-3 w-3" />
                    {subProcessCount} sous-processus
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className="bg-blue-100 text-blue-700">JOIN</Badge>
                </>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <GitBranch className="h-3 w-3" />
                  1 sous-processus
                </Badge>
              )}
              
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="gap-1">
                <Bell className="h-3 w-3" />
                Notif clôture
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                End
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version History */}
      {versions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Historique des versions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">v{v.version}</span>
                      {getStatusBadge(v.status)}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(v.created_at), 'PP', { locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Régénérer le workflow ?</AlertDialogTitle>
            <AlertDialogDescription>
              {workflowInfo?.isCustomized ? (
                <>
                  <span className="font-medium text-amber-600">Attention :</span> Ce workflow a été 
                  personnalisé manuellement. La régénération écrasera toutes les modifications.
                </>
              ) : (
                <>
                  Le workflow actuel sera remplacé par un nouveau généré à partir des paramètres du processus.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleGenerate(true)}>
              Régénérer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
