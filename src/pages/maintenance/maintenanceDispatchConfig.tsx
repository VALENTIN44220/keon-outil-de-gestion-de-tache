/**
 * maintenanceDispatchConfig — config Maintenance pour ModuleDispatchView.
 *
 * Specificites :
 *  - row id = task_id (pas id)
 *  - "status" metier = etat_global (label francais, pas slug)
 *  - workflow par boutons Valider / Refuser (useMaterialValidation)
 *  - pas de kanban/calendrier (seulement tableau)
 *  - sub-tableau lignes[] dans le panneau etendu
 */
import { useState } from 'react';
import { Package, AlertTriangle, Clock, CheckCircle2, ListChecks, Trash2, User, Calendar, Boxes, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useMaintenanceRequests, MaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useMaterialValidation } from '@/hooks/useMaterialValidation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TaskStats } from '@/types/task';
import {
  ModuleDetailDialog, DetailSection, DetailInfoLine, DetailStatusAction,
} from '@/components/modules/ModuleDetailDialog';
import type { ModuleDispatchConfig, ModuleKpi, ModuleRowCtx } from '@/components/modules/ModuleDispatchView';

const ETATS_COLORS: Record<string, string> = {
  'En attente validation': 'bg-amber-100 text-amber-800 border-amber-300',
  'Demande de devis': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Bon de commande envoyé': 'bg-blue-100 text-blue-800 border-blue-300',
  'AR reçu': 'bg-purple-100 text-purple-800 border-purple-300',
  'Commande livrée': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Commande distribuée': 'bg-green-100 text-green-800 border-green-300',
};

// On utilise les memes labels et keys (les etats sont deja en francais)
const ETATS_LABELS: Record<string, string> = Object.fromEntries(
  Object.keys(ETATS_COLORS).map(e => [e, e]),
);

const MAINT_TERMINAL = ['Commande distribuée', 'Commande distribuee'];

const deleteRequest = async (id: string, refetch: () => void) => {
  if (!confirm('Supprimer définitivement cette demande matériel ?')) return;
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    toast.success('Demande supprimée');
    refetch();
  } catch (e: any) {
    toast.error(`Erreur : ${e.message}`);
  }
};

