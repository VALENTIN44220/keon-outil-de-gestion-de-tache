import { useState } from 'react';
import { 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Database,
  CloudUpload,
  Stethoscope,
  BarChart3,
  Clock,
  Download,
  FileJson,
  ArrowDownToLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFabricLakehouseSync, TablePreview, SyncResult } from '@/hooks/useFabricLakehouseSync';

// Table prefix for Fabric Lakehouse
const TABLE_PREFIX = 'LOVABLE_APPTASK_';

const ALL_TABLES = [
  { name: 'assignment_rules', label: 'Règles d\'affectation' },
  { name: 'be_projects', label: 'Projets BE' },
  { name: 'be_request_details', label: 'Détails demandes BE' },
  { name: 'be_request_sub_processes', label: 'Sous-processus demandes BE' },
  { name: 'be_task_labels', label: 'Labels tâches BE' },
  { name: 'categories', label: 'Catégories' },
  { name: 'collaborator_group_members', label: 'Membres groupes' },
  { name: 'collaborator_groups', label: 'Groupes collaborateurs' },
  { name: 'companies', label: 'Sociétés' },
  { name: 'departments', label: 'Services' },
  { name: 'hierarchy_levels', label: 'Niveaux hiérarchiques' },
  { name: 'holidays', label: 'Jours fériés' },
  { name: 'job_titles', label: 'Postes' },
  { name: 'pending_task_assignments', label: 'Affectations en attente' },
  { name: 'permission_profiles', label: 'Profils permissions' },
  { name: 'process_template_visible_companies', label: 'Visibilité process/sociétés' },
  { name: 'process_template_visible_departments', label: 'Visibilité process/services' },
  { name: 'process_templates', label: 'Templates processus' },
  { name: 'profiles', label: 'Profils utilisateurs' },
  { name: 'request_field_values', label: 'Valeurs champs' },
  { name: 'sub_process_template_visible_companies', label: 'Visibilité sous-process/sociétés' },
  { name: 'sub_process_template_visible_departments', label: 'Visibilité sous-process/services' },
  { name: 'sub_process_templates', label: 'Templates sous-processus' },
  { name: 'subcategories', label: 'Sous-catégories' },
  { name: 'task_attachments', label: 'Pièces jointes' },
  { name: 'task_checklists', label: 'Checklists tâches' },
  { name: 'task_template_checklists', label: 'Checklists templates' },
  { name: 'task_template_visible_companies', label: 'Visibilité tâches/sociétés' },
  { name: 'task_template_visible_departments', label: 'Visibilité tâches/services' },
  { name: 'task_templates', label: 'Templates tâches' },
  { name: 'task_validation_levels', label: 'Niveaux validation' },
  { name: 'tasks', label: 'Tâches' },
  { name: 'template_custom_fields', label: 'Champs personnalisés' },
  { name: 'template_validation_levels', label: 'Niveaux validation templates' },
  { name: 'user_leaves', label: 'Congés' },
  { name: 'user_roles', label: 'Rôles utilisateurs' },
  { name: 'workload_slots', label: 'Créneaux charge' },
];

// Get Fabric table name with prefix
const getFabricTableName = (supabaseTableName: string): string => {
  return `${TABLE_PREFIX}${supabaseTableName}`;
};

