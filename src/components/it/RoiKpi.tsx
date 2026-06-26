import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Carte KPI ROI réutilisable (onglet ROI projet + ROI scénario). */
export function RoiKpi({
  label, value, sub, color, icon, highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-1',
      highlight ? 'bg-muted/40 border-border' : 'bg-background',
    )}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className={cn('text-xl font-bold tabular-nums', color)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
