/**
 * BERequestsTracking — Suivi des demandes BE côté demandeur.
 *
 * Affiche chaque demande BE avec :
 * - Badge projet + urgence
 * - Barre de progression (prestations clôturées / total)
 * - Liste dépliable des prestations avec leur be_status coloré et l'assigné
 */

import { useState, useEffect, useMemo } from 'react';
import { Task } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { getBEStatusMeta } from '@/hooks/useBETaskStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, FolderOpen, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChildTask {
  id: string;
  parent_request_id: string;
  be_status: string | null;
  sub_process_template?: { name: string } | null;
  assignee?: { display_name: string } | null;
}

interface BEProject {
  id: string;
  code_projet: string;
  nom_projet: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const URGENCY_META: Record<string, { label: string; className: string }> = {
  critique: { label: '🔴 Critique', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400' },
  urgent:   { label: '🟠 Urgent',   className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400' },
  normal:   { label: 'Normal',       className: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400' },
};

const STATUS_ORDER = [
  'soumise', 'affectee', 'en_cours', 'a_relire',
  'a_valider', 'a_deposer', 'en_instruction', 'complement_demande', 'cloturee',
];

/** Extrait le nom de la prestation depuis "Prestation — Sous-étape" */
function extractGroupName(name: string): string {
  const sep = name.indexOf(' — ');
  return sep !== -1 ? name.slice(0, sep).trim() : name.trim();
}

/** Retourne le statut le plus avancé parmi un groupe de tâches */
function dominantStatus(tasks: ChildTask[]): string {
  let best = 'soumise';
  for (const t of tasks) {
    const s = t.be_status ?? 'soumise';
    if (STATUS_ORDER.indexOf(s) > STATUS_ORDER.indexOf(best)) best = s;
  }
  return best;
}

/** Regroupe les tâches enfant par prestation (groupName extrait du template name) */
function groupByPrestation(tasks: ChildTask[]): { groupName: string; tasks: ChildTask[] }[] {
  const map = new Map<string, { groupName: string; tasks: ChildTask[] }>();
  for (const t of tasks) {
    const name = t.sub_process_template?.name ?? '—';
    const gName = extractGroupName(name);
    if (!map.has(gName)) map.set(gName, { groupName: gName, tasks: [] });
    map.get(gName)!.tasks.push(t);
  }
  return Array.from(map.values());
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BERequestsTrackingProps {
  requests: Task[];
  onRequestClick: (task: Task) => void;
}

export function BERequestsTracking({ requests, onRequestClick }: BERequestsTrackingProps) {
  const [childTasks, setChildTasks] = useState<ChildTask[]>([]);
  const [projects, setProjects] = useState<Record<string, BEProject>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const requestIds = useMemo(() => requests.map(r => r.id), [requests]);
  const projectIds = useMemo(
    () => [...new Set(requests.map(r => r.be_project_id).filter(Boolean) as string[])],
    [requests],
  );
  const requestIdsKey = requestIds.join(',');
  const projectIdsKey = projectIds.join(',');

  // Chargement des tâches enfant
  useEffect(() => {
    if (requestIds.length === 0) { setChildTasks([]); return; }
    (supabase as any)
      .from('tasks')
      .select(`
        id, parent_request_id, be_status,
        sub_process_template:sub_process_templates!tasks_sub_process_template_id_fkey(name),
        assignee:profiles!tasks_assignee_id_fkey(display_name)
      `)
      .in('parent_request_id', requestIds)
      .eq('type', 'task')
      .order('created_at', { ascending: true })
      .then(({ data }: any) => setChildTasks(data ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestIdsKey]);

  // Chargement des projets BE
  useEffect(() => {
    if (projectIds.length === 0) { setProjects({}); return; }
    (supabase as any)
      .from('be_projects')
      .select('id, code_projet, nom_projet')
      .in('id', projectIds)
      .then(({ data }: any) => {
        const map: Record<string, BEProject> = {};
        for (const p of data ?? []) map[p.id] = p;
        setProjects(map);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdsKey]);

  // Pré-calcul : tâches enfant groupées par request id
  const childrenByRequest = useMemo(() => {
    const map = new Map<string, ChildTask[]>();
    for (const t of childTasks) {
      if (!map.has(t.parent_request_id)) map.set(t.parent_request_id, []);
      map.get(t.parent_request_id)!.push(t);
    }
    return map;
  }, [childTasks]);

  if (requests.length === 0) return null;

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Bureau d'Études</h3>
        <Badge variant="secondary" className="text-xs">{requests.length}</Badge>
      </div>

      <div className="space-y-2">
        {requests.map(req => {
          const children = childrenByRequest.get(req.id) ?? [];
          const project = req.be_project_id ? projects[req.be_project_id] : null;
          const urgency = (req.be_urgency as string) ?? 'normal';
          const urgMeta = URGENCY_META[urgency] ?? URGENCY_META.normal;
          const isExpanded = expanded.has(req.id);
          const prestations = groupByPrestation(children);
          const totalChildren = children.length;
          const closedChildren = children.filter(c => c.be_status === 'cloturee').length;
          const progressPct = totalChildren > 0 ? Math.round((closedChildren / totalChildren) * 100) : 0;

          return (
            <div key={req.id} className="border rounded-lg overflow-hidden bg-card">
              {/* En-tête */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => toggle(req.id)}
                >
                  {isExpanded
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronRight className="h-3.5 w-3.5" />}
                </Button>

                <button
                  className="flex-1 text-left flex items-center gap-2 flex-wrap min-w-0"
                  onClick={() => onRequestClick(req)}
                >
                  {project && (
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0">
                      {project.code_projet}
                    </Badge>
                  )}
                  <span className="text-sm font-medium truncate">{req.title}</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {urgency !== 'normal' && (
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 border', urgMeta.className)}>
                      {urgMeta.label}
                    </Badge>
                  )}
                  {totalChildren > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {closedChildren}/{totalChildren}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(req.created_at), 'dd MMM', { locale: fr })}
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                </div>
              </div>

              {/* Barre de progression */}
              {totalChildren > 0 && (
                <div className="h-0.5 bg-muted mx-3 rounded-full overflow-hidden mb-0.5">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}

              {/* Prestations dépliées */}
              {isExpanded && (
                <div className="border-t divide-y bg-muted/10">
                  {prestations.length === 0 ? (
                    <p className="px-4 py-2 text-xs text-muted-foreground italic">
                      Aucune prestation créée
                    </p>
                  ) : (
                    prestations.map(({ groupName, tasks }) => {
                      const status = dominantStatus(tasks);
                      const meta = getBEStatusMeta(status);
                      const assigneeNames = [
                        ...new Set(tasks.map(t => t.assignee?.display_name).filter(Boolean)),
                      ].join(', ');

                      return (
                        <div key={groupName} className="flex items-center gap-2 px-4 py-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-xs flex-1 truncate">{groupName}</span>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-1.5 border shrink-0', meta.bgClass, meta.textClass)}
                            style={{ borderColor: meta.color + '60' }}
                          >
                            {meta.icon} {meta.label}
                          </Badge>
                          {assigneeNames && (
                            <span className="text-[10px] text-muted-foreground shrink-0 max-w-[90px] truncate">
                              {assigneeNames}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
