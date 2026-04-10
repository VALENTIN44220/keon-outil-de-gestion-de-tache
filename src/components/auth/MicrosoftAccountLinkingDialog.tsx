import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Link2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  microsoftEmail: string | null;
  onLinked: () => void;   // called after successful link — parent triggers re-login
  onDenied: () => void;   // called when user gives up / access denied
}

type Phase = 'form' | 'linking' | 'success' | 'denied';

type LinkMicrosoftResponse = {
  success?: boolean;
  error?: string;
  detail?: string;
};

/** Edge Function errors are returned as JSON with non-2xx status; invoke() then sets data=null. */
async function resolveLinkMicrosoftPayload(
  data: LinkMicrosoftResponse | null,
  error: unknown,
): Promise<LinkMicrosoftResponse | null> {
  if (data && typeof data === 'object') return data;
  if (error instanceof FunctionsHttpError) {
    try {
      const parsed = (await error.context.clone().json()) as LinkMicrosoftResponse;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* not JSON */
    }
  }
  return null;
}

const ERROR_MESSAGES: Record<string, string> = {
  target_not_found:       "Aucun compte ne correspond à cet email. Vérifiez l'adresse ou contactez votre administrateur.",
  target_not_authorised:  "Ce compte n'est pas autorisé à accéder à l'application.",
  target_already_has_azure: "Un compte Microsoft est déjà associé à cet email.",
  already_has_profile:    "Cette session Microsoft a déjà un profil dans l'application. Déconnectez-vous et reconnectez-vous directement avec Microsoft.",
  not_an_azure_user:      "Cette session n'est pas une connexion Microsoft valide pour la liaison.",
  transfer_failed:        "La liaison a échoué côté serveur. Réessayez ou contactez votre administrateur.",
  internal_error:         "Erreur interne. Réessayez dans quelques instants.",
};

export function MicrosoftAccountLinkingDialog({ open, microsoftEmail, onLinked, onDenied }: Props) {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErrorMsg(null);
    setPhase('linking');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('no_session');

      const { data, error } = await supabase.functions.invoke<LinkMicrosoftResponse>(
        'link-microsoft-account',
        {
          headers: { Authorization: `Bearer ${token}` },
          body: { targetEmail: email.trim() },
        },
      );

      const payload = await resolveLinkMicrosoftPayload(data ?? null, error);

      if (!payload?.success) {
        const raw =
          (typeof payload?.error === 'string' ? payload.error : null) ??
          (error instanceof FunctionsHttpError ? null : error instanceof Error ? error.message : null) ??
          'internal_error';
        const code = typeof raw === 'string' ? raw.split(':')[0].trim() : 'internal_error';
        if (code === 'target_not_found' || code === 'target_not_authorised') {
          setPhase('denied');
        } else {
          const hint = typeof payload?.detail === 'string' ? ` (${payload.detail})` : '';
          setErrorMsg(
            (ERROR_MESSAGES[code] ?? ERROR_MESSAGES['internal_error']) + hint,
          );
          setPhase('form');
        }
        return;
      }

      // Identity transferred — sign out current (now deleted) user
      await supabase.auth.signOut().catch(() => {});
      setPhase('success');
    } catch (err: any) {
      setErrorMsg(ERROR_MESSAGES['internal_error']);
      setPhase('form');
    }
  };

  const handleReconnect = () => {
    onLinked();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && phase === 'form' && onDenied()}>
      <DialogContent className="max-w-md">

        {/* ── Form phase ── */}
        {(phase === 'form' || phase === 'linking') && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Lier votre compte Microsoft
              </DialogTitle>
              <DialogDescription className="text-left space-y-2 pt-1">
                {microsoftEmail ? (
                  <span>
                    Votre compte Microsoft (<strong>{microsoftEmail}</strong>) n'est pas encore
                    associé à un compte dans cette application.
                  </span>
                ) : (
                  <span>
                    Votre compte Microsoft n'est pas encore associé à un compte dans cette application.
                  </span>
                )}
                <br />
                Entrez l'email de votre compte existant pour les associer définitivement.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="link-email">Email de votre compte existant</Label>
                <Input
                  id="link-email"
                  type="email"
                  placeholder="prenom.nom@keon-group.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={phase === 'linking'}
                  autoFocus
                  required
                />
              </div>

              {errorMsg && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDenied}
                  disabled={phase === 'linking'}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={phase === 'linking' || !email.trim()}>
                  {phase === 'linking' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Associer les comptes
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {/* ── Success phase ── */}
        {phase === 'success' && (
          <>
            <DialogHeader>
              <div className="flex justify-center mb-2">
                <div className="p-3 rounded-full bg-green-100">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <DialogTitle className="text-center text-green-700">Comptes associés !</DialogTitle>
              <DialogDescription className="text-center pt-1">
                Votre compte Microsoft est maintenant lié à votre compte existant.
                <br />
                Reconnectez-vous avec le bouton Microsoft pour accéder à l'application.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="justify-center pt-2">
              <Button onClick={handleReconnect} className="w-full">
                Se reconnecter avec Microsoft
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Denied phase ── */}
        {phase === 'denied' && (
          <>
            <DialogHeader>
              <div className="flex justify-center mb-2">
                <div className="p-3 rounded-full bg-destructive/10">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
              </div>
              <DialogTitle className="text-center text-destructive">Accès refusé</DialogTitle>
              <DialogDescription className="text-center pt-1">
                L'email saisi ne correspond à aucun compte autorisé dans l'application.
                <br />
                Contactez votre administrateur système.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="justify-center pt-2">
              <Button variant="outline" onClick={onDenied}>
                Fermer
              </Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
