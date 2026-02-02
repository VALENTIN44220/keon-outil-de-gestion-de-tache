import { User, Building2, Briefcase } from 'lucide-react';

interface SystemFieldsCardProps {
  userName?: string | null;
  company?: string | null;
  department?: string | null;
}

export function SystemFieldsCard({ userName, company, department }: SystemFieldsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-muted/30 to-muted/10 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Demandeur
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FieldCard
          icon={<User className="h-4 w-4" />}
          label="Nom"
          value={userName || 'Utilisateur connecté'}
        />
        <FieldCard
          icon={<Building2 className="h-4 w-4" />}
          label="Société"
          value={company || 'Non renseignée'}
        />
        <FieldCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Service"
          value={department || 'Non renseigné'}
        />
      </div>
    </div>
  );
}

function FieldCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white border border-border/50 px-3 py-2.5 shadow-sm">
      <div className="flex-shrink-0 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
