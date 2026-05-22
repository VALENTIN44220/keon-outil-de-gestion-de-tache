import { forwardRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task, TaskStatus } from '@/types/task';
import { TaskCard } from './TaskCard';
import { ClipboardList, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FolderOpen, ExternalLink } from 'lucide-react';
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
    const navigate = useNavigate();
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
          case 'request':
            key = (task as any).parent_request_id || 'Sans demande';
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
          {Array.from(groups.entries()).map(([groupKey, groupTasks]) => {
            // Quand on regroupe par demande, l'en-tête est cliquable et ouvre
            // la fiche de la demande parente (/demande/:id).
            const isRequestGroup = groupBy === 'request' && groupKey !== 'Sans demande';
            return (
            <div key={groupKey}>
              {isRequestGroup ? (
                <button
                  onClick={() => navigate(`/demande/${groupKey}`)}
                  className="group w-full flex items-center gap-2 mb-4 pb-2 border-b border-violet-200 text-left hover:text-violet-700 transition-colors"
                  title="Ouvrir la demande"
                >
                  <FolderOpen className="h-4 w-4 text-violet-600 shrink-0" />
                  <span className="text-lg font-semibold text-foreground group-hover:text-violet-700">
                    {groupLabels?.get(groupKey) || 'Demande'}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({groupTasks.length})
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                </button>
              ) : (
                <h3 className="text-lg font-semibold mb-4 text-foreground border-b border-border pb-2">
                  {groupLabels?.get(groupKey) || groupKey}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({groupTasks.length})
                  </span>
                </h3>
              )}
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
            );
          })}
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
          <div className="flex items-center justify-between px-1 py-3 border-t mt-4">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, tasks.length)} sur {tasks.length} tâches
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                disabled={page === 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) => p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm"
                    className="h-7 min-w-[28px] px-2 text-xs"
                    onClick={() => setPage(p as number)}>
                    {p}
                  </Button>
                ))
              }
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);
