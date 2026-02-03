import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogAction, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface AccessRestrictedDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AccessRestrictedDialog({ open, onClose }: AccessRestrictedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Accès refusé
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3 pt-2">
            <p>
              Vous n'avez pas encore été invité à rejoindre cette application.
            </p>
            <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
              <p className="font-medium">Pour accéder à KEON Task Manager :</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Inscrivez-vous sur Lovable via le lien d'invitation reçu</li>
                <li>Attendez qu'un administrateur vous invite à l'application</li>
                <li>Cliquez sur le lien d'invitation reçu par email</li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground">
              Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>
            Compris
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
