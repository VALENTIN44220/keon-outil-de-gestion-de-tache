/**
 * TabShell — Composants partagés pour les onglets de paramétrage d'un processus.
 *
 * Garantit un look cohérent entre Champs, Accès, Notifications (et futurs onglets) :
 *  - Header : icône + titre + sous-titre
 *  - Bandeau lecture-seule si pas de droits
 *  - SaveBar collante en bas avec badge « non enregistré » + bouton primaire
 *
 * Aucune logique métier ici : juste l'UX.
 */
import { ReactNode } from 'react';
import { LucideIcon, Lock, Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function TabHeader({
  icon: Icon,
  title,
  description,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {trailing}
    </div>
  );
}

export function ReadOnlyBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-xs flex items-center gap-2">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      Lecture seule — tu n'as pas les droits de modification sur ce processus.
    </div>
  );
}

export function SaveBar({
  dirty,
  saving,
  canSave,
  onSave,
  onCancel,
  label = 'Enregistrer',
}: {
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onCancel?: () => void;
  label?: string;
}) {
  return (
    <div className={cn(
      'sticky bottom-0 -mx-6 px-6 py-3 border-t bg-background/95 backdrop-blur',
      'flex items-center justify-end gap-3',
    )}>
      {dirty && (
        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
          Modifications non enregistrées
        </Badge>
      )}
      {onCancel && (
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
      )}
      <Button size="sm" onClick={onSave} disabled={saving || !canSave || !dirty} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}

export function EmptyHint({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg flex flex-col items-center gap-2">
      <Icon className="h-8 w-8 opacity-30" />
      {children}
    </div>
  );
}
