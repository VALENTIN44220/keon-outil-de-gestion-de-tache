/**
 * clientDispatchConfig — suivi des demandes de création client (flux
 * séquentiel CRM → Compta → Affaire).
 */
import { UserPlus, ListChecks, Clock, CheckCircle2, AlertTriangle, User, Calendar, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useClientRequests, ClientRequest } from '@/hooks/useClientRequests';
import type { TaskStats } from '@/types/task';
import { ModuleDetailDialog, DetailSection, DetailInfoLine } from '@/components/modules/ModuleDetailDialog';
import type { ModuleDispatchConfig, ModuleKpi } from '@/components/modules/ModuleDispatchView';

const STATUS_LABELS: Record<string, string> = {
  todo: 'En cours', 'in-progress': 'En cours', done: 'Clôturée', cancelled: 'Abandonnée', refused: 'Refusée',
};
const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-amber-100 text-amber-800 border-amber-300',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
  done: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-300',
  refused: 'bg-rose-100 text-rose-800 border-rose-300',
};
const STEP_STATUS_LABELS: Record<string, string> = {
  to_assign: 'À affecter', todo: 'À traiter', 'in-progress': 'En cours',
  pending_validation_1: 'À valider', validated: 'Validée', done: 'Validée',
  refused: 'Refusée', cancelled: 'Annulée',
};
const TERMINAL = ['done', 'cancelled', 'refused'];

