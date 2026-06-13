/**
 * SMQDetail — Fiche d'une NC (synthèse + actions + pièces jointes + historique)
 *
 * Workflow visible :
 *  - status: nouvelle | affectee | en_cours | cloturee
 *  - Boutons d'action selon le statut + rôle (pilote / admin / déclarant)
 *  - Onglet "Actions" : actions correctives/préventives liées, avec pont
 *    vers tasks (bouton "Transformer en tâche").
 */
import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMatchedRouteParam } from '@/hooks/useMatchedRouteParam';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, AlertTriangle, Play, CheckCircle2, Link as LinkIcon, Plus,
  ListChecks, History, Paperclip, FileText, User as UserIcon, Loader2, ExternalLink,
  Pencil, Sparkles,
} from 'lucide-react';
import { SMQEditDialog } from '@/components/smq/SMQEditDialog';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useNCDetail, useChangeNCStatus } from '@/hooks/useNCDeclarations';
import {
  NC_STATUS_META, NC_IDENTIFICATION_LABELS, NC_PROCESSUS,
  NC_EFFICACITE_LABELS, NC_ACTION_TYPE_LABELS, NC_ACTION_STATUS_LABELS,
  type NCActionType, type NCEfficacite,
} from '@/types/smqNC';

export default function SMQDetail() {
  // PersistentRoutes utilise matchPath (pas <Route>), donc useParams() ne
  // fonctionne PAS ici : on doit utiliser useMatchedRouteParam.
  const id = useMatchedRouteParam('id', '/smq/:id');
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const { isAdmin } = useUserRole();
  const { effectivePermissions, isLoading: permLoading } = useEffectivePermissions();
  const currentProfileId = (isSimulating && simulatedProfile ? simulatedProfile : authProfile)?.id ?? null;

  const { nc, actions, attachments, history, isLoading, refetch } = useNCDetail(id ?? null);

  if (!permLoading && !effectivePermissions.can_access_smq) {
    return <Navigate to="/" replace />;
  }
  const changeStatus = useChangeNCStatus();

  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [activeView, setActiveView] = useState('smq');
  const [efficacite, setEfficacite] = useState<NCEfficacite | ''>('');
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Charge les noms des utilisateurs référencés
  useEffect(() => {
    if (!nc) return;
    const ids = new Set<string>();
    if (nc.declarant_id) ids.add(nc.declarant_id);
    if (nc.pilote_id) ids.add(nc.pilote_id);
    actions.forEach(a => { if (a.assignee_id) ids.add(a.assignee_id); if (a.created_by) ids.add(a.created_by); });
    history.forEach(h => { if (h.changed_by) ids.add(h.changed_by); });
    attachments.forEach(a => { if (a.uploaded_by) ids.add(a.uploaded_by); });
    if (ids.size === 0) return;
    void supabase.from('profiles').select('id, display_name').in('id', Array.from(ids))
      .then(({ data }) => {
        if (data) setProfilesMap(new Map(data.map(p => [p.id, p.display_name ?? '—'])));
      });
  }, [nc, actions, history, attachments]);

  useEffect(() => {
    if (nc?.efficacite_action) setEfficacite(nc.efficacite_action);
  }, [nc?.efficacite_action]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!nc) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">NC introuvable</p>
          <Button onClick={() => navigate('/smq')}>Retour</Button>
        </main>
      </div>
    );
  }

  const meta = NC_STATUS_META[nc.status];
  const isPilote = currentProfileId === nc.pilote_id;
  const isDeclarant = currentProfileId === nc.declarant_id;
  // can_manage_smq = pilote SMQ global (Florence) ou délégué : peut piloter
  // toutes les NC, pas seulement celles où il est désigné pilote_id
  const canManage = isAdmin || isPilote || isDeclarant || effectivePermissions.can_manage_smq;

  // canEdit : qui peut MODIFIER les informations de la NC (champs métier) ?
  //  - le rédacteur, tant que la NC n'est pas clôturée (compléter sa déclaration)
  //  - le pilote désigné OU Florence/responsable SMQ, à tout moment
  //  - l'admin, à tout moment
  const canEdit =
    isAdmin
    || isPilote
    || effectivePermissions.can_manage_smq
    || (isDeclarant && nc.status !== 'cloturee');

  const processusLabel = NC_PROCESSUS.find(p => p.code === nc.processus_code)?.label ?? nc.processus_code;

  const handleAffecter = async () => {
    if (!nc.pilote_id) { toast.error('Désigne d\'abord un pilote'); return; }
    await changeStatus(nc.id, 'affectee');
    refetch();
  };

  const handleDemarrer = async () => { await changeStatus(nc.id, 'en_cours'); refetch(); };

  const handleCloturer = async () => {
    if (!efficacite) { toast.error('Renseigne l\'efficacité de l\'action avant clôture'); return; }
    const { error } = await supabase.from('nc_declarations')
      .update({ status: 'cloturee', efficacite_action: efficacite })
      .eq('id', nc.id);
    if (error) { toast.error(`Erreur clôture : ${error.message}`); return; }
    toast.success('NC clôturée');
    refetch();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title={
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/smq')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <Badge variant="outline" className="font-mono text-[10px] shrink-0">{nc.nc_number}</Badge>
              <span className="truncate">{nc.title}</span>
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">

          {/* ── Statut + actions workflow ─────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('text-xs', meta.color)}>{meta.label}</Badge>
            {nc.identification && <Badge variant="outline" className="text-xs">{NC_IDENTIFICATION_LABELS[nc.identification]}</Badge>}
            {nc.societe_code && <Badge variant="secondary" className="text-xs">{nc.societe_code}</Badge>}

            <div className="ml-auto flex items-center gap-2">
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setIsEditOpen(true)} className="gap-2">
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </Button>
              )}
              {canManage && nc.status === 'nouvelle' && (
                <Button size="sm" onClick={handleAffecter} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <UserIcon className="h-4 w-4" /> Marquer affectée
                </Button>
              )}
              {canManage && nc.status === 'affectee' && (
                <Button size="sm" onClick={handleDemarrer} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                  <Play className="h-4 w-4" /> Démarrer l'analyse
                </Button>
              )}
              {canManage && nc.status === 'en_cours' && (
                <div className="flex items-center gap-2">
                  <Select value={efficacite} onValueChange={(v) => setEfficacite(v as NCEfficacite)}>
                    <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Efficacité…" /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(NC_EFFICACITE_LABELS) as [NCEfficacite, string][]).map(([k, lbl]) => (
                        <SelectItem key={k} value={k}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleCloturer} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Clôturer
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────── */}
          <Tabs defaultValue="synthese">
            <TabsList>
              <TabsTrigger value="synthese" className="gap-2"><FileText className="h-4 w-4" />Synthèse</TabsTrigger>
              <TabsTrigger value="actions" className="gap-2"><ListChecks className="h-4 w-4" />Actions ({actions.length})</TabsTrigger>
              <TabsTrigger value="attachments" className="gap-2"><Paperclip className="h-4 w-4" />Pièces jointes ({attachments.length})</TabsTrigger>
              <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />Historique</TabsTrigger>
            </TabsList>

            {/* ── Synthèse ────────────────────────────────────────────── */}
            <TabsContent value="synthese" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <KeyValue label="Date du constat" value={format(parseISO(nc.date_constat), 'dd MMMM yyyy', { locale: fr })} />
                <KeyValue label="Date de clôture souhaitée" value={nc.date_cloture_souhaitee ? format(parseISO(nc.date_cloture_souhaitee), 'dd MMM yyyy', { locale: fr }) : '—'} />
                <KeyValue label="Rédacteur" value={nc.declarant_id ? (profilesMap.get(nc.declarant_id) ?? '—') : '—'} />
                <KeyValue label="Pilote" value={nc.pilote_id ? (profilesMap.get(nc.pilote_id) ?? '—') : 'Non désigné'} />
                <KeyValue label="Processus" value={processusLabel ?? '—'} />
                <KeyValue label="Métier" value={nc.metier_code ?? '—'} />
                {nc.fournisseur_nom && <KeyValue label="Fournisseur" value={nc.fournisseur_nom} />}
                {nc.code_projet && <KeyValue label="Code projet" value={nc.code_projet} />}
                {nc.efficacite_action && <KeyValue label="Efficacité" value={NC_EFFICACITE_LABELS[nc.efficacite_action]} />}
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Description du problème</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{nc.description_problem || <span className="italic text-muted-foreground">—</span>}</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Causes racines</CardTitle></CardHeader>
                  <CardContent><p className="text-xs whitespace-pre-wrap">{nc.causes_racines || <span className="italic text-muted-foreground">—</span>}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Actions correctives</CardTitle></CardHeader>
                  <CardContent><p className="text-xs whitespace-pre-wrap">{nc.actions_correctives || <span className="italic text-muted-foreground">—</span>}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Actions préventives</CardTitle></CardHeader>
                  <CardContent><p className="text-xs whitespace-pre-wrap">{nc.actions_preventives || <span className="italic text-muted-foreground">—</span>}</p></CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Actions liées (avec pont vers tasks) ─────────────────── */}
            <TabsContent value="actions" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{actions.length} action{actions.length > 1 ? 's' : ''} planifiée{actions.length > 1 ? 's' : ''}</p>
                <Button size="sm" onClick={() => setIsAddActionOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />Nouvelle action
                </Button>
              </div>

              {actions.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Aucune action planifiée pour cette NC
                </CardContent></Card>
              ) : actions.map(act => (
                <Card key={act.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      act.type === 'corrective' ? 'border-amber-300 text-amber-700' : 'border-sky-300 text-sky-700'
                    )}>{NC_ACTION_TYPE_LABELS[act.type]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{NC_ACTION_STATUS_LABELS[act.status]}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{act.title}</p>
                      {act.description && <p className="text-xs text-muted-foreground truncate">{act.description}</p>}
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        {act.assignee_id && <span>👤 {profilesMap.get(act.assignee_id) ?? '—'}</span>}
                        {act.due_date && <span>· Échéance {format(parseISO(act.due_date), 'dd MMM yyyy', { locale: fr })}</span>}
                      </div>
                    </div>
                    {act.linked_task_id ? (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/demande/${act.linked_task_id}`)}>
                        <ExternalLink className="h-3.5 w-3.5" /> Tâche
                      </Button>
                    ) : (
                      <ActionToTaskButton action={act} nc={nc} onDone={refetch} />
                    )}
                  </CardContent>
                </Card>
              ))}

              {isAddActionOpen && (
                <NewActionForm
                  nc={nc}
                  existingActions={actions}
                  onClose={() => setIsAddActionOpen(false)}
                  onCreated={refetch}
                />
              )}
            </TabsContent>

            {/* ── Pièces jointes ──────────────────────────────────────── */}
            <TabsContent value="attachments" className="space-y-3">
              <AttachmentsList ncId={nc.id} attachments={attachments} profilesMap={profilesMap} onRefresh={refetch} />
            </TabsContent>

            {/* ── Historique ──────────────────────────────────────────── */}
            <TabsContent value="history" className="space-y-2">
              {history.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Aucun historique</CardContent></Card>
              ) : history.map(h => (
                <Card key={h.id}>
                  <CardContent className="p-3 flex items-center gap-3 text-sm">
                    <Badge variant="outline" className={cn('text-[10px]', NC_STATUS_META[h.to_status]?.color)}>
                      {NC_STATUS_META[h.to_status]?.label ?? h.to_status}
                    </Badge>
                    <span className="flex-1 text-muted-foreground">
                      {h.from_status && <>{NC_STATUS_META[h.from_status]?.label ?? h.from_status} → </>}
                      <strong>{NC_STATUS_META[h.to_status]?.label ?? h.to_status}</strong>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {h.changed_by && (profilesMap.get(h.changed_by) ?? '—')}
                      {' · '}
                      {format(parseISO(h.changed_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Dialog d'édition complète de la NC */}
      <SMQEditDialog nc={nc} open={isEditOpen} onClose={() => setIsEditOpen(false)} onSaved={refetch} />
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-card rounded-lg border p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

// ─── Formulaire d'ajout d'une action ──────────────────────────────────────
/**
 * Parse un texte multi-lignes (typiquement nc.actions_correctives ou
 * nc.actions_preventives) en items individuels. Reconnaît :
 *   - "1. ..." / "1) ..." / "1: ..." / "1/ ..." → numérotation explicite
 *   - "- ..." / "• ..." → puces
 *   - sinon : 1 ligne = 1 item
 * Retire le préfixe pour ne garder que le contenu.
 */
function parseActionsText(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^(\d+\s*[\.\)\:\/]|\-|•|\*)\s*/, '').trim())
    .filter(line => line.length >= 3);
}

function NewActionForm({
  nc, existingActions, onClose, onCreated,
}: {
  nc: NCDeclaration;
  existingActions: NCAction[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<NCActionType>('corrective');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const me = (isSimulating && simulatedProfile ? simulatedProfile : authProfile)?.id ?? null;

  // Parse les actions du plan + filtre celles déjà créées (titre identique)
  const suggCorrectives = parseActionsText(nc.actions_correctives);
  const suggPreventives = parseActionsText(nc.actions_preventives);
  const existingTitles = new Set(existingActions.map(a => a.title.trim().toLowerCase()));
  const remainingCorrectives = suggCorrectives.filter(s => !existingTitles.has(s.toLowerCase()));
  const remainingPreventives = suggPreventives.filter(s => !existingTitles.has(s.toLowerCase()));

  const createAction = async (actionType: NCActionType, actionTitle: string, actionDesc?: string, actionDueDate?: string) => {
    const { error } = await supabase.from('nc_actions').insert({
      nc_id: nc.id, type: actionType, title: actionTitle.trim(),
      description: actionDesc?.trim() || null,
      due_date: actionDueDate || null, status: 'todo',
      created_by: me, assignee_id: me,
    });
    if (error) { toast.error(`Erreur : ${error.message}`); return false; }
    return true;
  };

  const handleSaveManual = async () => {
    if (!title.trim()) { toast.error('Titre requis'); return; }
    setIsSaving(true);
    const ok = await createAction(type, title, description, dueDate);
    setIsSaving(false);
    if (!ok) return;
    toast.success('Action ajoutée');
    onClose(); onCreated();
  };

  const handleSuggestionClick = async (sugg: string, sType: NCActionType) => {
    setIsSaving(true);
    const ok = await createAction(sType, sugg);
    setIsSaving(false);
    if (!ok) return;
    toast.success('Action créée depuis le plan');
    onCreated();
    // On ne ferme pas le formulaire — le user peut continuer à cocher d'autres suggestions
  };

  const handleImportAll = async () => {
    setIsSaving(true);
    let count = 0;
    for (const s of remainingCorrectives) {
      if (await createAction('corrective', s)) count++;
    }
    for (const s of remainingPreventives) {
      if (await createAction('preventive', s)) count++;
    }
    setIsSaving(false);
    if (count > 0) {
      toast.success(`${count} action(s) créée(s) depuis le plan`);
      onCreated();
      onClose();
    }
  };

  const hasSuggestions = remainingCorrectives.length + remainingPreventives.length > 0;

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Nouvelle action</CardTitle>
        {hasSuggestions && (
          <CardDescription className="text-xs">
            Suggestions extraites du plan d'action de la NC — clique pour créer en un coup, ou crée manuellement ci-dessous.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Suggestions depuis le plan d'action */}
        {hasSuggestions && (
          <div className="space-y-2 p-2 rounded-lg bg-sky-50/40 border border-sky-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-800 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {remainingCorrectives.length + remainingPreventives.length} action(s) suggérée(s) du plan
              </span>
              <Button size="sm" variant="outline" disabled={isSaving} onClick={handleImportAll} className="h-7 text-xs gap-1">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Tout importer
              </Button>
            </div>
            {remainingCorrectives.map((s, i) => (
              <SuggestionRow key={`c-${i}`} text={s} type="corrective" onAdd={handleSuggestionClick} disabled={isSaving} />
            ))}
            {remainingPreventives.map((s, i) => (
              <SuggestionRow key={`p-${i}`} text={s} type="preventive" onAdd={handleSuggestionClick} disabled={isSaving} />
            ))}
          </div>
        )}

        {/* Création manuelle */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-semibold text-muted-foreground">Ou crée une action manuelle :</p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={type} onValueChange={(v) => setType(v as NCActionType)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(NC_ACTION_TYPE_LABELS) as [NCActionType, string][]).map(([k, lbl]) => (
                  <SelectItem key={k} value={k}>{lbl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'action" className="text-sm" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)" rows={2} className="text-sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>Fermer</Button>
            <Button size="sm" onClick={handleSaveManual} disabled={isSaving}>
              {isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Ajouter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionRow({
  text, type, onAdd, disabled,
}: {
  text: string;
  type: NCActionType;
  onAdd: (text: string, type: NCActionType) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-white/80 border border-sky-100 group">
      <Badge variant="outline" className={cn(
        'text-[9px] shrink-0',
        type === 'corrective' ? 'border-amber-300 text-amber-700' : 'border-sky-300 text-sky-700'
      )}>
        {type === 'corrective' ? 'Cor.' : 'Prév.'}
      </Badge>
      <span className="flex-1 text-xs text-foreground truncate" title={text}>{text}</span>
      <Button
        size="sm" variant="ghost"
        disabled={disabled}
        onClick={() => onAdd(text, type)}
        className="h-6 px-2 text-[11px] opacity-60 group-hover:opacity-100 transition-opacity"
      >
        <Plus className="h-3 w-3 mr-1" /> Créer
      </Button>
    </div>
  );
}

// ─── Bouton : transformer une action en tâche TaskFlow ───────────────────
function ActionToTaskButton({ action, nc, onDone }: { action: any; nc: any; onDone: () => void }) {
  const [isCreating, setIsCreating] = useState(false);
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const me = (isSimulating && simulatedProfile ? simulatedProfile : authProfile)?.id ?? null;
  const { user } = useAuth();

  const handleCreate = async () => {
    if (!user?.id) return;
    setIsCreating(true);
    // Crée une tâche dans tasks + lien retour
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: `[${nc.nc_number}] ${action.title}`,
        description: action.description || `Action ${action.type === 'corrective' ? 'corrective' : 'préventive'} liée à la NC ${nc.nc_number}.\n\nNC : ${nc.title}`,
        type: 'task',
        status: 'todo',
        priority: 'medium',
        assignee_id: action.assignee_id ?? me,
        requester_id: nc.declarant_id ?? me,
        due_date: action.due_date,
        user_id: user.id,
      } as any)
      .select('id')
      .single();
    if (error) {
      setIsCreating(false);
      toast.error(`Erreur création tâche : ${error.message}`);
      return;
    }
    // Lien retour
    await supabase.from('nc_actions').update({ linked_task_id: task.id }).eq('id', action.id);
    setIsCreating(false);
    toast.success('Action transformée en tâche');
    onDone();
  };

  return (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCreate} disabled={isCreating}>
      {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
      Transformer en tâche
    </Button>
  );
}

// ─── Liste des pièces jointes + ajout ────────────────────────────────────
function AttachmentsList({
  ncId, attachments, profilesMap, onRefresh,
}: {
  ncId: string;
  attachments: any[];
  profilesMap: Map<string, string>;
  onRefresh: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const me = (isSimulating && simulatedProfile ? simulatedProfile : authProfile)?.id ?? null;

  const handleAdd = async () => {
    if (!url.trim()) { toast.error('URL requise'); return; }
    setIsSaving(true);
    const { error } = await supabase.from('nc_attachments').insert({
      nc_id: ncId, name: name.trim() || url.trim(), url: url.trim(), type: 'link', uploaded_by: me,
    });
    setIsSaving(false);
    if (error) { toast.error(`Erreur : ${error.message}`); return; }
    toast.success('Lien ajouté');
    setName(''); setUrl('');
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <Input placeholder="Intitulé (optionnel)" value={name} onChange={(e) => setName(e.target.value)} className="text-sm h-9 max-w-[200px]" />
          <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} className="text-sm h-9 flex-1" />
          <Button size="sm" onClick={handleAdd} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Ajouter un lien
          </Button>
        </CardContent>
      </Card>

      {attachments.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Aucune pièce jointe</CardContent></Card>
      ) : attachments.map(att => (
        <Card key={att.id}>
          <CardContent className="p-3 flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={att.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-sky-700 hover:text-sky-900 hover:underline truncate flex-1" title={att.url}>
              {att.name || att.url}
            </a>
            {att.uploaded_by && (
              <span className="text-[11px] text-muted-foreground">par {profilesMap.get(att.uploaded_by) ?? '—'}</span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
