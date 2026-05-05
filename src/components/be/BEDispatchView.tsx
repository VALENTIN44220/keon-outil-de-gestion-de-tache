/**
 * BEDispatchView — Vue de dispatch/assignation des tâches Bureau d'Études.
 *
 * Mode projet  : projectId fourni → tâches du projet uniquement
 * Mode global  : projectId absent → toutes les tâches BE actives, tous projets
 *
 * Workflow :
 *   soumise ──[assignation]──▶ affectee ──[Commencer]──▶ en_cours
 *   ──[Soumettre]──▶ a_relire ──[Valider]──▶ a_valider ──▶ …
 *
 * Profils proposés dans le sélecteur :
 *   • Tous les profils be_poste IN ('ingenieur_etudes','projeteur')
 *   • + les managers dispatch (dispatch_manager_id dans sub_process_templates BE)
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
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
  Play,
  X,
  Info,
  ExternalLink,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getBEStatusMeta } from '@/hooks/useBETaskStatus';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BEStatusBadge } from '@/components/be/BEStatusBadge';
import { NewBERequestDialog } from '@/components/be/NewBERequestDialog';
import { useBETaskStatus } from '@/hooks/useBETaskStatus';
import { useUserWeekLoad, type UserWeekLoad } from '@/hooks/useUserWeekLoad';
import { clearBETaskSlots, resyncBESlots } from '@/lib/be/distributeBESlots';

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
  task_number: string | null;
  request_number: string | null;
  status: string;
  be_status: string | null;
  be_urgency: 'normal' | 'urgent' | 'critique' | null;
  parent_request_id: string | null;
  assignee_id: string | null;
  sub_process_template_id: string | null;
  due_date: string | null;
  start_date: string | null;
  duration_hours: number | null;
  created_at: string;
  type: string;
  document_url: string | null;
  assignee?: { id: string; display_name: string } | null;
  sub_process_template?: {
    id: string;
    name: string;
    be_category: string | null;
    dispatch_manager_id: string | null;
    order_index: number | null;
    /** Étapes consécutives partageant le même groupe = parallèles. NULL = séquentielle. */
    parallel_group: number | null;
  } | null;
  be_project?: { code_projet: string; nom_projet: string } | null;
}

/**
 * Statuts BE qui "débloquent" la tâche suivante dans la séquence d'une demande.
 * Une tâche à order_index N est active seulement si la tâche N-1 a atteint l'un de ces statuts.
 */
const SEQUENCED_UNLOCK_STATUSES = new Set([
  'a_valider', 'a_deposer', 'en_instruction', 'complement_demande', 'cloturee',
]);

/**
 * Calcule l'ensemble des IDs de tâches "bloquées" par un groupe précédent
 * non encore entièrement validé.
 *
 * Algorithme :
 *   1. Trier les tâches d'une demande par order_index.
 *   2. Constituer des « groupes » consécutifs :
 *      - tâches avec le même `parallel_group` non-null → même groupe (parallèles)
 *      - tâche avec parallel_group=NULL → groupe solo (1 tâche)
 *   3. Parcourir les groupes : dès qu'un groupe n'est PAS entièrement validé
 *      (au moins une tâche du groupe pas en SEQUENCED_UNLOCK_STATUSES),
 *      toutes les tâches des groupes suivants sont bloquées.
 *
 * Cas dégénéré (tous parallel_group=NULL) = comportement strictement séquentiel
 * comme avant — rétrocompatible.
 */
