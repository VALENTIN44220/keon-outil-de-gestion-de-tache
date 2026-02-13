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
import { REQUEST_VALIDATION_STATUS_LABELS } from '@/services/requestValidationService';
import { ChevronDown, ChevronRight, Columns3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/services/taskStatusService';

interface DataTableWidgetProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  /** Persisted column selection key */
  processId?: string;
}

// All available columns definition
export interface ColumnDef {
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
  { key: 'request_number', label: 'N° Demande', defaultVisible: true, render: (t) => t.request_number || '-' },
  { key: 'title', label: 'Titre', defaultVisible: true, render: (t) => <span className="font-medium max-w-[250px] truncate block">{t.title}</span>, width: 'max-w-[250px]' },
  { key: 'status', label: 'Statut', defaultVisible: true, render: (t) => renderStatus(t.status) },
  { key: 'priority', label: 'Priorité', defaultVisible: true, render: (t) => renderPriority(t.priority) },
  { key: 'due_date', label: 'Échéance', defaultVisible: true, render: (t) => renderDate(t.due_date) },
  { key: 'request_validation_status', label: 'Validation demande', defaultVisible: false, render: (t) => {
    const status = t.request_validation_status || 'none';
    if (status === 'none') return '-';
    const label = REQUEST_VALIDATION_STATUS_LABELS[status] || status;
    const colorMap: Record<string, string> = {
      'pending_level_1': 'bg-amber-100 text-amber-800',
      'pending_level_2': 'bg-amber-100 text-amber-800',
      'validated': 'bg-emerald-100 text-emerald-800',
      'refused': 'bg-red-100 text-red-800',
      'returned': 'bg-violet-100 text-violet-800',
    };
    return <Badge className={cn('text-xs', colorMap[status] || '')}>{label}</Badge>;
  }},
  { key: 'created_at', label: 'Créé le', defaultVisible: false, render: (t) => renderDate(t.created_at) },
  { key: 'updated_at', label: 'Modifié le', defaultVisible: false, render: (t) => renderDate(t.updated_at) },
  { key: 'type', label: 'Type', defaultVisible: false, render: (t) => t.type === 'request' ? 'Demande' : 'Tâche' },
  { key: 'task_number', label: 'N° Tâche', defaultVisible: false, render: (t) => t.task_number || '-' },
  { key: 'category', label: 'Catégorie', defaultVisible: false, render: (t) => t.category || '-' },
  { key: 'description', label: 'Description', defaultVisible: false, render: (t) => <span className="max-w-[200px] truncate block">{t.description || '-'}</span> },
  { key: 'assignee_id', label: 'Assigné à', defaultVisible: false, render: (t) => t.assignee_id ? '✓' : '-' },
  { key: 'requester_id', label: 'Demandeur', defaultVisible: false, render: (t) => t.requester_id ? '✓' : '-' },
  { key: 'validated_at', label: 'Validé le', defaultVisible: false, render: (t) => renderDate(t.validated_at) },
];

const STORAGE_KEY_PREFIX = 'datatable-columns';

export function DataTableWidget({ tasks, onTaskClick, processId }: DataTableWidgetProps) {
  const storageKey = processId ? `${STORAGE_KEY_PREFIX}-${processId}` : STORAGE_KEY_PREFIX;

  // Only show requests (type === 'request') in top-level
  const requests = useMemo(() => tasks.filter(t => t.type === 'request'), [tasks]);

  const { sortedData, sortConfig, handleSort } = useTableSort(requests, 'created_at', 'desc');
  const displayTasks = sortedData.slice(0, 50);

  // Column visibility
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

  // Expanded rows – child tasks
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [childTasks, setChildTasks] = useState<Task[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);

  const handleExpandRequest = useCallback(async (requestId: string) => {
    if (expandedRequestId === requestId) {
      setExpandedRequestId(null);
      setChildTasks([]);
      return;
    }
    setExpandedRequestId(requestId);
    setLoadingChildren(true);
    const { data } = await (supabase as any)
      .from('tasks')
      .select('*')
      .eq('parent_request_id', requestId)
      .order('created_at', { ascending: true });
    setChildTasks((data as Task[]) || []);
    setLoadingChildren(false);
  }, [expandedRequestId]);

  return (
    <div className="overflow-auto h-full flex flex-col">
      {/* Column selector toolbar */}
      <div className="flex items-center justify-end px-2 py-1 border-b bg-muted/30 shrink-0">
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
              {/* Expand column */}
              <TableHead className="w-8" />
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
            {displayTasks.map((request) => {
              const isExpanded = expandedRequestId === request.id;
              return (
                <RequestRowGroup
                  key={request.id}
                  request={request}
                  isExpanded={isExpanded}
                  childTasks={isExpanded ? childTasks : []}
                  loadingChildren={isExpanded && loadingChildren}
                  activeColumns={activeColumns}
                  onToggleExpand={() => handleExpandRequest(request.id)}
                  onTaskClick={onTaskClick}
                />
              );
            })}
            {displayTasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={activeColumns.length + 1} className="text-center text-muted-foreground py-8">
                  Aucune demande à afficher
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {requests.length > 50 && (
        <p className="text-xs text-muted-foreground text-center py-2 shrink-0">
          Affichage des 50 premières demandes sur {requests.length}
        </p>
      )}
    </div>
  );
}

// Sub-component for a request row + its child tasks
function RequestRowGroup({
  request,
  isExpanded,
  childTasks,
  loadingChildren,
  activeColumns,
  onToggleExpand,
  onTaskClick,
}: {
  request: Task;
  isExpanded: boolean;
  childTasks: Task[];
  loadingChildren: boolean;
  activeColumns: ColumnDef[];
  onToggleExpand: () => void;
  onTaskClick?: (task: Task) => void;
}) {
  return (
    <>
      {/* Request row */}
      <TableRow
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => onTaskClick?.(request)}
      >
        <TableCell className="w-8 px-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        {activeColumns.map(col => (
          <TableCell key={col.key} className="text-sm">
            {col.render(request)}
          </TableCell>
        ))}
      </TableRow>

      {/* Child tasks */}
      {isExpanded && (
        <>
          {loadingChildren ? (
            <TableRow>
              <TableCell colSpan={activeColumns.length + 1} className="py-3">
                <div className="flex items-center gap-2 pl-8 text-muted-foreground text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Chargement des tâches…
                </div>
              </TableCell>
            </TableRow>
          ) : childTasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={activeColumns.length + 1} className="py-2">
                <p className="pl-8 text-muted-foreground text-xs italic">Aucune tâche associée</p>
              </TableCell>
            </TableRow>
          ) : (
            childTasks.map(child => (
              <TableRow
                key={child.id}
                className="bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => onTaskClick?.(child)}
              >
                <TableCell className="w-8 px-1">
                  <span className="pl-3 text-muted-foreground text-xs">↳</span>
                </TableCell>
                {activeColumns.map(col => (
                  <TableCell key={col.key} className="text-sm text-muted-foreground">
                    {col.render(child)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </>
      )}
    </>
  );
}
