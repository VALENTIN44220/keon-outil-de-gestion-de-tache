import { Layers, Inbox, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TasksEmptyStateProps {
  onAddTask?: () => void;
}

export function TasksEmptyState({ onAddTask }: TasksEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 bg-gradient-to-b from-muted/30 to-transparent rounded-2xl border-2 border-dashed border-muted-foreground/20">
      {/* Animated icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
          <Inbox className="w-10 h-10 text-primary/60" />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
          <Sparkles className="w-4 h-4 text-accent" />
        </div>
      </div>
      
      <h3 className="text-lg font-bold text-foreground mb-2 font-display tracking-wide">
        Aucune tâche disponible
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6 leading-relaxed">
        Sélectionnez les tâches à réaliser pour cette demande. Chaque tâche cochée déclenchera automatiquement la création des actions correspondantes.
      </p>
      {onAddTask && (
        <Button 
          variant="outline" 
          onClick={onAddTask} 
          className="gap-2 rounded-xl border-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all"
        >
          <Layers className="h-4 w-4" />
          Ajouter une tâche
        </Button>
      )}
    </div>
  );
}
