import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Lock, Check, X } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forced?: boolean;
  onSuccess?: () => void;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'Au moins 8 caractères', test: (p) => p.length >= 8 },
  { label: 'Au moins une majuscule', test: (p) => /[A-Z]/.test(p) },
  { label: 'Au moins une minuscule', test: (p) => /[a-z]/.test(p) },
  { label: 'Au moins un chiffre', test: (p) => /[0-9]/.test(p) },
  { label: 'Au moins un caractère spécial (!@#$%&*)', test: (p) => /[!@#$%&*+=?-]/.test(p) },
];

export function ChangePasswordDialog({
  open,
  onOpenChange,
  forced = false,
  onSuccess,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const allRequirementsMet = passwordRequirements.every((req) => req.test(newPassword));
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allRequirementsMet) {
      toast.error('Le mot de passe ne respecte pas tous les critères');
      return;
    }

    if (!passwordsMatch) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);

    try {
      // Update password using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      // If forced change, update the must_change_password flag
      if (forced) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ must_change_password: false })
            .eq('user_id', user.id);
        }
      }

      toast.success('Mot de passe modifié avec succès');
      resetForm();
      onSuccess?.();
      
      if (!forced) {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      
      if (error.message?.includes('same_password')) {
        toast.error('Le nouveau mot de passe doit être différent de l\'ancien');
      } else {
        toast.error(error.message || 'Erreur lors du changement de mot de passe');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // If forced, don't allow closing
    if (forced && !newOpen) {
      return;
    }
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={forced ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={forced ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {forced ? 'Changement de mot de passe obligatoire' : 'Changer le mot de passe'}
          </DialogTitle>
          <DialogDescription>
            {forced
              ? 'Pour des raisons de sécurité, vous devez définir un nouveau mot de passe personnel.'
              : 'Saisissez votre nouveau mot de passe.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password - only show if not forced (user might not know the generated one) */}
          {!forced && (
            <div className="space-y-2">
              <Label htmlFor="current-password">Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required={!forced}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* New password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password requirements */}
            <div className="mt-2 space-y-1">
              {passwordRequirements.map((req, index) => {
                const isMet = req.test(newPassword);
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      newPassword.length === 0
                        ? 'text-muted-foreground'
                        : isMet
                        ? 'text-green-600'
                        : 'text-red-500'
                    }`}
                  >
                    {newPassword.length === 0 ? (
                      <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    ) : isMet ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {req.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p
                className={`text-xs ${
                  passwordsMatch ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {passwordsMatch ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {!forced && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || !allRequirementsMet || !passwordsMatch}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Changer le mot de passe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
