/**
 * clientDispatchConfig — suivi des demandes de création client (flux
 * séquentiel CRM → Compta → Affaire).
 */
import { useState } from 'react';
import { UserPlus, ListChecks, Clock, CheckCircle2, AlertTriangle, User, Calendar, Building2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
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
/** Statuts terminaux d'une ÉTAPE (sous-tâche). */
const STEP_TERMINAL = ['done', 'validated', 'realisee', 'cloturee', 'refused', 'cancelled'];

/**
 * Codes à saisir par le valideur pour clore une étape (indexés par order_index) :
 *  - 1 = Contrôle Compta  → code client
 *  - 2 = Création affaire → code affaire
 */
const STEP_CODE_BY_ORDER: Record<number, { key: string; label: string; placeholder: string }> = {
  1: { key: 'code_client', label: 'Code client', placeholder: 'Code client attribué en compta' },
  2: { key: 'code_affaire', label: 'Code affaire', placeholder: 'Code affaire créé' },
};

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
  const { profile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const currentProfileId = (isSimulating && simulatedProfile ? simulatedProfile : profile)?.id ?? null;
  const [codeValue, setCodeValue] = useState('');
  const [validating, setValidating] = useState(false);

  const d = request.module_data ?? {};

  // Étape active (1re non terminée) + droit de validation de l'utilisateur courant.
  const activeStep = request.steps.find((s) => !STEP_TERMINAL.includes(s.status)) ?? null;
  const codeReq = activeStep ? STEP_CODE_BY_ORDER[activeStep.order_index] ?? null : null;
  const canValidateActive = !!activeStep && (
    isAdmin ||
    (!!currentProfileId && (activeStep.assignee_id === currentProfileId
      || (activeStep.group_assignee_ids ?? []).includes(currentProfileId)))
  );

  const handleValidateStep = async () => {
    if (!activeStep) return;
    const code = codeValue.trim();
    if (codeReq && !code) { toast.error(`${codeReq.label} obligatoire`); return; }
    setValidating(true);
    try {
      // 1) Code rangé dans le module_data de la demande (avant le passage à done).
      if (codeReq) {
        const { data: parent } = await supabase
          .from('tasks').select('module_data').eq('id', request.task_id).maybeSingle();
        const merged = { ...(((parent as any)?.module_data) ?? {}), [codeReq.key]: code };
        const { error } = await supabase
          .from('tasks').update({ module_data: merged }).eq('id', request.task_id);
        if (error) throw error;
      }
      // 2) Étape → done (déclenche le spawn de l'étape suivante côté DB).
      const { error: sErr } = await supabase.from('tasks').update({ status: 'done' }).eq('id', activeStep.id);
      if (sErr) throw sErr;
      toast.success(codeReq ? `${codeReq.label} enregistré — étape validée` : 'Étape validée');
      setCodeValue('');
      refetch();
    } catch (e: any) {
      console.error('handleValidateStep:', e);
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setValidating(false);
    }
  };
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

  const validationSection: DetailSection | null = (activeStep && canValidateActive) ? {
    title: 'Valider l\'étape en cours', icon: <CheckCircle2 className="h-3 w-3" />,
    content: (
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
        <p className="text-sm font-medium">{activeStep.title.split(' — ').pop()}</p>
        {codeReq && (
          <div className="space-y-1.5">
            <Label htmlFor="client-dispatch-code">{codeReq.label} *</Label>
            <Input
              id="client-dispatch-code"
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && codeValue.trim() && !validating) void handleValidateStep(); }}
              placeholder={codeReq.placeholder}
              disabled={validating}
            />
          </div>
        )}
        <div className="flex justify-end">
          <Button
            onClick={() => void handleValidateStep()}
            disabled={validating || (!!codeReq && !codeValue.trim())}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Valider l'étape
          </Button>
        </div>
      </div>
    ),
  } : null;

  return (
    <ModuleDetailDialog
      open={open} onClose={onClose} taskId={request.task_id} title={request.title}
      status={request.status} statusLabels={STATUS_LABELS} statusColors={STATUS_COLORS}
      infoLines={infoLines}
      sections={[infoSection, stepsSection, ...(validationSection ? [validationSection] : [])]}
      refetch={refetch}
      isAdmin={isAdmin} allowDelete={isAdmin}
      onDeleteConfirm="Supprimer définitivement cette demande de création client et ses étapes ?"
    />
  );
}
