/**
 * logistiqueDispatchConfig — config du module Logistique pour ModuleDispatchView.
 */
import { useMemo, useState } from 'react';
import { LogistiquePlanificationDialog } from '@/components/logistique/LogistiquePlanificationDialog';
import { LogistiqueQuotationDialog } from '@/components/logistique/LogistiqueQuotationDialog';
import {
  Truck, AlertTriangle, Clock, CheckCircle2, ListChecks, Trash2,
  User, Calendar, Package, MapPin, Send, FileText, Tag, Check, X as XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLogistiqueRequests, LogistiqueRequest } from '@/hooks/useLogistiqueRequests';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TaskStats } from '@/types/task';
import {
  ModuleDetailDialog, DetailSection, DetailInfoLine, DetailStatusAction,
} from '@/components/modules/ModuleDetailDialog';
import type { ModuleDispatchConfig, ModuleKpi, ModuleRowCtx } from '@/components/modules/ModuleDispatchView';

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-amber-100 text-amber-800 border-amber-300',
  affectee: 'bg-blue-100 text-blue-800 border-blue-300',
  planifiee: 'bg-violet-100 text-violet-800 border-violet-300',
  en_enlevement: 'bg-orange-100 text-orange-800 border-orange-300',
  en_livraison: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  livree: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cloturee: 'bg-green-100 text-green-800 border-green-300',
  abandonnee: 'bg-gray-100 text-gray-700 border-gray-300',
  complement_demande: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'Soumise',
  affectee: 'Affectée',
  planifiee: 'Planifiée',
  en_enlevement: 'En enlèvement',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  cloturee: 'Clôturée',
  abandonnee: 'Annulée',
  complement_demande: 'Complément demandé',
};

const TERMINAL_STATUSES = ['cloturee', 'abandonnee', 'cancelled', 'done'];

interface LogistiqueExtraFilter {
  filiale: string;        // 'all' ou nom
  urgent: boolean;
}

const updateStatus = async (
  id: string,
  newStatus: string,
  extraData: Record<string, any> | undefined,
  refetch: () => void,
  options?: { assigneeId?: string },
) => {
  try {
    const updates: any = { status: newStatus };
    if (extraData) {
      // On lit la ligne courante pour merger module_data
      const { data: row } = await supabase.from('tasks').select('module_data').eq('id', id).maybeSingle();
      const current = (row as any)?.module_data ?? {};
      updates.module_data = { ...current, ...extraData };
    }
    if (options?.assigneeId) updates.assignee_id = options.assigneeId;
    const { error } = await supabase.from('tasks').update(updates).eq('id', id);
    if (error) throw error;
    toast.success(`Statut → ${STATUS_LABELS[newStatus] ?? newStatus}`);
    refetch();
  } catch (e: any) {
    toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
  }
};

const deleteRequest = async (id: string, refetch: () => void) => {
  if (!confirm('Supprimer définitivement cette demande de transport ?')) return;
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    toast.success('Demande supprimée');
    refetch();
  } catch (e: any) {
    toast.error(`Erreur : ${e.message}`);
  }
};

