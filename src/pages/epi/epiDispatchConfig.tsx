import {
  HardHat, AlertTriangle, Clock, ListChecks, Trash2,
  User, Calendar, Boxes, Euro,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useEPIRequests } from '@/hooks/useEPIRequests';
import { usePermissionsContext } from '@/contexts/PermissionsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TaskStats } from '@/types/task';
import {
  ModuleDetailDialog, DetailSection, DetailInfoLine, DetailStatusAction,
} from '@/components/modules/ModuleDetailDialog';
import type { ModuleDispatchConfig, ModuleKpi, ModuleRowCtx } from '@/components/modules/ModuleDispatchView';
import type { EPIRequest, EPILigneStatut } from '@/types/epi';
import {
  EPI_PROFIL_LABELS, EPI_TYPE_DEMANDE_LABELS, EPI_LIGNE_STATUT_LABELS,
} from '@/types/epi';

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-800 border-amber-300',
  validee: 'bg-blue-100 text-blue-800 border-blue-300',
  commandee: 'bg-purple-100 text-purple-800 border-purple-300',
  attribuee: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  annulee: 'bg-red-100 text-red-800 border-red-300',
};

const EPI_STATUS_LABELS: Record<string, string> = {
  todo: 'Soumise',
  'in-progress': 'En cours',
  done: 'Clôturée',
  cancelled: 'Annulée',
};

const EPI_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-amber-100 text-amber-800 border-amber-300',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
  done: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

const TYPE_COLORS: Record<string, string> = {
  ponctuelle: 'bg-sky-100 text-sky-800 border-sky-300',
  dotation_annuelle: 'bg-violet-100 text-violet-800 border-violet-300',
};

const EPI_TERMINAL = ['done', 'cancelled'];

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const deleteRequest = async (id: string, refetch: () => void) => {
  if (!confirm('Supprimer définitivement cette demande EPI ?')) return;
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    toast.success('Demande supprimée');
    refetch();
  } catch (e: any) {
    toast.error(`Erreur : ${e.message}`);
  }
};

