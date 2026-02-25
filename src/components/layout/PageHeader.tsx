import { ReactNode } from 'react';
import keonLogo from '@/assets/keon-logo.jpg';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <header className={cn(
      "bg-muted/50 border-b border-border px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-30",
      className
    )}>
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <img 
            src={keonLogo} 
            alt="KEON" 
            className="h-8 w-8 sm:h-10 sm:w-10 object-cover rounded-lg shadow-sm shrink-0" 
          />
          <h1 className="text-sm sm:text-xl font-display font-semibold tracking-wide text-foreground uppercase truncate">
            {title}
          </h1>
        </div>
        
        {children && (
          <div className="flex items-center gap-3">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
