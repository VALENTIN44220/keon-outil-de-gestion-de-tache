import { useState } from 'react';
import { 
  Upload, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  FileSpreadsheet,
  FolderSync,
  Stethoscope,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useGovernanceSync, GovernanceTableStatus } from '@/hooks/useGovernanceSync';
import { TableViewDialog } from './TableViewDialog';

const GOVERNANCE_TABLES = [
  { name: 'companies', label: 'Sociétés', fileName: 'APP_GESTION_COMPANIES.xlsx' },
  { name: 'departments', label: 'Services', fileName: 'APP_GESTION_DEPARTMENTS.xlsx' },
  { name: 'job_titles', label: 'Postes', fileName: 'APP_GESTION_JOB_TITLES.xlsx' },
  { name: 'hierarchy_levels', label: 'Hiérarchie', fileName: 'APP_GESTION_HIERARCHY_LEVELS.xlsx' },
  { name: 'permission_profiles', label: 'Droits', fileName: 'APP_GESTION_PERMISSION_PROFILES.xlsx' },
  { name: 'profiles', label: 'Utilisateurs', fileName: 'APP_GESTION_PROFILES.xlsx' },
  { name: 'assignment_rules', label: 'Affectation', fileName: 'APP_GESTION_ASSIGNMENT_RULES.xlsx' },
  { name: 'categories', label: 'Catégories', fileName: 'APP_GESTION_CATEGORIES.xlsx' },
];

export function GovernanceSyncTab() {
  const {
    isLoading,
    isDiagnosing,
    diagnostics,
    previewData,
    runDiagnostic,
    getPreview,
    clearPreview,
    exportToSharePoint,
    importFromSharePoint,
  } = useGovernanceSync();

  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set(GOVERNANCE_TABLES.map(t => t.name)));
  const [viewingTable, setViewingTable] = useState<{ name: string; label: string } | null>(null);

  const toggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedTables(newSelected);
  };

  const selectAll = () => setSelectedTables(new Set(GOVERNANCE_TABLES.map(t => t.name)));
  const deselectAll = () => setSelectedTables(new Set());

  const handleExport = async () => {
    const tables = selectedTables.size === GOVERNANCE_TABLES.length 
      ? undefined 
      : Array.from(selectedTables);
    await exportToSharePoint(tables);
  };

  const handleImport = async () => {
    const tables = selectedTables.size === GOVERNANCE_TABLES.length 
      ? undefined 
      : Array.from(selectedTables);
    await importFromSharePoint(tables);
  };

  const handlePreview = async () => {
    const tables = selectedTables.size === GOVERNANCE_TABLES.length 
      ? undefined 
      : Array.from(selectedTables);
    await getPreview(tables);
  };

  const getTableStatus = (tableName: string): GovernanceTableStatus | undefined => {
    return previewData?.find(t => t.name === tableName);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderSync className="h-5 w-5" />
            Synchronisation Gouvernance SharePoint
          </CardTitle>
          <CardDescription>
            Synchronisez les données d'organisation avec SharePoint 
            (site: <code className="text-xs bg-muted px-1 rounded">GOUVERNANCEDATA</code>)
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
              Diagnostic
            </Button>
            
            {diagnostics && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={diagnostics.siteId ? 'default' : 'destructive'}>
                  Site: {diagnostics.siteId ? '✓' : '✗'}
                </Badge>
                <Badge variant={diagnostics.driveId ? 'default' : 'destructive'}>
                  Drive: {diagnostics.driveId ? '✓' : '✗'}
                </Badge>
                <span className="text-muted-foreground">
                  {diagnostics.files.filter(f => f.exists).length}/{diagnostics.files.length} fichiers
                </span>
              </div>
            )}
          </div>

          {/* Table selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
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
                <Button variant="ghost" size="sm" onClick={clearPreview}>
                  Fermer aperçu
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {GOVERNANCE_TABLES.map((table) => {
                const status = getTableStatus(table.name);
                const fileInfo = diagnostics?.files.find(f => f.table === table.name);
                
                return (
                  <div
                    key={table.name}
                    className={`group flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                      selectedTables.has(table.name) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      id={table.name}
                      checked={selectedTables.has(table.name)}
                      onCheckedChange={() => toggleTable(table.name)}
                    />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setViewingTable({ name: table.name, label: table.label })}
                        className="font-medium text-sm hover:text-primary hover:underline text-left flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {table.label}
                      </button>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {table.fileName}
                      </p>
                      
                      {status && (
                        <div className="flex items-center gap-2 mt-1">
                          {status.fileExists ? (
                            <Badge variant="outline" className="text-xs">
                              <FileSpreadsheet className="h-3 w-3 mr-1" />
                              {status.excelCount}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Pas de fichier
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            DB: {status.dbCount}
                          </Badge>
                        </div>
                      )}
                      
                      {fileInfo && !status && (
                        <div className="mt-1">
                          {fileInfo.exists ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <Button
              onClick={handleExport}
              disabled={isLoading || selectedTables.size === 0}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Exporter vers SharePoint ({selectedTables.size})
            </Button>
            
            <Button
              variant="outline"
              onClick={handleImport}
              disabled={isLoading || selectedTables.size === 0}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Importer depuis SharePoint
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Emplacement des fichiers</h4>
            <p className="text-sm text-muted-foreground">
              Les fichiers sont stockés dans : <code className="bg-muted px-1 rounded">Documents/BDD/SOURCES/APP_GESTION_TASK/</code>
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Premier export</h4>
            <p className="text-sm text-muted-foreground">
              Si les fichiers n'existent pas, utilisez "Exporter vers SharePoint" pour créer les fichiers initiaux.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Ordre d'import recommandé</h4>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Sociétés (companies)</li>
              <li>Services (departments) - dépend de company_id</li>
              <li>Postes (job_titles) - dépend de department_id</li>
              <li>Hiérarchie (hierarchy_levels)</li>
              <li>Droits (permission_profiles)</li>
              <li>Utilisateurs (profiles) - dépend des tables précédentes</li>
              <li>Catégories (categories)</li>
              <li>Affectation (assignment_rules)</li>
            </ol>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Important :</strong> L'import met à jour les enregistrements existants (par ID) et crée les nouveaux. 
              Les suppressions doivent être effectuées manuellement.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Table View Dialog */}
      <TableViewDialog
        open={!!viewingTable}
        onOpenChange={(open) => !open && setViewingTable(null)}
        tableName={viewingTable?.name || ''}
        tableLabel={viewingTable?.label || ''}
      />
    </div>
  );
}
