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

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
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
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Search,
  Activity,
  AlertTriangle,
  ShieldCheck,
  UserX,
  UserPlus,
  Ban,
  Loader2,
  FolderOpen,
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
import {
  useRequestStates,
  MACRO_STATE_CATEGORIES,
  macroStateColor,
  type MacroStateCategory,
} from '@/hooks/useRequestStates';

// ─── Constantes ──────────────────────────────────────────────────────────────

const BE_PROCESS_TEMPLATE_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';
const BE_WORKER_POSTES = ['ingenieur_etudes', 'projeteur'];
// Groupe de collaborateurs « SERVICE BUREAUX D'ETUDES » — source de vérité de
// l'appartenance au BE. Toute personne hors de ce groupe ne doit pas apparaître
// dans les dropdowns d'affectation, même si son champ be_poste est renseigné.
const BE_COLLAB_GROUP_ID = '301ffee1-718f-42af-aec0-545cf4765ffa';

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
          title="Saisie en heures (1j = 8h)"
        />
        <span className="text-[10px] text-muted-foreground shrink-0">h</span>
      </div>
    );
  }

  // Affichage compact : 1 jour = 8h.
  //  - < 8h          → "Xh"   (ex. "4h")
  //  - multiple de 8 → "Nj"   (ex. "8h → 1j", "24h → 3j")
  //  - sinon         → "Nj Zh" (ex. "10h → 1j 2h")
  const formatDuration = (h: number): string => {
    if (h < 8) return `${h}h`;
    const days = Math.floor(h / 8);
    const rem = h - days * 8;
    if (rem === 0) return `${days}j`;
    return `${days}j ${rem}h`;
  };
  const display = initial != null ? formatDuration(initial) : '—';
  const tooltipText = initial != null
    ? `Temps prévu : ${initial}h (= ${display}). Alimente le plan de charge à l'affectation.`
    : `Temps prévu — alimente le plan de charge à l'affectation`;
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
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AssigneeSelector({
  taskId,
  parentRequestId,
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
  parentRequestId?: string | null;
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
  const navigate = useNavigate();

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

        // notifications.user_id = auth.users.id (PAS profile.id) → on résout
        // assigneeId/requesterId (profile.id) vers leur user_id auth via profiles.
        const profileIdsToResolve = [assigneeId, requesterId].filter(Boolean) as string[];
        const authIdByProfile = new Map<string, string>();
        if (profileIdsToResolve.length > 0) {
          const { data: prfs } = await sb
            .from('profiles')
            .select('id, user_id')
            .in('id', profileIdsToResolve);
          (prfs ?? []).forEach((p: any) => {
            if (p.user_id) authIdByProfile.set(p.id, p.user_id);
          });
        }

        const notifications: any[] = [];

        // Notifier l'assigné (si ce n'est pas soi-même)
        const assigneeAuthId = assigneeId ? authIdByProfile.get(assigneeId) : null;
        if (assigneeAuthId && assigneeAuthId !== user?.id) {
          notifications.push({
            user_id: assigneeAuthId,
            title: `Affecté : ${taskLabel}`,
            message: `Vous avez été affecté(e) à une tâche BE${projectSuffix}.`,
            type: 'be_affectee',
            related_entity_type: 'task',
            related_entity_id: taskId,
          });
        }

        // Notifier le demandeur (si différent de l'opérateur et de l'assigné)
        const requesterAuthId = requesterId ? authIdByProfile.get(requesterId) : null;
        if (requesterAuthId && requesterAuthId !== user?.id && requesterId !== assigneeId) {
          notifications.push({
            user_id: requesterAuthId,
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
    onSuccess: (_data, assigneeId) => {
      qc.invalidateQueries({ queryKey: ['be-dispatch-tasks'] });
      // Rafraîchit la charge hebdo affichée sous chaque profil
      qc.invalidateQueries({ queryKey: ['user-week-load'] });
      onAssigned();

      if (assigneeId) {
        // Affecté à un collaborateur → on bascule sur le Plan de charge,
        // pré-filtré sur la demande + le salarié, pour placer la tâche sur
        // une date par drag-drop.
        toast.success('Tâche assignée — ouverture du plan de charge');
        const params = new URLSearchParams();
        if (parentRequestId) params.set('demandId', parentRequestId);
        params.set('userId', assigneeId);
        navigate(`/workload?${params.toString()}`);
      } else {
        toast.success('Affectation retirée');
      }
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

  const { updateBEStatus, submitValidationOutcome, isUpdating } = useBETaskStatus();
  // Validation à 3 issues sur a_relire : dialog pour 'complement' / 'refuse'
  const [validationOpen, setValidationOpen] = useState<null | 'complement' | 'refuse'>(null);
  const [validationComment, setValidationComment] = useState('');
  const [isSubmittingValidation, setIsSubmittingValidation] = useState(false);

  // ── Identité de l'utilisateur courant (avec support simulation) ──────────
  // Permet d'afficher les boutons d'action UNIQUEMENT à la personne concernée :
  //  - "Commencer" / "Soumettre" → uniquement à l'assignée de la tâche
  //  - "Valider" (a_relire → a_valider) → uniquement au dispatch manager
  //    (ou aux validateurs niveau 1/2 si configurés sur la prestation)
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const currentProfileId = (isSimulating && simulatedProfile ? simulatedProfile : authProfile)?.id ?? null;

  const isAssignee = currentProfileId !== null && task.assignee_id === currentProfileId;
  const isDispatchManager = currentProfileId !== null
    && task.sub_process_template?.dispatch_manager_id === currentProfileId;
  // Validateurs explicites configurés sur task_templates (héritage à la création)
  const isValidator1 = currentProfileId !== null
    && (task as any).validator_level_1_id === currentProfileId;
  const isValidator2 = currentProfileId !== null
    && (task as any).validator_level_2_id === currentProfileId;
  const canValidateAtRelire = isDispatchManager || isValidator1 || isValidator2;

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
          <span
            className="text-sm font-medium leading-tight break-words"
            style={{
              // Permet le retour à la ligne mais limite à 2 lignes max via line-clamp
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={presName}
          >
            {presName}
          </span>
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
        parentRequestId={task.parent_request_id}
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

      {/* affectee → en_cours : SEULEMENT l'assignée peut démarrer */}
      {!isBlocked && task.be_status === 'affectee' && isAssignee && (
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

      {/* en_cours → a_relire : SEULEMENT l'assignée peut soumettre */}
      {!isBlocked && task.be_status === 'en_cours' && isAssignee && (
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

      {/* a_relire → 3 issues : Valider / Demande de complément / Refuser
          SEULEMENT le manager de dispatch (ou validateur N1/N2 configuré) */}
      {!isBlocked && task.be_status === 'a_relire' && canValidateAtRelire && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Demande de complément (renvoi à l'exécutant, commentaire obligatoire) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  onClick={() => { setValidationComment(''); setValidationOpen('complement'); }}
                  disabled={isSubmittingValidation || isUpdating}
                >
                  <UserPlus className="h-3 w-3" />
                  <span className="hidden xl:inline">Complément</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Demande de complément (commentaire requis, renvoyé à l'exécutant)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Refuser (clôture refusée, commentaire obligatoire) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => { setValidationComment(''); setValidationOpen('refuse'); }}
                  disabled={isSubmittingValidation || isUpdating}
                >
                  <Ban className="h-3 w-3" />
                  <span className="hidden xl:inline">Refuser</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Refuser (clôture refusée, commentaire requis)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Valider (étape suivante) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={async () => {
                    setIsSubmittingValidation(true);
                    try {
                      await submitValidationOutcome({
                        taskId: task.id,
                        outcome: 'validate',
                        taskLabel: presName,
                        projectCode,
                        assigneeId: task.assignee_id,
                        requesterId,
                        parentRequestId: task.parent_request_id,
                      });
                      onRefresh();
                    } catch { /* déjà notifié */ } finally { setIsSubmittingValidation(false); }
                  }}
                  disabled={isSubmittingValidation || isUpdating}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="hidden lg:inline">Valider</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Valider — passer à « À valider »</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Dialog commentaire pour Complément / Refus */}
          <AlertDialog
            open={validationOpen !== null}
            onOpenChange={(o) => { if (!o) { setValidationOpen(null); setValidationComment(''); } }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {validationOpen === 'refuse' ? 'Refuser cette étape' : 'Demande de complément'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {validationOpen === 'refuse'
                    ? 'L\'étape sera clôturée comme refusée. Précisez le motif du refus (obligatoire).'
                    : 'L\'étape repart à l\'exécutant pour complément. Précisez ce qui est attendu (obligatoire).'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea
                value={validationComment}
                onChange={(e) => setValidationComment(e.target.value)}
                placeholder={validationOpen === 'refuse' ? 'Motif du refus…' : 'Détail du complément attendu…'}
                rows={4}
                autoFocus
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmittingValidation}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!validationOpen) return;
                    setIsSubmittingValidation(true);
                    try {
                      await submitValidationOutcome({
                        taskId: task.id,
                        outcome: validationOpen,
                        comment: validationComment,
                        taskLabel: presName,
                        projectCode,
                        assigneeId: task.assignee_id,
                        requesterId,
                        parentRequestId: task.parent_request_id,
                      });
                      setValidationOpen(null);
                      setValidationComment('');
                      onRefresh();
                    } catch { /* déjà notifié */ } finally { setIsSubmittingValidation(false); }
                  }}
                  disabled={isSubmittingValidation || !validationComment.trim()}
                  className={validationOpen === 'refuse' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
                >
                  {isSubmittingValidation ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {validationOpen === 'refuse' ? 'Refuser' : 'Demander complément'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const isGlobal = !projectId;

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [assignFilter, setAssignFilter] = useState<'all' | 'unassigned'>('all');
  // Filtres additionnels (mode global uniquement) — fusion de l'ancien /be/suivi
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [statusBEFilter, setStatusBEFilter] = useState<string>('all');
  const [macroStateFilter, setMacroStateFilter] = useState<'all' | MacroStateCategory>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // ── Auto-ouverture depuis URL (?requestId=...) ───────────────────────────
  // Quand l'utilisateur clique sur une notification "Nouvelle demande BE",
  // on arrive ici avec ?requestId=<uuid>. On reset les filtres bloquants,
  // on expand la demande et on nettoie le paramètre URL.
  useEffect(() => {
    const rid = searchParams.get('requestId');
    if (!rid) return;
    // Reset des filtres qui pourraient masquer la demande
    setOverdueOnly(false);
    setAssignFilter('all');
    setMacroStateFilter('all');
    // Auto-expand la demande ciblée
    setExpandedRequests(prev => {
      const next = new Set(prev);
      next.add(rid);
      return next;
    });
    // Nettoie le paramètre URL sans recharger la page
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('requestId');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  // ── États métier BE (request_states) ──────────────────────────────────────
  const { statesByCode: beStatesByCode, labelOf: beStateLabelOf } = useRequestStates(BE_PROCESS_TEMPLATE_ID);
  const [searchQuery, setSearchQuery] = useState('');
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
          validation_level_1, validation_level_2,
          validator_level_1_id, validator_level_2_id,
          assignee:profiles!tasks_assignee_id_fkey(id, display_name),
          sub_process_template:sub_process_templates!tasks_sub_process_template_id_fkey(id, name, be_category, dispatch_manager_id, order_index, parallel_group),
          be_project:be_projects!tasks_be_project_id_fkey(code_projet, nom_projet)
        `)
        .eq('type', 'task')
        .not('be_status', 'is', null)
        .not('be_status', 'eq', 'cloturee')
        .not('status', 'eq', 'cancelled')
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
          be_project_id, be_affaire_id, request_number, current_state_code,
          requester:profiles!tasks_requester_id_fkey(display_name),
          be_project:be_projects!tasks_be_project_id_fkey(code_projet, nom_projet)
        `)
        .eq('type', 'request')
        .not('status', 'eq', 'cancelled')
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
  // Source de vérité = appartenance au groupe « SERVICE BUREAUX D'ETUDES ».
  // Seules les personnes membres de ce groupe sont éligibles à l'affectation.
  const { data: profiles = [] } = useQuery({
    queryKey: ['be-team-profiles', BE_COLLAB_GROUP_ID],
    queryFn: async (): Promise<Profile[]> => {
      // 0. Récupère les user_id membres du groupe BE
      const { data: groupMembers } = await sb
        .from('collaborator_group_members')
        .select('user_id')
        .eq('group_id', BE_COLLAB_GROUP_ID);

      const beMemberIds = new Set<string>(
        (groupMembers ?? []).map((m: any) => m.user_id).filter(Boolean),
      );

      if (beMemberIds.size === 0) {
        // Groupe vide ou inaccessible — on n'affiche personne plutôt que de
        // tomber dans l'ancien comportement (qui exposait des non-BE).
        return [];
      }

      const memberIdsArr = Array.from(beMemberIds);

      // 1. Exécutants : ingenieur_etudes + projeteur ET membres du groupe BE
      const { data: workers } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', memberIdsArr)
        .in('be_poste', BE_WORKER_POSTES)
        .in('status', ['active', 'external'])
        .order('display_name');

      // 2. Managers dispatch définis dans les sous-étapes BE
      //    On les conserve UNIQUEMENT s'ils sont membres du groupe BE.
      const { data: tplRows } = await sb
        .from('sub_process_templates')
        .select('dispatch_manager_id')
        .eq('process_template_id', BE_PROCESS_TEMPLATE_ID)
        .not('dispatch_manager_id', 'is', null);

      const managerIds = [...new Set<string>(
        (tplRows ?? [])
          .map((r: any) => r.dispatch_manager_id)
          .filter((id: string) => id && beMemberIds.has(id)),
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
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  /** Prédicat partagé par les filtres requête + tâche standalone. */
  const matchesTaskFilters = useCallback((t: BETaskRow): boolean => {
    if (urgencyFilter !== 'all' && t.be_urgency !== urgencyFilter) return false;
    if (assignFilter === 'unassigned' && t.assignee_id) return false;
    if (statusBEFilter !== 'all' && t.be_status !== statusBEFilter) return false;
    if (assigneeFilter === 'unassigned') {
      if (t.assignee_id) return false;
    } else if (assigneeFilter !== 'all') {
      if (t.assignee_id !== assigneeFilter) return false;
    }
    if (projectFilter !== 'all') {
      if (t.be_project?.code_projet !== projectFilter) return false;
    }
    if (overdueOnly) {
      if (!t.due_date || t.due_date >= todayStr || t.be_status === 'cloturee') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        (t.task_number ?? '').toLowerCase().includes(q) ||
        (t.title ?? '').toLowerCase().includes(q) ||
        (t.sub_process_template?.name ?? '').toLowerCase().includes(q) ||
        (t.be_project?.code_projet ?? '').toLowerCase().includes(q) ||
        (t.be_project?.nom_projet ?? '').toLowerCase().includes(q) ||
        (t.assignee?.display_name ?? '').toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  }, [urgencyFilter, assignFilter, statusBEFilter, assigneeFilter, projectFilter, overdueOnly, searchQuery, todayStr]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const children = tasksByRequest.get(req.id) ?? [];
      if (children.length === 0) return false;
      // La demande est gardée si AU MOINS une de ses tâches matche les filtres
      // (l'urgence est aussi évaluée au niveau demande pour cohérence avec l'ancien comportement).
      if (urgencyFilter !== 'all' && req.be_urgency !== urgencyFilter) return false;
      // Filtre catégorie macro d'état (basé sur current_state_code de la demande)
      if (macroStateFilter !== 'all') {
        const code = (req as any).current_state_code as string | null;
        const macro = code ? (beStatesByCode.get(code)?.state_category ?? null) : null;
        if (macro !== macroStateFilter) return false;
      }
      // Si recherche par n° de demande, on matche aussi sur req.request_number / req.title
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const reqMatches =
          (req.request_number ?? '').toLowerCase().includes(q) ||
          (req.title ?? '').toLowerCase().includes(q);
        if (reqMatches) return true; // demande matche directement
      }
      return children.some(matchesTaskFilters);
    });
  }, [requests, tasksByRequest, urgencyFilter, searchQuery, matchesTaskFilters, macroStateFilter, beStatesByCode]);

  const standaloneFiltered = useMemo(() => {
    const st = tasksByRequest.get('__standalone__') ?? [];
    return st.filter(matchesTaskFilters);
  }, [tasksByRequest, matchesTaskFilters]);

  const totalUnassigned = useMemo(() => tasks.filter(t => !t.assignee_id).length, [tasks]);
  const totalARelire = useMemo(() => tasks.filter(t => t.be_status === 'a_relire').length, [tasks]);

  // ── KPIs (mode global uniquement) ────────────────────────────────────────
  const kpis = useMemo(() => {
    let active = 0;
    let overdue = 0;
    let toValidate = 0;
    let unassigned = 0;
    const activeProjects = new Set<string>();
    for (const t of tasks) {
      if (t.be_status === 'cloturee') continue;
      active += 1;
      const projectCode = t.be_project?.code_projet;
      if (projectCode) activeProjects.add(projectCode);
      if (t.due_date && t.due_date < todayStr) overdue += 1;
      if (t.be_status === 'a_relire' || t.be_status === 'a_valider') toValidate += 1;
      if (!t.assignee_id && t.be_status === 'soumise') unassigned += 1;
    }
    return { active, overdue, toValidate, unassigned, activeProjects: activeProjects.size };
  }, [tasks, todayStr]);

  // Listes uniques pour les selects (mode global)
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.be_project) map.set(t.be_project.code_projet, t.be_project.nom_projet);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.assignee) map.set(t.assignee.id, t.assignee.display_name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const activeFilterCount =
    (urgencyFilter !== 'all' ? 1 : 0) +
    (assignFilter !== 'all' ? 1 : 0) +
    (statusBEFilter !== 'all' ? 1 : 0) +
    (macroStateFilter !== 'all' ? 1 : 0) +
    (assigneeFilter !== 'all' ? 1 : 0) +
    (projectFilter !== 'all' ? 1 : 0) +
    (overdueOnly ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const resetFilters = () => {
    setUrgencyFilter('all');
    setAssignFilter('all');
    setStatusBEFilter('all');
    setMacroStateFilter('all');
    setAssigneeFilter('all');
    setProjectFilter('all');
    setOverdueOnly(false);
    setSearchQuery('');
  };

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
      {/* ── KPIs (mode global uniquement) ──────────────────────────────── */}
      {isGlobal && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <KpiCard
            label="Prestations actives"
            value={kpis.active}
            icon={Activity}
            accent="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            onClick={() => { setStatusBEFilter('all'); setOverdueOnly(false); setAssigneeFilter('all'); }}
          />
          <KpiCard
            label="En retard"
            value={kpis.overdue}
            icon={AlertTriangle}
            accent="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
            onClick={() => { setOverdueOnly(true); setStatusBEFilter('all'); setAssigneeFilter('all'); }}
          />
          <KpiCard
            label="À valider / relire"
            value={kpis.toValidate}
            icon={ShieldCheck}
            accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            onClick={() => { setStatusBEFilter('a_relire'); setOverdueOnly(false); setAssigneeFilter('all'); }}
          />
          <KpiCard
            label="Non assignées"
            value={kpis.unassigned}
            icon={UserX}
            accent="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            onClick={() => { setAssigneeFilter('unassigned'); setStatusBEFilter('all'); setOverdueOnly(false); }}
          />
          <KpiCard
            label="Projets actifs"
            value={kpis.activeProjects}
            icon={FolderOpen}
            accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          />
        </div>
      )}

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

          {/* ── Barre de filtres avancés (mode global) ─────────────────── */}
          {isGlobal && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher (n° tâche, projet, prestation, assigné...)"
                  className="pl-8 h-8 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select value={statusBEFilter} onValueChange={setStatusBEFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Statut BE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {(['soumise','affectee','en_cours','a_relire','a_valider','a_deposer','en_instruction','complement_demande','cloturee'] as const).map((s) => {
                    const meta = getBEStatusMeta(s);
                    return (
                      <SelectItem key={s} value={s}>
                        {meta.icon} {meta.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select value={macroStateFilter} onValueChange={(v) => setMacroStateFilter(v as any)}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="État demande" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous états</SelectItem>
                  {MACRO_STATE_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[170px] h-8 text-xs">
                  <SelectValue placeholder="Projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous projets</SelectItem>
                  {projectOptions.map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      <span className="font-mono text-[10px] mr-1">{code}</span>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Assigné" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous assignés</SelectItem>
                  <SelectItem value="unassigned">Non assignées</SelectItem>
                  {assigneeOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={overdueOnly ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setOverdueOnly((v) => !v)}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                En retard
              </Button>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={resetFilters}>
                  <X className="h-3.5 w-3.5" />
                  Réinitialiser ({activeFilterCount})
                </Button>
              )}
            </div>
          )}
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
                          {(req as any).current_state_code && (() => {
                            const st = beStatesByCode.get((req as any).current_state_code);
                            const macro = st?.state_category ?? null;
                            return (
                              <Badge
                                className={cn(
                                  'text-[10px] px-1.5 py-0 border-0',
                                  macro ? macroStateColor(macro) : 'bg-slate-100 text-slate-700',
                                )}
                                title={st?.label ?? (req as any).current_state_code}
                              >
                                {beStateLabelOf((req as any).current_state_code)}
                              </Badge>
                            );
                          })()}
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
                        {/* Bouton pour ajouter une sous-tâche manuelle (en plus du processus) */}
                        <AddManualSubTask
                          parentRequest={req}
                          profiles={profiles}
                          onAdded={refetch}
                        />
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

// ─── Card KPI interne ─────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  const Comp: any = clickable ? 'button' : 'div';
  return (
    <Comp
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={cn('text-left', clickable && 'cursor-pointer transition-transform hover:-translate-y-0.5')}
    >
      <Card className={cn('border-border/60', clickable && 'hover:shadow-md hover:border-primary/30')}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className={cn('p-2 rounded-lg shrink-0', accent)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
          </div>
        </CardContent>
      </Card>
    </Comp>
  );
}

// ─── Ajout d'une sous-tâche manuelle (hors processus) ────────────────────────
/**
 * Permet au manager BE d'ajouter une sous-tâche libre à une demande, en
 * complément des étapes définies par le processus (sub_process_template).
 * La tâche créée :
 *  - hérite de be_project_id, be_affaire_id, be_urgency, requester_id de la demande
 *  - n'a PAS de sub_process_template_id (signe « ad-hoc »)
 *  - démarre en be_status='soumise' (à dispatcher) ou 'affectee' si assigné
 *  - peut être planifiée comme n'importe quelle autre tâche
 */
function AddManualSubTask({
  parentRequest,
  profiles,
  onAdded,
}: {
  parentRequest: any;
  profiles: Profile[];
  onAdded: () => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [durationHours, setDurationHours] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setAssigneeId('');
    setDurationHours('');
    setDueDate('');
    setEditing(false);
  };

  const handleSave = async () => {
    const t = title.trim();
    if (!t) {
      toast.error('Le titre est requis');
      return;
    }
    setIsSaving(true);
    try {
      const dur = durationHours.trim() ? parseFloat(durationHours) : null;
      const insertPayload: Record<string, any> = {
        title: `${parentRequest.title} — ${t}`,
        type: 'task',
        status: 'todo',
        be_project_id: parentRequest.be_project_id,
        be_affaire_id: parentRequest.be_affaire_id,
        be_urgency: parentRequest.be_urgency ?? 'normal',
        be_status: assigneeId ? 'affectee' : 'soumise',
        parent_request_id: parentRequest.id,
        // Pas de sub_process_template_id : tâche ad-hoc, hors processus
        sub_process_template_id: null,
        assignee_id: assigneeId || null,
        duration_hours: dur,
        due_date: dueDate || null,
        user_id: user?.id,
        requester_id: parentRequest.requester_id,
        source_process_template_id: BE_PROCESS_TEMPLATE_ID,
        process_template_id: BE_PROCESS_TEMPLATE_ID,
      };
      const { error } = await sb.from('tasks').insert(insertPayload);
      if (error) throw error;
      toast.success('Sous-tâche ajoutée');
      reset();
      onAdded();
    } catch (e: any) {
      console.error('[AddManualSubTask] insert error', e);
      toast.error(e?.message || 'Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground hover:bg-muted/30 hover:text-primary border-t border-dashed transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter une sous-tâche manuelle
      </button>
    );
  }

  return (
    <div className="px-4 py-3 border-t bg-muted/20 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la sous-tâche"
          className="h-8 text-xs flex-1 min-w-[200px]"
          autoFocus
        />
        <Select value={assigneeId || '__none__'} onValueChange={(v) => setAssigneeId(v === '__none__' ? '' : v)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Assigner..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Non assigné</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0}
          step={0.5}
          value={durationHours}
          onChange={(e) => setDurationHours(e.target.value)}
          placeholder="Durée h"
          className="h-8 w-20 text-xs"
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ajouter'}
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={reset} disabled={isSaving}>
          Annuler
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Cette sous-tâche s'ajoute aux étapes du processus. Elle suivra le même workflow BE.
      </p>
    </div>
  );
}
