import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle, Workflow, ArrowRight } from 'lucide-react';
import { useWorkflowMigration } from '@/hooks/useWorkflowMigration';
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
  const [showConfirm, setShowConfirm] = useState(false);

  const handleMigrate = async () => {
    setShowConfirm(false);
    await migrateAllProcesses();
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
                  Après la migration, les anciens paramètres de validation (N1/N2) dans les tâches 
                  seront masqués. Toute la logique de validation passera par le workflow.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
