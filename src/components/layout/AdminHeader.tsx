import keonTaskLogo from '@/assets/keon-task-logo.png';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  return (
    <header className="bg-muted/50 border-b border-border px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <img 
          src={keonTaskLogo} 
          alt="KEON Task Manager" 
          className="h-10 w-10 object-contain" 
        />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-body font-bold tracking-wide text-foreground">KEON</span>
          <span className="text-xs font-display font-semibold tracking-wider text-muted-foreground uppercase">Task Manager</span>
        </div>
        <div className="ml-4 border-l border-border pl-4">
          <h1 className="text-xl font-display font-semibold tracking-wide text-foreground uppercase">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground font-body">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
