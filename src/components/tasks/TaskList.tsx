import { forwardRef, useState, useEffect, useMemo } from 'react';
import { Task, TaskStatus } from '@/types/task';
import { TaskCard } from './TaskCard';
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  groupBy?: string;
  groupLabels?: Map<string, string>;
  progressMap?: Record<string, { completed: number; total: number; progress: number }>;
  onTaskUpdated?: () => void;
}

const PAGE_SIZE = 24;

export const TaskList = forwardRef<HTMLDivElement, TaskListProps>(
  function TaskList(
    { tasks, onStatusChange, onDelete, groupBy, groupLabels, progressMap, onTaskUpdated },
    ref
  ) {
    const [page, setPage] = useState(1);

    useEffect(() => { setPage(1); }, [tasks.length]);

    const totalPages = Math.ceil(tasks.length / PAGE_SIZE);
    const paginatedTasks = useMemo(() => tasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [tasks, page]);

    if (tasks.length === 0) {
      return (
        <div
          ref={ref}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            Aucune tâche trouvée
          </h3>
          <p className="text-sm text-muted-foreground">
            Modifiez vos filtres ou créez une nouvelle tâche
          </p>
        </div>
      );
    }

    // Group tasks if groupBy is set
    if (groupBy && groupBy !== 'none') {
      const groups = new Map<string, Task[]>();

      tasks.forEach((task) => {
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
        <div ref={ref} className="space-y-8">
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
                    onTaskUpdated={onTaskUpdated}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div ref={ref}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              taskProgress={progressMap?.[task.id]}
              onTaskUpdated={onTaskUpdated}
            />
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }
);
