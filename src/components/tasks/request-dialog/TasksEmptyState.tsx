import { CheckSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TasksEmptyStateProps {
  onAddTask?: () => void;
}

export function TasksEmptyState({ onAddTask }: TasksEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <CheckSquare className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Aucune tâche sélectionnée
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
        Sélectionnez les tâches à réaliser pour cette demande. Chaque tâche cochée déclenchera la création des actions correspondantes.
      </p>
      {onAddTask && (
        <Button variant="outline" onClick={onAddTask} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter une tâche
        </Button>
      )}
    </div>
  );
}