export const maintenanceDispatchConfig: ModuleDispatchConfig<MaintenanceRequest, {}> = {
  moduleCode: 'maintenance',
  activeView: 'maintenance-dispatch',
  title: 'Demandes matériel',
  subtitle: 'Validation coordinateur → commande logistique',
  icon: Package,
  iconBgClass: 'bg-warning/10',
  iconColorClass: 'text-warning',
  newRoute: '/maintenance/new',
  contextId: 'maintenance-module-dispatch',
  processId: 'maintenance-module',

  useRequests: useMaintenanceRequests,
  getId: (r) => r.task_id,
  getStatus: (r) => r.etat_global ?? 'En attente validation',
  getRequesterId: (r) => r.requester_id,
  getAssigneeId: (r) => r.assignee_id,

  statusLabels: ETATS_LABELS,
  terminalStatuses: MAINT_TERMINAL,
  enableKanban: false,
  enableCalendar: false,

  computeKpis: (requests): ModuleKpi[] => {
    const total = requests.length;
    const enAttenteVal = requests.filter(r => r.etat_global === 'En attente validation').length;
    const enCours = requests.filter(r => r.etat_global && ['Demande de devis', 'Bon de commande envoyé', 'AR reçu'].includes(r.etat_global)).length;
    const livrees = requests.filter(r => r.etat_global === 'Commande livrée').length;
    return [
      { icon: ListChecks, label: 'Total demandes', value: total, color: 'bg-slate-100 text-slate-700' },
      { icon: AlertTriangle, label: 'À valider (coordinateur)', value: enAttenteVal, color: 'bg-amber-100 text-amber-700' },
      { icon: Clock, label: 'En cours commande', value: enCours, color: 'bg-blue-100 text-blue-700' },
      { icon: CheckCircle2, label: 'Livrées à distribuer', value: livrees, color: 'bg-emerald-100 text-emerald-700' },
    ];
  },

  computeStats: (requests): TaskStats => {
    const total = requests.length;
    const todo = requests.filter(t => t.status === 'todo').length;
    const inProgress = requests.length - todo;
    const done = requests.filter(t => MAINT_TERMINAL.includes(t.etat_global || '')).length;
    return {
      total, todo, inProgress, done, pendingValidation: 0, validated: 0, refused: 0,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  },

  searchableFields: (r) => [
    r.title,
    ...(r.lignes?.flatMap(l => [l.ref, l.des]) ?? []),
  ],

  columns: [
    { key: 'title', header: 'Titre', className: 'font-medium max-w-[300px] truncate', cell: (r) => <>{r.title}</> },
    { key: 'lignes', header: 'Articles', cell: (r) => <>{r.nb_lignes}</> },
    { key: 'qte', header: 'Qté', cell: (r) => <>{r.qte_totale}</> },
    {
      key: 'etat',
      header: 'État global',
      cell: (r) => r.etat_global ? (
        <Badge variant="outline" className={cn('text-xs', ETATS_COLORS[r.etat_global])}>
          {r.etat_global}
        </Badge>
      ) : <>—</>,
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
      <p className="text-xs font-medium text-muted-foreground">Articles ({r.nb_lignes})</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Réf.</TableHead>
            <TableHead>Désignation</TableHead>
            <TableHead className="text-right">Quantité</TableHead>
            <TableHead>État</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {r.lignes?.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-mono text-xs">{l.ref}</TableCell>
              <TableCell className="text-sm">{l.des}</TableCell>
              <TableCell className="text-right">{l.quantite}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('text-xs', ETATS_COLORS[l.etat_commande])}>
                  {l.etat_commande}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),

  rowActions: (r, ctx) => <MaintenanceRowActions request={r} ctx={ctx} />,

  DetailDialog: (props) => <MaintenanceDetailDialog {...props} />,
};

// ────────────────────────────────────────────────────────────────────────
// Stateful row actions (Valider / Refuser)
// ────────────────────────────────────────────────────────────────────────

function MaintenanceRowActions({ request: r, ctx }: { request: MaintenanceRequest; ctx: ModuleRowCtx }) {
  const { validateMaterialRequest, refuseMaterialRequest, isProcessing } = useMaterialValidation();
  const isAwaiting = r.etat_global === 'En attente validation';

  const handleValidate = async () => {
    const ok = await validateMaterialRequest(r.task_id);
    if (ok) ctx.refetch();
  };
  const handleRefuse = async () => {
    if (!confirm('Refuser cette demande ?')) return;
    const ok = await refuseMaterialRequest(r.task_id);
    if (ok) ctx.refetch();
  };

  return (
    <>
      {isAwaiting && (
        <>
          <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); void handleValidate(); }} disabled={isProcessing}>
            Valider
          </Button>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void handleRefuse(); }} disabled={isProcessing}>
            Refuser
          </Button>
        </>
      )}
      {ctx.isAdmin && (
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

// ────────────────────────────────────────────────────────────────────────
// Stateful detail dialog
// ────────────────────────────────────────────────────────────────────────
function MaintenanceDetailDialog({ request, open, onClose, refetch, isAdmin, profilesMap }: {
  request: MaintenanceRequest;
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  isAdmin: boolean;
  myProfileId?: string;
  profilesMap: Map<string, string>;
}) {
  const { validateMaterialRequest, refuseMaterialRequest, isProcessing } = useMaterialValidation();
  const [showLivraisonDialog, setShowLivraisonDialog] = useState(false);
  const fmtDay = (iso: string | null | undefined) =>
    iso ? format(parseISO(iso), 'dd/MM/yyyy', { locale: fr }) : '—';

  const status = request.etat_global ?? 'En attente validation';
  const isAwaiting = status === 'En attente validation';
  const moduleData = (request as any).module_data ?? {};
  const dateLivraisonPrevue = moduleData.date_livraison_prevue as string | undefined;
  const dateLivraisonEffective = moduleData.date_livraison_effective as string | undefined;

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
      label: 'Demandée le',
      icon: <Calendar className="h-3 w-3" />,
      value: fmtDay(request.created_at),
    },
    {
      label: 'Articles / quantite',
      icon: <Boxes className="h-3 w-3" />,
      value: `${request.nb_lignes ?? 0} articles — ${request.qte_totale ?? 0} unités`,
    },
    ...(dateLivraisonPrevue
      ? [{ label: 'Livraison prévue', icon: <Truck className="h-3 w-3" />, value: fmtDay(dateLivraisonPrevue) }]
      : []),
    ...(dateLivraisonEffective
      ? [{ label: 'Livré le', icon: <CheckCircle2 className="h-3 w-3" />, value: fmtDay(dateLivraisonEffective) }]
      : []),
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
              <TableHead className="text-right">Qté</TableHead>
              <TableHead>État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {request.lignes?.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.ref}</TableCell>
                <TableCell className="text-sm">{l.des}</TableCell>
                <TableCell className="text-right">{l.quantite}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', ETATS_COLORS[l.etat_commande])}>
                    {l.etat_commande}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ),
    },
  ];

  const data = (request as any).module_data ?? {};

  // Workflow : faire avancer toutes les lignes au prochain etat
  // Si extraData fourni, on merge dans tasks.module_data (pour memoriser ex: date_livraison_prevue)
  const advanceAllLignes = async (nextEtat: string, extraTaskData?: Record<string, any>) => {
    try {
      const { error } = await supabase
        .from('demande_materiel')
        .update({ etat_commande: nextEtat })
        .eq('request_id', request.task_id);
      if (error) throw error;
      if (extraTaskData) {
        const merged = { ...moduleData, ...extraTaskData };
        const { error: tErr } = await supabase
          .from('tasks')
          .update({ module_data: merged })
          .eq('id', request.task_id);
        if (tErr) throw tErr;
      }
      toast.success(`Toutes les lignes → ${nextEtat}`);
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    }
  };

  const statusActions: DetailStatusAction[] = [];
  if (isAwaiting) {
    statusActions.push({
      key: 'val',
      label: isProcessing ? '…' : 'Valider',
      onClick: async () => {
        const ok = await validateMaterialRequest(request.task_id);
        if (ok) refetch();
      },
    });
    statusActions.push({
      key: 'ref',
      label: 'Refuser',
      variant: 'outline',
      onClick: async () => {
        if (!confirm('Refuser cette demande ?')) return;
        const ok = await refuseMaterialRequest(request.task_id);
        if (ok) refetch();
      },
    });
  } else {
    // Boutons de progression du workflow procurement
    switch (status) {
      case 'Demande de devis':
        // Au passage en BC : ouvre le dialog pour saisir la date de livraison prevue
        statusActions.push({ key: 'bc', label: 'BC envoyé', onClick: () => setShowLivraisonDialog(true) });
        break;
      case 'Bon de commande envoyé':
        statusActions.push({ key: 'ar', label: 'AR reçu', onClick: () => advanceAllLignes('AR reçu') });
        break;
      case 'AR reçu':
        statusActions.push({
          key: 'liv',
          label: 'Commande livrée',
          onClick: () => advanceAllLignes('Commande livrée', { date_livraison_effective: new Date().toISOString().slice(0, 10) }),
        });
        break;
      case 'Commande livrée':
        statusActions.push({ key: 'dist', label: 'Distribuée', onClick: () => advanceAllLignes('Commande distribuée') });
        break;
    }
  }

  return (
    <>
      <ModuleDetailDialog
        open={open}
        onClose={onClose}
        taskId={request.task_id}
        title={request.title}
        description={(request as any).description ?? undefined}
        status={status}
        statusLabels={ETATS_LABELS}
        statusColors={ETATS_COLORS}
        infoLines={infoLines}
        sections={sections}
        attachments={data.attachments as any}
        links={data.links as any}
        allowAttachmentMutation={true}
        attachmentPathPrefix={`maintenance-requests/${request.task_id}`}
        statusActions={statusActions}
        refetch={refetch}
        isAdmin={isAdmin}
        allowDelete={true}
        onDeleteConfirm="Supprimer définitivement cette demande matériel ?"
      />
      <MaintenanceLivraisonDialog
        open={showLivraisonDialog}
        onClose={() => setShowLivraisonDialog(false)}
        defaultDate={dateLivraisonPrevue}
        onConfirm={async (date) => {
          await advanceAllLignes('Bon de commande envoyé', { date_livraison_prevue: date });
          setShowLivraisonDialog(false);
        }}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Mini dialog : saisie de la date de livraison prevue lors du passage en BC
// ────────────────────────────────────────────────────────────────────────
function MaintenanceLivraisonDialog({ open, onClose, onConfirm, defaultDate }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: string) => Promise<void> | void;
  defaultDate?: string;
}) {
  const [date, setDate] = useState(defaultDate ?? '');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!date) {
      toast.error('Renseigne la date de livraison prévue');
      return;
    }
    setBusy(true);
    try {
      await onConfirm(date);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Bon de commande envoyé
          </DialogTitle>
          <DialogDescription>
            Renseigne la date de livraison prévue annoncée par le fournisseur.
            Le demandeur sera notifié.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="dlp">Date de livraison prévue *</Label>
            <Input
              id="dlp" type="date" value={date}
              onChange={(e) => setDate(e.target.value)} disabled={busy}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={busy || !date}>
            Confirmer & passer en BC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
