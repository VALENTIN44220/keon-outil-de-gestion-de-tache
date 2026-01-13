import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type SyncAction = 'import' | 'export' | 'sync';

interface PreviewProject {
  code_projet: string;
  nom_projet: string;
  adresse_site?: string | null;
  siret?: string | null;
  status?: string;
  [key: string]: string | null | undefined;
}

export interface PreviewData {
  toImport: PreviewProject[];
  toUpdate: {
    current: PreviewProject;
    incoming: PreviewProject;
    changes: string[];
  }[];
  toExport: PreviewProject[];
  unchanged: number;
}

export function useSharePointSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  const getPreview = async (action: SyncAction): Promise<PreviewData | null> => {
    setIsPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sharepoint-excel-sync', {
        body: { action, preview: true },
      });

      if (error) throw error;
      
      setPreviewData(data.preview);
      return data.preview;
    } catch (error: unknown) {
      console.error('SharePoint preview error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Impossible de charger la prévisualisation';
      toast({
        title: 'Erreur de prévisualisation',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const executeSync = async (action: SyncAction) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sharepoint-excel-sync', {
        body: { action, preview: false },
      });

      if (error) throw error;

      setLastSync(new Date());
      setPreviewData(null);

      const messages = {
        import: `Import terminé: ${data.imported} nouveaux, ${data.updated} mis à jour`,
        export: `Export terminé: ${data.exported} projets exportés`,
        sync: `Synchronisation terminée: ${data.imported} importés, ${data.updated} mis à jour`,
      };

      toast({
        title: 'Synchronisation SharePoint',
        description: messages[action],
      });

      return data;
    } catch (error: unknown) {
      console.error('SharePoint sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Impossible de synchroniser avec SharePoint';
      toast({
        title: 'Erreur de synchronisation',
        description: errorMessage,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const importFromSharePoint = () => executeSync('import');
  const exportToSharePoint = () => executeSync('export');
  const fullSync = () => executeSync('sync');

  const clearPreview = () => setPreviewData(null);

  return {
    isLoading,
    isPreviewLoading,
    lastSync,
    previewData,
    getPreview,
    clearPreview,
    importFromSharePoint,
    exportToSharePoint,
    fullSync,
  };
}
