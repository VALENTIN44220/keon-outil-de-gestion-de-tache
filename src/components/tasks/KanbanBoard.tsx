import { Task, TaskStatus } from '@/types/task';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import { ClipboardList } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  groupBy?: string;
  groupLabels?: Map<string, string>;
  progressMap?: Record<string, { completed: number; total: number; progress: number }>;
  onTaskUpdated?: () => void;
}

const statusColumns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'to_assign', label: 'À affecter', color: 'bg-orange-500/10 border-orange-500/30' },
  { status: 'todo', label: 'À faire', color: 'bg-yellow-500/10 border-yellow-500/30' },
  { status: 'in-progress', label: 'En cours', color: 'bg-blue-500/10 border-blue-500/30' },
  { status: 'done', label: 'Terminé', color: 'bg-green-500/10 border-green-500/30' },
];

export function KanbanBoard({ tasks, onStatusChange, onDelete, groupBy, groupLabels, progressMap, onTaskUpdated }: KanbanBoardProps) {
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    onStatusChange(taskId, status);
  };

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
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {groupLabels?.get(groupKey) || groupKey}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {statusColumns.map(({ status, label, color }) => {
                const columnTasks = groupTasks.filter(t => t.status === status);
                return (
                  <div
                    key={status}
                    className={cn("rounded-xl border-2 border-dashed p-4 min-h-[200px]", color)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-sm">{label}</h4>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {columnTasks.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {columnTasks.map(task => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <TaskCard
                            task={task}
                            onStatusChange={onStatusChange}
                            onDelete={onDelete}
                            compact
                            taskProgress={progressMap?.[task.id]}
                            onTaskUpdated={onTaskUpdated}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: no grouping
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statusColumns.map(({ status, label, color }) => {
        const columnTasks = tasks.filter(t => t.status === status);
        return (
          <div
            key={status}
            className={cn("rounded-xl border-2 border-dashed p-4 min-h-[300px]", color)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{label}</h3>
              <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-3">
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <TaskCard
                    task={task}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    compact
                    taskProgress={progressMap?.[task.id]}
                    onTaskUpdated={onTaskUpdated}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
