/**
 * BEDispatchView — Vue de dispatch/assignation des tâches Bureau d'Études.
 *
 * Mode projet  : projectId fourni → tâches du projet uniquement
 * Mode global  : projectId absent → toutes les tâches BE actives, tous projets
 *
 * Workflow :
 *   en_cours ──[Soumettre]──▶ a_relire ──[Valider]──▶ a_valider ──▶ …
 *
 * Profils proposés dans le sélecteur :
 *   • Tous les profils be_poste IN ('ingenieur_etudes','projeteur')
 *   • + les managers dispatch (dispatch_manager_id dans sub_process_templates BE)
 */

import { useState, useMemo, useRef, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
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
  ChevronDown,
  ChevronRight,
  UserCheck,
  Zap,
  Filter,
  ClipboardList,
  Plus,
  Link as LinkIcon,
  Pencil,
  Send,
  CheckCircle2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BEStatusBadge } from '@/components/be/BEStatusBadge';
import { NewBERequestDialog } from '@/components/be/NewBERequestDialog';

// ─── Constantes ──────────────────────────────────────────────────────────────

const BE_PROCESS_TEMPLATE_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';
const BE_WORKER_POSTES = ['ingenieur_etudes', 'projeteur'];

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
  document_url: string | null;
  assignee?: { id: string; display_name: string } | null;
  sub_process_template?: { id: string; name: string; be_category: string | null } | null;
  be_project?: { code_projet: string; nom_projet: string } | null;
}

interface Profile {
  id: string;
  display_name: string;
}

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

/**
 * Champ lien document — affichage compact, édition inline.
 * Clique sur l'icône pour éditer ; Entrée/Échap/blur pour valider/annuler.
 */
