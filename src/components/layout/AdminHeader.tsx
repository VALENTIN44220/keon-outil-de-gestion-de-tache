import keonLogo from '@/assets/keon-logo.jpg';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  return (
    <header className="bg-muted/50 border-b border-border px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <img 
          src={keonLogo} 
          alt="KEON" 
          className="h-10 w-10 object-cover rounded-lg shadow-sm" 
        />
        <div>
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
