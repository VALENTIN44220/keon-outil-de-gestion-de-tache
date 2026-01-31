import { Calendar, Users, Plus, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GanttEmptyStateProps {
  type: 'no-members' | 'no-tasks' | 'no-planned' | 'no-data';
  onAction?: () => void;
  className?: string;
}

const EMPTY_STATES = {
  'no-members': {
    icon: Users,
    iconColor: 'from-blue-500 to-indigo-500',
    title: 'Aucun collaborateur',
    description: 'Ajoutez des membres à votre équipe pour commencer à planifier.',
    actionLabel: 'Gérer l\'équipe',
  },
  'no-tasks': {
    icon: FileSpreadsheet,
    iconColor: 'from-amber-500 to-orange-500',
    title: 'Aucune tâche à planifier',
    description: 'Créez des tâches et assignez-les à vos collaborateurs.',
    actionLabel: 'Créer une tâche',
  },
  'no-planned': {
    icon: Calendar,
    iconColor: 'from-emerald-500 to-teal-500',
    title: 'Aucune tâche planifiée',
    description: 'Glissez-déposez les tâches depuis la barre latérale pour les planifier.',
    actionLabel: null,
  },
  'no-data': {
    icon: Calendar,
    iconColor: 'from-slate-500 to-slate-400',
    title: 'Aucune donnée',
    description: 'Aucune donnée disponible pour la période sélectionnée.',
    actionLabel: null,
  },
};

export function GanttEmptyState({ type, onAction, className }: GanttEmptyStateProps) {
  const state = EMPTY_STATES[type];
  const Icon = state.icon;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-8 text-center",
      className
    )}>
      <div className={cn(
        "w-20 h-20 rounded-3xl flex items-center justify-center mb-6",
        "bg-gradient-to-br shadow-lg",
        state.iconColor
      )}>
        <Icon className="w-10 h-10 text-white" />
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {state.title}
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {state.description}
      </p>
      
      {state.actionLabel && onAction && (
        <Button onClick={onAction} className="gap-2">
          <Plus className="h-4 w-4" />
          {state.actionLabel}
        </Button>
      )}
      
      {type === 'no-planned' && (
        <div className="mt-8 p-4 bg-muted/50 rounded-xl border border-dashed max-w-md">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg">💡</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Conseil</p>
              <p className="text-xs text-muted-foreground mt-1">
                Utilisez le glisser-déposer depuis la liste des tâches à gauche, 
                ou cliquez et glissez sur la grille pour créer rapidement une nouvelle tâche.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading skeleton
export function GanttLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header skeleton */}
      <div className="h-12 bg-muted rounded-lg" />
      
      {/* Rows skeleton */}
      <div className="flex gap-4">
        {/* Sidebar skeleton */}
        <div className="w-80 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl" />
          ))}
        </div>
        
        {/* Grid skeleton */}
        <div className="flex-1">
          <div className="h-[400px] bg-muted rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Error state
interface GanttErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function GanttErrorState({ message, onRetry }: GanttErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center mb-4">
        <span className="text-3xl">⚠️</span>
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Une erreur est survenue
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {message || 'Impossible de charger les données du plan de charge.'}
      </p>
      
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          Réessayer
        </Button>
      )}
    </div>
  );
}
