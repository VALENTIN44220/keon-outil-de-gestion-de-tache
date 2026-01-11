import { Task, TaskStatus } from '@/types/task';
import { TaskCard } from './TaskCard';
import { ClipboardList } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  groupBy?: string;
  groupLabels?: Map<string, string>;
  progressMap?: Record<string, { completed: number; total: number; progress: number }>;
}

export function TaskList({ tasks, onStatusChange, onDelete, groupBy, groupLabels, progressMap }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ClipboardList className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Aucune tâche trouvée</h3>
        <p className="text-sm text-muted-foreground">
          Modifiez vos filtres ou créez une nouvelle tâche
        </p>
      </div>
    );
  }

  // Group tasks if groupBy is set
  if (groupBy && groupBy !== 'none') {
    const groups = new Map<string, Task[]>();
    
    tasks.forEach(task => {
      let key = 'Non assigné';
      switch (groupBy) {
        case 'assignee':
          key = task.assignee_id || 'Non assigné';
          break;
        case 'requester':
          key = task.requester_id || 'Non défini';
          break;
        case 'reporter':
          key = task.reporter_id || 'Non défini';
          break;
        case 'category':
          key = task.category_id || 'Sans catégorie';
          break;
        case 'subcategory':
          key = task.subcategory_id || 'Sans sous-catégorie';
          break;
        default:
          key = 'Autre';
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(task);
    });

    return (
      <div className="space-y-8">
        {Array.from(groups.entries()).map(([groupKey, groupTasks]) => (
          <div key={groupKey}>
            <h3 className="text-lg font-semibold mb-4 text-foreground border-b border-border pb-2">
              {groupLabels?.get(groupKey) || groupKey}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({groupTasks.length})
              </span>
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  taskProgress={progressMap?.[task.id]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          taskProgress={progressMap?.[task.id]}
        />
      ))}
    </div>
  );
}
