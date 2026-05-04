import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { AccessRestrictedDialog } from './AccessRestrictedDialog';
import { MicrosoftAccountLinkingDialog } from './MicrosoftAccountLinkingDialog';

type ProfileGateRow = {
  id: string;
  lovable_status: string | null;
  permission_profile_id: string | null;
  id_lucca: string | null;
};

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

// Routes that don't require a provisioned profile (auth flows, password reset, etc.)
// They run OUTSIDE the persistent-routes system but are still wrapped by AuthGate.
const PUBLIC_PATHS = [
  '/auth',
  '/auth/callback',
  '/auth/accept-invite',
  '/reset-password',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * One-shot auth bootstrap that runs once per session (not per route) to:
 *   - verify the user has a row in public.profiles,
 *   - handle Microsoft Azure account linking when a shadow profile exists,
 *   - create a default profile row for classic (email/password) sign-ups.
 *
 * Previously this logic lived inside <ProtectedRoute>, which ran the check on every
 * route mount. With <PersistentRoutes> each first-visited page mounted its own
 * <ProtectedRoute>, so navigating to a new page briefly showed the profile-check
 * spinner (a near-white "blank" screen) before the children rendered. Hoisting the
 * logic to a single gate component mounted above the router removes that flash.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
          if (needsLink && !isKeonProvisionedProfile(data)) {
            setHasProfile(false);
            setShowLinkingDialog(true);
            return;
          }

          setHasProfile(true);
          return;
        }

        if (needsLink) {
          setHasProfile(false);
          setShowLinkingDialog(true);
          return;
        }

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
      } catch (err) {
        console.error('Error checking profile:', err);
        setHasProfile(false);
        setShowAccessDenied(true);
      } finally {
        setIsCheckingProfile(false);
      }
    }

    checkProfile();
  }, [user, refreshProfile]);

  // Public routes render immediately without waiting for the profile check so that
  // /auth, /auth/callback, /reset-password, etc. stay usable even when no profile exists yet.
  if (isPublicPath(location.pathname)) {
    return <>{children}</>;
  }

  if (isLoading || (user && isCheckingProfile && hasProfile === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && hasProfile === false) {
    return (
      <>
        <MicrosoftAccountLinkingDialog
          open={showLinkingDialog}
          microsoftEmail={user?.email ?? null}
          onLinked={async () => {
            setShowLinkingDialog(false);
            navigate('/auth', { replace: true });
          }}
          onDenied={async () => {
            setShowLinkingDialog(false);
            setShowAccessDenied(true);
            await supabase.auth.signOut();
          }}
        />
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