export const logistiqueDispatchConfig: ModuleDispatchConfig<LogistiqueRequest, LogistiqueExtraFilter> = {
  moduleCode: 'logistique',
  activeView: 'logistique-dispatch',
  title: 'Logistique — Transports',
  subtitle: 'Demandes courantes & urgentes / suivi enlèvement & livraison',
  icon: Truck,
  iconBgClass: 'bg-blue-500/10',
  iconColorClass: 'text-blue-600',
  newRoute: '/logistique/new',
  contextId: 'logistique-module-dispatch',
  processId: 'logistique-module',

  useRequests: useLogistiqueRequests,
  getId: (r) => r.id,
  getStatus: (r) => r.status,
  getRequesterId: (r) => r.requester_id,
  getAssigneeId: (r) => r.assignee_id,

  statusLabels: STATUS_LABELS,
  terminalStatuses: TERMINAL_STATUSES,

  computeKpis: (requests): ModuleKpi[] => {
    const enCours = requests.filter(r => !['cloturee', 'abandonnee', 'livree'].includes(r.status)).length;
    const urgentes = requests.filter(r => r.module_data?.urgence && !['cloturee', 'abandonnee', 'livree'].includes(r.status)).length;
    const aPlanifier = requests.filter(r => ['todo', 'affectee'].includes(r.status)).length;
    const enLivraison = requests.filter(r => ['en_enlevement', 'en_livraison'].includes(r.status)).length;
    const livrees = requests.filter(r => r.status === 'livree').length;
    return [
      { icon: ListChecks, label: 'En cours', value: enCours, color: 'bg-slate-100 text-slate-700' },
      { icon: AlertTriangle, label: 'Urgentes', value: urgentes, color: 'bg-red-100 text-red-700' },
      { icon: Clock, label: 'À planifier', value: aPlanifier, color: 'bg-amber-100 text-amber-700' },
      { icon: Truck, label: 'En livraison', value: enLivraison, color: 'bg-cyan-100 text-cyan-700' },
      { icon: CheckCircle2, label: 'Livrées', value: livrees, color: 'bg-emerald-100 text-emerald-700' },
    ];
  },

  computeStats: (requests): TaskStats => {
    const total = requests.length;
    const todo = requests.filter(t => t.status === 'todo').length;
    const inProgress = requests.filter(t => ['affectee', 'planifiee', 'en_enlevement', 'en_livraison', 'in-progress'].includes(t.status)).length;
    const done = requests.filter(t => ['livree', 'cloturee', 'done'].includes(t.status)).length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, todo, inProgress, done, pendingValidation: 0, validated: 0, refused: 0, completionRate };
  },

  searchableFields: (r) => [
    r.title,
    r.module_data?.filiale,
    r.module_data?.code_projet,
    r.module_data?.nature_marchandise,
    r.module_data?.destinataire_nom,
    r.module_data?.transporteur,
    r.module_data?.num_suivi,
  ],

  extraFilterInitial: { filiale: 'all', urgent: false },

  ExtraFilters: ({ value, onChange, requests }) => {
    const filiales = useMemo(() => {
      const set = new Set<string>();
      for (const r of requests as LogistiqueRequest[]) {
        const f = r.module_data?.filiale;
        if (f) set.add(f);
      }
      return Array.from(set).sort();
    }, [requests]);
    return (
      <>
        <Select value={value.filiale} onValueChange={(v) => onChange({ ...value, filiale: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filiale" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes filiales</SelectItem>
            {filiales.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={value.urgent ? 'default' : 'outline'} size="sm" onClick={() => onChange({ ...value, urgent: !value.urgent })}>
          <AlertTriangle className="h-4 w-4 mr-1" />
          Urgentes uniquement
        </Button>
      </>
    );
  },

  applyExtraFilters: (r, value) => {
    if (value.filiale !== 'all' && r.module_data?.filiale !== value.filiale) return false;
    if (value.urgent && !r.module_data?.urgence) return false;
    return true;
  },

  columns: [
    {
      key: 'demande',
      header: 'Demande',
      className: 'font-medium max-w-[280px] truncate text-primary',
      cell: (r) => (
        <span>
          {!!r.module_data?.urgence && <Badge variant="destructive" className="mr-2 text-[10px]">URGENT</Badge>}
          {r.title}
        </span>
      ),
    },
    {
      key: 'filiale',
      header: 'Filiale',
      cell: (r) => <Badge variant="outline">{r.module_data?.filiale ?? '—'}</Badge>,
    },
    {
      key: 'code_projet',
      header: 'Code projet',
      className: 'text-sm',
      cell: (r) => <>{r.module_data?.code_projet ?? '—'}</>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (r) => (
        <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[r.status])}>
          {STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: 'date_demandee',
      header: 'Date demandée',
      className: 'text-xs text-muted-foreground',
      cell: (r) => <>{r.due_date ? format(new Date(r.due_date), 'dd/MM/yyyy', { locale: fr }) : '—'}</>,
    },
  ],

  expandedPanel: (r) => {
    const data = r.module_data ?? {};
    return (
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Marchandise</p>
          <p>{data.nature_marchandise ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{data.nb_colis} {data.type_colis}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Expéditeur</p>
          <p>{data.depart_stock_bgn ? 'Stock BGN (Bouguenais)' : (data.expediteur_adresse ?? '—')}</p>
          {!data.depart_stock_bgn && (
            <p className="text-xs text-muted-foreground mt-1">{data.expediteur_nom} — {data.expediteur_tel}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Destinataire</p>
          <p>{data.destinataire_adresse ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{data.destinataire_nom} — {data.destinataire_tel}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Suivi</p>
          {data.transporteur && <p>Transporteur: {data.transporteur}</p>}
          {data.num_suivi && <p>N° suivi: {data.num_suivi}</p>}
          {data.date_livraison_prevue && <p>Livraison prévue: {data.date_livraison_prevue}</p>}
          {data.date_livraison_effective && <p>Livré le: {data.date_livraison_effective}</p>}
          {!data.transporteur && !data.num_suivi && !data.date_livraison_prevue && <p className="text-muted-foreground">—</p>}
        </div>
        {r.description && (
          <div className="col-span-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Commentaire</p>
            <p>{r.description}</p>
          </div>
        )}
      </div>
    );
  },

  rowActions: (r, ctx) => <LogistiqueRowActions request={r} ctx={ctx} />,

  onKanbanStatusChange: async (id, newStatus) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    if (error) toast.error(`Erreur : ${error.message}`);
  },
  onCalendarStatusChange: async (id, newStatus) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    if (error) toast.error(`Erreur : ${error.message}`);
  },

  DetailDialog: (props) => <LogistiqueDetailDialog {...props} />,
};

// ────────────────────────────────────────────────────────────────────────
// Composants stateful (en dehors de la config pour pouvoir utiliser hooks)
// ────────────────────────────────────────────────────────────────────────

interface LogistiqueDetailDialogProps {
  request: LogistiqueRequest;
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  isAdmin: boolean;
  myProfileId?: string;
  profilesMap: Map<string, string>;
}

function LogistiqueDetailDialog({ request, open, onClose, refetch, isAdmin, myProfileId, profilesMap }: LogistiqueDetailDialogProps) {
    const [showPlanif, setShowPlanif] = useState(false);
    const [showQuote, setShowQuote] = useState(false);
    const data = request.module_data ?? {};
    const isQuotation = data.mode === 'quotation';
    const hasProposal = isQuotation && data.quotation_price != null;
    // Le demandeur connecté (ou un admin) peut décider d'une proposition
    const canDecideQuote = hasProposal && (request.requester_id === myProfileId || isAdmin);
    const fmtDay = (iso: string | null | undefined) =>
      iso ? format(parseISO(iso), 'dd/MM/yyyy', { locale: fr }) : '—';

    const extraBadges = (
      <>
        {isQuotation && (
          <Badge className="text-xs bg-sky-100 text-sky-800 border-sky-300 gap-1">
            <Tag className="h-3 w-3" /> {hasProposal ? 'Devis proposé' : 'Devis demandé'}
          </Badge>
        )}
        {!!data.urgence && !isQuotation && <Badge variant="destructive" className="text-xs">⚡ URGENT</Badge>}
        {data.filiale && <Badge variant="secondary" className="text-xs">{data.filiale}</Badge>}
        {data.code_projet && <Badge variant="outline" className="text-xs font-mono">{data.code_projet}</Badge>}
      </>
    );

    const infoLines: DetailInfoLine[] = [
      {
        label: 'Demandeur',
        icon: <User className="h-3 w-3" />,
        value: request.requester_id ? profilesMap.get(request.requester_id) ?? '—' : '—',
      },
      {
        label: 'Affecté à',
        icon: <User className="h-3 w-3" />,
        value: request.assignee_id ? profilesMap.get(request.assignee_id) ?? '—' : '—',
      },
      {
        label: 'Date demandée',
        icon: <Calendar className="h-3 w-3" />,
        value: request.due_date ? fmtDay(request.due_date) : '—',
      },
      ...(data.date_souhaitee_enlevement
        ? [{ label: 'Enlèvement souhaité', icon: <Calendar className="h-3 w-3" />, value: fmtDay(data.date_souhaitee_enlevement) }]
        : []),
      ...(data.date_livraison_prevue
        ? [{ label: 'Livraison prévue', icon: <Calendar className="h-3 w-3" />, value: fmtDay(data.date_livraison_prevue) }]
        : []),
      ...(data.date_livraison_effective
        ? [{ label: 'Livré le', icon: <CheckCircle2 className="h-3 w-3" />, value: fmtDay(data.date_livraison_effective) }]
        : []),
    ];

    // Format conditionnement : nouveau format (colis_lines[]) ou fallback ancien (nb_colis/type_colis)
    const conditionnementText = (() => {
      if (Array.isArray(data.colis_lines) && data.colis_lines.length > 0) {
        return data.colis_lines
          .map((l: any) => `${l.nb} ${l.type}`)
          .join(' + ');
      }
      return `${data.nb_colis ?? '?'} ${data.type_colis ?? ''}`.trim();
    })();

    const sections: DetailSection[] = [
      // Section devis si applicable
      ...(isQuotation ? [{
        title: 'Demande de devis',
        icon: <Tag className="h-3 w-3" />,
        fields: hasProposal
          ? [
              { label: 'Prix proposé', value: `${data.quotation_price} €` },
              ...(data.quotation_valid_until ? [{ label: 'Valide jusqu\'au', value: fmtDay(data.quotation_valid_until) }] : []),
              ...(data.quotation_proposed_at ? [{ label: 'Proposé le', value: fmtDay(data.quotation_proposed_at) }] : []),
              ...(data.quotation_comment ? [{ label: 'Commentaire', value: data.quotation_comment as string }] : []),
              ...(data.quotation_accepted_at ? [{ label: '✓ Accepté le', value: fmtDay(data.quotation_accepted_at) }] : []),
              ...(data.quotation_refused_at ? [{ label: '✗ Refusé le', value: fmtDay(data.quotation_refused_at) }] : []),
            ]
          : [
              { label: 'État', value: 'En attente de chiffrage par le logisticien' },
            ],
      }] : []),
      {
        title: 'Marchandise',
        icon: <Package className="h-3 w-3" />,
        fields: [
          { label: 'Nature', value: data.nature_marchandise ?? '—' },
          { label: 'Conditionnement', value: conditionnementText },
          ...(data.nb_colis_total ? [{ label: 'Total colis', value: String(data.nb_colis_total) }] : []),
          ...(data.valeur_totale_eur ? [{ label: 'Valeur totale', value: `${data.valeur_totale_eur} €` }] : []),
          ...(data.poids_total_kg ? [{ label: 'Poids total', value: `${data.poids_total_kg} kg` }] : []),
          ...(data.dimensions ? [{ label: 'Dimensions', value: data.dimensions as string }] : []),
          ...(data.dangereux ? [{ label: 'Marchandise dangereuse', value: 'OUI' as any }] : []),
        ],
      },
      {
        title: 'Expéditeur',
        icon: <MapPin className="h-3 w-3" />,
        fields: data.depart_stock_bgn
          ? [{ label: 'Adresse', value: 'Stock BGN (Bouguenais)' }]
          : [
              { label: 'Adresse', value: data.expediteur_adresse ?? '—' },
              { label: 'Contact', value: `${data.expediteur_nom ?? '—'} — ${data.expediteur_tel ?? ''}`.trim() },
            ],
      },
      {
        title: 'Destinataire',
        icon: <MapPin className="h-3 w-3" />,
        fields: [
          { label: 'Adresse', value: data.destinataire_adresse ?? '—' },
          { label: 'Contact', value: `${data.destinataire_nom ?? '—'} — ${data.destinataire_tel ?? ''}`.trim() },
        ],
      },
      ...(data.transporteur || data.num_suivi || data.cout_estime
        ? [{
            title: 'Suivi & transport',
            icon: <Send className="h-3 w-3" />,
            fields: [
              ...(data.transporteur ? [{ label: 'Transporteur', value: data.transporteur as string }] : []),
              ...(data.num_suivi ? [{ label: 'N° suivi', value: data.num_suivi as string }] : []),
              ...(data.cout_estime ? [{ label: 'Coût estimé', value: `${data.cout_estime} €` }] : []),
            ],
          }]
        : []),
    ];

    // Workflow boutons
    const todayISO = () => new Date().toISOString().slice(0, 10);
    const statusActions: DetailStatusAction[] = [];

    // ─── Workflow QUOTATION (devis) ─────────────────────────────────────
    if (isQuotation && !TERMINAL_STATUSES.includes(request.status)) {
      if (!hasProposal) {
        // Le logisticien doit chiffrer
        statusActions.push({
          key: 'quote', label: 'Chiffrer le devis',
          onClick: () => setShowQuote(true),
        });
      } else if (canDecideQuote) {
        // Le demandeur valide ou refuse
        statusActions.push({
          key: 'accept_quote',
          label: '✓ Valider le devis & lancer le transport',
          onClick: () => updateStatus(
            request.id, 'affectee', {
              mode: 'transport',
              quotation_accepted_at: new Date().toISOString(),
            }, refetch,
          ),
        });
        statusActions.push({
          key: 'refuse_quote', label: 'Refuser le devis', variant: 'outline',
          onClick: () => updateStatus(
            request.id, 'abandonnee', { quotation_refused_at: new Date().toISOString() }, refetch,
          ),
        });
      }
    }

    // ─── Workflow TRANSPORT (existant) ──────────────────────────────────
    if (!isQuotation || (isQuotation && data.quotation_accepted_at && data.mode === 'transport')) {
      switch (request.status) {
        case 'todo':
          statusActions.push({
            key: 'pec',
            label: 'Prendre en charge',
            onClick: () => updateStatus(request.id, 'affectee', undefined, refetch, { assigneeId: myProfileId }),
          });
          break;
        case 'affectee':
          statusActions.push({
            key: 'plan', label: 'Planifier',
            onClick: () => setShowPlanif(true),
          });
          break;
      case 'planifiee':
        statusActions.push({ key: 'enl', label: 'Enlèvement', variant: 'outline', targetStatus: 'en_enlevement' });
        statusActions.push({ key: 'liv', label: 'En livraison', targetStatus: 'en_livraison' });
        break;
      case 'en_enlevement':
        statusActions.push({ key: 'liv2', label: 'Enlevé → en livraison', targetStatus: 'en_livraison' });
        break;
      case 'en_livraison':
        statusActions.push({
          key: 'livre', label: 'Livré', targetStatus: 'livree',
          extraData: { date_livraison_effective: todayISO() },
        });
        break;
      case 'livree':
        statusActions.push({ key: 'clo', label: 'Clôturer', variant: 'outline', targetStatus: 'cloturee' });
        break;
      }
    }
    if (!TERMINAL_STATUSES.includes(request.status) && request.status !== 'abandonnee') {
      statusActions.push({ key: 'abd', label: 'Annuler', variant: 'ghost', targetStatus: 'abandonnee' });
    }

    return (
      <>
        <ModuleDetailDialog
          open={open}
          onClose={onClose}
          taskId={request.id}
          title={request.title}
          description={request.description ?? undefined}
          status={request.status}
          statusLabels={STATUS_LABELS}
          statusColors={STATUS_COLORS}
          priority={(data.priority as string) ?? undefined}
          extraBadges={extraBadges}
          infoLines={infoLines}
          sections={sections}
          attachments={data.attachments as any}
          links={data.links as any}
          allowAttachmentMutation={true}
          attachmentPathPrefix={`logistique-requests/${request.id}`}
          statusActions={statusActions}
          refetch={refetch}
          isAdmin={isAdmin}
          allowDelete={true}
          onDeleteConfirm="Supprimer définitivement cette demande de transport ?"
          /* "Demander complement" : passe la demande en 'complement_demande' + post un commentaire */
          complementConfig={
            !TERMINAL_STATUSES.includes(request.status) && request.status !== 'complement_demande'
              ? { targetStatus: 'complement_demande', triggerLabel: 'Demander complément' }
              : undefined
          }
          myProfileId={myProfileId}
        />
        <LogistiquePlanificationDialog
          taskId={request.id}
          open={showPlanif}
          onClose={() => setShowPlanif(false)}
          onPlanned={refetch}
        />
        <LogistiqueQuotationDialog
          taskId={request.id}
          open={showQuote}
          onClose={() => setShowQuote(false)}
          onProposed={refetch}
        />
      </>
    );
  }

// ────────────────────────────────────────────────────────────────────────
// Row actions (stateful pour gerer le dialog Planifier sur la ligne)
// ────────────────────────────────────────────────────────────────────────

function LogistiqueRowActions({ request: r, ctx }: { request: LogistiqueRequest; ctx: ModuleRowCtx }) {
  const [showPlanif, setShowPlanif] = useState(false);

  const onChange = (newStatus: string, extra?: Record<string, any>, opts?: { assigneeId?: string }) =>
    updateStatus(r.id, newStatus, extra, ctx.refetch, opts).catch(() => {});

  let actionBtn: React.ReactNode = null;
  switch (r.status) {
    case 'todo':
      actionBtn = (
        <Button
          size="sm"
          onClick={(e) => { e.stopPropagation(); onChange('affectee', undefined, { assigneeId: ctx.myProfileId }); }}
        >
          Prendre en charge
        </Button>
      );
      break;
    case 'affectee':
      actionBtn = (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); setShowPlanif(true); }}>Planifier</Button>
      );
      break;
    case 'planifiee':
      actionBtn = (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onChange('en_enlevement'); }}>Enlèvement</Button>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onChange('en_livraison'); }}>En livraison</Button>
        </div>
      );
      break;
    case 'en_enlevement':
      actionBtn = (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onChange('en_livraison'); }}>Enlevé</Button>
      );
      break;
    case 'en_livraison':
      actionBtn = (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onChange('livree', { date_livraison_effective: new Date().toISOString().slice(0,10) }); }}>Livré</Button>
      );
      break;
    case 'livree':
      actionBtn = (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onChange('cloturee'); }}>Clôturer</Button>
      );
      break;
  }

  return (
    <>
      {actionBtn}
      {ctx.isAdmin && (
        <Button
          size="icon" variant="ghost" className="h-7 w-7 text-destructive"
          onClick={(e) => { e.stopPropagation(); deleteRequest(r.id, ctx.refetch); }}
          title="Supprimer"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
      <LogistiquePlanificationDialog
        taskId={r.id}
        open={showPlanif}
        onClose={() => setShowPlanif(false)}
        onPlanned={ctx.refetch}
      />
    </>
  );
}
