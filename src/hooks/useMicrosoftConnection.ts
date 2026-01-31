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

// PKCE Helper functions
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);
  return { codeVerifier, codeChallenge };
}

// Storage keys for PKCE
const PKCE_VERIFIER_KEY = 'microsoft_oauth_code_verifier';

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
      // Generate PKCE values
      const { codeVerifier, codeChallenge } = await generatePKCE();
      
      // Store code verifier for later use during token exchange
      sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
      
      // Use dedicated callback route for OAuth
      const redirectUri = `${window.location.origin}/auth/callback`;
      
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { 
          action: 'get-auth-url', 
          redirectUri,
          codeChallenge,
          codeChallengeMethod: 'S256',
        },
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
      // Retrieve the code verifier from session storage
      const codeVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
      
      if (!codeVerifier) {
        throw new Error('Code verifier not found. Please restart the authentication flow.');
      }
      
      // Use dedicated callback route for OAuth
      const redirectUri = `${window.location.origin}/auth/callback`;
      
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { 
          action: 'exchange-code', 
          code, 
          redirectUri,
          codeVerifier,
        },
      });

      if (error) throw error;
      
      // Clean up the stored verifier
      sessionStorage.removeItem(PKCE_VERIFIER_KEY);
      
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