export const clientDispatchConfig: ModuleDispatchConfig<ClientRequest, {}> = {
  moduleCode: 'client',
  activeView: 'client-dispatch',
  title: 'Création client',
  subtitle: 'Contrôle CRM → Contrôle Compta → Création affaire',
  icon: UserPlus,
  iconBgClass: 'bg-cyan-500/10',
  iconColorClass: 'text-cyan-600',
  newRoute: '/client/new',
  newButtonLabel: 'Nouvelle demande',
  contextId: 'client-module-dispatch',
  processId: 'client-module',

  useRequests: useClientRequests,
  getId: (r) => r.task_id,
  getStatus: (r) => r.status,
  getRequesterId: (r) => r.requester_id,

  statusLabels: STATUS_LABELS,
  terminalStatuses: TERMINAL,
  enableKanban: false,
  enableCalendar: false,

  computeKpis: (requests): ModuleKpi[] => {
    const actives = requests.filter(r => !TERMINAL.includes(r.status));
    const aValider = requests.reduce((s, r) => s + r.steps.filter(st => ['pending_validation_1', 'todo'].includes(st.status)).length, 0);
    const refusees = requests.filter(r => r.status === 'refused' || r.steps.some(s => s.status === 'refused')).length;
    const cloturees = requests.filter(r => r.status === 'done').length;
    return [
      { icon: ListChecks, label: 'Demandes actives', value: actives.length, color: 'bg-slate-100 text-slate-700' },
      { icon: Clock, label: 'Étapes à traiter', value: aValider, color: 'bg-amber-100 text-amber-700' },
      { icon: CheckCircle2, label: 'Clôturées', value: cloturees, color: 'bg-emerald-100 text-emerald-700' },
      { icon: AlertTriangle, label: 'Refusées', value: refusees, color: 'bg-rose-100 text-rose-700' },
    ];
  },

  computeStats: (requests): TaskStats => {
    const total = requests.length;
    const done = requests.filter(r => r.status === 'done').length;
    return { total, todo: 0, inProgress: total - done, done, pendingValidation: 0, validated: 0, refused: 0,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0 };
  },

  searchableFields: (r) => [r.title, r.module_data?.nom_client, r.module_data?.code_site],

  columns: [
    {
      key: 'client', header: 'Client', className: 'font-medium max-w-[260px] truncate',
      cell: (r) => <>{r.module_data?.nom_client || r.title}</>,
    },
    {
      key: 'origine', header: 'Origine', className: 'text-xs',
      cell: (r) => <>{r.module_data?.origine ?? '—'}</>,
    },
    {
      key: 'etape', header: 'Étape en cours',
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-[140px]">
          <Progress value={r.nb_etapes > 0 ? Math.round((r.nb_terminees / r.nb_etapes) * 100) : 0} className="h-2 w-16" />
          <span className="text-xs text-muted-foreground truncate">{r.currentStepLabel}</span>
        </div>
      ),
    },
    {
      key: 'statut', header: 'Statut',
      cell: (r) => <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[r.status])}>{STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
    {
      key: 'date', header: 'Créée le', className: 'text-xs text-muted-foreground',
      cell: (r) => <>{format(new Date(r.created_at), 'dd/MM/yyyy', { locale: fr })}</>,
    },
  ],

  expandedPanel: (r) => (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Étapes du flux</p>
      <Table>
        <TableHeader><TableRow><TableHead>Étape</TableHead><TableHead>Approbateur(s)</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
        <TableBody>
          {r.steps.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-sm">{s.title.split(' — ').pop()}</TableCell>
              <TableCell className="text-xs">{s.assigneeLabel}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{STEP_STATUS_LABELS[s.status] ?? s.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),

  DetailDialog: ({ request, open, onClose, refetch, isAdmin, profilesMap }) => (
    <ClientDetailDialog request={request} open={open} onClose={onClose} refetch={refetch} isAdmin={isAdmin} profilesMap={profilesMap} />
  ),
};

function ClientDetailDialog({ request, open, onClose, refetch, isAdmin, profilesMap }: {
  request: ClientRequest; open: boolean; onClose: () => void; refetch: () => void; isAdmin: boolean; profilesMap: Map<string, string>;
}) {
  const d = request.module_data ?? {};
  const fields: Record<string, string> = {
    nom_client: 'Raison sociale', adresse_siege: 'Adresse du siège', siret: 'N° SIRET',
    tva: 'N° TVA', naf: 'NAF', contact_facturation: 'Contact facturation', devise: 'Devise',
    parc_hors_parc: 'Parc / hors parc', origine: 'Origine', code_site: 'Code site',
    code_prospect: 'Code prospect', prospect: 'Prospect',
    code_client: 'Code client (retour Compta)', code_affaire: 'Code affaire (retour)',
    code_affaire_a_creer: 'Code affaire à créer', affaire_mode: 'Affaire',
  };

  const infoLines: DetailInfoLine[] = [
    { label: 'Demandeur', icon: <User className="h-3 w-3" />, value: request.requester_id ? profilesMap.get(request.requester_id) ?? '—' : '—' },
    { label: 'Créée le', icon: <Calendar className="h-3 w-3" />, value: format(new Date(request.created_at), 'dd/MM/yyyy', { locale: fr }) },
    { label: 'Avancement', icon: <CheckCircle2 className="h-3 w-3" />, value: `${request.nb_terminees}/${request.nb_etapes} étapes` },
  ];

  const infoSection: DetailSection = {
    title: 'Informations client', icon: <Building2 className="h-3 w-3" />,
    content: (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {Object.entries(fields).filter(([k]) => d[k] !== undefined && d[k] !== null && d[k] !== '').map(([k, label]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{String(d[k])}</span>
          </div>
        ))}
      </div>
    ),
  };

  const stepsSection: DetailSection = {
    title: `Étapes (${request.nb_etapes})`, icon: <ListChecks className="h-3 w-3" />,
    content: (
      <Table>
        <TableHeader><TableRow><TableHead>Étape</TableHead><TableHead>Approbateur(s)</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
        <TableBody>
          {request.steps.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-sm">{s.title.split(' — ').pop()}</TableCell>
              <TableCell className="text-xs">{s.assigneeLabel}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{STEP_STATUS_LABELS[s.status] ?? s.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ),
  };

  return (
    <ModuleDetailDialog
      open={open} onClose={onClose} taskId={request.task_id} title={request.title}
      status={request.status} statusLabels={STATUS_LABELS} statusColors={STATUS_COLORS}
      infoLines={infoLines} sections={[infoSection, stepsSection]} refetch={refetch}
      isAdmin={isAdmin} allowDelete={isAdmin}
      onDeleteConfirm="Supprimer définitivement cette demande de création client et ses étapes ?"
    />
  );
}
