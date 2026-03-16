import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const { user, isLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPostLoginChecking, setIsPostLoginChecking] = useState(false);
  const [showUnknownEmailOverlay, setShowUnknownEmailOverlay] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && !isPostLoginChecking) {
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
      // Post-login access check: ensure the email exists in profiles (allowlist pattern).
      // This prevents a brief redirect before we validate.
      setIsPostLoginChecking(true);

      try {
        const {
          data: { user: authedUser },
          error: getUserError,
        } = await supabase.auth.getUser();

        if (getUserError) throw getUserError;

        const email = authedUser?.email?.trim().toLowerCase();
        if (!email) {
          setShowUnknownEmailOverlay(true);
          await supabase.auth.signOut();
          return;
        }

        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('lovable_email', email)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profileRow) {
          setShowUnknownEmailOverlay(true);
          await supabase.auth.signOut();
          return;
        }

        toast({
          title: 'Connexion réussie',
          description: 'Bienvenue sur TaskFlow !',
        });
      } catch (err: any) {
        console.error('Post-login profile check failed:', err);
        toast({
          title: 'Erreur',
          description: err?.message ?? "Impossible de vérifier l'accès utilisateur.",
          variant: 'destructive',
        });
        await supabase.auth.signOut();
      } finally {
        setIsPostLoginChecking(false);
      }
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
      <AlertDialog open={showUnknownEmailOverlay} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accès refusé</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;email n&apos;existe pas dans la base de données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowUnknownEmailOverlay(false)}>
              Compris
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          En vous connectant, vous acceptez nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
}
