/**
 * rhDispatchConfig — config RH pour ModuleDispatchView.
 *
 * Un seul dispatch pour les 4 prestations (Onboarding / Offboarding /
 * Mutation / Promotion), filtre par prestation. Statut métier = statut de la
 * demande + avancement des sous-tâches spawnnées automatiquement.
 */
import { UserPlus, Users, ListChecks, Clock, CheckCircle2, AlertTriangle, User, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useRHRequests, RHRequest, RHPrestation, RH_PRESTATION_LABELS,
} from '@/hooks/useRHRequests';
import type { TaskStats } from '@/types/task';
import {
  ModuleDetailDialog, DetailSection, DetailInfoLine,
} from '@/components/modules/ModuleDetailDialog';
import type { ModuleDispatchConfig, ModuleKpi } from '@/components/modules/ModuleDispatchView';

const STATUS_LABELS: Record<string, string> = {
  todo: 'Soumise',
  'in-progress': 'En cours',
  done: 'Clôturée',
  cancelled: 'Abandonnée',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-amber-100 text-amber-800 border-amber-300',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
  done: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-300',
};

const CHILD_STATUS_LABELS: Record<string, string> = {
  to_assign: 'À affecter',
  todo: 'À faire',
  'in-progress': 'En cours',
  pending_validation_1: 'À valider',
  pending_validation_2: 'À valider (N2)',
  validated: 'Validée',
  done: 'Terminée',
  review: 'À corriger',
  refused: 'Refusée',
  cancelled: 'Annulée',
};

const PRESTATION_COLORS: Record<RHPrestation, string> = {
  onboarding: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  offboarding: 'bg-rose-100 text-rose-800 border-rose-300',
  mutation: 'bg-blue-100 text-blue-800 border-blue-300',
  promotion: 'bg-violet-100 text-violet-800 border-violet-300',
};

const TERMINAL = ['done', 'cancelled'];

interface RHExtraFilters {
  prestation: RHPrestation | 'all';
}

