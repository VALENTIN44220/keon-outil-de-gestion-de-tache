import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RequestDialogHeaderProps {
  processName?: string | null;
  onClose: () => void;
}

export function RequestDialogHeader({ processName, onClose }: RequestDialogHeaderProps) {
  return (
    <div className="relative flex-shrink-0 px-6 py-4 border-b border-border bg-gradient-to-r from-white to-muted/30">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary via-primary/80 to-accent rounded-l-2xl" />
      
      <div className="flex items-center justify-between pl-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {processName ? `Demande: ${processName}` : 'Nouvelle demande à un service'}
            </h2>
            {processName && (
              <p className="text-sm text-muted-foreground">Processus métier</p>
            )}
          </div>
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
