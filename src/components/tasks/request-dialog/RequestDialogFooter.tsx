import { Button } from '@/components/ui/button';
import { Loader2, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RequestDialogFooterProps {
  onClose: () => void;
  isSubmitting: boolean;
  isDisabled: boolean;
}

export function RequestDialogFooter({ onClose, isSubmitting, isDisabled }: RequestDialogFooterProps) {
  return (
    <div className="relative flex-shrink-0 border-t-2 border-primary/10 bg-gradient-to-r from-muted/30 via-white to-muted/30">
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side info */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Les champs marqués * sont obligatoires</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3 ml-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-w-[100px] rounded-xl border-2 hover:bg-muted/50 transition-all"
          >
            <X className="h-4 w-4 mr-2 opacity-70" />
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={isDisabled || isSubmitting}
            className={cn(
              "min-w-[200px] gap-2 rounded-xl font-semibold shadow-lg transition-all duration-200",
              "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary",
              "hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
            )}
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
      </div>
    </div>
  );
}