export const rhDispatchConfig: ModuleDispatchConfig<RHRequest, RHExtraFilters> = {
  moduleCode: 'rh',
  activeView: 'rh-dispatch',
  title: 'Mouvements collaborateurs',
  subtitle: 'Onboarding · Offboarding · Mutation · Promotion',
  icon: UserPlus,
  iconBgClass: 'bg-pink-500/10',
  iconColorClass: 'text-pink-600',
  newRoute: '/rh/new',
  newButtonLabel: 'Nouveau dossier',
  contextId: 'rh-module-dispatch',
  processId: 'rh-module',

  useRequests: useRHRequests,
  getId: (r) => r.task_id,
  getStatus: (r) => r.status,
  getRequesterId: (r) => r.requester_id,
  getAssigneeId: (r) => r.assignee_id,

  statusLabels: STATUS_LABELS,
  terminalStatuses: TERMINAL,
  enableKanban: false,
  enableCalendar: false,

  computeKpis: (requests): ModuleKpi[] => {
    const actifs = requests.filter(r => !TERMINAL.includes(r.status));
    const aValider = requests.reduce((s, r) => s + r.nb_a_valider, 0);
    const aAffecter = actifs.reduce((s, r) => s + r.nb_a_affecter, 0);
    const today = new Date().toISOString().slice(0, 10);
    const enRetard = actifs.filter(r => r.due_date && r.due_date < today).length;
    return [
      { icon: ListChecks, label: 'Dossiers actifs', value: actifs.length, color: 'bg-slate-100 text-slate-700' },
      { icon: Users, label: 'Sous-tâches à affecter', value: aAffecter, color: 'bg-amber-100 text-amber-700' },
      { icon: Clock, label: 'Sous-tâches à valider', value: aValider, color: 'bg-blue-100 text-blue-700' },
      { icon: AlertTriangle, label: 'Dossiers en retard', value: enRetard, color: 'bg-red-100 text-red-700' },
    ];
  },

  computeStats: (requests): TaskStats => {
    const total = requests.length;
    const done = requests.filter(r => r.status === 'done').length;
    const todo = requests.filter(r => r.status === 'todo').length;
    return {
      total, todo, inProgress: total - todo - done, done,
      pendingValidation: requests.reduce((s, r) => s + r.nb_a_valider, 0),
      validated: 0, refused: 0,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  },

  searchableFields: (r) => [
    r.title,
    r.module_data?.nom,
    r.module_data?.prenom,
    r.module_data?.poste,
  ],

  extraFilterInitial: { prestation: 'all' },
  ExtraFilters: ({ value, onChange }) => (
    <Select
      value={value.prestation}
      onValueChange={(v) => onChange({ prestation: v as RHExtraFilters['prestation'] })}
    >
      <SelectTrigger className="w-[180px] h-9">
        <SelectValue placeholder="Prestation" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Toutes prestations</SelectItem>
        {(Object.keys(RH_PRESTATION_LABELS) as RHPrestation[]).map(p => (
          <SelectItem key={p} value={p}>{RH_PRESTATION_LABELS[p]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
  applyExtraFilters: (r, value) =>
    value.prestation === 'all' || r.prestation === value.prestation,

  columns: [
    {
      key: 'prestation',
      header: 'Prestation',
      cell: (r) => r.prestation ? (
        <Badge variant="outline" className={cn('text-xs', PRESTATION_COLORS[r.prestation])}>
          {RH_PRESTATION_LABELS[r.prestation]}
        </Badge>
      ) : <>—</>,
    },
    {
      key: 'collaborateur',
      header: 'Collaborateur',
      className: 'font-medium max-w-[260px] truncate',
      cell: (r) => <>{[r.module_data?.nom, r.module_data?.prenom].filter(Boolean).join(' ') || r.title}</>,
    },
    {
      key: 'avancement',
      header: 'Avancement',
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <Progress
            value={r.nb_taches > 0 ? Math.round((r.nb_terminees / r.nb_taches) * 100) : 0}
            className="h-2 w-20"
          />
          <span className="text-xs text-muted-foreground">{r.nb_terminees}/{r.nb_taches}</span>
        </div>
      ),
    },
    {
      key: 'echeance',
      header: 'Échéance',
      className: 'text-xs text-muted-foreground',
      cell: (r) => <>{r.due_date ? format(new Date(r.due_date), 'dd/MM/yyyy', { locale: fr }) : '—'}</>,
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

  expandedPanel: (r) => (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Sous-tâches ({r.nb_taches})
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tâche</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {r.children.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-sm">{c.title.split(' — ').pop()}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {c.due_date ? format(new Date(c.due_date), 'dd/MM/yyyy', { locale: fr }) : '—'}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {CHILD_STATUS_LABELS[c.status] ?? c.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),

  DetailDialog: ({ request, open, onClose, refetch, isAdmin, profilesMap }) => (
    <RHDetailDialog
      request={request}
      open={open}
      onClose={onClose}
      refetch={refetch}
      isAdmin={isAdmin}
      profilesMap={profilesMap}
    />
  ),
};

// ────────────────────────────────────────────────────────────────────────
function RHDetailDialog({ request, open, onClose, refetch, isAdmin, profilesMap }: {
  request: RHRequest;
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  isAdmin: boolean;
  profilesMap: Map<string, string>;
}) {
  const d = request.module_data ?? {};
  const fmtDay = (iso: string | null | undefined) =>
    iso ? format(new Date(iso), 'dd/MM/yyyy', { locale: fr }) : '—';

  const fieldLabels: Record<string, string> = {
    nom: 'Nom', prenom: 'Prénom', poste: 'Poste', lieu_travail: 'Lieu de travail',
    societe: 'Société', service: 'Service', manager: 'Manager',
    vehicule: 'Véhicule', type_vehicule: 'Type de véhicule',
    ordinateur_portable: 'Ordinateur portable', telephone: 'Téléphone',
    date_premier_jour: '1er jour de contrat', date_dernier_jour: 'Dernier jour de contrat',
    date_mutation: 'Date de mutation', date_promotion: 'Date de promotion',
    ancien_poste: 'Ancien poste', nouveau_poste: 'Nouveau poste',
    ancienne_societe: 'Ancienne société', nouvelle_societe: 'Nouvelle société',
    ancien_manager: 'Ancien manager', nouveau_manager: 'Nouveau manager',
    montant_max_devis_divalto: 'Droits Divalto — montant max devis',
    licence_pipedrive: 'Licence Pipedrive',
  };

  const infoLines: DetailInfoLine[] = [
    {
      label: 'Demandeur',
      icon: <User className="h-3 w-3" />,
      value: request.requester_id ? profilesMap.get(request.requester_id) ?? '—' : '—',
    },
    {
      label: 'Échéance',
      icon: <Calendar className="h-3 w-3" />,
      value: fmtDay(request.due_date),
    },
    {
      label: 'Avancement',
      icon: <CheckCircle2 className="h-3 w-3" />,
      value: `${request.nb_terminees}/${request.nb_taches} sous-tâches terminées`,
    },
  ];

  const collabSection: DetailSection = {
    title: 'Informations collaborateur',
    icon: <User className="h-3 w-3" />,
    content: (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {Object.entries(fieldLabels)
          .filter(([key]) => d[key] !== undefined && d[key] !== null && d[key] !== '')
          .map(([key, label]) => (
            <div key={key} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-right">
                {typeof d[key] === 'boolean'
                  ? (d[key] ? 'Oui' : 'Non')
                  : key.startsWith('date_') ? fmtDay(d[key]) : String(d[key])}
              </span>
            </div>
          ))}
      </div>
    ),
  };

  const tasksSection: DetailSection = {
    title: `Sous-tâches (${request.nb_taches})`,
    icon: <ListChecks className="h-3 w-3" />,
    content: (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tâche</TableHead>
            <TableHead>Affectée à</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {request.children.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-sm">{c.title.split(' — ').pop()}</TableCell>
              <TableCell className="text-xs">
                {c.assignee_id ? profilesMap.get(c.assignee_id) ?? '—' : <span className="text-muted-foreground">À affecter</span>}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {CHILD_STATUS_LABELS[c.status] ?? c.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ),
  };

  return (
    <ModuleDetailDialog
      open={open}
      onClose={onClose}
      taskId={request.task_id}
      title={request.title}
      status={request.status}
      statusLabels={STATUS_LABELS}
      statusColors={STATUS_COLORS}
      infoLines={infoLines}
      sections={[collabSection, tasksSection]}
      refetch={refetch}
      isAdmin={isAdmin}
      allowDelete={isAdmin}
      onDeleteConfirm="Supprimer définitivement ce dossier RH et toutes ses sous-tâches ?"
    />
  );
}
