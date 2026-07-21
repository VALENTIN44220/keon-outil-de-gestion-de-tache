/**
 * juridiqueDispatchConfig — config Juridique pour ModuleDispatchView.
 *
 * Modèle simple : la demande est la tâche. Le service juridique l'affecte
 * (assignee_id) et fait évoluer son statut. Onglet « Plan de charge » en extra.
 */
import {
  Scale, ListChecks, UserCog, AlertTriangle, CheckCircle2, Clock, User, Calendar,
  Briefcase, Building2, Flag, BarChart2,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TaskStats } from '@/types/task';
import {
  ModuleDetailDialog, DetailSection, DetailInfoLine, DetailStatusAction,
} from '@/components/modules/ModuleDetailDialog';
import type { ModuleDispatchConfig, ModuleKpi } from '@/components/modules/ModuleDispatchView';
import {
  useJuridiqueRequests, JuridiqueRequest, JuridiquePrestation,
  JURIDIQUE_PRESTATION_LABELS, JURIDIQUE_PRESTATIONS,
  JURIDIQUE_MEMBERS, JURIDIQUE_MEMBER_IDS, JURIDIQUE_TERMINAL_STATUSES,
} from '@/hooks/useJuridiqueRequests';
import { JuridiquePlanning } from '@/pages/juridique/JuridiquePlanning';

const STATUS_LABELS: Record<string, string> = {
  todo: 'À affecter',
  'in-progress': 'En cours',
  done: 'Terminée',
  cancelled: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-amber-100 text-amber-800 border-amber-300',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
  done: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-300',
};

const PRIORITY_LABELS: Record<string, string> = { low: 'Basse', medium: 'Moyenne', high: 'Élevée' };
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 border-slate-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  high: 'bg-red-100 text-red-800 border-red-300',
};

const TERMINAL = JURIDIQUE_TERMINAL_STATUSES;

const memberName = (id: string | null | undefined) =>
  id ? (JURIDIQUE_MEMBERS.find(m => m.id === id)?.name ?? '—') : null;

const fmtDay = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), 'dd/MM/yyyy', { locale: fr }) : '—';

interface JuridiqueExtraFilters {
  prestation: JuridiquePrestation | 'all';
  assignee: string | 'all';
}

