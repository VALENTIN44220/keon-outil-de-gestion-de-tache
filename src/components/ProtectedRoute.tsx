import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { AccessRestrictedDialog } from './auth/AccessRestrictedDialog';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  useEffect(() => {
    async function checkProfile() {
      if (!user) {
        setHasProfile(null);
        return;
      }

      setIsCheckingProfile(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, lovable_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking profile:', error);
          setHasProfile(false);
        } else if (!data) {
          // User authenticated but no profile - not invited
          setHasProfile(false);
          setShowAccessDenied(true);
        } else {
          setHasProfile(true);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        setHasProfile(false);
      } finally {
        setIsCheckingProfile(false);
      }
    }

    checkProfile();
  }, [user]);

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
