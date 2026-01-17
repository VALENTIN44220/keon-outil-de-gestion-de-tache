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
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useFabricLakehouseSync, TablePreview, SyncResult } from '@/hooks/useFabricLakehouseSync';

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

export function FabricLakehouseSyncTab() {
  const {
    isLoading,
    isDiagnosing,
    diagnostics,
    previewData,
    lastSyncResult,
    runDiagnostic,
    getPreview,
    syncToLakehouse,
    clearPreview,
  } = useFabricLakehouseSync();

  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set(ALL_TABLES.map(t => t.name)));

  const toggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedTables(newSelected);
  };

  const selectAll = () => setSelectedTables(new Set(ALL_TABLES.map(t => t.name)));
  const deselectAll = () => setSelectedTables(new Set());

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

  const getTablePreview = (tableName: string): TablePreview | undefined => {
    return previewData?.find(t => t.table === tableName);
  };

  const getTableResult = (tableName: string): SyncResult | undefined => {
    return lastSyncResult?.results.find(r => r.table === tableName);
  };

  const totalRows = previewData?.reduce((sum, t) => sum + t.rowCount, 0) || 0;
  const syncProgress = lastSyncResult 
    ? (lastSyncResult.syncedTables / lastSyncResult.totalTables) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5" />
            Synchronisation Microsoft Fabric Lakehouse
          </CardTitle>
          <CardDescription>
            Exportez l'intégralité des données vers votre Lakehouse au format Delta pour analyse Power BI / Fabric
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
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {table.name}
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
