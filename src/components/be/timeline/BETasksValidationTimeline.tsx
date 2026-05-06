/**
 * BETasksValidationTimeline — vue « Étapes » de la timeline projet BE.
 *
 * Affiche pour chaque tâche BE du projet une mini-frise horizontale des
 * transitions `be_status` avec leur date (lue depuis tasks.be_status_dates).
 *
 * Les tâches sont regroupées par demande parente. Chaque tâche montre :
 *  - son n° (task_number) + nom (prestation)
 *  - une suite de pastilles statut, chaque pastille avec sa date
 *  - les statuts non encore atteints en gris
 */
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getBEStatusMeta, type BETaskStatus } from '@/hooks/useBETaskStatus';
import type { Task } from '@/types/task';

/** Ordre canonique des statuts BE pour la frise horizontale. */
const STATUS_ORDER: BETaskStatus[] = [
  'soumise', 'affectee', 'en_cours', 'a_relire', 'a_valider',
  'a_deposer', 'en_instruction', 'complement_demande', 'cloturee',
];

interface Props {
  tasks: Task[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function BETasksValidationTimeline({ tasks, searchQuery, onSearchChange }: Props) {
  // Garde uniquement les tâches BE (be_status défini), pas les requests parents
  const beTasks = useMemo(
    () => tasks.filter((t: any) => t.type === 'task' && t.be_status),
    [tasks],
  );

  // Filtre recherche
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return beTasks;
    const q = searchQuery.toLowerCase();
    return beTasks.filter((t: any) =>
      (t.task_number ?? '').toLowerCase().includes(q) ||
      (t.title ?? '').toLowerCase().includes(q),
    );
  }, [beTasks, searchQuery]);

  // Regroupe par demande parente
  const grouped = useMemo(() => {
    const map = new Map<string | null, Task[]>();
    for (const t of filtered) {
      const key = (t as any).parent_request_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    // Tri par task_number à l'intérieur de chaque demande
    for (const arr of map.values()) {
      arr.sort((a: any, b: any) => (a.task_number ?? '').localeCompare(b.task_number ?? ''));
    }
    return [...map.entries()];
  }, [filtered]);

  // Récupère le titre de la demande parente (depuis les tasks elles-mêmes)
  const requestTitleById = useMemo(() => {
    const m = new Map<string, { title: string; number: string | null }>();
    for (const t of tasks) {
      if ((t as any).type === 'request') {
        m.set(t.id, {
          title: (t as any).title ?? '—',
          number: (t as any).request_number ?? null,
        });
      }
    }
    return m;
  }, [tasks]);

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-4">
        {/* Recherche */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Rechercher une tâche (n° ou titre)..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucune tâche BE pour ce projet.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([requestId, taskList]) => {
              const reqInfo = requestId ? requestTitleById.get(requestId) : null;
              return (
                <div key={requestId ?? 'orphan'} className="border rounded-lg overflow-hidden">
                  {/* En-tête demande */}
                  <div className="px-3 py-2 bg-muted/40 flex items-center gap-2 border-b">
                    {reqInfo?.number && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {reqInfo.number}
                      </Badge>
                    )}
                    <span className="text-sm font-medium truncate">
                      {reqInfo?.title ?? 'Tâches non rattachées à une demande'}
                    </span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {taskList.length} tâche{taskList.length > 1 ? 's' : ''}
                    </Badge>
                  </div>

                  {/* Une ligne par tâche */}
                  <div className="divide-y">
                    {taskList.map((task: any) => (
                      <BETaskStatusRow key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Une ligne (= une tâche avec sa frise de statuts) ─────────────────────────
function BETaskStatusRow({ task }: { task: any }) {
  const currentStatus = task.be_status as BETaskStatus | null;
  const dates = (task.be_status_dates as Record<string, string> | null) ?? {};

  // Index du statut courant dans l'ordre canonique
  const currentIdx = currentStatus ? STATUS_ORDER.indexOf(currentStatus) : -1;

  return (
    <div className="px-3 py-3 hover:bg-muted/20 transition-colors">
      {/* En-tête tâche */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {task.task_number && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {task.task_number}
          </Badge>
        )}
        <span className="text-sm font-medium truncate flex-1">{task.title}</span>
        {task.assignee && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            👤 {task.assignee.display_name}
          </span>
        )}
      </div>

      {/* Frise horizontale des statuts */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_ORDER.map((status, idx) => {
          const meta = getBEStatusMeta(status);
          const date = dates[status];
          const isReached = !!date || (currentIdx >= 0 && idx <= currentIdx);
          const isCurrent = currentStatus === status;
          const isFuture = !isReached;

          return (
            <div key={status} className="flex items-center shrink-0">
              <div
                className={cn(
                  'flex flex-col items-center min-w-[68px] px-1.5 py-1 rounded',
                  isCurrent && 'ring-2 ring-primary ring-offset-1',
                  isFuture && 'opacity-30',
                )}
                title={
                  date
                    ? `${meta.label} — ${format(new Date(date), 'dd MMM yyyy à HH:mm', { locale: fr })}`
                    : meta.label
                }
              >
                <div
                  className={cn(
                    'w-3 h-3 rounded-full mb-1',
                    isReached && 'shadow-sm',
                  )}
                  style={{ backgroundColor: isReached ? meta.color : '#cbd5e1' }}
                />
                <span className="text-[9px] text-center leading-tight">
                  {meta.icon} {meta.label}
                </span>
                {date ? (
                  <span className="text-[9px] tabular-nums text-muted-foreground mt-0.5">
                    {format(new Date(date), 'dd/MM/yy', { locale: fr })}
                  </span>
                ) : (
                  <span className="text-[9px] text-muted-foreground/40 mt-0.5">—</span>
                )}
              </div>
              {idx < STATUS_ORDER.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
