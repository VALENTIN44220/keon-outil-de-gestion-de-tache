import { useState } from 'react';
import { CheckSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Landing page for invited users.
 *
 * Supabase's inviteUserByEmail sends an email whose link resolves to this page
 * (via /auth/callback?code=xxx, then redirected here, OR directly via redirectTo).
 *
 * We intentionally do NOT exchange the invite code here — instead, we send the
 * user through the Microsoft Azure OAuth flow so that their Supabase identity
 * is bound to their Azure account from the very first sign-in.
 *
 * ⚠️  Prerequisite: in the Supabase dashboard (Authentication → Configuration)
 *     "Enable linking of OAuth identities" must be ON so that Azure sign-in with
 *     the same email is automatically linked to the invited user record.
 */
export default function AcceptInvite() {
  const [isLoading, setIsLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    const redirectTo =
      import.meta.env.VITE_AZURE_REDIRECT_URI || `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes:
          'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite Tasks.Read Tasks.ReadWrite Group.Read.All Team.ReadBasic.All',
        redirectTo,
      },
    });

    if (error) {
      console.error('Microsoft login error:', error);
      setIsLoading(false);
    }
    // On success the browser is redirected to Azure — no need to reset loading state.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-primary">
            <CheckSquare className="h-10 w-10" />
            <span className="text-3xl font-bold">TaskFlow</span>
          </div>
          <p className="text-muted-foreground">Gérez vos tâches efficacement</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle>Vous avez été invité !</CardTitle>
            <CardDescription>
              Pour activer votre compte et accéder à l'application, connectez-vous avec votre
              compte <strong>Microsoft Azure</strong> associé à l'adresse email sur laquelle
              vous avez reçu cette invitation.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              type="button"
              className="group relative w-full overflow-hidden border-border/70 bg-gradient-to-r from-slate-50 to-white text-foreground shadow-sm transition-all hover:border-primary/40 hover:shadow-md dark:from-slate-900 dark:to-slate-800"
              variant="outline"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-[#0078D4] transition-all group-hover:w-1.5" />
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion Microsoft...
                </>
              ) : (
                <>
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[#0078D4] text-[10px] font-bold text-white">
                    M
                  </span>
                  Continuer avec Microsoft
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Connexion SSO Microsoft 365 sécurisée — aucun mot de passe requis.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
