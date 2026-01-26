import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle, Workflow, Layers, RefreshCw } from 'lucide-react';
import { useWorkflowMigration } from '@/hooks/useWorkflowMigration';
import { useWorkflowAutoGeneration } from '@/hooks/useWorkflowAutoGeneration';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function WorkflowMigrationTab() {
  const { isMigrating, migrationResults, migrateAllProcesses } = useWorkflowMigration();
  const { generateAllMissingWorkflows, isGenerating, progress } = useWorkflowAutoGeneration();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAutoGenConfirm, setShowAutoGenConfirm] = useState(false);
  const [showForceRegenConfirm, setShowForceRegenConfirm] = useState(false);
  const [autoGenResults, setAutoGenResults] = useState<{
    subProcesses: { total: number; created: number; existing: number; errors: number };
    processes: { total: number; created: number; existing: number; errors: number };
  } | null>(null);

  const handleMigrate = async () => {
    setShowConfirm(false);
    await migrateAllProcesses();
  };

  const handleAutoGenerate = async (forceRegenerate = false) => {
    setShowAutoGenConfirm(false);
    setShowForceRegenConfirm(false);
    const results = await generateAllMissingWorkflows(forceRegenerate);
    setAutoGenResults(results);
  };

  const successCount = migrationResults.filter(r => r.workflowCreated).length;
  const skipCount = migrationResults.filter(r => r.error === 'Workflow déjà existant').length;
  const errorCount = migrationResults.filter(r => r.error && r.error !== 'Workflow déjà existant').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Migration des Workflows
          </CardTitle>
          <CardDescription>
            Générer automatiquement des workflows pour tous les processus existants. 
            Cette opération crée un schéma de base avec les tâches et validations 
            définies dans chaque processus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
              <AlertDialogTrigger asChild>
                <Button disabled={isMigrating}>
                  {isMigrating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Migration en cours...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Lancer la migration
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la migration</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va générer des workflows par défaut pour tous les processus 
                    qui n'en ont pas encore. Les processus avec un workflow existant seront ignorés.
                    <br /><br />
                    <strong>Note :</strong> Les workflows générés seront en mode "brouillon" et 
                    devront être publiés manuellement après vérification.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleMigrate}>
                    Confirmer la migration
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {migrationResults.length > 0 && (
              <div className="flex gap-2">
                {successCount > 0 && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {successCount} créé(s)
                  </Badge>
                )}
                {skipCount > 0 && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {skipCount} ignoré(s)
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                    <XCircle className="h-3 w-3 mr-1" />
                    {errorCount} erreur(s)
                  </Badge>
                )}
              </div>
            )}
          </div>

          {migrationResults.length > 0 && (
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-4 space-y-2">
                {migrationResults.map((result, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {result.workflowCreated ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : result.error === 'Workflow déjà existant' ? (
                        <AlertCircle className="h-5 w-5 text-blue-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{result.processName}</p>
                        {result.error && (
                          <p className="text-sm text-muted-foreground">{result.error}</p>
                        )}
                      </div>
                    </div>
                    {result.workflowCreated && (
                      <Badge variant="secondary">
                        {result.nodesCreated} nœuds
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Auto-generation section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Génération automatique des workflows
          </CardTitle>
          <CardDescription>
            Crée automatiquement un workflow complet pour chaque processus et sous-processus, 
            incluant: Déclencheur → Tâches → Validation Manager → Notification → Fin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <AlertDialog open={showAutoGenConfirm} onOpenChange={setShowAutoGenConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Générer les workflows manquants
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Générer les workflows manquants</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va créer un workflow complet pour chaque processus et 
                    sous-processus qui n'en possède pas encore.
                    <br /><br />
                    <strong>Contenu généré :</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>🚀 Nœud Déclencheur (démarrage automatique)</li>
                      <li>📋 Nœuds Tâche pour chaque tâche existante</li>
                      <li>✅ Nœud Validation Manager</li>
                      <li>🔔 Nœud Notification de clôture</li>
                      <li>🏁 Nœud Fin</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleAutoGenerate(false)}>
                    Générer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showForceRegenConfirm} onOpenChange={setShowForceRegenConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isGenerating}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Régénérer TOUS les workflows
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">⚠️ Attention - Régénération complète</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va <strong>supprimer et recréer</strong> TOUS les workflows existants.
                    <br /><br />
                    <span className="text-destructive font-medium">
                      Toutes les personnalisations manuelles seront perdues !
                    </span>
                    <br /><br />
                    Utilisez cette option uniquement si vous souhaitez repartir d'une base propre.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => handleAutoGenerate(true)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Régénérer tout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {isGenerating && progress.total > 0 && (
            <div className="space-y-2">
              <Progress value={(progress.current / progress.total) * 100} />
              <p className="text-sm text-muted-foreground">
                {progress.current} / {progress.total} éléments traités
              </p>
            </div>
          )}

          {autoGenResults && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-medium">Sous-processus</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total : {autoGenResults.subProcesses.total}</div>
                  <div className="text-green-600">Créés : {autoGenResults.subProcesses.created}</div>
                  <div className="text-blue-600">Existants : {autoGenResults.subProcesses.existing}</div>
                  <div className="text-red-600">Erreurs : {autoGenResults.subProcesses.errors}</div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-3">
                  <Workflow className="h-4 w-4 text-primary" />
                  <span className="font-medium">Processus</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total : {autoGenResults.processes.total}</div>
                  <div className="text-green-600">Créés : {autoGenResults.processes.created}</div>
                  <div className="text-blue-600">Existants : {autoGenResults.processes.existing}</div>
                  <div className="text-red-600">Erreurs : {autoGenResults.processes.errors}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fonctionnement de la migration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-primary font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  1
                </span>
                Analyse
              </div>
              <p className="text-sm text-muted-foreground">
                Le système analyse chaque processus, ses sous-processus et tâches associées.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-primary font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  2
                </span>
                Génération
              </div>
              <p className="text-sm text-muted-foreground">
                Un workflow est créé avec les nœuds correspondants : Début, Tâches, Validations, Fin.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-primary font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  3
                </span>
                Vérification
              </div>
              <p className="text-sm text-muted-foreground">
                Les workflows sont créés en brouillon. Vérifiez et publiez-les manuellement.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg border bg-amber-500/10 border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Important</p>
                <p className="text-sm text-amber-700 mt-1">
                  Les paramètres d'affectation et de validation dans les sous-processus sont désormais 
                  en lecture seule. Toute la configuration se fait via l'éditeur de workflow.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
