import { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Columns3, ClipboardList } from 'lucide-react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort, SortDirection } from '@/hooks/useTableSort';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { TaskDetailDialog } from './TaskDetailDialog';
import { cn } from '@/lib/utils';

interface DenseTableViewProps {
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  progressMap?: Record<string, { completed: number; total: number; progress: number }>;
  onTaskUpdated?: () => void;
}

interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'request_number', label: 'N°', defaultVisible: true },
  { key: 'title', label: 'Titre', defaultVisible: true },
  { key: 'status', label: 'Statut', defaultVisible: true },
  { key: 'priority', label: 'Priorité', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: false },
  { key: 'assignee', label: 'Assigné', defaultVisible: true },
  { key: 'requester', label: 'Demandeur', defaultVisible: false },
  { key: 'category', label: 'Catégorie', defaultVisible: true },
  { key: 'due_date', label: 'Échéance', defaultVisible: true },
  { key: 'progress', label: 'Progression', defaultVisible: false },
  { key: 'created_at', label: 'Créé le', defaultVisible: false },
  { key: 'updated_at', label: 'Modifié le', defaultVisible: false },
  { key: 'planner_labels', label: 'Étiquettes Planner', defaultVisible: false },
];

const STORAGE_KEY = 'dense-table-visible-columns';

const STATUS_LABELS: Record<string, string> = {
  'todo': 'À faire',
  'in-progress': 'En cours',
  'done': 'Terminé',
  'pending_validation_1': 'Valid. N1',
  'pending_validation_2': 'Valid. N2',
  'validated': 'Validé',
  'refused': 'Refusé',
  'to_assign': 'À affecter',
  'review': 'En revue',
  'cancelled': 'Annulé',
};

const STATUS_COLORS: Record<string, string> = {
  'todo': 'bg-muted text-muted-foreground',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'done': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'validated': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  'refused': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'pending_validation_1': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'pending_validation_2': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'to_assign': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'review': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'cancelled': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  'low': 'Basse',
  'medium': 'Moyenne',
  'high': 'Haute',
  'urgent': 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  'low': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'medium': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'high': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  'urgent': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function DenseTableView({ tasks, onStatusChange, onDelete, progressMap, onTaskUpdated }: DenseTableViewProps) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    return ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
  });
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [categoriesMap, setCategoriesMap] = useState<Map<string, string>>(new Map());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [colSelectorOpen, setColSelectorOpen] = useState(false);

  const { sortedData: sortedTasks, sortConfig, handleSort } = useTableSort<Task>(tasks, 'created_at', 'desc');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Fetch profiles & categories
  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: cats }] = await Promise.all([
        supabase.from('profiles').select('id, display_name'),
        supabase.from('categories').select('id, name'),
      ]);
      if (profiles) {
        const m = new Map<string, string>();
        profiles.forEach(p => m.set(p.id, p.display_name || '—'));
        setProfilesMap(m);
      }
      if (cats) {
        const m = new Map<string, string>();
        cats.forEach(c => m.set(c.id, c.name));
        setCategoriesMap(m);
      }
    })();
  }, []);

  // sortedTasks already computed by useTableSort

  const handleToggleColumn = (key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const renderCellContent = (task: Task, colKey: string) => {
    switch (colKey) {
      case 'request_number':
        return <span className="font-mono text-xs text-muted-foreground">{task.request_number || task.task_number || '—'}</span>;
      case 'title':
        return <span className="font-medium text-foreground truncate max-w-[280px] block">{task.title}</span>;
      case 'status':
        return <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[task.status])}>{STATUS_LABELS[task.status] || task.status}</Badge>;
      case 'priority':
        return <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', PRIORITY_COLORS[task.priority])}>{PRIORITY_LABELS[task.priority]}</Badge>;
      case 'type':
        return <span className="text-xs">{task.type === 'request' ? 'Demande' : 'Tâche'}</span>;
      case 'assignee':
        return <span className="text-xs">{profilesMap.get(task.assignee_id || '') || '—'}</span>;
      case 'requester':
        return <span className="text-xs">{profilesMap.get(task.requester_id || '') || '—'}</span>;
      case 'category':
        return <span className="text-xs">{categoriesMap.get(task.category_id || '') || '—'}</span>;
      case 'due_date':
        return task.due_date ? <span className="text-xs">{format(new Date(task.due_date), 'dd/MM/yyyy', { locale: fr })}</span> : <span className="text-xs text-muted-foreground">—</span>;
      case 'progress': {
        const p = progressMap?.[task.id];
        if (!p) return <span className="text-xs text-muted-foreground">—</span>;
        return <span className="text-xs">{p.completed}/{p.total} ({p.progress}%)</span>;
      }
      case 'created_at':
        return <span className="text-xs">{format(new Date(task.created_at), 'dd/MM/yy HH:mm', { locale: fr })}</span>;
      case 'updated_at':
        return <span className="text-xs">{format(new Date(task.updated_at), 'dd/MM/yy HH:mm', { locale: fr })}</span>;
      case 'planner_labels': {
        const labels = task.planner_labels;
        if (!labels || labels.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-0.5">
            {labels.map((label, i) => (
              <Badge key={i} variant="outline" className="text-[9px] px-1 py-0 bg-violet-50 text-violet-700 dark:bg-violet-900 dark:text-violet-200 border-violet-200">
                {label}
              </Badge>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ClipboardList className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Aucune tâche trouvée</h3>
        <p className="text-sm text-muted-foreground">Modifiez vos filtres ou créez une nouvelle tâche</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <Popover open={colSelectorOpen} onOpenChange={setColSelectorOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs border-keon-300">
              <Columns3 className="h-3.5 w-3.5" />
              Colonnes ({visibleColumns.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="end">
            <div className="p-2 border-b">
              <span className="text-xs font-medium">Colonnes visibles</span>
            </div>
            <ScrollArea className="h-[260px]">
              <div className="p-2 space-y-1">
                {ALL_COLUMNS.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`dt-${col.key}`}
                      checked={visibleColumns.includes(col.key)}
                      onCheckedChange={() => handleToggleColumn(col.key)}
                      disabled={col.key === 'title'}
                    />
                    <Label htmlFor={`dt-${col.key}`} className="text-xs cursor-pointer flex-1">
                      {col.label}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      <div className="border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-keon-50 hover:bg-keon-50">
              {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                <SortableTableHead
                  key={col.key}
                  sortKey={col.key}
                  currentSortKey={sortConfig.key as string}
                  currentDirection={sortConfig.direction}
                  onSort={handleSort}
                  className="h-8 px-2 text-[11px] font-semibold whitespace-nowrap"
                >
                  {col.label}
                </SortableTableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.map(task => (
              <TableRow
                key={task.id}
                className="cursor-pointer hover:bg-keon-50/50 h-8"
                onClick={() => setSelectedTask(task)}
              >
                {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                  <TableCell key={col.key} className="py-1 px-2 text-xs">
                    {renderCellContent(task, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={onStatusChange}
        />
      )}
    </>
  );
}
