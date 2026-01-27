import { Task } from '@/types/task';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DataTableWidgetProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  'todo': { label: 'À faire', color: 'bg-keon-orange text-white' },
  'in-progress': { label: 'En cours', color: 'bg-keon-blue text-white' },
  'done': { label: 'Terminé', color: 'bg-keon-green text-white' },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  'urgent': { label: 'Urgente', color: 'bg-red-500 text-white' },
  'high': { label: 'Haute', color: 'bg-keon-terose text-white' },
  'medium': { label: 'Moyenne', color: 'bg-keon-orange text-white' },
  'low': { label: 'Basse', color: 'bg-keon-green text-white' },
};

export function DataTableWidget({ tasks, onTaskClick }: DataTableWidgetProps) {
  const displayTasks = tasks.slice(0, 50);

  return (
    <div className="overflow-auto h-full">
      <Table>
        <TableHeader>
          <TableRow className="bg-keon-50">
            <TableHead className="font-semibold text-keon-900">Titre</TableHead>
            <TableHead className="font-semibold text-keon-900">Statut</TableHead>
            <TableHead className="font-semibold text-keon-900">Priorité</TableHead>
            <TableHead className="font-semibold text-keon-900">Échéance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayTasks.map((task) => {
            const status = statusLabels[task.status] || statusLabels['todo'];
            const priority = priorityLabels[task.priority] || priorityLabels['medium'];
            
            return (
              <TableRow 
                key={task.id}
                className="cursor-pointer hover:bg-keon-50 transition-colors"
                onClick={() => onTaskClick?.(task)}
              >
                <TableCell className="font-medium text-keon-900 max-w-[200px] truncate">
                  {task.title}
                </TableCell>
                <TableCell>
                  <Badge className={cn('text-xs', status.color)}>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', priority.color)}>
                    {priority.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-keon-600">
                  {task.due_date ? format(new Date(task.due_date), 'dd MMM', { locale: fr }) : '-'}
                </TableCell>
              </TableRow>
            );
          })}
          {displayTasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-keon-500 py-8">
                Aucune tâche à afficher
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {tasks.length > 50 && (
        <p className="text-xs text-keon-500 text-center py-2">
          Affichage des 50 premières tâches sur {tasks.length}
        </p>
      )}
    </div>
  );
}
