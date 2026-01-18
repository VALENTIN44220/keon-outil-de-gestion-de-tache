import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FabricDiagnostics {
  success: boolean;
  workspaceId?: string;
  lakehouseId?: string;
  message: string;
  tablesCount?: number;
}

export interface TablePreview {
  table: string;
  rowCount: number;
  error?: string;
}

export interface SyncResult {
  table: string;
  success: boolean;
  rowCount?: number;
  error?: string;
}

export interface SyncResponse {
  success: boolean;
  syncedTables: number;
  totalTables: number;
  totalRows: number;
  results: SyncResult[];
}

export interface ImportResponse {
  success: boolean;
  importedTables: number;
  totalTables: number;
  totalRows: number;
  results: SyncResult[];
}

export interface ImportFilesResponse {
  success: boolean;
  files: string[];
  message?: string;
  error?: string;
}

export function useFabricLakehouseSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<FabricDiagnostics | null>(null);
  const [previewData, setPreviewData] = useState<TablePreview[] | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResponse | null>(null);
  const [lastImportResult, setLastImportResult] = useState<ImportResponse | null>(null);
  const [availableImportFiles, setAvailableImportFiles] = useState<string[]>([]);

  const runDiagnostic = async () => {
    setIsDiagnosing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fabric-lakehouse-sync', {
        body: { action: 'diagnose' },
      });

      if (error) throw error;

      setDiagnostics(data);
      
      if (data.success) {
        toast.success('Connexion au Lakehouse Fabric réussie');
      } else {
        toast.error(`Erreur: ${data.message}`);
      }
    } catch (error: any) {
      console.error('Diagnostic error:', error);
      toast.error(`Erreur de diagnostic: ${error.message}`);
      setDiagnostics({
        success: false,
        message: error.message,
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const getPreview = async (tables?: string[]) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fabric-lakehouse-sync', {
        body: { action: 'preview', tables },
      });

      if (error) throw error;

      setPreviewData(data.tables);
      toast.success(`${data.tables.length} tables à synchroniser (${data.totalRows} lignes)`);
    } catch (error: any) {
      console.error('Preview error:', error);
      toast.error(`Erreur de prévisualisation: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const syncToLakehouse = async (tables?: string[]) => {
    setIsLoading(true);
    setLastSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('fabric-lakehouse-sync', {
        body: { action: 'sync', tables },
      });

      if (error) throw error;

      setLastSyncResult(data);
      
      if (data.success) {
        toast.success(`Synchronisation réussie: ${data.syncedTables}/${data.totalTables} tables (${data.totalRows} lignes)`);
      } else {
        const failedCount = data.totalTables - data.syncedTables;
        toast.warning(`Synchronisation partielle: ${failedCount} tables en erreur`);
      }

      return data;
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(`Erreur de synchronisation: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearPreview = () => setPreviewData(null);

  const listImportFiles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fabric-lakehouse-sync', {
        body: { action: 'list-import-files' },
      });

      if (error) throw error;

      setAvailableImportFiles(data.files || []);
      
      if (data.files?.length > 0) {
        toast.success(`${data.files.length} fichiers disponibles pour import`);
      } else {
        toast.info(data.message || 'Aucun fichier trouvé');
      }

      return data;
    } catch (error: any) {
      console.error('List import files error:', error);
      toast.error(`Erreur: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const importFromLakehouse = async (tables?: string[]) => {
    setIsImporting(true);
    setLastImportResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('fabric-lakehouse-sync', {
        body: { action: 'import', tables },
      });

      if (error) throw error;

      setLastImportResult(data);
      
      if (data.success) {
        toast.success(`Import réussi: ${data.importedTables} tables (${data.totalRows} lignes)`);
      } else {
        const failedCount = data.results.filter((r: SyncResult) => !r.success).length;
        toast.warning(`Import partiel: ${failedCount} tables en erreur`);
      }

      return data;
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erreur d'import: ${error.message}`);
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  return {
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
  };
}
