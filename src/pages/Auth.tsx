import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckSquare, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const { user, isLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Temporary notice: after Supabase auth migration, users must reset their password once.
  const [showPasswordMigrationNotice, setShowPasswordMigrationNotice] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Register form state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');

  useEffect(() => {
    // Default to "show" so the notice is visible right after the migration.
    const flag = import.meta.env.VITE_PASSWORD_MIGRATION_NOTICE ?? '1';
    const shouldShow = String(flag) === '1';
    if (!shouldShow) return;

    try {
      const dismissed = localStorage.getItem('password_migration_notice_dismissed');
      setShowPasswordMigrationNotice(dismissed !== '1');
    } catch {
      // If localStorage isn't available, just show the notice.
      setShowPasswordMigrationNotice(true);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleMicrosoftLogin = async () => {
    try {
      setIsSubmitting(true);

      const redirectTo =
        import.meta.env.VITE_AZURE_REDIRECT_URI || `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email',
          redirectTo,
        },
      });

      if (error) {
        toast({
          title: 'Erreur de connexion Microsoft',
          description: error.message,
          variant: 'destructive',
        });
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('Microsoft login error:', error);
      toast({
        title: 'Erreur de connexion Microsoft',
        description: error.message ?? 'Une erreur est survenue lors de la connexion Microsoft.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingReset(true);

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Email envoyé',
        description: 'Un lien de réinitialisation a été envoyé à votre adresse email.',
      });
      setShowForgotPassword(false);
      setForgotEmail('');
    }

    setIsSendingReset(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      toast({
        title: 'Erreur de connexion',
        description: error.message,
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    } else {
      toast({
        title: 'Connexion réussie',
        description: 'Bienvenue sur TaskFlow !',
      });
    }

    setIsSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await signUp(registerEmail, registerPassword, registerName);

    if (error) {
      toast({
        title: "Erreur d'inscription",
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Compte créé',
        description: 'Votre compte a été créé avec succès !',
      });
    }

    setIsSubmitting(false);
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
            <CardTitle>Connexion</CardTitle>
            <CardDescription>Connectez-vous à votre compte</CardDescription>
          </CardHeader>
          <CardContent>
            {showPasswordMigrationNotice && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-destructive">
                      Une migration a été effectuée
                    </p>
                    <p className="text-muted-foreground">
                      Pour finaliser l'accès à votre compte, utilisez « <span className="font-medium text-foreground">Mot de passe oublié</span> ».
                      Vous pouvez ré-enregistrer votre mot de passe avec le même mot de passe que précédemment.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setShowPasswordMigrationNotice(false);
                      try {
                        localStorage.setItem('password_migration_notice_dismissed', '1');
                      } catch {
                        // ignore
                      }
                    }}
                    aria-label="Fermer le message"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-4">
              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled
              >
                Se connecter avec Microsoft (en développement)
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span>ou avec email</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Mot de passe</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Se connecter
              </Button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </form>

            {showForgotPassword && (
              <div className="mt-4 pt-4 border-t border-border">
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Entrez votre adresse email pour recevoir un lien de réinitialisation.
                  </p>
                  <Input
                    type="email"
                    placeholder="votre@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    disabled={isSendingReset}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowForgotPassword(false)}
                      disabled={isSendingReset}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isSendingReset}>
                      {isSendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Envoyer
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          En vous connectant, vous acceptez nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
}
