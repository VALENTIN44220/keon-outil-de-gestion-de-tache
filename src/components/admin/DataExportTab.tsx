import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ExportTable {
  name: string;
  label: string;
  description: string;
}

const EXPORTABLE_TABLES: ExportTable[] = [
  { name: 'companies', label: 'Sociétés', description: 'Liste des sociétés' },
  { name: 'departments', label: 'Services', description: 'Liste des services' },
  { name: 'job_titles', label: 'Fonctions', description: 'Liste des fonctions' },
  { name: 'hierarchy_levels', label: 'Niveaux hiérarchiques', description: 'Niveaux de la hiérarchie' },
  { name: 'permission_profiles', label: 'Profils de permissions', description: 'Profils de droits utilisateurs' },
  { name: 'profiles', label: 'Utilisateurs', description: 'Profils des utilisateurs' },
  { name: 'categories', label: 'Catégories', description: 'Catégories de tâches' },
  { name: 'subcategories', label: 'Sous-catégories', description: 'Sous-catégories de tâches' },
  { name: 'process_templates', label: 'Processus', description: 'Modèles de processus' },
  { name: 'sub_process_templates', label: 'Sous-processus', description: 'Modèles de sous-processus' },
  { name: 'task_templates', label: 'Modèles de tâches', description: 'Modèles de tâches' },
  { name: 'task_template_checklists', label: 'Checklists modèles', description: 'Sous-actions des modèles' },
  { name: 'be_projects', label: 'Projets BE', description: 'Projets Bureau d\'Études' },
  { name: 'be_task_labels', label: 'Labels BE', description: 'Labels des tâches BE' },
  { name: 'assignment_rules', label: 'Règles d\'affectation', description: 'Règles d\'assignation automatique' },
  { name: 'tasks', label: 'Tâches', description: 'Toutes les tâches' },
  { name: 'task_checklists', label: 'Checklists tâches', description: 'Sous-actions des tâches' },
];

function convertToCSV(data: any[], tableName: string): string {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(';')];
  
  for (const row of data) {
    const values = headers.map(header => {
      let value = row[header];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      // Escape quotes and wrap in quotes if contains separator or quotes
      const stringValue = String(value);
      if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(';'));
  }
  
  return csvRows.join('\n');
}

function downloadFile(content: string, filename: string, type: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataExportTab() {
  const { toast } = useToast();
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const toggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedTables(newSelected);
  };

  const selectAll = () => {
    setSelectedTables(new Set(EXPORTABLE_TABLES.map(t => t.name)));
  };

  const deselectAll = () => {
    setSelectedTables(new Set());
  };

  const exportSingleTable = async (tableName: string) => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: 'Table vide',
          description: `La table ${tableName} ne contient pas de données`,
          variant: 'destructive',
        });
        return;
      }

      const timestamp = new Date().toISOString().split('T')[0];
      
      if (exportFormat === 'csv') {
        const csv = convertToCSV(data, tableName);
        downloadFile(csv, `${tableName}_${timestamp}.csv`, 'text/csv');
      } else {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `${tableName}_${timestamp}.json`, 'application/json');
      }

      toast({
        title: 'Export réussi',
        description: `${data.length} enregistrements exportés`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Erreur d\'export',
        description: error.message || 'Impossible d\'exporter les données',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportSelectedTables = async () => {
    if (selectedTables.size === 0) {
      toast({
        title: 'Aucune table sélectionnée',
        description: 'Veuillez sélectionner au moins une table à exporter',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    const timestamp = new Date().toISOString().split('T')[0];
    let successCount = 0;

    try {
      for (const tableName of selectedTables) {
        const { data, error } = await supabase
          .from(tableName as any)
          .select('*');

        if (error) {
          console.error(`Error exporting ${tableName}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          if (exportFormat === 'csv') {
            const csv = convertToCSV(data, tableName);
            downloadFile(csv, `${tableName}_${timestamp}.csv`, 'text/csv');
          } else {
            const json = JSON.stringify(data, null, 2);
            downloadFile(json, `${tableName}_${timestamp}.json`, 'application/json');
          }
          successCount++;
        }
      }

      toast({
        title: 'Export terminé',
        description: `${successCount} table(s) exportée(s) avec succès`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Erreur d\'export',
        description: error.message || 'Erreur lors de l\'export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export des données
          </CardTitle>
          <CardDescription>
            Exportez les tables de la base de données au format CSV ou JSON pour les modifier et les réimporter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Format selection */}
          <div className="flex items-center gap-4">
            <Label>Format d'export :</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={() => setExportFormat('csv')}
                  className="w-4 h-4"
                />
                <span>CSV (Excel)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={() => setExportFormat('json')}
                  className="w-4 h-4"
                />
                <span>JSON</span>
              </label>
            </div>
          </div>

          {/* Selection buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Tout sélectionner
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Tout désélectionner
            </Button>
            <Button 
              onClick={exportSelectedTables} 
              disabled={isExporting || selectedTables.size === 0}
              className="ml-auto"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exporter la sélection ({selectedTables.size})
            </Button>
          </div>

          {/* Table list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXPORTABLE_TABLES.map((table) => (
              <div
                key={table.name}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={table.name}
                  checked={selectedTables.has(table.name)}
                  onCheckedChange={() => toggleTable(table.name)}
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={table.name}
                    className="font-medium cursor-pointer"
                  >
                    {table.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{table.description}</p>
                  <p className="text-xs text-muted-foreground font-mono">{table.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => exportSingleTable(table.name)}
                  disabled={isExporting}
                  className="shrink-0"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions pour l'import</CardTitle>
          <CardDescription>
            Comment préparer vos fichiers pour un import en masse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Format CSV</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Utilisez le point-virgule (;) comme séparateur</li>
              <li>Encodage UTF-8 avec BOM</li>
              <li>La première ligne contient les noms des colonnes</li>
              <li>Les UUID doivent rester au format standard (ex: 123e4567-e89b-12d3-a456-426614174000)</li>
              <li>Les dates au format ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)</li>
              <li>Les booléens : true/false</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Ordre d'import recommandé</h4>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>companies (Sociétés)</li>
              <li>departments (Services) - référence company_id</li>
              <li>job_titles (Fonctions) - référence department_id</li>
              <li>hierarchy_levels (Niveaux hiérarchiques)</li>
              <li>permission_profiles (Profils de permissions)</li>
              <li>profiles (Utilisateurs) - référence les tables précédentes</li>
              <li>categories puis subcategories</li>
              <li>process_templates puis sub_process_templates puis task_templates</li>
            </ol>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Important :</strong> Pour l'import, contactez l'administrateur système ou utilisez l'outil SQL de Supabase. 
              Un import mal configuré peut corrompre les données existantes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
