import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SharepointFile {
  id: string;
  name: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  mimeType: string | null;
  isFolder: boolean;
  childCount: number;
}

/** Codes d'erreur renvoyés par l'Edge Function sharepoint-list-files. */
export type SharepointErrorCode = 'NOT_CONNECTED' | 'SCOPE_MISSING' | 'MISSING_URL' | 'ERROR';

export class SharepointError extends Error {
  constructor(message: string, public readonly code: SharepointErrorCode) {
    super(message);
    this.name = 'SharepointError';
  }
}

/**
 * Liste les fichiers de la bibliothèque SharePoint liée à un projet IT.
 * Requiert une connexion Microsoft active avec scope Sites.Read.All.
 *
 * Erreurs typées :
 *  - code 'NOT_CONNECTED'  : aucun token Microsoft pour cet utilisateur
 *  - code 'SCOPE_MISSING'  : token présent mais scope SharePoint absent → reconnecter
 *  - code 'ERROR'          : autre erreur (URL invalide, site introuvable…)
 */
export function useSharepointFiles(sharepointUrl: string | null | undefined) {
  return useQuery<SharepointFile[], SharepointError>({
    queryKey: ['sharepoint-files', sharepointUrl],
    enabled: !!sharepointUrl,
    staleTime: 3 * 60 * 1000, // 3 min
    retry: (failureCount, error) => {
      // Ne pas retenter sur NOT_CONNECTED / SCOPE_MISSING
      if (error instanceof SharepointError && error.code !== 'ERROR') return false;
      return failureCount < 2;
    },
    queryFn: async (): Promise<SharepointFile[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const resp = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'sharepoint-list-files', sharepointUrl },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (resp.error) throw new SharepointError(resp.error.message, 'ERROR');

      const data = resp.data as { success: boolean; error?: string; message?: string; files?: SharepointFile[] };
      if (!data.success) {
        const code = (data.error as SharepointErrorCode) || 'ERROR';
        throw new SharepointError(data.message || 'Erreur SharePoint inconnue', code);
      }

      return data.files ?? [];
    },
  });
}
