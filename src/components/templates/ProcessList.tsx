import { ProcessWithTasks, TaskTemplate } from '@/types/template';
import { ProcessCard } from './ProcessCard';

interface ProcessListProps {
  processes: ProcessWithTasks[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onViewDetails: (id: string) => void;
  onAddTask: (processId: string, task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>) => void;
  onDeleteTask: (processId: string, taskId: string) => void;
}

export function ProcessList({ processes, onDelete, onEdit, onViewDetails, onAddTask, onDeleteTask }: ProcessListProps) {
  if (processes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-card rounded-xl shadow-sm">
        <p className="text-muted-foreground text-lg mb-2">Aucun processus créé</p>
        <p className="text-sm text-muted-foreground">
          Créez votre premier modèle de processus pour réutiliser des ensembles de tâches
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {processes.map(process => (
        <ProcessCard
          key={process.id}
          process={process}
          onDelete={() => onDelete(process.id)}
          onEdit={() => onEdit(process.id)}
          onViewDetails={() => onViewDetails(process.id)}
          onAddTask={(task) => onAddTask(process.id, task)}
          onDeleteTask={(taskId) => onDeleteTask(process.id, taskId)}
        />
      ))}
    </div>
  );
}
