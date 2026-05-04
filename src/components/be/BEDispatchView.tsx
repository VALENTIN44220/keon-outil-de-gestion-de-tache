/**
 * BEDispatchView — Vue de dispatch/assignation des tâches Bureau d'Études.
 *
 * Affiche toutes les tâches BE d'un projet qui n'ont pas encore d'assignataire
 * (ou dont le statut est 'en_cours' / 'a_relire' etc.), groupées par demande parente.
 *
 * Permet au responsable dispatch :
 *  - d'assigner chaque tâche à un membre de l'équipe
 *  - de changer le be_status via BEStatusBadge
 *  - de filtrer par urgence ou prestation
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Zap,
  Filter,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BEStatusBadge } from '@/components/be/BEStatusBadge';
import { NewBERequestDialog } from '@/components/be/NewBERequestDialog';
import type { BETaskStatus } from '@/hooks/useBETaskStatus';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BETaskRow {
  id: string;
  title: string;
  status: string;
  be_status: string | null;
  be_urgency: 'normal' | 'urgent' | 'critique' | null;
  parent_request_id: string | null;
  assignee_id: string | null;
  sub_process_template_id: string | null;
  due_date: string | null;
  created_at: string;
  type: string;
  // Joined
  assignee?: { id: string; display_name: string } | null;
  sub_process_template?: { id: string; name: string; be_category: string | null } | null;
}

interface Profile {
  id: string;
  display_name: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const BE_PROCESS_TEMPLATE_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

const sb = supabase as any;

const URGENCY_META: Record<string, { label: string; color: string; bg: string; textClass: string }> = {
  normal: {
    label: 'Normal',
    color: '#64748b',
    bg: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-600 dark:text-slate-400',
  },
  urgent: {
    label: 'Urgent',
    color: '#f59e0b',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  critique: {
    label: 'Critique',
    color: '#ef4444',
    bg: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: string | null | undefined }) {
  const meta = URGENCY_META[urgency ?? 'normal'] ?? URGENCY_META.normal;
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 font-medium border', meta.bg, meta.textClass)}
      style={{ borderColor: meta.color + '50' }}
    >
      {urgency === 'critique' ? '🔴 ' : urgency === 'urgent' ? '🟠 ' : ''}
      {meta.label}
    </Badge>
  );
}

function AssigneeSelector({
  taskId,
  currentAssigneeId,
  profiles,
  onAssigned,
}: {
  taskId: string;
  currentAssigneeId: string | null;
  profiles: Profile[];
  onAssigned: () => void;
}) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const { error } = await sb
        .from('tasks')
        .update({ assignee_id: assigneeId })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tâche assignée');
      qc.invalidateQueries({ queryKey: ['be-dispatch-tasks'] });
      onAssigned();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erreur lors de l'assignation");
    },
  });

  const current = profiles.find(p => p.id === currentAssigneeId);

  return (
    <Select
      value={currentAssigneeId ?? '__none__'}
      onValueChange={v => mutation.mutate(v === '__none__' ? null : v)}
      disabled={mutation.isPending}
    >
      <SelectTrigger
        className={cn(
          'h-7 text-xs gap-1 min-w-[130px] max-w-[160px]',
          !currentAssigneeId && 'text-muted-foreground border-dashed',
        )}
      >
        {current ? (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-4 w-4">
              <AvatarFallback className="text-[8px] bg-primary/10">
                {current.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{current.display_name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5" />
            <span>Non assigné</span>
          </div>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground italic">Non assigné</span>
        </SelectItem>
        {profiles.map(p => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] bg-primary/10">
                  {p.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {p.display_name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BEDispatchViewProps {
  projectId: string | undefined;
  projectCode?: string;
}

export function BEDispatchView({ projectId, projectCode }: BEDispatchViewProps) {
  const qc = useQueryClient();

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [assignFilter, setAssignFilter] = useState<'all' | 'unassigned'>('all');
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [showNewRequest, setShowNewRequest] = useState(false);

  // ── Chargement tâches ──────────────────────────────────────────────────────
  const { data: tasks = [], isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ['be-dispatch-tasks', projectId],
    queryFn: async (): Promise<BETaskRow[]> => {
      if (!projectId) return [];
      const { data, error } = await sb
        .from('tasks')
        .select(`
          id, title, status, be_status, be_urgency,
          parent_request_id, assignee_id, sub_process_template_id,
          due_date, created_at, type,
          assignee:profiles!tasks_assignee_id_fkey(id, display_name),
          sub_process_template:sub_process_templates!tasks_sub_process_template_id_fkey(id, name, be_category)
        `)
        .eq('be_project_id', projectId)
        .eq('type', 'task')
        .not('be_status', 'is', null)
        .not('be_status', 'eq', 'cloturee')
        .order('be_urgency', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as BETaskRow[]) ?? [];
    },
    enabled: !!projectId,
  });

  // ── Chargement demandes parentes ───────────────────────────────────────────
  const { data: requests = [] } = useQuery({
    queryKey: ['be-dispatch-requests', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await sb
        .from('tasks')
        .select('id, title, be_urgency, created_at, requester:profiles!tasks_requester_id_fkey(display_name)')
        .eq('be_project_id', projectId)
        .eq('type', 'request')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!projectId,
  });

  // ── Chargement profils (uniquement les intervenants BE définis dans les templates) ──
  const { data: profiles = [] } = useQuery({
    queryKey: ['be-team-profiles'],
    queryFn: async (): Promise<Profile[]> => {
      // 1. Récupère les IDs distincts des intervenants définis dans les sous-étapes BE
      const { data: tplRows } = await sb
        .from('sub_process_templates')
        .select('dispatch_manager_id, user_id')
        .eq('process_template_id', BE_PROCESS_TEMPLATE_ID);

      const profileIds = new Set<string>();
      for (const row of tplRows ?? []) {
        if (row.dispatch_manager_id) profileIds.add(row.dispatch_manager_id);
        if (row.user_id) profileIds.add(row.user_id);
      }

      if (profileIds.size === 0) return [];

      // 2. Charge uniquement ces profils (actifs ou externes)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', [...profileIds])
        .in('status', ['active', 'external'])
        .order('display_name');
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });

  // ── Regroupement ──────────────────────────────────────────────────────────
  const tasksByRequest = useMemo(() => {
    const map = new Map<string | null, BETaskRow[]>();
    for (const t of tasks) {
      const key = t.parent_request_id ?? '__standalone__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  // ── Filtrage ──────────────────────────────────────────────────────────────
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const children = tasksByRequest.get(req.id) ?? [];
      if (children.length === 0) return false;

      const matchUrgency = urgencyFilter === 'all' || req.be_urgency === urgencyFilter;
      const matchAssign =
        assignFilter === 'all' || children.some(t => !t.assignee_id);

      return matchUrgency && matchAssign;
    });
  }, [requests, tasksByRequest, urgencyFilter, assignFilter]);

  const standaloneFiltered = useMemo(() => {
    const st = tasksByRequest.get('__standalone__') ?? [];
    return st.filter(t => {
      const matchUrgency = urgencyFilter === 'all' || t.be_urgency === urgencyFilter;
      const matchAssign = assignFilter === 'all' || !t.assignee_id;
      return matchUrgency && matchAssign;
    });
  }, [tasksByRequest, urgencyFilter, assignFilter]);

  const totalUnassigned = useMemo(
    () => tasks.filter(t => !t.assignee_id).length,
    [tasks],
  );

  const toggleRequest = (id: string) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-muted-foreground" />
              Dispatch des tâches BE
              {totalUnassigned > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                  {totalUnassigned} non assignée(s)
                </Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Filtre urgence */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ToggleGroup
                        type="single"
                        value={urgencyFilter}
                        onValueChange={v => setUrgencyFilter(v || 'all')}
                        className="h-7"
                      >
                        <ToggleGroupItem value="all" className="text-xs h-7 px-2">
                          Tout
                        </ToggleGroupItem>
                        <ToggleGroupItem value="critique" className="text-xs h-7 px-2 text-red-600">
                          🔴 Critique
                        </ToggleGroupItem>
                        <ToggleGroupItem value="urgent" className="text-xs h-7 px-2 text-amber-600">
                          🟠 Urgent
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Filtrer par urgence</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Filtre assignation */}
              <Button
                variant={assignFilter === 'unassigned' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  setAssignFilter(p => (p === 'all' ? 'unassigned' : 'all'))
                }
              >
                <Filter className="h-3.5 w-3.5" />
                Non assignées
              </Button>

              {/* Nouvelle demande */}
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowNewRequest(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvelle demande
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {tasksLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Aucune tâche BE active</p>
              <p className="text-xs mt-1">
                Créez une nouvelle demande pour démarrer.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1"
                onClick={() => setShowNewRequest(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvelle demande BE
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {/* ── Demandes groupées ─────────────────────────────── */}
              {filteredRequests.map(req => {
                const children = tasksByRequest.get(req.id) ?? [];
                const filteredChildren = children.filter(t => {
                  const matchUrgency =
                    urgencyFilter === 'all' || t.be_urgency === urgencyFilter;
                  const matchAssign = assignFilter === 'all' || !t.assignee_id;
                  return matchUrgency && matchAssign;
                });
                if (filteredChildren.length === 0) return null;

                const isExpanded = expandedRequests.has(req.id);
                const unassignedCount = filteredChildren.filter(t => !t.assignee_id).length;

                return (
                  <div key={req.id}>
                    {/* En-tête de la demande */}
                    <button
                      onClick={() => toggleRequest(req.id)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {req.title}
                          </span>
                          <UrgencyBadge urgency={req.be_urgency} />
                          {unassignedCount > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 text-amber-600 border-amber-300 dark:text-amber-400"
                            >
                              {unassignedCount} à assigner
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          {req.requester?.display_name && (
                            <span>Demandeur : {req.requester.display_name}</span>
                          )}
                          <span>
                            {format(new Date(req.created_at), 'dd MMM yyyy', {
                              locale: fr,
                            })}
                          </span>
                          <span>{filteredChildren.length} prestation(s)</span>
                        </div>
                      </div>
                    </button>

                    {/* Tâches enfant */}
                    {isExpanded && (
                      <div className="ml-6 border-l-2 border-muted">
                        {filteredChildren.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            profiles={profiles}
                            onRefresh={refetch}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Tâches standalone ─────────────────────────────── */}
              {standaloneFiltered.length > 0 && (
                <>
                  {filteredRequests.length > 0 && (
                    <div className="px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5" />
                      Tâches indépendantes ({standaloneFiltered.length})
                    </div>
                  )}
                  {standaloneFiltered.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      profiles={profiles}
                      onRefresh={refetch}
                    />
                  ))}
                </>
              )}

              {filteredRequests.length === 0 && standaloneFiltered.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Aucune tâche ne correspond aux filtres sélectionnés.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog nouvelle demande */}
      <NewBERequestDialog
        open={showNewRequest}
        onOpenChange={setShowNewRequest}
        defaultProjectId={projectId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['be-dispatch-tasks', projectId] });
          qc.invalidateQueries({ queryKey: ['be-dispatch-requests', projectId] });
        }}
      />
    </>
  );
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  profiles,
  onRefresh,
}: {
  task: BETaskRow;
  profiles: Profile[];
  onRefresh: () => void;
}) {
  const presName = (task.sub_process_template as any)?.name ?? task.title;
  const presCat = (task.sub_process_template as any)?.be_category ?? null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b last:border-0 transition-colors',
        !task.assignee_id && 'bg-amber-50/30 dark:bg-amber-900/10',
      )}
    >
      {/* Pastille statut */}
      <BEStatusBadge status={task.be_status} dot taskId={task.id} />

      {/* Infos prestation */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{presName}</span>
          {presCat === 'be_reglementaire' && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 text-amber-600 border-amber-300 dark:text-amber-400 shrink-0"
            >
              Régl.
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <BEStatusBadge status={task.be_status} compact taskId={task.id} />
          <UrgencyBadge urgency={task.be_urgency} />
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground">
              Échéance : {format(new Date(task.due_date), 'dd/MM/yy')}
            </span>
          )}
        </div>
      </div>

      {/* Sélecteur assignataire */}
      <AssigneeSelector
        taskId={task.id}
        currentAssigneeId={task.assignee_id}
        profiles={profiles}
        onAssigned={onRefresh}
      />
    </div>
  );
}
