import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ChangePasswordDialog } from './ChangePasswordDialog';

interface ForcePasswordChangeProps {
  children: React.ReactNode;
}

export function ForcePasswordChange({ children }: ForcePasswordChangeProps) {
  const { user, profile } = useAuth();
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkMustChangePassword = async () => {
      if (!user) {
        setMustChangePassword(false);
        setIsChecking(false);
        return;
      }

      // Check from profile context first
      if (profile?.must_change_password !== undefined) {
        setMustChangePassword(profile.must_change_password);
        setIsChecking(false);
        return;
      }

      // Fallback: fetch directly from database
      const { data, error } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setMustChangePassword(data.must_change_password);
      }
      setIsChecking(false);
    };

    checkMustChangePassword();
  }, [user, profile]);

  const handlePasswordChangeSuccess = async () => {
    // Refresh the profile to update the must_change_password flag
    setMustChangePassword(false);
    
    // Also update in database just to be sure
    if (user) {
      await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', user.id);
    }
  };

  // Don't block if still checking or no user
  if (isChecking || !user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <ChangePasswordDialog
        open={mustChangePassword}
        onOpenChange={() => {}} // No-op since it's forced
        forced={true}
        onSuccess={handlePasswordChangeSuccess}
      />
    </>
  );
}
