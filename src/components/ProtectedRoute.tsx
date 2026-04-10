import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Loader2 } from 'lucide-react';
import { AccessRestrictedDialog } from './auth/AccessRestrictedDialog';
import { MicrosoftAccountLinkingDialog } from './auth/MicrosoftAccountLinkingDialog';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type ProfileGateRow = {
  id: string;
  lovable_status: string | null;
  permission_profile_id: string | null;
  id_lucca: string | null;
};

/** Profil synchronisé / invité dans l’app (droit d’accès métier), pas un bootstrap local ou fantôme trigger. */
function isKeonProvisionedProfile(row: ProfileGateRow): boolean {
  return Boolean(row.permission_profile_id || row.id_lucca);
}

function displayNameFromUser(user: User) {
  const meta = user.user_metadata ?? {};
  return (
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.display_name === 'string' && meta.display_name) ||
    (typeof meta.preferred_username === 'string' && meta.preferred_username) ||
    (user.email ? user.email.split('@')[0] : null) ||
    'Utilisateur'
  );
}

/** Returns true when the current Supabase session was initiated via Microsoft (azure). */
function isAzureSession(user: User): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.provider === 'azure') return true;

  const provs = meta.providers;
  if (Array.isArray(provs) && provs.includes('azure')) return true;
  if (typeof provs === 'string') {
    try {
      const parsed = JSON.parse(provs) as unknown;
      if (Array.isArray(parsed) && parsed.includes('azure')) return true;
    } catch {
      /* ignore */
    }
  }

  return (user.identities ?? []).some((i) => i.provider === 'azure');
}

/**
 * After OAuth code exchange, `Session.provider_token` is set; email/password sessions typically are not.
 * Social login on this app is Azure-only (`/auth`); unknown OAuth with missing metadata still needs the Microsoft linking UI.
 */
function oauthLooksLikeMicrosoftAzure(user: User): boolean {
  if (isAzureSession(user)) return true;
  const ids = user.identities ?? [];
  if (ids.some((i) => i.provider === 'azure')) return true;
  if (ids.some((i) => i.provider === 'google' || i.provider === 'github' || i.provider === 'gitlab')) {
    return false;
  }
  return true;
}

function needsMicrosoftAccountLinking(session: Session | null, user: User): boolean {
  if (isAzureSession(user)) return true;
  if (session?.provider_token && oauthLooksLikeMicrosoftAzure(user)) return true;
  return false;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [showLinkingDialog, setShowLinkingDialog] = useState(false);

  useEffect(() => {
    async function checkProfile() {
      if (!user) {
        setHasProfile(null);
        return;
      }

      setIsCheckingProfile(true);
      try {
        // After OAuth redirect, ensure the client has loaded the session into memory
        // before RLS evaluates auth.uid() on profiles.
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData.session?.user ?? user;

        const fetchMyProfileRow = async () =>
          supabase
            .from('profiles')
            .select('id, lovable_status, permission_profile_id, id_lucca')
            .eq('user_id', sessionUser.id)
            .maybeSingle();

        let data: ProfileGateRow | null = null;
        let error: { message: string; code?: string } | null = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await fetchMyProfileRow();
          if (res.data) {
            data = res.data;
            error = null;
            break;
          }
          if (res.error) {
            error = res.error;
            break;
          }
          await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
        }

        if (error) {
          console.error('Error checking profile:', error);
          setHasProfile(false);
          setShowAccessDenied(true);
          return;
        }

        const { data: authData } = await supabase.auth.getUser();
        const userForLink = authData?.user ?? sessionUser;
        const session = sessionData.session ?? null;
        const needsLink = needsMicrosoftAccountLinking(session, userForLink);

        if (data) {
          // Session Microsoft OAuth mais profil “fantôme” (trigger ancien ou insert minimal) : pas d’accès tant que la liaison n’est pas faite avec un compte provisionné.
          if (needsLink && !isKeonProvisionedProfile(data)) {
            setHasProfile(false);
            setShowLinkingDialog(true);
            return;
          }

          setHasProfile(true);
          return;
        }

        // No row in public.profiles for this auth user.
        // Microsoft OAuth: never client-insert a stub profile — forces link-microsoft-account flow.
        if (needsLink) {
          setHasProfile(false);
          setShowLinkingDialog(true);
          return;
        }

        // RLS: "Users can insert their own profile" WITH CHECK (auth.uid() = user_id).
        const insertRow: Database['public']['Tables']['profiles']['Insert'] = {
          user_id: sessionUser.id,
          display_name: displayNameFromUser(sessionUser),
        };
        if (sessionUser.email) {
          insertRow.lovable_email = sessionUser.email;
        }

        const { error: insertError } = await supabase.from('profiles').insert(insertRow);

        if (!insertError) {
          await refreshProfile();
          setHasProfile(true);
          return;
        }

        if (insertError.code === '23505') {
          const { data: afterRace } = await fetchMyProfileRow();
          if (afterRace) {
            await refreshProfile();
            setHasProfile(true);
            return;
          }
        }

        console.error('Profile bootstrap failed:', insertError);
        setHasProfile(false);
        setShowAccessDenied(true);
      } catch (error) {
        console.error('Error checking profile:', error);
        setHasProfile(false);
        setShowAccessDenied(true);
      } finally {
        setIsCheckingProfile(false);
      }
    }

    checkProfile();
  }, [user, refreshProfile]);

  if (isLoading || isCheckingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // User is authenticated but has no profile
  if (hasProfile === false) {
    return (
      <>
        {/* Microsoft login → no profile match → offer account linking */}
        <MicrosoftAccountLinkingDialog
          open={showLinkingDialog}
          microsoftEmail={user?.email ?? null}
          onLinked={async () => {
            // After linking the identity is transferred; ask the user to re-authenticate
            // with Microsoft — the new session will resolve to the original account.
            setShowLinkingDialog(false);
            // The dialog already signed out before calling onLinked.
            navigate('/auth', { replace: true });
          }}
          onDenied={async () => {
            setShowLinkingDialog(false);
            setShowAccessDenied(true);
            await supabase.auth.signOut();
          }}
        />

        {/* Classic "not invited" gate */}
        <AccessRestrictedDialog
          open={showAccessDenied}
          onClose={async () => {
            setShowAccessDenied(false);
            await supabase.auth.signOut();
          }}
        />
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return <>{children}</>;
}