function computeBlockedTasks(tasks: BETaskRow[]): Set<string> {
  const blocked = new Set<string>();

  const byRequest = new Map<string, BETaskRow[]>();
  for (const t of tasks) {
    if (!t.parent_request_id) continue;
    if (!byRequest.has(t.parent_request_id)) byRequest.set(t.parent_request_id, []);
    byRequest.get(t.parent_request_id)!.push(t);
  }

  for (const siblings of byRequest.values()) {
    if (siblings.length <= 1) continue;

    const sorted = [...siblings].sort((a, b) => {
      const oa = a.sub_process_template?.order_index ?? 9999;
      const ob = b.sub_process_template?.order_index ?? 9999;
      if (oa !== ob) return oa - ob;
      return a.created_at.localeCompare(b.created_at);
    });

    // Constituer les groupes parallèles consécutifs
    const groups: BETaskRow[][] = [];
    let currentGroup: BETaskRow[] = [];
    let currentKey: string | null = null;
    for (const t of sorted) {
      const pg = t.sub_process_template?.parallel_group ?? null;
      // Clé unique par groupe : si pg=null → solo (clé unique par tâche),
      //                         si pg non-null → partagée
      const key = pg === null ? `solo-${t.id}` : `pg-${pg}`;
      if (key === currentKey && currentGroup.length > 0) {
        currentGroup.push(t);
      } else {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [t];
        currentKey = key;
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    // Parcourir les groupes : dès qu'un groupe n'est pas entièrement validé,
    // les tâches des groupes suivants sont bloquées (mais pas celles du groupe en cours)
    let blocked_from_here = false;
    for (const group of groups) {
      if (blocked_from_here) {
        for (const t of group) blocked.add(t.id);
        continue;
      }
      const allUnlocked = group.every(t =>
        SEQUENCED_UNLOCK_STATUSES.has(t.be_status ?? ''),
      );
      if (!allUnlocked) {
        // Le groupe en cours n'est pas finalisé : les groupes suivants sont bloqués.
        // Les tâches DE ce groupe restent actives (parallèles entre elles).
        blocked_from_here = true;
      }
    }
  }

  return blocked;
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

/**
 * Édition inline du temps prévu (heures) d'une tâche BE.
 * Le manager saisit l'estimation à la création/affectation pour que
 * `distributeBESlots` puisse matérialiser la charge.
 */
function DurationHoursField({
  taskId,
  initial,
  onSaved,
}: {
  taskId: string;
  initial: number | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial != null ? String(initial) : '');
  const qc = useQueryClient();

  const save = async () => {
    const trimmed = value.trim();
    const parsed = trimmed === '' ? null : parseFloat(trimmed);
    if (parsed != null && (isNaN(parsed) || parsed < 0 || parsed > 1000)) {
      toast.error('Heures invalides (0 à 1000)');
      return;
    }
    const { error } = await sb
      .from('tasks')
      .update({ duration_hours: parsed })
      .eq('id', taskId);
    if (error) {
      toast.error(error.message || 'Erreur de sauvegarde');
      return;
    }
    setEditing(false);

    // Auto-resync : si la tâche est déjà planifiée (slots existants), on
    // ajuste les slots pour matcher la nouvelle durée. Garde la même date
    // de départ et le même assigné. Si la nouvelle durée est null/0, les
    // slots sont supprimés.
    try {
      const result = await resyncBESlots(taskId);
      if (result) {
        if (result.truncated) {
          toast.warning(
            `Plan de charge ajusté : ${result.hoursPlaced}h posées (fenêtre trop courte pour ${parsed}h).`,
          );
        } else if (result.slotsCreated > 0) {
          toast.success(`Plan de charge mis à jour (${result.slotsCreated} demi-journée${result.slotsCreated > 1 ? 's' : ''}).`);
        }
      }
    } catch (e) {
      console.warn('[DurationHoursField] resyncBESlots failed', e);
      toast.warning('Plan de charge non resynchronisé (erreur). La durée est tout de même enregistrée.');
    }

    qc.invalidateQueries({ queryKey: ['be-dispatch-tasks'] });
    qc.invalidateQueries({ queryKey: ['user-week-load'] });
    onSaved();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <Input
          type="number"
          min={0}
          max={1000}
          step={0.5}
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setEditing(false);
              setValue(initial != null ? String(initial) : '');
            }
          }}
          onBlur={save}
          className="h-7 w-16 text-xs"
          placeholder="h"
        />
      </div>
    );
  }

  const display = initial != null ? `${initial}h` : '—';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              'h-7 px-2 text-xs rounded border border-dashed shrink-0 transition-colors',
              initial != null
                ? 'border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:bg-violet-900/20'
                : 'border-muted-foreground/30 text-muted-foreground/60 hover:border-primary hover:text-primary',
            )}
          >
            ⏱ {display}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Temps prévu — alimente le plan de charge à l'affectation
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AssigneeSelector({
  taskId,
  currentAssigneeId,
  currentBeStatus,
  requesterId,
  taskLabel,
  projectCode,
  profiles,
  loadByUser,
  durationHours,
  startDate,
  dueDate,
  onAssigned,
}: {
  taskId: string;
  currentAssigneeId: string | null;
  currentBeStatus: string | null;
  requesterId?: string | null;
  taskLabel: string;
  projectCode?: string | null;
  profiles: Profile[];
  /** Charge hebdomadaire par utilisateur pour aider le manager à équilibrer. */
  loadByUser: Map<string, UserWeekLoad>;
  /** Temps prévu pour la tâche (heures). Sert à matérialiser des slots de plan de charge. */
  durationHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  onAssigned: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const isAssigning = !!assigneeId;

      // Calcule le nouveau be_status si nécessaire
      let newBeStatus: string | undefined;
      if (isAssigning && currentBeStatus === 'soumise') {
        newBeStatus = 'affectee';
      } else if (!isAssigning && currentBeStatus === 'affectee') {
        newBeStatus = 'soumise';
      }

      const updatePayload: Record<string, any> = { assignee_id: assigneeId };
      if (newBeStatus) updatePayload.be_status = newBeStatus;

      const { error } = await sb.from('tasks').update(updatePayload).eq('id', taskId);
      if (error) throw error;

      // ── Plan de charge : nettoyer les anciens slots à la désassignation/réaffectation
      // (la planification effective se fait par drag-drop manuel du manager dans /workload,
      // pas en automatique — on n'impose pas de créneau).
      if (!isAssigning && currentAssigneeId) {
        try {
          await clearBETaskSlots(taskId, currentAssigneeId);
        } catch (e) {
          console.warn('[AssigneeSelector] clearBETaskSlots failed', e);
        }
      }
      if (isAssigning && currentAssigneeId && currentAssigneeId !== assigneeId) {
        try {
          await clearBETaskSlots(taskId, currentAssigneeId);
        } catch (e) {
          console.warn('[AssigneeSelector] clearBETaskSlots (reassign) failed', e);
        }
      }

      // Notifications lors d'une affectation
      if (isAssigning && newBeStatus === 'affectee') {
        const projectSuffix = projectCode ? ` — ${projectCode}` : '';
        const assigneeName = profiles.find(p => p.id === assigneeId)?.display_name ?? '';
        const notifications: any[] = [];

        // Notifier l'assigné (si ce n'est pas soi-même)
        if (assigneeId !== user?.id) {
          notifications.push({
            user_id: assigneeId,
            title: `Affecté : ${taskLabel}`,
            message: `Vous avez été affecté(e) à une tâche BE${projectSuffix}.`,
            type: 'be_affectee',
            related_entity_type: 'task',
            related_entity_id: taskId,
          });
        }

        // Notifier le demandeur (si différent de l'opérateur et de l'assigné)
        if (requesterId && requesterId !== user?.id && requesterId !== assigneeId) {
          notifications.push({
            user_id: requesterId,
            title: 'Demande prise en charge',
            message: `Votre demande a été affectée${assigneeName ? ` à ${assigneeName}` : ''}${projectSuffix}.`,
            type: 'be_affectee_requester',
            related_entity_type: 'task',
            related_entity_id: taskId,
          });
        }

        if (notifications.length > 0) {
          await sb.from('notifications').insert(notifications);
        }
      }
    },
    onSuccess: () => {
      toast.success('Tâche assignée');
      qc.invalidateQueries({ queryKey: ['be-dispatch-tasks'] });
      // Rafraîchit la charge hebdo affichée sous chaque profil
      qc.invalidateQueries({ queryKey: ['user-week-load'] });
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
        {[...profiles]
          // Tri par charge croissante : les plus disponibles en premier
          .sort((a, b) => {
            const la = loadByUser.get(a.id)?.hoursBooked ?? 0;
            const lb = loadByUser.get(b.id)?.hoursBooked ?? 0;
            return la - lb;
          })
          .map(p => {
            const load = loadByUser.get(p.id);
            const pct = load?.percent ?? 0;
            const loadColor =
              pct >= 100 ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
              : pct >= 80 ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
              : 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400';
            return (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex items-center gap-2 w-full">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px] bg-primary/10">
                      {p.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1">{p.display_name}</span>
                  {load && (
                    <span
                      className={cn(
                        'text-[9px] font-mono px-1.5 py-0.5 rounded tabular-nums shrink-0',
                        loadColor,
                      )}
                      title={`${load.hoursBooked}h prévues cette semaine sur ${load.capacityHours}h (${pct}%)`}
                    >
                      {load.hoursBooked}h/{load.capacityHours}h
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
      </SelectContent>
    </Select>
  );
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  profiles,
  loadByUser,
  showProject,
  isBlocked,
  requesterId,
  onRequestDetail,
  onRefresh,
}: {
  task: BETaskRow;
  profiles: Profile[];
  loadByUser: Map<string, UserWeekLoad>;
  showProject?: boolean;
  isBlocked?: boolean;
  requesterId?: string | null;
  onRequestDetail?: () => void;
  onRefresh: () => void;
}) {
  const presName = task.sub_process_template?.name ?? task.title;
  const presCat = task.sub_process_template?.be_category ?? null;
  const isARelire = task.be_status === 'a_relire';
  const projectCode = task.be_project?.code_projet;

  const { updateBEStatus, isUpdating } = useBETaskStatus();

  const changeStatus = async (newStatus: string) => {
    await updateBEStatus({
      taskId: task.id,
      status: newStatus as any,
      notify: {
        taskLabel: presName,
        projectCode,
        dispatchManagerId: task.sub_process_template?.dispatch_manager_id ?? null,
        assigneeId: task.assignee_id,
      },
    });
    onRefresh();
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b last:border-0 transition-colors',
        isBlocked
          ? 'opacity-50 bg-muted/20'
          : isARelire
          ? 'bg-amber-50/60 dark:bg-amber-900/15 border-l-2 border-l-amber-400'
          : !task.assignee_id
          ? 'bg-amber-50/30 dark:bg-amber-900/10'
          : '',
      )}
    >
      {/* Pastille statut interactive (non-interactive si tâche bloquée) */}
      <BEStatusBadge
        status={task.be_status}
        dot
        taskId={isBlocked ? undefined : task.id}
        onStatusChange={isBlocked ? undefined : onRefresh}
      />

      {/* Infos prestation */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showProject && task.be_project && (
            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 shrink-0">
              {task.be_project.code_projet}
            </Badge>
          )}
          {/* Identifiant tâche — cohérent avec le backlog /workload */}
          {task.task_number && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] px-1 py-0 shrink-0 text-muted-foreground"
              title={`Tâche : ${task.task_number}`}
            >
              {task.task_number}
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
          {isBlocked && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 text-slate-500 border-slate-300 dark:text-slate-400 shrink-0"
            >
              ⏳ En attente
            </Badge>
          )}
          {!isBlocked && isARelire && (
            <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
              À relire
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <BEStatusBadge
            status={task.be_status}
            compact
            taskId={isBlocked ? undefined : task.id}
            onStatusChange={isBlocked ? undefined : onRefresh}
          />
          <UrgencyBadge urgency={task.be_urgency} />
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground">
              Échéance : {format(new Date(task.due_date), 'dd/MM/yy')}
            </span>
          )}
        </div>
      </div>

      {/* Lien vers la demande parente */}
      {onRequestDetail && task.parent_request_id && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground/60 hover:text-primary"
                onClick={onRequestDetail}
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Détail de la demande</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Lien document */}
      <DocumentLinkField taskId={task.id} initialUrl={task.document_url} />

      {/* Sélecteur assignataire (toujours visible même pour les tâches bloquées — pré-assignation possible) */}
      {/* Temps prévu (heures) — utilisé pour matérialiser les workload_slots à l'affectation */}
      <DurationHoursField
        taskId={task.id}
        initial={task.duration_hours}
        onSaved={onRefresh}
      />

      <AssigneeSelector
        taskId={task.id}
        currentAssigneeId={task.assignee_id}
        currentBeStatus={task.be_status}
        requesterId={requesterId}
        taskLabel={presName}
        projectCode={projectCode}
        profiles={profiles}
        loadByUser={loadByUser}
        durationHours={task.duration_hours}
        startDate={task.start_date}
        dueDate={task.due_date}
        onAssigned={onRefresh}
      />

      {/* Boutons workflow — masqués pour les tâches bloquées */}

      {/* affectee → en_cours : l'assigné démarre la tâche */}
      {!isBlocked && task.be_status === 'affectee' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1 text-xs shrink-0 text-indigo-600 border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                onClick={() => changeStatus('en_cours')}
                disabled={isUpdating}
              >
                <Play className="h-3 w-3" />
                <span className="hidden lg:inline">Commencer</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Démarrer la réalisation</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* en_cours → a_relire : l'assigné soumet son travail */}
      {!isBlocked && task.be_status === 'en_cours' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1 text-xs shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={() => changeStatus('a_relire')}
                disabled={isUpdating}
              >
                <Send className="h-3 w-3" />
                <span className="hidden lg:inline">Soumettre</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Soumettre à relecture du manager</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* a_relire → a_valider : le manager valide */}
      {!isBlocked && task.be_status === 'a_relire' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="h-7 px-2 gap-1 text-xs shrink-0 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => changeStatus('a_valider')}
                disabled={isUpdating}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden lg:inline">Valider</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Valider — passer à « À valider »</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Placeholder pour maintenir l'alignement quand aucun bouton n'est affiché */}
      {(isBlocked || !['affectee', 'en_cours', 'a_relire'].includes(task.be_status ?? '')) && (
        <div className="w-[72px] shrink-0" />
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
  const navigate = useNavigate();
  const isGlobal = !projectId;

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [assignFilter, setAssignFilter] = useState<'all' | 'unassigned'>('all');
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // ── Chargement tâches ──────────────────────────────────────────────────────
  const { data: tasks = [], isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ['be-dispatch-tasks', projectId ?? 'global'],
    queryFn: async (): Promise<BETaskRow[]> => {
      let q = sb
        .from('tasks')
        .select(`
          id, title, task_number, request_number, status, be_status, be_urgency,
          parent_request_id, assignee_id, sub_process_template_id,
          due_date, start_date, duration_hours, created_at, type, document_url,
          assignee:profiles!tasks_assignee_id_fkey(id, display_name),
          sub_process_template:sub_process_templates!tasks_sub_process_template_id_fkey(id, name, be_category, dispatch_manager_id, order_index, parallel_group),
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
          id, title, description, be_urgency, created_at, requester_id,
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

  // ── Charge hebdomadaire (heures) par profil pour la semaine en cours ──────
  // Alimente l'AssigneeSelector pour aider le manager à équilibrer les
  // affectations selon le plan de charge réel.
  const profileIds = useMemo(() => profiles.map((p) => p.id), [profiles]);
  const { loadByUser } = useUserWeekLoad(profileIds);

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

  /** IDs des tâches bloquées par une tâche précédente non encore validée dans la même demande */
  const blockedTaskIds = useMemo(() => computeBlockedTasks(tasks), [tasks]);

  /** Demande sélectionnée pour le panneau de détail */
  const selectedRequest = useMemo(
    () => requests.find(r => r.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );
  const selectedChildren = useMemo(
    () => (selectedRequestId ? (tasksByRequest.get(selectedRequestId) ?? []) : []),
    [tasksByRequest, selectedRequestId],
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
            Assignez → l'intervenant clique sur{' '}
            <span className="font-medium text-indigo-600">Commencer</span> puis sur{' '}
            <span className="font-medium text-blue-600">Soumettre</span> quand son travail est
            prêt → le manager clique sur{' '}
            <span className="font-medium text-amber-600">Valider</span>.
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
                const unassignedCount = filteredChildren.filter(t => !t.assignee_id && !blockedTaskIds.has(t.id)).length;
                const aRelireCount = filteredChildren.filter(t => t.be_status === 'a_relire' && !blockedTaskIds.has(t.id)).length;
                const blockedCount = filteredChildren.filter(t => blockedTaskIds.has(t.id)).length;
                const activeCount = filteredChildren.length - blockedCount;

                return (
                  <div key={req.id}>
                    {/* En-tête de la demande */}
                    <div className="w-full flex items-center">
                    <button
                      onClick={() => toggleRequest(req.id)}
                      className="flex-1 text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
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
                          <span>{activeCount} prestation(s) active{activeCount > 1 ? 's' : ''}{blockedCount > 0 ? `, ${blockedCount} en attente` : ''}</span>
                        </div>
                      </div>
                    </button>
                    {/* Bouton détail demande */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 mr-2 text-muted-foreground hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); setSelectedRequestId(req.id); }}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Voir le détail de la demande</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    </div>

                    {/* Tâches enfant */}
                    {isExpanded && (
                      <div className="ml-6 border-l-2 border-muted">
                        {filteredChildren.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            profiles={profiles}
                            loadByUser={loadByUser}
                            showProject={false}
                            isBlocked={blockedTaskIds.has(task.id)}
                            requesterId={req.requester_id}
                            onRequestDetail={task.parent_request_id ? () => setSelectedRequestId(task.parent_request_id!) : undefined}
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
                      loadByUser={loadByUser}
                      showProject={isGlobal}
                      isBlocked={blockedTaskIds.has(task.id)}
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

      {/* ── Dialog détail demande ──────────────────────────────────────────── */}
      <Dialog open={!!selectedRequest} onOpenChange={open => { if (!open) setSelectedRequestId(null); }}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedRequest?.be_project && (
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedRequest.be_project.code_projet}
                </Badge>
              )}
              <UrgencyBadge urgency={selectedRequest?.be_urgency} />
            </div>
            <DialogTitle className="text-lg leading-tight pr-8">
              {selectedRequest?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pt-2">
            {/* Métadonnées */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selectedRequest?.requester?.display_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Demandeur :</span>
                  <span className="font-medium">{selectedRequest.requester.display_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Date :</span>
                <span>{selectedRequest ? format(new Date(selectedRequest.created_at), 'dd MMM yyyy', { locale: fr }) : ''}</span>
              </div>
              {selectedRequest?.be_project && (
                <div className="flex items-center gap-2 col-span-2">
                  <ExternalLink className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-muted-foreground">Projet :</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-sm font-medium text-primary"
                    onClick={() => {
                      setSelectedRequestId(null);
                      navigate(`/be/projects/${selectedRequest.be_project.code_projet}/overview`);
                    }}
                  >
                    {selectedRequest.be_project.code_projet} — {selectedRequest.be_project.nom_projet}
                  </Button>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedRequest?.description && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedRequest.description}</p>
                  </div>
                </div>
              </>
            )}

            {/* Prestations */}
            {selectedChildren.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Prestations ({selectedChildren.length})
                  </p>
                  <div className="space-y-2">
                    {[...selectedChildren]
                      .sort((a, b) => {
                        const oa = a.sub_process_template?.order_index ?? 9999;
                        const ob = b.sub_process_template?.order_index ?? 9999;
                        return oa - ob;
                      })
                      .map(child => {
                        const meta = getBEStatusMeta(child.be_status);
                        const isChildBlocked = blockedTaskIds.has(child.id);
                        const assignee = child.assignee;
                        return (
                          <div
                            key={child.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-lg border',
                              isChildBlocked ? 'opacity-50 bg-muted/20' : 'bg-card',
                            )}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: meta.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {child.sub_process_template?.name ?? child.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn('text-[10px] px-1.5 py-0 border', meta.bgClass, meta.textClass)}
                                  style={{ borderColor: meta.color + '50' }}
                                >
                                  {meta.icon} {meta.label}
                                </Badge>
                                {isChildBlocked && (
                                  <span className="text-[10px] text-muted-foreground">⏳ En attente</span>
                                )}
                              </div>
                            </div>
                            {assignee ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                <User className="h-3 w-3" />
                                <span>{assignee.display_name}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-amber-600 shrink-0">Non assigné</span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
