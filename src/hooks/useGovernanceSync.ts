import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
export interface GovernanceTableStatus {
  name: string;
  label: string;
  fileName: string;
  fileExists?: boolean;
  dbCount?: number;
  excelCount?: number;
  error?: string;
}

export interface GovernanceDiagnostics {
  siteUrl: string;
  siteId: string;
  driveId: string;
  basePath: string;
  files: {
    table: string;
    fileName: string;
    exists: boolean;
    error?: string;
  }[];
}

export interface ExportResult {
  table: string;
  fileName?: string;
  count: number;
}

export function useGovernanceSync() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<GovernanceDiagnostics | null>(null);
  const [previewData, setPreviewData] = useState<GovernanceTableStatus[] | null>(null);

  // Invalidate all governance-related queries after import
  const invalidateGovernanceQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    queryClient.invalidateQueries({ queryKey: ['job-titles'] });
    queryClient.invalidateQueries({ queryKey: ['hierarchy-levels'] });
    queryClient.invalidateQueries({ queryKey: ['permission-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['assignment-rules'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['admin-data'] });
  };

  const runDiagnostic = async () => {
    setIsDiagnosing(true);
    setDiagnostics(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sharepoint-governance-sync', {
        body: { action: 'diagnose' },
      });

      if (error) throw error;
      
      setDiagnostics(data.diagnostics);
      
      const allExist = data.diagnostics.files.every((f: any) => f.exists);
      const someExist = data.diagnostics.files.some((f: any) => f.exists);
      
      if (allExist) {
        toast({
          title: 'Diagnostic réussi',
          description: 'Tous les fichiers sont accessibles',
        });
      } else if (someExist) {
        toast({
          title: 'Diagnostic partiel',
          description: 'Certains fichiers sont manquants',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Aucun fichier trouvé',
          description: 'Les fichiers n\'existent pas encore sur SharePoint',
        });
      }
      
      return data.diagnostics;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur de diagnostic';
      toast({
        title: 'Erreur de diagnostic',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsDiagnosing(false);
    }
  };

  const getPreview = async (tables?: string[]) => {
    setIsLoading(true);
    setPreviewData(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sharepoint-governance-sync', {
        body: { action: 'preview', tables },
      });

      if (error) throw error;
      
      setPreviewData(data.tables);
      return data.tables;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur de prévisualisation';
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const exportToSharePoint = async (tables?: string[]) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sharepoint-governance-sync', {
        body: { action: 'export', tables },
      });

      if (error) throw error;
      
      const exportedCount = data.exported?.reduce((sum: number, t: ExportResult) => sum + t.count, 0) || 0;
      const errorCount = data.errors?.length || 0;
      
      if (errorCount > 0) {
        toast({
          title: 'Export partiel',
          description: `${exportedCount} enregistrements exportés, ${errorCount} erreur(s)`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Export terminé',
          description: `${data.exported?.length || 0} fichiers créés sur SharePoint`,
        });
      }
      
      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur d\'export';
      toast({
        title: 'Erreur d\'export',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const importFromSharePoint = async (tables?: string[]) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sharepoint-governance-sync', {
        body: { action: 'import', tables },
      });

      if (error) throw error;
      
      const importedCount = data.imported?.reduce((sum: number, t: ExportResult) => sum + t.count, 0) || 0;
      const updatedCount = data.updated?.reduce((sum: number, t: ExportResult) => sum + t.count, 0) || 0;
      const errorCount = data.errors?.length || 0;
      
      if (errorCount > 0) {
        toast({
          title: 'Import partiel',
          description: `${importedCount} créés, ${updatedCount} mis à jour, ${errorCount} erreur(s)`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Import terminé',
          description: `${importedCount} créés, ${updatedCount} mis à jour`,
        });
      }
      
      // Invalidate all related queries to refresh the UI
      invalidateGovernanceQueries();
      
      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur d\'import';
      toast({
        title: 'Erreur d\'import',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearPreview = () => setPreviewData(null);

  return {
    isLoading,
    isDiagnosing,
    diagnostics,
    previewData,
    runDiagnostic,
    getPreview,
    clearPreview,
    exportToSharePoint,
    importFromSharePoint,
  };
}
