import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Play, CheckCircle2, XCircle, AlertCircle, 
  Workflow, Layers, RefreshCw, GitFork, Search 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useWorkflowMigration } from '@/hooks/useWorkflowMigration';
import { useWorkflowAutoGeneration } from '@/hooks/useWorkflowAutoGeneration';
import { supabase } from '@/integrations/supabase/client';
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

interface ProcessItem {
  id: string;
  name: string;
  subProcessCount: number;
}

interface SubProcessItem {
  id: string;
  name: string;
  processName: string;
}

export function WorkflowMigrationTab() {
  const { isMigrating, migrationResults, migrateAllProcesses } = useWorkflowMigration();
  const { generateAllMissingWorkflows, isGenerating, progress } = useWorkflowAutoGeneration();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSelectiveRegenConfirm, setShowSelectiveRegenConfirm] = useState(false);
  const [autoGenResults, setAutoGenResults] = useState<{
    subProcesses: { total: number; created: number; existing: number; errors: number };
    processes: { total: number; created: number; existing: number; errors: number };
  } | null>(null);

  // Selection state
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcessItem[]>([]);
  const [selectedProcessIds, setSelectedProcessIds] = useState<string[]>([]);
  const [selectedSubProcessIds, setSelectedSubProcessIds] = useState<string[]>([]);
  const [processSearch, setProcessSearch] = useState('');
  const [subProcessSearch, setSubProcessSearch] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch processes and sub-processes for selection
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [{ data: processData }, { data: subProcessData }] = await Promise.all([
          supabase
            .from('process_templates')
            .select('id, name, sub_process_templates(id)')
            .order('name'),
          supabase
            .from('sub_process_templates')
            .select('id, name, process_templates(name)')
            .order('name'),
        ]);

        setProcesses(
          (processData || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            subProcessCount: p.sub_process_templates?.length || 0,
          }))
        );

        setSubProcesses(
          (subProcessData || []).map((sp: any) => ({
            id: sp.id,
            name: sp.name,
            processName: sp.process_templates?.name || 'N/A',
          }))
        );
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  const handleMigrate = async () => {
    setShowConfirm(false);
    await migrateAllProcesses();
  };

  const handleSelectiveRegenerate = async () => {
    setShowSelectiveRegenConfirm(false);
    const results = await generateAllMissingWorkflows(true, {
      processIds: selectedProcessIds.length > 0 ? selectedProcessIds : undefined,
      subProcessIds: selectedSubProcessIds.length > 0 ? selectedSubProcessIds : undefined,
    });
    setAutoGenResults(results);
    // Clear selection after regeneration
    setSelectedProcessIds([]);
    setSelectedSubProcessIds([]);
  };

  const handleGenerateMissing = async () => {
    const results = await generateAllMissingWorkflows(false);
    setAutoGenResults(results);
  };

  const toggleProcessSelection = (id: string) => {
    setSelectedProcessIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSubProcessSelection = (id: string) => {
    setSelectedSubProcessIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllProcesses = () => {
    const filtered = filteredProcesses.map(p => p.id);
    const allSelected = filtered.every(id => selectedProcessIds.includes(id));
    if (allSelected) {
      setSelectedProcessIds(prev => prev.filter(id => !filtered.includes(id)));
    } else {
      setSelectedProcessIds(prev => [...new Set([...prev, ...filtered])]);
    }
  };

  const selectAllSubProcesses = () => {
    const filtered = filteredSubProcesses.map(sp => sp.id);
    const allSelected = filtered.every(id => selectedSubProcessIds.includes(id));
    if (allSelected) {
      setSelectedSubProcessIds(prev => prev.filter(id => !filtered.includes(id)));
    } else {
      setSelectedSubProcessIds(prev => [...new Set([...prev, ...filtered])]);
    }
  };

  const filteredProcesses = processes.filter(p =>
    p.name.toLowerCase().includes(processSearch.toLowerCase())
  );

  const filteredSubProcesses = subProcesses.filter(sp =>
    sp.name.toLowerCase().includes(subProcessSearch.toLowerCase()) ||
    sp.processName.toLowerCase().includes(subProcessSearch.toLowerCase())
  );

  const successCount = migrationResults.filter(r => r.workflowCreated).length;
  const skipCount = migrationResults.filter(r => r.error === 'Workflow déjà existant').length;
  const errorCount = migrationResults.filter(r => r.error && r.error !== 'Workflow déjà existant').length;

  const totalSelected = selectedProcessIds.length + selectedSubProcessIds.length;

  return (
    <div className="space-y-6">
      {/* Selective Regeneration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitFork className="h-5 w-5" />
            Régénération sélective des workflows
          </CardTitle>
          <CardDescription>
            Sélectionnez les processus et/ou sous-processus dont vous souhaitez régénérer les workflows.
            Les processus avec plusieurs sous-processus utilisent un pattern Fork/Join pour l'exécution parallèle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="processes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="processes" className="flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                Processus ({selectedProcessIds.length}/{processes.length})
              </TabsTrigger>
              <TabsTrigger value="subprocesses" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Sous-processus ({selectedSubProcessIds.length}/{subProcesses.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="processes" className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un processus..."
                    value={processSearch}
                    onChange={(e) => setProcessSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={selectAllProcesses}>
                  {filteredProcesses.every(p => selectedProcessIds.includes(p.id))
                    ? 'Désélectionner tout'
                    : 'Sélectionner tout'}
                </Button>
              </div>

              <ScrollArea className="h-[250px] rounded-md border">
                {isLoadingData ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="p-3 space-y-1">
                    {filteredProcesses.map((process) => (
                      <div
                        key={process.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedProcessIds.includes(process.id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                        onClick={() => toggleProcessSelection(process.id)}
                      >
                        <Checkbox
                          checked={selectedProcessIds.includes(process.id)}
                          onCheckedChange={() => toggleProcessSelection(process.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{process.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {process.subProcessCount} sous-processus
                          </p>
                        </div>
                        {process.subProcessCount > 1 && (
                          <Badge variant="outline" className="text-xs">
                            <GitFork className="h-3 w-3 mr-1" />
                            Fork/Join
                          </Badge>
                        )}
                      </div>
                    ))}
                    {filteredProcesses.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Aucun processus trouvé
                      </p>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="subprocesses" className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un sous-processus..."
                    value={subProcessSearch}
                    onChange={(e) => setSubProcessSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={selectAllSubProcesses}>
                  {filteredSubProcesses.every(sp => selectedSubProcessIds.includes(sp.id))
                    ? 'Désélectionner tout'
                    : 'Sélectionner tout'}
                </Button>
              </div>

              <ScrollArea className="h-[250px] rounded-md border">
                {isLoadingData ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="p-3 space-y-1">
                    {filteredSubProcesses.map((sp) => (
                      <div
                        key={sp.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedSubProcessIds.includes(sp.id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                        onClick={() => toggleSubProcessSelection(sp.id)}
                      >
                        <Checkbox
                          checked={selectedSubProcessIds.includes(sp.id)}
                          onCheckedChange={() => toggleSubProcessSelection(sp.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{sp.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {sp.processName}
                          </p>
                        </div>
                      </div>
                    ))}
                    {filteredSubProcesses.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Aucun sous-processus trouvé
                      </p>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-4 pt-2 border-t">
            <AlertDialog open={showSelectiveRegenConfirm} onOpenChange={setShowSelectiveRegenConfirm}>
              <AlertDialogTrigger asChild>
                <Button 
                  disabled={isGenerating || totalSelected === 0}
                  variant="default"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Régénérer la sélection ({totalSelected})
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">
                    ⚠️ Régénérer les workflows sélectionnés
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va <strong>supprimer et recréer</strong> les workflows pour :
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {selectedProcessIds.length > 0 && (
                        <li>{selectedProcessIds.length} processus</li>
                      )}
                      {selectedSubProcessIds.length > 0 && (
                        <li>{selectedSubProcessIds.length} sous-processus</li>
                      )}
                    </ul>
                    <br />
                    <span className="text-destructive font-medium">
                      Les personnalisations manuelles seront perdues !
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleSelectiveRegenerate}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Régénérer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button 
              variant="outline" 
              disabled={isGenerating}
              onClick={handleGenerateMissing}
            >
              <Play className="h-4 w-4 mr-2" />
              Générer les manquants uniquement
            </Button>
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

      {/* Legacy Migration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Migration des Workflows (Legacy)
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
                <Button variant="outline" disabled={isMigrating}>
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
            <ScrollArea className="h-[200px] rounded-md border">
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

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Fonctionnement de la génération</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-primary font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  1
                </span>
                Sous-processus unique
              </div>
              <p className="text-sm text-muted-foreground">
                Début → Tâches → Validation → Notification → Fin
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-primary font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  2
                </span>
                Multi sous-processus
              </div>
              <p className="text-sm text-muted-foreground">
                Début → <strong>Fork</strong> → [SP parallèles] → <strong>Join</strong> → Fin
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-primary font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                  3
                </span>
                Fork/Join
              </div>
              <p className="text-sm text-muted-foreground">
                Exécution parallèle des sous-processus avec synchronisation finale.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg border bg-amber-500/10 border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Important</p>
                <p className="text-sm text-amber-700 mt-1">
                  Les workflows générés sont en brouillon. Vérifiez et publiez-les via l'éditeur de workflow.
                  La régénération supprime les personnalisations existantes.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
