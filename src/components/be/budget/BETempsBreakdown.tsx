import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock } from 'lucide-react';
import { useBEAffaireTempsBreakdown } from '@/hooks/useBEAffaireTempsBreakdown';
import { BE_POSTE_ICON, BE_POSTE_LABEL, type BEPoste } from '@/types/beTemps';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const num = (n: number, frac = 1) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: frac });

interface BETempsBreakdownProps {
  affaireId: string;
}

export function BETempsBreakdown({ affaireId }: BETempsBreakdownProps) {
  const { parUser, parPoste, isLoading } = useBEAffaireTempsBreakdown(affaireId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (parUser.length === 0 && parPoste.length === 0) {
    return null; // Pas d'heures déclarées sur cette affaire → on n'affiche rien
  }

  return (
    <div className="space-y-3">
      {/* Détail par poste */}
      {parPoste.length > 0 && (
        <div className="rounded-lg border bg-muted/10 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 px-1">
            Temps déclaré par poste
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
            {parPoste.map((p) => {
              const isAssigned = p.poste !== 'non_assigne';
              const label = isAssigned
                ? BE_POSTE_LABEL[p.poste as BEPoste]
                : 'Non assigné';
              const icon = isAssigned ? BE_POSTE_ICON[p.poste as BEPoste] : '❓';
              return (
                <div
                  key={p.poste}
                  className="flex items-center justify-between text-xs px-1 py-0.5"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span>{icon}</span>
                    <span className="text-muted-foreground truncate">{label}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                      {p.nb_collaborateurs}
                    </Badge>
                  </span>
                  <span className="flex gap-2 tabular-nums shrink-0">
                    <span className="font-semibold">{num(p.jours)} j</span>
                    {p.cout_rh > 0 && (
                      <span className="text-muted-foreground">{eur(p.cout_rh)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Détail par collaborateur */}
      {parUser.length > 0 && (
        <div className="rounded-lg border bg-muted/10 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 px-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Détail par collaborateur ({parUser.length})
          </p>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {parUser.map((u) => {
              const initiales = u.display_name
                ? u.display_name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase()
                : '??';
              const name = u.display_name ?? `Lucca #${u.id_lucca ?? '?'}`;
              const posteLabel = u.be_poste ? BE_POSTE_LABEL[u.be_poste] : 'Non assigné';
              return (
                <div
                  key={u.user_id ?? `lucca-${u.id_lucca}`}
                  className="flex items-center gap-2 text-xs px-1 py-1 hover:bg-muted/30 rounded"
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[9px] bg-primary/10">
                      {initiales}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {posteLabel}
                    </p>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <p className="font-semibold">{num(u.jours)} j</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-2.5 w-2.5" />
                      {num(u.heures, 0)} h
                      {u.cout_rh > 0 && <span className="ml-1">· {eur(u.cout_rh)}</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