export function FabricLakehouseSyncTab() {
  const {
    isLoading,
    isImporting,
    isDiagnosing,
    diagnostics,
    previewData,
    lastSyncResult,
    lastImportResult,
    availableImportFiles,
    runDiagnostic,
    getPreview,
    syncToLakehouse,
    importFromLakehouse,
    listImportFiles,
    clearPreview,
  } = useFabricLakehouseSync();

  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set(ALL_TABLES.map(t => t.name)));
  const [selectedImportTables, setSelectedImportTables] = useState<Set<string>>(new Set());

  const toggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedTables(newSelected);
  };

  const toggleImportTable = (tableName: string) => {
    const newSelected = new Set(selectedImportTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedImportTables(newSelected);
  };

  const selectAll = () => setSelectedTables(new Set(ALL_TABLES.map(t => t.name)));
  const deselectAll = () => setSelectedTables(new Set());

  const selectAllImport = () => setSelectedImportTables(new Set(availableImportFiles));
  const deselectAllImport = () => setSelectedImportTables(new Set());

  const handlePreview = async () => {
    const tables = selectedTables.size === ALL_TABLES.length 
      ? undefined 
      : Array.from(selectedTables);
    await getPreview(tables);
  };

  const handleSync = async () => {
    const tables = selectedTables.size === ALL_TABLES.length 
      ? undefined 
      : Array.from(selectedTables);
    await syncToLakehouse(tables);
  };

  const handleScanImportFiles = async () => {
    const result = await listImportFiles();
    if (result?.files?.length > 0) {
      setSelectedImportTables(new Set(result.files));
    }
  };

  const handleImport = async () => {
    const tables = Array.from(selectedImportTables);
    if (tables.length === 0) return;
    await importFromLakehouse(tables);
  };

  const getTablePreview = (tableName: string): TablePreview | undefined => {
    return previewData?.find(t => t.table === tableName);
  };

  const getTableResult = (tableName: string): SyncResult | undefined => {
    return lastSyncResult?.results.find(r => r.table === tableName);
  };

  const getTableImportResult = (tableName: string): SyncResult | undefined => {
    return lastImportResult?.results.find(r => r.table === tableName);
  };

  const totalRows = previewData?.reduce((sum, t) => sum + t.rowCount, 0) || 0;
  const syncProgress = lastSyncResult 
    ? (lastSyncResult.syncedTables / lastSyncResult.totalTables) * 100 
    : 0;
  const importProgress = lastImportResult
    ? (lastImportResult.importedTables / lastImportResult.totalTables) * 100
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Microsoft Fabric Lakehouse
          </CardTitle>
          <CardDescription>
            Synchronisez les données entre votre application et Microsoft Fabric Lakehouse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Diagnostic section */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Button
              variant="outline"
              onClick={runDiagnostic}
              disabled={isDiagnosing}
            >
              {isDiagnosing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Stethoscope className="h-4 w-4 mr-2" />
              )}
              Diagnostic connexion
            </Button>
            
            {diagnostics && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={diagnostics.success ? 'default' : 'destructive'}>
                  {diagnostics.success ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  OneLake: {diagnostics.success ? 'Connecté' : 'Erreur'}
                </Badge>
                {diagnostics.success && diagnostics.tablesCount && (
                  <span className="text-muted-foreground">
                    {diagnostics.tablesCount} tables disponibles
                  </span>
                )}
              </div>
            )}
          </div>

          <Tabs defaultValue="export" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export" className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4" />
                Exporter vers Fabric
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                Importer depuis Fabric
              </TabsTrigger>
            </TabsList>

            {/* EXPORT TAB */}
            <TabsContent value="export" className="space-y-6 mt-6">
              {/* Last sync result */}
              {lastSyncResult && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Dernière synchronisation
                    </span>
                    <Badge variant={lastSyncResult.success ? 'default' : 'destructive'}>
                      {lastSyncResult.syncedTables}/{lastSyncResult.totalTables} tables
                    </Badge>
                  </div>
                  <Progress value={syncProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {lastSyncResult.totalRows.toLocaleString()} lignes synchronisées
                  </p>
                </div>
              )}

              {/* Table selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Tout sélectionner
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Tout désélectionner
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handlePreview}
                    disabled={isLoading || selectedTables.size === 0}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Prévisualiser
                  </Button>
                  {previewData && (
                    <>
                      <Badge variant="secondary" className="ml-2">
                        <Database className="h-3 w-3 mr-1" />
                        {totalRows.toLocaleString()} lignes
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={clearPreview}>
                        Fermer aperçu
                      </Button>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-1">
                  {ALL_TABLES.map((table) => {
                    const preview = getTablePreview(table.name);
                    const result = getTableResult(table.name);
                    
                    return (
                      <div
                        key={table.name}
                        className={`flex items-center gap-2 p-2 border rounded-lg transition-colors text-sm ${
                          selectedTables.has(table.name) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          id={table.name}
                          checked={selectedTables.has(table.name)}
                          onCheckedChange={() => toggleTable(table.name)}
                        />
                        <div className="flex-1 min-w-0">
                          <label 
                            htmlFor={table.name}
                            className="font-medium cursor-pointer truncate block"
                          >
                            {table.label}
                          </label>
                          <p className="text-xs text-muted-foreground font-mono truncate" title={getFabricTableName(table.name)}>
                            {getFabricTableName(table.name)}
                          </p>
                        </div>
                        
                        {preview && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {preview.rowCount}
                          </Badge>
                        )}
                        
                        {result && (
                          result.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sync button */}
              <div className="flex items-center gap-4 pt-4 border-t">
                <Button
                  onClick={handleSync}
                  disabled={isLoading || selectedTables.size === 0 || !diagnostics?.success}
                  className="flex-1"
                  size="lg"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Synchroniser vers Fabric ({selectedTables.size} tables)
                </Button>
              </div>
            </TabsContent>

            {/* IMPORT TAB */}
            <TabsContent value="import" className="space-y-6 mt-6">
              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Import depuis Fabric :</strong> Placez vos fichiers JSON dans le dossier 
                  <code className="mx-1 px-1 bg-amber-200 dark:bg-amber-800 rounded">Files/_sync_back/</code>
                  du Lakehouse. Nommez-les avec le nom de la table (ex: <code className="px-1 bg-amber-200 dark:bg-amber-800 rounded">be_projects.json</code>).
                </p>
              </div>

              {/* Last import result */}
              {lastImportResult && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2">
                      <ArrowDownToLine className="h-4 w-4" />
                      Dernier import
                    </span>
                    <Badge variant={lastImportResult.success ? 'default' : 'destructive'}>
                      {lastImportResult.importedTables}/{lastImportResult.totalTables} tables
                    </Badge>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {lastImportResult.totalRows.toLocaleString()} lignes importées
                  </p>
                </div>
              )}

              {/* Scan for files */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={handleScanImportFiles}
                    disabled={isLoading || !diagnostics?.success}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileJson className="h-4 w-4 mr-2" />
                    )}
                    Scanner les fichiers
                  </Button>
                  
                  {availableImportFiles.length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={selectAllImport}>
                        Tout sélectionner
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllImport}>
                        Tout désélectionner
                      </Button>
                      <Badge variant="secondary" className="ml-2">
                        {availableImportFiles.length} fichiers trouvés
                      </Badge>
                    </>
                  )}
                </div>

                {availableImportFiles.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-1">
                    {availableImportFiles.map((tableName) => {
                      const tableInfo = ALL_TABLES.find(t => t.name === tableName);
                      const result = getTableImportResult(tableName);
                      
                      return (
                        <div
                          key={tableName}
                          className={`flex items-center gap-2 p-2 border rounded-lg transition-colors text-sm ${
                            selectedImportTables.has(tableName) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            id={`import-${tableName}`}
                            checked={selectedImportTables.has(tableName)}
                            onCheckedChange={() => toggleImportTable(tableName)}
                          />
                          <div className="flex-1 min-w-0">
                            <label 
                              htmlFor={`import-${tableName}`}
                              className="font-medium cursor-pointer truncate block"
                            >
                              {tableInfo?.label || tableName}
                            </label>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {tableName}.json
                            </p>
                          </div>
                          
                          {result && (
                            result.success ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                {result.rowCount !== undefined && result.rowCount > 0 && (
                                  <Badge variant="outline" className="text-xs">{result.rowCount}</Badge>
                                )}
                              </div>
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {availableImportFiles.length === 0 && diagnostics?.success && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileJson className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Cliquez sur "Scanner les fichiers" pour rechercher les fichiers à importer</p>
                  </div>
                )}
              </div>

              {/* Import button */}
              <div className="flex items-center gap-4 pt-4 border-t">
                <Button
                  onClick={handleImport}
                  disabled={isImporting || selectedImportTables.size === 0 || !diagnostics?.success}
                  className="flex-1"
                  size="lg"
                  variant="secondary"
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Importer depuis Fabric ({selectedImportTables.size} tables)
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Synchronisation planifiée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Format Delta :</strong> Les données sont exportées au format Delta Lake, 
              compatible avec Power BI, Azure Synapse et Microsoft Fabric.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Configuration requise dans Fabric</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Le Service Principal doit être activé dans les paramètres Admin Fabric</li>
              <li>Le Service Principal doit avoir le rôle <strong>Contributeur</strong> sur le Workspace</li>
              <li>Les tables apparaîtront dans la section <strong>Tables</strong> du Lakehouse</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Planification automatique</h4>
            <p className="text-sm text-muted-foreground">
              Pour automatiser la synchronisation, créez un <strong>Pipeline Fabric</strong> qui appelle 
              périodiquement cette fonction, ou utilisez une tâche CRON dans l'administration.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
