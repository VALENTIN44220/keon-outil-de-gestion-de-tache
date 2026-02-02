import { User, Building2, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemFieldsCardProps {
  userName?: string | null;
  company?: string | null;
  department?: string | null;
}

export function SystemFieldsCard({ userName, company, department }: SystemFieldsCardProps) {
  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-white to-accent/5 p-5 shadow-sm relative overflow-hidden">
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary via-primary/80 to-accent rounded-l-2xl" />
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pl-2">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
          <User className="h-5 w-5 text-white" />
        </div>
        <div>
          <span className="text-sm font-bold text-foreground uppercase tracking-wider font-display">
            Demandeur
          </span>
          <p className="text-xs text-muted-foreground">Informations du demandeur</p>
        </div>
      </div>
      
      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-2">
        <FieldCard
          icon={<User className="h-4 w-4" />}
          label="Nom"
          value={userName || 'Utilisateur connecté'}
          variant="primary"
        />
        <FieldCard
          icon={<Building2 className="h-4 w-4" />}
          label="Société"
          value={company || 'Non renseignée'}
          variant="secondary"
        />
        <FieldCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Service"
          value={department || 'Non renseigné'}
          variant="accent"
        />
      </div>
    </div>
  );
}

function FieldCard({ 
  icon, 
  label, 
  value, 
  variant = 'primary' 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  variant?: 'primary' | 'secondary' | 'accent';
}) {
  const variantStyles = {
    primary: 'bg-gradient-to-br from-white to-primary/5 border-primary/20 hover:border-primary/40',
    secondary: 'bg-gradient-to-br from-white to-info/5 border-info/20 hover:border-info/40',
    accent: 'bg-gradient-to-br from-white to-accent/5 border-accent/20 hover:border-accent/40',
  };

  const iconStyles = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-info bg-info/10',
    accent: 'text-accent bg-accent/10',
  };

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-200 cursor-default",
      variantStyles[variant]
    )}>
      <div className={cn(
        "flex-shrink-0 p-2 rounded-lg",
        iconStyles[variant]
      )}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
