import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type CallbackStatus = 'processing' | 'success' | 'error';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth error
      if (error) {
        console.error('OAuth error:', error, errorDescription);
        setStatus('error');
        setErrorMessage(errorDescription || error);
        toast.error(`Erreur d'authentification: ${errorDescription || error}`);
        return;
      }

      // No code means invalid callback
      if (!code) {
        setStatus('error');
        setErrorMessage('Code d\'autorisation manquant');
        return;
      }

      try {
        // Determine the provider from state or default to Microsoft
        const provider = state?.includes('microsoft') ? 'microsoft' : 'microsoft';

        if (provider === 'microsoft') {
          // Exchange the code for tokens via edge function
          const redirectUri = `${window.location.origin}/auth/callback`;
          
          const { data, error: exchangeError } = await supabase.functions.invoke('microsoft-graph', {
            body: { action: 'exchange-code', code, redirectUri },
          });

          if (exchangeError) throw exchangeError;

          setStatus('success');
          toast.success(`Connecté à Microsoft: ${data.email}`);
          
          // Redirect to calendar or profile after success
          setTimeout(() => {
            navigate('/calendar');
          }, 1500);
        }
      } catch (err: any) {
        console.error('Callback error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Erreur lors de l\'échange du code');
        toast.error(`Erreur: ${err.message}`);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'processing' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle>Connexion en cours...</CardTitle>
              <CardDescription>
                Veuillez patienter pendant que nous finalisons la connexion.
              </CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-success/10">
                  <CheckCircle2 className="h-12 w-12 text-success" />
                </div>
              </div>
              <CardTitle className="text-success">Connexion réussie !</CardTitle>
              <CardDescription>
                Redirection vers le calendrier...
              </CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-destructive/10">
                  <XCircle className="h-12 w-12 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-destructive">Erreur de connexion</CardTitle>
              <CardDescription className="text-destructive/80">
                {errorMessage}
              </CardDescription>
            </>
          )}
        </CardHeader>

        {status === 'error' && (
          <CardContent className="flex flex-col gap-2">
            <Button onClick={() => navigate('/profile?tab=sync')} variant="outline">
              Retourner aux paramètres
            </Button>
            <Button onClick={() => navigate('/calendar')} variant="ghost">
              Aller au calendrier
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default AuthCallback;
