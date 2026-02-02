import { Building2, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RequestDialogHeaderProps {
  processName?: string | null;
  onClose: () => void;
}

export function RequestDialogHeader({ processName, onClose }: RequestDialogHeaderProps) {
  return (
    <div className="relative flex-shrink-0 border-b-2 border-primary/10 bg-gradient-to-r from-white via-primary/[0.02] to-accent/[0.03] overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
      
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 17.32v34.64L30 60 0 51.96V17.32L30 0z' fill='none' stroke='%231E5EFF' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '30px 30px',
        }} />
      </div>
      
      <div className="relative flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/25">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-md">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground font-display tracking-wide">
              {processName ? processName : 'Nouvelle demande'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {processName ? 'Processus métier' : 'Créer une demande à un service'}
            </p>
          </div>
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors h-10 w-10"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
