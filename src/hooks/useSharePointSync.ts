import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type SyncAction = 'import' | 'export' | 'sync';

export function useSharePointSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const executeSync = async (action: SyncAction) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sharepoint-excel-sync', {
        body: { action },
      });

      if (error) throw error;

      setLastSync(new Date());

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
    } catch (error: any) {
      console.error('SharePoint sync error:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error.message || 'Impossible de synchroniser avec SharePoint',
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

  return {
    isLoading,
    lastSync,
    importFromSharePoint,
    exportToSharePoint,
    fullSync,
  };
}
