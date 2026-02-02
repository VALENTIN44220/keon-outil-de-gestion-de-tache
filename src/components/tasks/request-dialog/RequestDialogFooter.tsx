import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';

interface RequestDialogFooterProps {
  onClose: () => void;
  isSubmitting: boolean;
  isDisabled: boolean;
}

export function RequestDialogFooter({ onClose, isSubmitting, isDisabled }: RequestDialogFooterProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={isSubmitting}
        className="min-w-[100px]"
      >
        Annuler
      </Button>
      <Button
        type="submit"
        disabled={isDisabled || isSubmitting}
        className="min-w-[180px] gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Création en cours...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Soumettre la demande
          </>
        )}
      </Button>
    </div>
  );
}