function DocumentLinkField({
  taskId,
  initialUrl,
}: {
  taskId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const mutation = useMutation({
    mutationFn: async (newUrl: string) => {
      const { error } = await sb
        .from('tasks')
        .update({ document_url: newUrl.trim() || null })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => toast.success('Lien sauvegardé'),
    onError: (err: any) => toast.error(err.message || 'Erreur'),
  });

  const save = () => {
    mutation.mutate(url);
    setEditing(false);
  };

  const cancel = () => {
    setUrl(initialUrl ?? '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <Input
          ref={inputRef}
          value={url}
          onChange={e => setUrl(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
          placeholder="https://…"
          className="h-7 text-xs w-44"
        />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={cancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (url) {
    return (
      <div className="flex items-center gap-1 shrink-0 max-w-[130px]">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1 min-w-0"
          title={url}
        >
          <LinkIcon className="h-3 w-3 shrink-0" />
          <span className="truncate hidden md:inline max-w-[80px]">
            {url.replace(/^https?:\/\//, '')}
          </span>
        </a>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 shrink-0 opacity-50 hover:opacity-100"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-2.5 w-2.5" />
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-muted-foreground shrink-0"
            onClick={() => setEditing(true)}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Ajouter un lien document</TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

// ─── TaskRow ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  profiles,
  showProject,
  onRefresh,
}: {
  task: BETaskRow;
  profiles: Profile[];
  showProject?: boolean;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const presName = (task.sub_process_template as any)?.name ?? task.title;
  const presCat = (task.sub_process_template as any)?.be_category ?? null;
  const isARelire = task.be_status === 'a_relire';

  const changeStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await sb
        .from('tasks')
        .update({ be_status: newStatus })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      qc.invalidateQueries({ queryKey: ['be-dispatch-tasks'] });
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message || 'Erreur'),
  });

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b last:border-0 transition-colors',
        isARelire
          ? 'bg-amber-50/60 dark:bg-amber-900/15 border-l-2 border-l-amber-400'
          : !task.assignee_id
          ? 'bg-amber-50/30 dark:bg-amber-900/10'
          : '',
      )}
    >
      {/* Pastille statut interactive */}
      <BEStatusBadge status={task.be_status} dot taskId={task.id} onStatusChange={onRefresh} />

      {/* Infos prestation */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showProject && task.be_project && (
            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 shrink-0">
              {task.be_project.code_projet}
            </Badge>
          )}
          <span className="text-sm font-medium truncate">{presName}</span>
          {presCat === 'be_reglementaire' && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 text-amber-600 border-amber-300 dark:text-amber-400 shrink-0"
            >
              Régl.
            </Badge>
          )}
          {isARelire && (
            <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
              À relire
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <BEStatusBadge status={task.be_status} compact taskId={task.id} onStatusChange={onRefresh} />
          <UrgencyBadge urgency={task.be_urgency} />
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground">
              Échéance : {format(new Date(task.due_date), 'dd/MM/yy')}
            </span>
          )}
        </div>
      </div>

      {/* Lien document */}
      <DocumentLinkField taskId={task.id} initialUrl={task.document_url} />

      {/* Sélecteur assignataire */}
      <AssigneeSelector
        taskId={task.id}
        currentAssigneeId={task.assignee_id}
        profiles={profiles}
        onAssigned={onRefresh}
      />

      {/* Bouton workflow rapide */}
      {task.be_status === 'en_cours' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1 text-xs shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={() => changeStatus.mutate('a_relire')}
                disabled={changeStatus.isPending}
              >
                <Send className="h-3 w-3" />
                <span className="hidden lg:inline">Soumettre</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Soumettre à relecture du manager</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {task.be_status === 'a_relire' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="h-7 px-2 gap-1 text-xs shrink-0 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => changeStatus.mutate('a_valider')}
                disabled={changeStatus.isPending}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden lg:inline">Valider</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Valider — passer à « À déposer »</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BEDispatchViewProps {
  /** Fourni = mode projet. Absent = mode global (tous projets). */
  projectId?: string;
  projectCode?: string;
}

export function BEDispatchView({ projectId, projectCode }: BEDispatchViewProps) {
  const qc = useQueryClient();
  const isGlobal = !projectId;

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [assignFilter, setAssignFilter] = useState<'all' | 'unassigned'>('all');
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [showNewRequest, setShowNewRequest] = useState(false);

  // ── Chargement tâches ──────────────────────────────────────────────────────
  const { data: tasks = [], isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ['be-dispatch-tasks', projectId ?? 'global'],
    queryFn: async (): Promise<BETaskRow[]> => {
      let q = sb
        .from('tasks')
        .select(`
          id, title, status, be_status, be_urgency,
          parent_request_id, assignee_id, sub_process_template_id,
          due_date, created_at, type, document_url,
          assignee:profiles!tasks_assignee_id_fkey(id, display_name),
          sub_process_template:sub_process_templates!tasks_sub_process_template_id_fkey(id, name, be_category),
          be_project:be_projects!tasks_be_project_id_fkey(code_projet, nom_projet)
        `)
        .eq('type', 'task')
        .not('be_status', 'is', null)
        .not('be_status', 'eq', 'cloturee')
        .order('be_urgency', { ascending: false })
        .order('created_at', { ascending: true });

      if (projectId) {
        q = q.eq('be_project_id', projectId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as BETaskRow[]) ?? [];
    },
  });

  // ── Chargement demandes parentes ───────────────────────────────────────────
  const { data: requests = [] } = useQuery({
    queryKey: ['be-dispatch-requests', projectId ?? 'global'],
    queryFn: async () => {
      let q = sb
        .from('tasks')
        .select(`
          id, title, be_urgency, created_at,
          requester:profiles!tasks_requester_id_fkey(display_name),
          be_project:be_projects!tasks_be_project_id_fkey(code_projet, nom_projet)
        `)
        .eq('type', 'request')
        .order('created_at', { ascending: false });

      if (projectId) {
        q = q.eq('be_project_id', projectId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // ── Chargement profils BE (exécutants + managers dispatch) ─────────────────
  const { data: profiles = [] } = useQuery({
    queryKey: ['be-team-profiles'],
    queryFn: async (): Promise<Profile[]> => {
      // 1. Exécutants : ingenieur_etudes + projeteur
      const { data: workers } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('be_poste', BE_WORKER_POSTES)
        .in('status', ['active', 'external'])
        .order('display_name');

      // 2. Managers dispatch définis dans les sous-étapes BE
      const { data: tplRows } = await sb
        .from('sub_process_templates')
        .select('dispatch_manager_id')
        .eq('process_template_id', BE_PROCESS_TEMPLATE_ID)
        .not('dispatch_manager_id', 'is', null);

      const managerIds = [...new Set<string>(
        (tplRows ?? []).map((r: any) => r.dispatch_manager_id).filter(Boolean),
      )];
      const existingIds = new Set((workers ?? []).map((p: any) => p.id));
      const missingIds = managerIds.filter(id => !existingIds.has(id));

      let allProfiles: Profile[] = [...(workers ?? [])];

      if (missingIds.length > 0) {
        const { data: managerData } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', missingIds)
          .in('status', ['active', 'external']);
        allProfiles = [
          ...allProfiles,
          ...(managerData ?? []),
        ].sort((a, b) => a.display_name.localeCompare(b.display_name));
      }

      return allProfiles;
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
      const matchAssign = assignFilter === 'all' || children.some(t => !t.assignee_id);
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

  const totalUnassigned = useMemo(() => tasks.filter(t => !t.assignee_id).length, [tasks]);
  const totalARelire = useMemo(() => tasks.filter(t => t.be_status === 'a_relire').length, [tasks]);

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
              {isGlobal ? 'Dispatch BE — Tous projets' : 'Dispatch des tâches BE'}
              {totalUnassigned > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                  {totalUnassigned} non assignée{totalUnassigned > 1 ? 's' : ''}
                </Badge>
              )}
              {totalARelire > 0 && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                  {totalARelire} à relire
                </Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtre urgence */}
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

              {/* Filtre assignation */}
              <Button
                variant={assignFilter === 'unassigned' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setAssignFilter(p => (p === 'all' ? 'unassigned' : 'all'))}
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

          {/* Légende workflow */}
          <p className="text-[11px] text-muted-foreground mt-1">
            L'intervenant clique sur{' '}
            <span className="font-medium text-blue-600">Soumettre</span> quand son travail est
            prêt, puis le manager clique sur{' '}
            <span className="font-medium text-amber-600">Valider</span> après relecture.
          </p>
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
              <p className="text-xs mt-1">Créez une nouvelle demande pour démarrer.</p>
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
                  const matchUrgency = urgencyFilter === 'all' || t.be_urgency === urgencyFilter;
                  const matchAssign = assignFilter === 'all' || !t.assignee_id;
                  return matchUrgency && matchAssign;
                });
                if (filteredChildren.length === 0) return null;

                const isExpanded = expandedRequests.has(req.id);
                const unassignedCount = filteredChildren.filter(t => !t.assignee_id).length;
                const aRelireCount = filteredChildren.filter(t => t.be_status === 'a_relire').length;

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
                          {/* Badge projet en mode global */}
                          {isGlobal && req.be_project && (
                            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 shrink-0">
                              {req.be_project.code_projet}
                            </Badge>
                          )}
                          <span className="text-sm font-medium truncate">{req.title}</span>
                          <UrgencyBadge urgency={req.be_urgency} />
                          {unassignedCount > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 text-amber-600 border-amber-300 dark:text-amber-400"
                            >
                              {unassignedCount} à assigner
                            </Badge>
                          )}
                          {aRelireCount > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 text-blue-600 border-blue-300 dark:text-blue-400"
                            >
                              {aRelireCount} à relire
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          {req.requester?.display_name && (
                            <span>Demandeur : {req.requester.display_name}</span>
                          )}
                          <span>
                            {format(new Date(req.created_at), 'dd MMM yyyy', { locale: fr })}
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
                            showProject={false}
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
                      showProject={isGlobal}
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
          qc.invalidateQueries({ queryKey: ['be-dispatch-tasks'] });
          qc.invalidateQueries({ queryKey: ['be-dispatch-requests'] });
        }}
      />
    </>
  );
}