export const juridiqueDispatchConfig: ModuleDispatchConfig<JuridiqueRequest, JuridiqueExtraFilters> = {
  moduleCode: 'juridique',
  activeView: 'juridique-dispatch',
  title: 'Demandes juridiques',
  subtitle: 'Contrats · Gouvernance · Fournisseurs · Conseil',
  icon: Scale,
  iconBgClass: 'bg-indigo-500/10',
  iconColorClass: 'text-indigo-600',
  newRoute: '/juridique/new',
  newButtonLabel: 'Nouvelle demande',
  contextId: 'juridique-module-dispatch',
  processId: 'juridique-module',

  useRequests: useJuridiqueRequests,
  getId: (r) => r.task_id,
  getStatus: (r) => r.status,
  getRequesterId: (r) => r.requester_id,
  getAssigneeId: (r) => r.assignee_id,

  statusLabels: STATUS_LABELS,
  terminalStatuses: TERMINAL,
  enableKanban: true,
  enableCalendar: true,

  computeKpis: (requests): ModuleKpi[] => {
    const actives = requests.filter(r => !TERMINAL.includes(r.status));
    const aAffecter = actives.filter(r => !r.assignee_id).length;
    const enCours = requests.filter(r => r.status === 'in-progress').length;
    const today = new Date().toISOString().slice(0, 10);
    const enRetard = actives.filter(r => r.due_date && r.due_date < today).length;
    const prioritaires = actives.filter(r => r.priority === 'high').length;
    return [
      { icon: ListChecks, label: 'Demandes actives', value: actives.length, color: 'bg-slate-100 text-slate-700' },
      { icon: UserCog, label: 'À affecter', value: aAffecter, color: 'bg-amber-100 text-amber-700' },
      { icon: Clock, label: 'En cours', value: enCours, color: 'bg-blue-100 text-blue-700' },
      { icon: AlertTriangle, label: 'En retard', value: enRetard, color: 'bg-red-100 text-red-700' },
      { icon: Flag, label: 'Priorité élevée', value: prioritaires, color: 'bg-rose-100 text-rose-700' },
    ];
  },

  computeStats: (requests): TaskStats => {
    const total = requests.length;
    const done = requests.filter(r => r.status === 'done').length;
    const todo = requests.filter(r => r.status === 'todo').length;
    return {
      total, todo, inProgress: total - todo - done, done,
      pendingValidation: 0, validated: 0, refused: 0,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  },

  searchableFields: (r) => [
    r.title,
    r.module_data?.objet,
    r.projet_label,
    r.fournisseur_label,
    r.prestation ? JURIDIQUE_PRESTATION_LABELS[r.prestation] : null,
  ],

  extraFilterInitial: { prestation: 'all', assignee: 'all' },
  ExtraFilters: ({ value, onChange }) => (
    <div className="flex gap-2">
      <Select
        value={value.prestation}
        onValueChange={(v) => onChange({ ...value, prestation: v as JuridiqueExtraFilters['prestation'] })}
      >
        <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les types</SelectItem>
          {JURIDIQUE_PRESTATIONS.map(p => (
            <SelectItem key={p} value={p}>{JURIDIQUE_PRESTATION_LABELS[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.assignee}
        onValueChange={(v) => onChange({ ...value, assignee: v })}
      >
        <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Affecté à" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les membres</SelectItem>
          <SelectItem value="__unassigned__">À affecter</SelectItem>
          {JURIDIQUE_MEMBERS.map(m => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
  applyExtraFilters: (r, value) => {
    if (value.prestation !== 'all' && r.prestation !== value.prestation) return false;
    if (value.assignee === '__unassigned__' && r.assignee_id) return false;
    if (value.assignee !== 'all' && value.assignee !== '__unassigned__' && r.assignee_id !== value.assignee) return false;
    return true;
  },

  columns: [
    {
      key: 'prestation',
      header: 'Type',
      cell: (r) => r.prestation ? (
        <Badge variant="outline" className="text-xs">{JURIDIQUE_PRESTATION_LABELS[r.prestation]}</Badge>
      ) : <>—</>,
    },
    {
      key: 'objet',
      header: 'Objet',
      className: 'font-medium max-w-[280px] truncate',
      cell: (r) => <>{r.module_data?.objet ?? r.title}</>,
    },
    {
      key: 'lien',
      header: 'Rattachement',
      className: 'text-xs text-muted-foreground max-w-[200px] truncate',
      cell: (r) => (
        <>{[r.projet_label, r.fournisseur_label].filter(Boolean).join(' · ') || '—'}</>
      ),
    },
    {
      key: 'assignee',
      header: 'Affecté à',
      cell: (r) => r.assignee_id
        ? <span className="text-sm">{memberName(r.assignee_id)}</span>
        : <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">À affecter</Badge>,
    },
    {
      key: 'priorite',
      header: 'Priorité',
      cell: (r) => r.priority ? (
        <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[r.priority])}>
          {PRIORITY_LABELS[r.priority] ?? r.priority}
        </Badge>
      ) : <>—</>,
    },
    {
      key: 'echeance',
      header: 'Échéance',
      className: 'text-xs text-muted-foreground',
      cell: (r) => <>{fmtDay(r.due_date)}</>,
    },
    {
      key: 'statut',
      header: 'Statut',
      cell: (r) => (
        <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[r.status])}>
          {STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    },
  ],

  extraTabs: [
    {
      value: 'planning',
      label: 'Plan de charge',
      icon: <BarChart2 className="h-4 w-4" />,
      content: ({ requests }) => <JuridiquePlanning requests={requests} />,
    },
  ],

  DetailDialog: ({ request, open, onClose, refetch, isAdmin, myProfileId, profilesMap }) => (
    <JuridiqueDetailDialog
      request={request}
      open={open}
      onClose={onClose}
      refetch={refetch}
      isAdmin={isAdmin}
      myProfileId={myProfileId}
      profilesMap={profilesMap}
    />
  ),
};

// ────────────────────────────────────────────────────────────────────────
function JuridiqueAssignment({ request, refetch, canManage }: {
  request: JuridiqueRequest;
  refetch: () => void;
  canManage: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const current = request.assignee_id ?? '__unassigned__';

  const onChange = async (v: string) => {
    setBusy(true);
    try {
      const assignee_id = v === '__unassigned__' ? null : v;
      const updates: any = { assignee_id };
      // Affecter fait passer une demande « à affecter » en « en cours ».
      if (assignee_id && request.status === 'todo') updates.status = 'in-progress';
      const { error } = await supabase.from('tasks').update(updates).eq('id', request.task_id);
      if (error) throw error;
      toast.success(assignee_id ? `Affectée à ${memberName(assignee_id)}` : 'Affectation retirée');
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={current} onValueChange={onChange} disabled={!canManage || busy}>
        <SelectTrigger className="w-[240px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__unassigned__">À affecter</SelectItem>
          {JURIDIQUE_MEMBERS.map(m => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!canManage && <span className="text-xs text-muted-foreground">Réservé au service juridique</span>}
    </div>
  );
}

function JuridiqueDetailDialog({ request, open, onClose, refetch, isAdmin, myProfileId, profilesMap }: {
  request: JuridiqueRequest;
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  isAdmin: boolean;
  myProfileId?: string;
  profilesMap: Map<string, string>;
}) {
  const canManage = isAdmin || (!!myProfileId && JURIDIQUE_MEMBER_IDS.includes(myProfileId));

  const infoLines: DetailInfoLine[] = [
    { label: 'Demandeur', icon: <User className="h-3 w-3" />, value: request.requester_id ? (profilesMap.get(request.requester_id) ?? '—') : '—' },
    { label: 'Type', icon: <Scale className="h-3 w-3" />, value: request.prestation ? JURIDIQUE_PRESTATION_LABELS[request.prestation] : '—' },
    { label: 'Échéance', icon: <Calendar className="h-3 w-3" />, value: fmtDay(request.due_date) },
    { label: 'Charge estimée', icon: <Clock className="h-3 w-3" />, value: request.duration_hours != null ? `${request.duration_hours} h` : '—' },
    { label: 'Projet lié', icon: <Briefcase className="h-3 w-3" />, value: request.projet_label ?? '—' },
    { label: 'Contrat fournisseur', icon: <Building2 className="h-3 w-3" />, value: request.fournisseur_label ?? '—' },
  ];

  const affectationSection: DetailSection = {
    title: 'Affectation',
    icon: <UserCog className="h-3 w-3" />,
    content: <JuridiqueAssignment request={request} refetch={refetch} canManage={canManage} />,
  };

  // Actions de statut (footer) — réservées au service juridique.
  const statusActions: DetailStatusAction[] = [];
  if (canManage) {
    if (request.status !== 'in-progress' && request.status !== 'done') {
      statusActions.push({ key: 'start', label: 'Prendre en charge', variant: 'default', targetStatus: 'in-progress' });
    }
    if (request.status !== 'done') {
      statusActions.push({ key: 'done', label: 'Terminer', variant: 'default', targetStatus: 'done' });
    }
    if (!TERMINAL.includes(request.status)) {
      statusActions.push({ key: 'cancel', label: 'Annuler', variant: 'outline', targetStatus: 'cancelled' });
    }
    if (TERMINAL.includes(request.status)) {
      statusActions.push({ key: 'reopen', label: 'Rouvrir', variant: 'outline', targetStatus: 'todo' });
    }
  }

  return (
    <ModuleDetailDialog
      open={open}
      onClose={onClose}
      taskId={request.task_id}
      title={request.title}
      description={request.description ?? undefined}
      status={request.status}
      statusLabels={STATUS_LABELS}
      statusColors={STATUS_COLORS}
      priority={request.priority ?? undefined}
      priorityLabels={PRIORITY_LABELS}
      infoLines={infoLines}
      sections={[affectationSection]}
      statusActions={statusActions}
      myProfileId={myProfileId}
      refetch={refetch}
      isAdmin={isAdmin}
      allowDelete={isAdmin}
      authorized={canManage}
      notAuthorizedHint="Seul le service juridique peut faire évoluer la demande"
      onDeleteConfirm="Supprimer définitivement cette demande juridique ?"
    />
  );
}
