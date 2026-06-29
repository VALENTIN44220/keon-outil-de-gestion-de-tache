import { useState } from 'react';
import { Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BugReportDialog } from './BugReportDialog';

interface ReportBugButtonProps {
  /** Sidebar repliée : n'afficher que l'icône. */
  collapsed?: boolean;
}

/**
 * Bouton global « Signaler » (footer de la sidebar). Ouvre le dialog de
 * signalement en pré-remplissant l'URL de la page courante.
 */
export function ReportBugButton({ collapsed = false }: ReportBugButtonProps) {
  const [open, setOpen] = useState(false);
  const pageUrl = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Signaler un bug ou une amélioration"
        className={cn(
          'w-full flex items-center rounded-lg transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-700',
          collapsed ? 'justify-center p-2' : 'gap-2.5 px-2 py-2',
        )}
      >
        <div className={cn('flex items-center justify-center rounded-md flex-shrink-0', collapsed ? 'w-8 h-8' : 'w-7 h-7')}>
          <Bug className="w-[15px] h-[15px]" />
        </div>
        {!collapsed && <span className="flex-1 text-left text-[13px]">Signaler un bug</span>}
      </button>
      <BugReportDialog open={open} onOpenChange={setOpen} defaultPageUrl={pageUrl} />
    </>
  );
}
