import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  department_id: string | null;
  company: string | null;
  company_id: string | null;
  manager_id: string | null;
  is_private: boolean;
  permission_profile_id: string | null;
  permission_profile?: Record<string, any> | null;
  hierarchy_level_id: string | null;
  must_change_password: boolean;
  /** Ordre des colonnes du tableau fournisseurs (/suppliers), ou null pour l’ordre par défaut. */
  suppliers_list_column_order?: string[] | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  /** Refetch profile for the current user (e.g. after bootstrap insert). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSessionSignatureRef = useRef<string | null>(null);
  const lastProfileUserIdRef = useRef<string | null>(null);

  const connectMicrosoftOnFirstOAuthLogin = async (session: Session) => {
    try {
      // These are present when using Supabase OAuth providers.
      // We forward them once to the edge function so it can persist the connection.
      const accessToken = (session as any).provider_token as string | undefined;
      const refreshToken = (session as any).provider_refresh_token as string | undefined;
      if (!accessToken) return;

      const { error } = await supabase.functions.invoke('microsoft-graph', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { action: 'connect-supabase-session', access_token: accessToken, refresh_token: refreshToken },
      });
      if (error) {
        console.warn('Microsoft connect invoke returned error:', error);
      }
    } catch (e) {
      // Non-blocking: login must succeed even if calendar connection fails.
      console.warn('Microsoft connect (post-login) failed:', e);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      // Include permission_profile so write access checks work reliably client-side
      .select('*, permission_profile:permission_profiles(*)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    // Cast to Profile – handles Json ↔ string[] differences and extra DB columns
    return data as unknown as Profile;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ignore technical token refreshes to avoid global rerender storms
        // when users switch browser tabs and come back.
        if (event === 'TOKEN_REFRESHED') {
          return;
        }

        const nextSignature = session?.access_token
          ? `${session.user.id}:${session.access_token}`
          : null;

        // Supabase can emit SIGNED_IN repeatedly (e.g. tab focus/session recovery).
        // Skip no-op updates to avoid rerendering the full app tree.
        if (event === 'SIGNED_IN' && nextSignature === lastSessionSignatureRef.current) {
          return;
        }

        lastSessionSignatureRef.current = nextSignature;
        setSession(prev => (prev?.access_token === session?.access_token ? prev : session));
        setUser(prev => (prev?.id === session?.user?.id ? prev : (session?.user ?? null)));

        if (session?.user) {
          if (lastProfileUserIdRef.current !== session.user.id) {
            lastProfileUserIdRef.current = session.user.id;
            // Use setTimeout to avoid potential race conditions
            setTimeout(async () => {
              const profile = await fetchProfile(session.user.id);
              setProfile(profile);
            }, 0);
          }

          if (event === 'SIGNED_IN') {
            void connectMicrosoftOnFirstOAuthLogin(session);
          }
        } else {
          lastProfileUserIdRef.current = null;
          setProfile(prev => (prev === null ? prev : null));
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const signature = session?.access_token ? `${session.user.id}:${session.access_token}` : null;
      lastSessionSignatureRef.current = signature;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        lastProfileUserIdRef.current = session.user.id;
        fetchProfile(session.user.id).then(setProfile);
        void connectMicrosoftOnFirstOAuthLogin(session);
      } else {
        lastProfileUserIdRef.current = null;
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Same route as Azure OAuth: PKCE ?code= must be exchanged in AuthCallback (detectSessionInUrl is off).
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          display_name: displayName || email,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('user_id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }

    return { error: error as Error | null };
  };

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const next = await fetchProfile(user.id);
    setProfile(next);
    lastProfileUserIdRef.current = user.id;
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      isLoading,
      signUp,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
    }),
    [user, profile, session, isLoading, refreshProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
