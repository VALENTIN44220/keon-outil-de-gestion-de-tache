import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bug } from 'lucide-react';
import { BugReportForm } from './BugReportForm';
import type { BugType } from '@/types/bugReport';

interface BugReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: BugType;
  defaultPageUrl?: string;
}

/** Dialog de signalement (utilisé par le bouton global « Signaler »). */
export function BugReportDialog({ open, onOpenChange, defaultType, defaultPageUrl }: BugReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bug className="h-4 w-4 text-red-500" />
            Signaler un bug ou une amélioration
          </DialogTitle>
        </DialogHeader>
        <BugReportForm
          defaultType={defaultType}
          defaultPageUrl={defaultPageUrl}
          onCreated={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
