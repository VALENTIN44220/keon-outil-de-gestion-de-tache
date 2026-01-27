import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MicrosoftConnection {
  connected: boolean;
  email?: string;
  display_name?: string;
  is_calendar_sync_enabled?: boolean;
  is_email_sync_enabled?: boolean;
  last_sync_at?: string;
}

export function useMicrosoftConnection() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<MicrosoftConnection>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!user) {
      setConnection({ connected: false });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'check-connection' },
      });

      if (error) throw error;
      setConnection(data);
    } catch (error) {
      console.error('Error checking Microsoft connection:', error);
      setConnection({ connected: false });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const getAuthUrl = async (): Promise<string | null> => {
    try {
      const redirectUri = `${window.location.origin}/profile?tab=sync`;
      
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'get-auth-url', redirectUri },
      });

      if (error) throw error;
      return data.authUrl;
    } catch (error: any) {
      console.error('Error getting auth URL:', error);
      toast.error(`Erreur: ${error.message}`);
      return null;
    }
  };

  const exchangeCode = async (code: string): Promise<boolean> => {
    try {
      const redirectUri = `${window.location.origin}/profile?tab=sync`;
      
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'exchange-code', code, redirectUri },
      });

      if (error) throw error;
      
      toast.success(`Connecté à Microsoft: ${data.email}`);
      await checkConnection();
      return true;
    } catch (error: any) {
      console.error('Error exchanging code:', error);
      toast.error(`Erreur de connexion: ${error.message}`);
      return false;
    }
  };

  const syncCalendar = async (startDate?: string, endDate?: string): Promise<number> => {
    if (!connection.connected) {
      toast.error('Non connecté à Microsoft');
      return 0;
    }

    setIsSyncing(true);
    try {
      const start = startDate || new Date().toISOString();
      const end = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'sync-calendar', startDate: start, endDate: end },
      });

      if (error) throw error;
      
      toast.success(`${data.syncedEvents} événements synchronisés`);
      await checkConnection();
      return data.syncedEvents;
    } catch (error: any) {
      console.error('Error syncing calendar:', error);
      toast.error(`Erreur de synchronisation: ${error.message}`);
      return 0;
    } finally {
      setIsSyncing(false);
    }
  };

  const sendEmail = async (
    to: string[],
    subject: string,
    body: string,
    isHtml: boolean = true
  ): Promise<boolean> => {
    if (!connection.connected || !connection.is_email_sync_enabled) {
      toast.error('Email non configuré');
      return false;
    }

    try {
      const { error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'send-email', to, subject, body, isHtml },
      });

      if (error) throw error;
      
      toast.success('Email envoyé');
      return true;
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(`Erreur d'envoi: ${error.message}`);
      return false;
    }
  };

  const disconnect = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;
      
      toast.success('Déconnecté de Microsoft');
      setConnection({ connected: false });
      return true;
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast.error(`Erreur: ${error.message}`);
      return false;
    }
  };

  return {
    connection,
    isLoading,
    isSyncing,
    getAuthUrl,
    exchangeCode,
    syncCalendar,
    sendEmail,
    disconnect,
    refresh: checkConnection,
  };
}
