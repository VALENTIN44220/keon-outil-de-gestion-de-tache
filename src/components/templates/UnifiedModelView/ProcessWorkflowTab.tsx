import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Workflow,
  ExternalLink,
  Play,
  History,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface WorkflowInfo {
  id: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  updatedAt: string;
}

interface ProcessWorkflowTabProps {
  processId: string;
  processName: string;
  workflowInfo: WorkflowInfo | null;
  canManage: boolean;
  onNavigateToEditor: () => void;
}

export function ProcessWorkflowTab({
  processId,
  processName,
  workflowInfo,
  canManage,
  onNavigateToEditor,
}: ProcessWorkflowTabProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'published':
        return {
          icon: CheckCircle,
          label: 'Publié',
          color: 'bg-green-100 text-green-700 border-green-300',
          description: 'Le workflow est actif et utilisé pour les nouvelles demandes',
        };
      case 'draft':
        return {
          icon: Clock,
          label: 'Brouillon',
          color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
          description: 'Le workflow est en cours de modification, non encore actif',
        };
      case 'archived':
        return {
          icon: History,
          label: 'Archivé',
          color: 'bg-gray-100 text-gray-700 border-gray-300',
          description: 'Ce workflow est archivé et ne sera plus utilisé',
        };
      default:
        return {
          icon: AlertTriangle,
          label: 'Inconnu',
          color: 'bg-gray-100 text-gray-700',
          description: '',
        };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Configuration du workflow</h3>
          <p className="text-sm text-muted-foreground">
            Définissez les étapes, validations et notifications
          </p>
        </div>
      </div>

      {!workflowInfo ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Workflow className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Aucun workflow configuré</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Créez un workflow pour définir les étapes d'exécution, les validations et les
              notifications de ce processus.
            </p>
            {canManage && (
              <Button onClick={onNavigateToEditor}>
                <Workflow className="h-4 w-4 mr-2" />
                Créer un workflow
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{workflowInfo.name}</CardTitle>
                <Badge className={getStatusConfig(workflowInfo.status).color}>
                  {getStatusConfig(workflowInfo.status).label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {getStatusConfig(workflowInfo.status).description}
              </p>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Version</span>
                  <p className="font-medium">v{workflowInfo.version}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Dernière modification</span>
                  <p className="font-medium">
                    {new Date(workflowInfo.updatedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button onClick={onNavigateToEditor} className="flex-1">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir l'éditeur
                </Button>
                {canManage && workflowInfo.status === 'draft' && (
                  <Button variant="outline">
                    <Play className="h-4 w-4 mr-2" />
                    Publier
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Historique des versions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">v{workflowInfo.version}</Badge>
                    <span>Version actuelle</span>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(workflowInfo.updatedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {/* Placeholder for more versions */}
                <p className="text-xs text-muted-foreground text-center py-2">
                  L'historique complet des versions sera disponible prochainement
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Test & Simulation */}
          {canManage && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Test et simulation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Testez le workflow sans créer de vraies données pour valider le comportement
                  attendu.
                </p>
                <Button variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Lancer une simulation
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
