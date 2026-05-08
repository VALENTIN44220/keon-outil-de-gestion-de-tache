/**
 * itDispatchConfig — config IT pour ModuleDispatchView.
 *
 * Specificites :
 *  - 4 KPIs (Actives / En cours / En attente / Realisees ce mois)
 *  - Filtres extras : prestation + projet IT (incl. "Sans projet")
 *  - Inline reassign Select (IT_TEAM_PROFILE_IDS) dans la colonne Assigné
 *  - Sync Planner (admin) dans HeaderExtras
 *  - Deep-link ?openTask= avec fetchById fallback (taches archivees)
 *  - Detail dialog : ITRequestDetailDialog (compact, riche, deja en place)
 *  - Workflow Demarrer / Demander complement / Realisee
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Monitor, Cloud, ListChecks, Clock, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useITRequests, ITRequest, IT_PRESTATIONS, IT_TEAM_PROFILE_IDS,
} from '@/hooks/useITRequests';
import { useITProjects } from '@/hooks/useITProjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import type { TaskStats } from '@/types/task';
import { ITRequestDetailDialog } from '@/components/it/ITRequestDetailDialog';
import type {
  ModuleDispatchConfig, ModuleKpi, ModuleRowCtx,
} from '@/components/modules/ModuleDispatchView';

const STATUS_LABELS: Record<string, string> = {
  todo: 'À affecter',
  affectee: 'Affectée',
  in_progress: 'En cours',
  'in-progress': 'En cours',
  en_attente_complement_demandeur: 'Attente compléments',
  en_attente_retour_externe: 'Attente tiers',
  en_attente_retour_ticket_itp: 'Attente ticket ITP',
  en_attente_retour_ticket_blc: 'Attente ticket BLC',
  en_attente_chiffrage: 'Attente chiffrage',
  realisee: 'Réalisée',
  done: 'Terminée',
  cancelled: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-amber-100 text-amber-800 border-amber-300',
  affectee: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-violet-100 text-violet-800 border-violet-300',
  'in-progress': 'bg-violet-100 text-violet-800 border-violet-300',
  en_attente_complement_demandeur: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  en_attente_retour_externe: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_retour_ticket_itp: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_retour_ticket_blc: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_chiffrage: 'bg-amber-100 text-amber-800 border-amber-300',
  realisee: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  done: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-300',
};

const TERMINAL_STATUSES = ['realisee', 'cloturee', 'cancelled', 'abandonnee', 'done'];

interface ITExtraFilter {
  prestation: string; // process_template_id ou 'all'
  project: string;    // it_project_id ou 'all' ou 'none'
}

const updateStatus = async (id: string, newStatus: string, refetch: () => void) => {
  try {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    if (error) throw error;
    toast.success(`Statut → ${STATUS_LABELS[newStatus] ?? newStatus}`);
    refetch();
  } catch (e: any) {
    toast.error(`Erreur : ${e.message}`);
  }
};

const reassign = async (id: string, newAssigneeId: string, refetch: () => void) => {
  try {
    const { error } = await supabase.from('tasks').update({ assignee_id: newAssigneeId }).eq('id', id);
    if (error) throw error;
    toast.success('Réaffecté');
    refetch();
  } catch (e: any) {
    toast.error(`Erreur : ${e.message}`);
  }
};

const linkProject = async (id: string, projectId: string | null, refetch: () => void) => {
  try {
    const { error } = await supabase.from('tasks').update({ it_project_id: projectId }).eq('id', id);
    if (error) throw error;
    toast.success(projectId ? 'Lié au projet' : 'Détaché du projet');
    refetch();
  } catch (e: any) {
    toast.error(`Erreur : ${e.message}`);
  }
};

export const itDispatchConfig: ModuleDispatchConfig<ITRequest, ITExtraFilter> = {
  moduleCode: 'it',
  activeView: 'it-dispatch',
  title: 'IT — Demandes',
  subtitle: '9 prestations / auto-affectation à la cible',
  icon: Monitor,
  iconBgClass: 'bg-cyan-500/10',
  iconColorClass: 'text-cyan-600',
  newRoute: '/it/new',
  contextId: 'it-module-dispatch',
  processId: 'it-module',

  useRequests: useITRequests,
  getId: (r) => r.id,
  getStatus: (r) => r.status,
  getRequesterId: (r) => r.requester_id,
  getAssigneeId: (r) => r.assignee_id,

  statusLabels: STATUS_LABELS,
  terminalStatuses: TERMINAL_STATUSES,

  /** Profils supplementaires a charger (referent metier) */
  extraProfileIds: (r) => [r.module_data?.referent_metier_profile_id as string | undefined],

  computeKpis: (requests): ModuleKpi[] => {
    const actives = requests.filter(r => !['realisee', 'done', 'cancelled'].includes(r.status)).length;
    const enCours = requests.filter(r => ['in_progress', 'in-progress'].includes(r.status)).length;
    const enAttente = requests.filter(r => [
      'en_attente_complement_demandeur', 'en_attente_retour_externe',
      'en_attente_retour_ticket_itp', 'en_attente_retour_ticket_blc', 'en_attente_chiffrage',
    ].includes(r.status)).length;
    const now = new Date();
    const realiseesMois = requests.filter(r => {
      if (!['realisee', 'done'].includes(r.status)) return false;
      const d = new Date(r.updated_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return [
      { icon: ListChecks, label: 'Actives', value: actives, color: 'bg-slate-100 text-slate-700' },
      { icon: Clock, label: 'En cours', value: enCours, color: 'bg-violet-100 text-violet-700' },
      { icon: AlertCircle, label: 'En attente', value: enAttente, color: 'bg-amber-100 text-amber-700' },
      { icon: CheckCircle2, label: 'Réalisées ce mois', value: realiseesMois, color: 'bg-emerald-100 text-emerald-700' },
    ];
  },

  computeStats: (requests): TaskStats => {
    const total = requests.length;
    const todo = requests.filter(t => t.status === 'todo').length;
    const inProgress = requests.filter(t => t.status === 'in-progress' || t.status === 'in_progress').length;
    const done = requests.filter(t => t.status === 'realisee' || t.status === 'done').length;
    const pendingValidation = requests.filter(t => t.status === 'pending_validation_1' || t.status === 'pending_validation_2').length;
    const validated = requests.filter(t => t.status === 'validated').length;
    const refused = requests.filter(t => t.status === 'refused').length;
    const completionRate = total > 0 ? Math.round(((done + validated) / total) * 100) : 0;
    return { total, todo, inProgress, done, pendingValidation, validated, refused, completionRate };
  },

  searchableFields: (r) => [
    r.title,
    r.description,
    r.module_data?.prestation as string | undefined,
  ],

  extraFilterInitial: { prestation: 'all', project: 'all' },

  ExtraFilters: ({ value, onChange }) => <ITExtraFilters value={value} onChange={onChange} />,

  applyExtraFilters: (r, value) => {
    if (value.prestation !== 'all' && r.source_process_template_id !== value.prestation) return false;
    const pid = (r as any).it_project_id;
    if (value.project !== 'all') {
      if (value.project === 'none' && pid) return false;
      if (value.project !== 'none' && pid !== value.project) return false;
    }
    return true;
  },

  columns: [
    {
      key: 'demande',
      header: 'Demande',
      className: 'font-medium max-w-[260px] truncate text-primary',
      cell: (r) => <>{r.title}</>,
    },
    {
      key: 'prestation',
      header: 'Prestation',
      cell: (r) => <Badge variant="outline" className="text-xs">{(r.module_data?.prestation as string) ?? '—'}</Badge>,
    },
    {
      key: 'projet',
      header: 'Projet IT',
      className: 'text-xs',
      cell: (r) => <ITProjectCell request={r} />,
    },
    {
      key: 'assignee',
      header: 'Assigné',
      className: 'text-xs',
      cell: (r, ctx) => <ITAssigneeCell request={r} ctx={ctx} />,
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
      key: 'date_demande',
      header: 'Date demande',
      className: 'text-xs text-muted-foreground whitespace-nowrap',
      cell: (r) => <>{format(new Date((r.date_demande as any) ?? r.created_at), 'dd/MM/yyyy', { locale: fr })}</>,
    },
    {
      key: 'date_debut',
      header: 'Date début',
      className: 'text-xs text-muted-foreground whitespace-nowrap',
      cell: (r) => r.date_lancement
        ? <>{format(new Date(r.date_lancement), 'dd/MM/yyyy', { locale: fr })}</>
        : <span className="text-muted-foreground/50">—</span>,
    },
    {
      key: 'date_cloture',
      header: 'Date clôture',
      className: 'text-xs text-muted-foreground whitespace-nowrap',
      cell: (r) => r.date_fermeture
        ? <>{format(new Date(r.date_fermeture), 'dd/MM/yyyy', { locale: fr })}</>
        : <span className="text-muted-foreground/50">—</span>,
    },
  ],

  expandedPanel: (r, ctx) => <ITExpandedPanel request={r} ctx={ctx} />,

  rowActions: (r, ctx) => <ITRowActions request={r} ctx={ctx} />,

  HeaderExtras: ({ isAdmin, refetch }) => isAdmin ? <SyncPlannerButton refetch={refetch} /> : null,

  fetchById: async (id) => {
    const { data } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    return (data as unknown as ITRequest) ?? null;
  },

  onKanbanStatusChange: async (id, newStatus) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    if (error) toast.error(`Erreur : ${error.message}`);
  },
  onCalendarStatusChange: async (id, newStatus) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    if (error) toast.error(`Erreur : ${error.message}`);
  },

  DetailDialog: ({ request, open, onClose, refetch, profilesMap }) => {
    // Le dialog IT a besoin du itProjectMap pour afficher le badge "Projet lié"
    const { projects: itProjects } = useITProjects();
    const projectMap = useMemo(() => {
      const m = new Map<string, string>();
      for (const p of itProjects) {
        m.set(p.id, p.code_projet_digital ? `${p.code_projet_digital} — ${p.nom_projet}` : p.nom_projet);
      }
      return m;
    }, [itProjects]);
    return (
      <ITRequestDetailDialog
        request={request}
        open={open}
        onClose={onClose}
        onMutated={refetch}
        profilesMap={profilesMap}
        itProjectMap={projectMap}
      />
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// Composants stateful
// ────────────────────────────────────────────────────────────────────────

function ITExtraFilters({ value, onChange }: {
  value: ITExtraFilter;
  onChange: (next: ITExtraFilter) => void;
}) {
  const { projects: itProjects } = useITProjects();
  return (
    <>
      <Select value={value.prestation} onValueChange={(v) => onChange({ ...value, prestation: v })}>
        <SelectTrigger className="w-[230px]"><SelectValue placeholder="Prestation" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes prestations</SelectItem>
          {IT_PRESTATIONS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.project} onValueChange={(v) => onChange({ ...value, project: v })}>
        <SelectTrigger className="w-[230px]"><SelectValue placeholder="Projet IT" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous projets</SelectItem>
          <SelectItem value="none">Sans projet</SelectItem>
          {itProjects.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.code_projet_digital ? `${p.code_projet_digital} — ` : ''}{p.nom_projet}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function ITProjectCell({ request }: { request: ITRequest }) {
  const { projects: itProjects } = useITProjects();
  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of itProjects) {
      m.set(p.id, p.code_projet_digital ? `${p.code_projet_digital} — ${p.nom_projet}` : p.nom_projet);
    }
    return m;
  }, [itProjects]);
  const itProjectId = (request as any).it_project_id as string | null;
  return itProjectId ? (
    <Badge variant="secondary" className="text-xs">{projectMap.get(itProjectId) ?? itProjectId.slice(0, 6)}</Badge>
  ) : <span className="text-muted-foreground">—</span>;
}

function ITAssigneeCell({ request, ctx }: { request: ITRequest; ctx: ModuleRowCtx }) {
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; display_name: string }>>([]);
  useEffect(() => {
    if (IT_TEAM_PROFILE_IDS.length === 0) return;
    void supabase.from('profiles').select('id, display_name').in('id', IT_TEAM_PROFILE_IDS)
      .then(({ data }) => { if (data) setTeamMembers(data as any); });
  }, []);
  return (
    <div onClick={e => e.stopPropagation()}>
      <Select value={request.assignee_id ?? ''} onValueChange={(v) => reassign(request.id, v, ctx.refetch)}>
        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {teamMembers.map(t => <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ITExpandedPanel({ request, ctx }: { request: ITRequest; ctx: ModuleRowCtx }) {
  const { projects: itProjects } = useITProjects();
  const itProjectId = (request as any).it_project_id as string | null;
  const data = request.module_data ?? {};
  return (
    <>
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground">Lier à un projet IT :</span>
        <Select
          value={itProjectId ?? 'none'}
          onValueChange={(v) => linkProject(request.id, v === 'none' ? null : v, ctx.refetch)}
        >
          <SelectTrigger className="h-7 text-xs w-[300px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Aucun projet —</SelectItem>
            {itProjects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.code_projet_digital ? `${p.code_projet_digital} — ` : ''}{p.nom_projet}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="col-span-2">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
          <p>{request.description ?? '—'}</p>
        </div>
        {data.nom_dossier_sharepoint && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Dossier SharePoint</p>
            <p>{data.nom_dossier_sharepoint as string}</p>
          </div>
        )}
        {data.emails_acces && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Emails accès</p>
            <p className="text-xs">{data.emails_acces as string}</p>
          </div>
        )}
        {data.num_ticket_itp && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">N° ticket ITP</p>
            <p>{data.num_ticket_itp as string}</p>
          </div>
        )}
        {data.num_ticket_blc && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">N° ticket BLC</p>
            <p>{data.num_ticket_blc as string}</p>
          </div>
        )}
        {data.champ_complementaire_cible && (
          <div className="col-span-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Précisions cible</p>
            <p>{data.champ_complementaire_cible as string}</p>
          </div>
        )}
      </div>
    </>
  );
}

function ITRowActions({ request: r, ctx }: { request: ITRequest; ctx: ModuleRowCtx }) {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const myProfile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [showComplement, setShowComplement] = useState(false);
  const [complementMsg, setComplementMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submitComplement = async () => {
    if (!myProfile?.id || !complementMsg.trim()) return;
    setBusy(true);
    try {
      const { error: cErr } = await supabase.from('task_comments').insert({
        task_id: r.id,
        author_id: myProfile.id,
        content: '[Complément demandé] ' + complementMsg.trim(),
      });
      if (cErr) throw cErr;
      const { error: sErr } = await supabase
        .from('tasks')
        .update({ status: 'en_attente_complement_demandeur' })
        .eq('id', r.id);
      if (sErr) throw sErr;
      toast.success('Complément demandé — message posté');
      setShowComplement(false);
      setComplementMsg('');
      ctx.refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  let actionBtn: React.ReactNode = null;
  switch (r.status) {
    case 'todo':
    case 'affectee':
      actionBtn = (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(r.id, 'in-progress', ctx.refetch); }}>
          Démarrer
        </Button>
      );
      break;
    case 'in_progress':
    case 'in-progress':
      actionBtn = (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setShowComplement(true); }}>
            Demander complément
          </Button>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(r.id, 'realisee', ctx.refetch); }}>
            Réalisée
          </Button>
        </div>
      );
      break;
    case 'en_attente_complement_demandeur':
    case 'en_attente_retour_externe':
      actionBtn = (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(r.id, 'in-progress', ctx.refetch); }}>
          Reprendre
        </Button>
      );
      break;
  }

  return (
    <>
      {actionBtn}
      <Dialog open={showComplement} onOpenChange={(o) => { if (!o) setShowComplement(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un complément</DialogTitle>
            <DialogDescription>
              Pose ta question au demandeur. Elle sera postée dans le chat de la tâche
              et le demandeur recevra une notification. La demande passera en
              « Attente compléments » jusqu'à sa réponse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              rows={4}
              value={complementMsg}
              onChange={(e) => setComplementMsg(e.target.value)}
              placeholder="Quelle info manque-t-il ? Ex. peux-tu préciser le navigateur utilisé ? le n° de poste ? un screenshot ?"
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplement(false)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={submitComplement} disabled={busy || !complementMsg.trim()}>
              {busy ? 'Envoi...' : 'Poster + demander complément'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SyncPlannerButton({ refetch }: { refetch: () => void }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const syncPlanner = async () => {
    setIsSyncing(true);
    try {
      const { data: mappings, error: mErr } = await (supabase as any)
        .from('planner_plan_mappings')
        .select('id, planner_plan_title')
        .eq('target_module_code', 'it')
        .eq('sync_enabled', true);
      if (mErr) throw mErr;
      if (!mappings || mappings.length === 0) {
        toast.error('Aucun mapping Planner configuré pour le module IT.');
        return;
      }
      let totalPulled = 0;
      let totalUpdated = 0;
      let plansSync = 0;
      const errors: string[] = [];
      for (const m of mappings as Array<{ id: string; planner_plan_title: string }>) {
        try {
          const { data, error } = await supabase.functions.invoke('microsoft-graph', {
            body: { action: 'planner-sync', planMappingId: m.id, skipPush: true },
          });
          if (error) throw error;
          totalPulled += Number((data as any)?.tasksPulled ?? 0);
          totalUpdated += Number((data as any)?.tasksUpdated ?? 0);
          plansSync++;
        } catch (err: any) {
          errors.push(`${m.planner_plan_title}: ${err.message ?? 'erreur'}`);
        }
      }
      if (errors.length > 0) {
        toast.error(`Sync partielle (${plansSync}/${mappings.length}) — ${errors[0]}`);
      } else {
        toast.success(`Sync Planner OK — ${totalPulled} nouvelles, ${totalUpdated} mises à jour (${plansSync} plan(s))`);
      }
      refetch();
    } catch (e: any) {
      toast.error(`Erreur sync : ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={syncPlanner} disabled={isSyncing}>
      <Cloud className="h-4 w-4 mr-2" />
      {isSyncing ? 'Sync...' : 'Sync Planner'}
    </Button>
  );
}