export const epiDispatchConfig: ModuleDispatchConfig<EPIRequest, {}> = {
  moduleCode: 'epi',
  activeView: 'epi-dispatch',
  title: 'Demandes EPI',
  subtitle: 'Demandes d\'équipements de protection individuelle',
  icon: HardHat,
  iconBgClass: 'bg-amber-100/50',
  iconColorClass: 'text-amber-700',
  newRoute: '/epi/new',
  contextId: 'epi-module-dispatch',
  processId: 'epi-module',

  useRequests: useEPIRequests,
  getId: (r) => r.task_id,
  getStatus: (r) => r.status ?? 'todo',
  getRequesterId: (r) => r.requester_id,
  getAssigneeId: (r) => r.assignee_id,

  statusLabels: EPI_STATUS_LABELS,
  terminalStatuses: EPI_TERMINAL,
  enableKanban: false,
  enableCalendar: false,

  computeKpis: (requests): ModuleKpi[] => {
    const total = requests.length;
    const actives = requests.filter(r => !EPI_TERMINAL.includes(r.status));
    const ponctuelles = actives.filter(r => r.type_demande === 'ponctuelle').length;
    const dotations = actives.filter(r => r.type_demande === 'dotation_annuelle').length;
    const montant = actives.reduce((s, r) => s + (r.montant_total ?? 0), 0);
    return [
      { icon: ListChecks, label: 'Total demandes', value: total, color: 'bg-slate-100 text-slate-700' },
      { icon: AlertTriangle, label: 'Ponctuelles actives', value: ponctuelles, color: 'bg-sky-100 text-sky-700' },
      { icon: Clock, label: 'Dotations annuelles', value: dotations, color: 'bg-violet-100 text-violet-700' },
      { icon: Euro, label: 'Montant actif HT', value: Math.round(montant), color: 'bg-emerald-100 text-emerald-700' },
    ];
  },

  computeStats: (requests): TaskStats => {
    const total = requests.length;
    const todo = requests.filter(t => t.status === 'todo').length;
    const done = requests.filter(t => EPI_TERMINAL.includes(t.status)).length;
    const inProgress = total - todo - done;
    return {
      total, todo, inProgress, done, pendingValidation: 0, validated: 0, refused: 0,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  },

  searchableFields: (r) => [
    r.title,
    r.beneficiaire_nom ?? '',
    r.beneficiaire_prenom ?? '',
    r.filiale ?? '',
    ...(r.lignes?.map(l => l.designation) ?? []),
  ],

  columns: [
    {
      key: 'type',
      header: 'Type',
      cell: (r) => r.type_demande ? (
        <Badge variant="outline" className={cn('text-xs', TYPE_COLORS[r.type_demande])}>
          {EPI_TYPE_DEMANDE_LABELS[r.type_demande] ?? r.type_demande}
        </Badge>
      ) : <>—</>,
    },
    {
      key: 'beneficiaire',
      header: 'Collaborateur',
      className: 'font-medium max-w-[200px] truncate',
      cell: (r) => <>{r.beneficiaire_prenom} {r.beneficiaire_nom}</>,
    },
    {
      key: 'profil',
      header: 'Profil',
      className: 'text-xs',
      cell: (r) => <>{r.profil_epi ? EPI_PROFIL_LABELS[r.profil_epi] ?? r.profil_epi : '—'}</>,
    },
    {
      key: 'articles',
      header: 'Articles',
      cell: (r) => <>{r.nb_lignes} article{r.nb_lignes > 1 ? 's' : ''}</>,
    },
    {
      key: 'montant',
      header: 'Montant',
      className: 'text-right font-mono text-xs',
      cell: (r) => <>{fmtEur(r.montant_total ?? 0)}</>,
    },
    {
      key: 'statut',
      header: 'Statut',
      cell: (r) => (
        <Badge variant="outline" className={cn('text-xs', EPI_STATUS_COLORS[r.status])}>
          {EPI_STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      className: 'text-xs text-muted-foreground',
      cell: (r) => <>{format(new Date(r.created_at), 'dd/MM/yyyy', { locale: fr })}</>,
    },
  ],

  expandedPanel: (r) => (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Articles ({r.nb_lignes}) — {r.filiale ?? '—'}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Réf.</TableHead>
            <TableHead>Désignation</TableHead>
            <TableHead>Taille</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">Prix unit.</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {r.lignes?.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-mono text-xs">{l.ref_sycomore}</TableCell>
              <TableCell className="text-sm">{l.designation}</TableCell>
              <TableCell className="text-xs">{l.taille}</TableCell>
              <TableCell className="text-right">{l.quantite}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtEur(l.prix_unitaire)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('text-xs', STATUT_COLORS[l.statut])}>
                  {EPI_LIGNE_STATUT_LABELS[l.statut] ?? l.statut}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),

  rowActions: (r, ctx) => <EPIRowActions request={r} ctx={ctx} />,
  DetailDialog: (props) => <EPIDetailDialog {...props} />,
};

function EPIRowActions({ request: r, ctx }: { request: EPIRequest; ctx: ModuleRowCtx }) {
  const { effectivePermissions } = usePermissionsContext();
  const canManage = effectivePermissions.can_manage_epi || ctx.isAdmin;
  const isAwaiting = r.status === 'todo';

  const handleValidate = async () => {
    try {
      await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', r.task_id);
      await supabase.from('epi_demande_lignes' as any).update({ statut: 'validee' }).eq('request_id', r.task_id);
      toast.success('Demande validée');
      ctx.refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  const handleRefuse = async () => {
    if (!confirm('Refuser cette demande EPI ?')) return;
    try {
      await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', r.task_id);
      await supabase.from('epi_demande_lignes' as any).update({ statut: 'annulee' }).eq('request_id', r.task_id);
      toast.success('Demande refusée');
      ctx.refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  return (
    <>
      {isAwaiting && canManage && (
        <>
          <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); void handleValidate(); }}>
            Valider
          </Button>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void handleRefuse(); }}>
            Refuser
          </Button>
        </>
      )}
      {canManage && (
        <Button
          size="icon" variant="ghost" className="h-7 w-7 text-destructive"
          onClick={(e) => { e.stopPropagation(); deleteRequest(r.task_id, ctx.refetch); }}
          title="Supprimer"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </>
  );
}

function EPIDetailDialog({ request, open, onClose, refetch, isAdmin, profilesMap }: {
  request: EPIRequest;
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  isAdmin: boolean;
  myProfileId?: string;
  profilesMap: Map<string, string>;
}) {
  const { effectivePermissions } = usePermissionsContext();
  const canManage = effectivePermissions.can_manage_epi || isAdmin;

  const fmtDay = (iso: string | null | undefined) =>
    iso ? format(parseISO(iso), 'dd/MM/yyyy', { locale: fr }) : '—';

  const infoLines: DetailInfoLine[] = [
    {
      label: 'Collaborateur',
      icon: <User className="h-3 w-3" />,
      value: `${request.beneficiaire_prenom ?? ''} ${request.beneficiaire_nom ?? ''}`.trim() || '—',
    },
    {
      label: 'Demandeur',
      icon: <User className="h-3 w-3" />,
      value: request.requester_id ? profilesMap.get(request.requester_id) ?? '—' : '—',
    },
    {
      label: 'Profil EPI',
      icon: <HardHat className="h-3 w-3" />,
      value: request.profil_epi ? EPI_PROFIL_LABELS[request.profil_epi] : '—',
    },
    {
      label: 'Type',
      icon: <Calendar className="h-3 w-3" />,
      value: request.type_demande ? EPI_TYPE_DEMANDE_LABELS[request.type_demande] : '—',
    },
    {
      label: 'Filiale',
      icon: <Boxes className="h-3 w-3" />,
      value: request.filiale ?? '—',
    },
    {
      label: 'Demandée le',
      icon: <Calendar className="h-3 w-3" />,
      value: fmtDay(request.created_at),
    },
    {
      label: 'Montant total',
      icon: <Euro className="h-3 w-3" />,
      value: fmtEur(request.montant_total ?? 0),
    },
  ];

  const sections: DetailSection[] = [
    {
      title: `Articles (${request.nb_lignes ?? 0})`,
      icon: <Boxes className="h-3 w-3" />,
      content: (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réf.</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead>Taille</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">Prix</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {request.lignes?.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.ref_sycomore}</TableCell>
                <TableCell className="text-sm">{l.designation}</TableCell>
                <TableCell className="text-xs">{l.taille}</TableCell>
                <TableCell className="text-right">{l.quantite}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {fmtEur(l.quantite * (l.prix_unitaire + l.prix_flocage))}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', STATUT_COLORS[l.statut])}>
                    {EPI_LIGNE_STATUT_LABELS[l.statut] ?? l.statut}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ),
    },
  ];

  const statusActions: DetailStatusAction[] = [];
  if (request.status === 'todo' && canManage) {
    statusActions.push({
      key: 'val',
      label: 'Valider',
      onClick: async () => {
        await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', request.task_id);
        await supabase.from('epi_demande_lignes' as any).update({ statut: 'validee' }).eq('request_id', request.task_id);
        toast.success('Demande validée');
        refetch();
      },
    });
    statusActions.push({
      key: 'ref',
      label: 'Refuser',
      variant: 'outline',
      onClick: async () => {
        if (!confirm('Refuser cette demande EPI ?')) return;
        await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', request.task_id);
        await supabase.from('epi_demande_lignes' as any).update({ statut: 'annulee' }).eq('request_id', request.task_id);
        toast.success('Demande refusée');
        refetch();
      },
    });
  } else if (request.status === 'in-progress' && canManage) {
    statusActions.push({
      key: 'cmd',
      label: 'Marquer commandée',
      onClick: async () => {
        await supabase.from('epi_demande_lignes' as any).update({ statut: 'commandee' }).eq('request_id', request.task_id);
        toast.success('Lignes marquées commandées');
        refetch();
      },
    });
    statusActions.push({
      key: 'attr',
      label: 'Marquer attribuée',
      onClick: async () => {
        await supabase.from('epi_demande_lignes' as any).update({ statut: 'attribuee' }).eq('request_id', request.task_id);
        await supabase.from('tasks').update({ status: 'done' }).eq('id', request.task_id);
        toast.success('EPI attribués — demande clôturée');
        refetch();
      },
    });
  }

  return (
    <ModuleDetailDialog
      open={open}
      onClose={onClose}
      taskId={request.task_id}
      title={request.title}
      status={request.status}
      statusLabels={EPI_STATUS_LABELS}
      statusColors={EPI_STATUS_COLORS}
      infoLines={infoLines}
      sections={sections}
      statusActions={statusActions}
      refetch={refetch}
      isAdmin={isAdmin}
      allowDelete={true}
      onDeleteConfirm="Supprimer définitivement cette demande EPI ?"
    />
  );
}
