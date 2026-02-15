import { useState, useEffect, useMemo, useCallback } from 'react';
import { Task } from '@/types/task';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort } from '@/hooks/useTableSort';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Columns3 } from 'lucide-react';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/services/taskStatusService';

interface TaskTableWidgetProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  processId?: string;
}

interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  render: (task: any) => React.ReactNode;
  width?: string;
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  'urgent': { label: 'Urgente', color: 'bg-red-500 text-white' },
  'high': { label: 'Haute', color: 'bg-keon-terose text-white' },
  'medium': { label: 'Moyenne', color: 'bg-keon-orange text-white' },
  'low': { label: 'Basse', color: 'bg-keon-green text-white' },
};

function renderStatus(status: string) {
  const label = TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] || status;
  const colors = TASK_STATUS_COLORS[status as keyof typeof TASK_STATUS_COLORS];
  if (!colors) return <span>{status}</span>;
  return <Badge className={cn('text-xs', colors.bg, colors.text)}>{label}</Badge>;
}

function renderPriority(priority: string) {
  const p = priorityLabels[priority] || priorityLabels['medium'];
  return <Badge variant="outline" className={cn('text-xs', p.color)}>{p.label}</Badge>;
}

function renderDate(dateStr: string | null) {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  } catch {
    return '-';
  }
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'task_number', label: 'N° Tâche', defaultVisible: true, render: (t) => t.task_number || '-' },
  { key: 'title', label: 'Titre', defaultVisible: true, render: (t) => <span className="font-medium max-w-[250px] truncate block">{t.title}</span>, width: 'max-w-[250px]' },
  { key: 'status', label: 'Statut', defaultVisible: true, render: (t) => renderStatus(t.status) },
  { key: 'priority', label: 'Priorité', defaultVisible: true, render: (t) => renderPriority(t.priority) },
  { key: 'due_date', label: 'Échéance', defaultVisible: true, render: (t) => renderDate(t.due_date) },
  { key: 'source', label: 'Source', defaultVisible: true, render: (t) => {
    if (t.planner_task_id) return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Planner</Badge>;
    if (t.parent_request_id) return <Badge variant="outline" className="text-xs bg-keon-orange/10 text-keon-orange border-keon-orange/30">Demande</Badge>;
    return <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">Directe</Badge>;
  }},
  { key: 'created_at', label: 'Créé le', defaultVisible: false, render: (t) => renderDate(t.created_at) },
  { key: 'updated_at', label: 'Modifié le', defaultVisible: false, render: (t) => renderDate(t.updated_at) },
  { key: 'category', label: 'Catégorie', defaultVisible: false, render: (t) => t.category || '-' },
  { key: 'description', label: 'Description', defaultVisible: false, render: (t) => <span className="max-w-[200px] truncate block">{t.description || '-'}</span> },
  { key: 'assignee_id', label: 'Assigné à', defaultVisible: false, render: (t) => t.assignee_id ? '✓' : '-' },
  { key: 'planner_labels', label: 'Étiquettes Planner', defaultVisible: false, render: (t) => t.planner_labels || '-' },
];

const STORAGE_KEY_PREFIX = 'tasktable-columns';

export function TaskTableWidget({ tasks, onTaskClick, processId }: TaskTableWidgetProps) {
  const storageKey = processId ? `${STORAGE_KEY_PREFIX}-${processId}` : STORAGE_KEY_PREFIX;

  // Show only tasks (not requests)
  const taskItems = useMemo(() => tasks.filter(t => t.type === 'task' || (t.type !== 'request')), [tasks]);

  const { sortedData, sortConfig, handleSort } = useTableSort(taskItems, 'created_at', 'desc');
  const displayTasks = sortedData.slice(0, 100);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* fallthrough */ }
    }
    return ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
  }, [visibleColumns, storageKey]);

  const activeColumns = useMemo(
    () => ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)),
    [visibleColumns]
  );

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  return (
    <div className="overflow-auto h-full flex flex-col">
      {/* Column selector toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b bg-muted/30 shrink-0">
        <span className="text-xs text-muted-foreground font-medium">
          {taskItems.length} tâche{taskItems.length > 1 ? 's' : ''}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
              <Columns3 className="h-3.5 w-3.5" />
              Colonnes
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Colonnes visibles</p>
            <div className="space-y-1 max-h-[260px] overflow-y-auto">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 px-1 py-0.5 text-sm cursor-pointer hover:bg-muted rounded">
                  <Checkbox
                    checked={visibleColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              {activeColumns.map(col => (
                <SortableTableHead
                  key={col.key}
                  sortKey={col.key}
                  currentSortKey={sortConfig.key as string}
                  currentDirection={sortConfig.direction}
                  onSort={handleSort}
                  className="font-semibold text-foreground text-xs"
                >
                  {col.label}
                </SortableTableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayTasks.map((task) => (
              <TableRow
                key={task.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onTaskClick?.(task)}
              >
                {activeColumns.map(col => (
                  <TableCell key={col.key} className="text-sm">
                    {col.render(task)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {displayTasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={activeColumns.length} className="text-center text-muted-foreground py-8">
                  Aucune tâche à afficher
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {taskItems.length > 100 && (
        <p className="text-xs text-muted-foreground text-center py-2 shrink-0">
          Affichage des 100 premières tâches sur {taskItems.length}
        </p>
      )}
    </div>
  );
}
