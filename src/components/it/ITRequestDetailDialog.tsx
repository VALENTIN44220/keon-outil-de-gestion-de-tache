/**
 * ITRequestDetailDialog — fenetre de detail compacte pour une demande IT.
 *
 * Affiche en 1 page :
 *  - Header : titre, badges (statut, priorite, prestation, projet IT)
 *  - Bloc demande : description, demandeur, exécutant, référent métier,
 *    dates (créée le, échéance, mise à jour état, clôturée le si terminal),
 *    champs spécifiques par prestation (SharePoint emails, ticket ITP/BLC...)
 *  - Chat compact (scrollable, hauteur fixe)
 *  - Actions par statut + statuts spécifiques selon prestation
 */
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TaskCommentsSection } from '@/components/tasks/TaskCommentsSection';
import { Calendar, Clock, User, Briefcase, ListChecks, FileText, AlertCircle, CheckCircle2, Trash2, Paperclip, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { ITRequest } from '@/hooks/useITRequests';
import { Textarea } from '@/components/ui/textarea';
import { ITRequestStatusBadge } from '@/components/it/ITRequestStatusBadge';

const STATUS_LABELS: Record<string, string> = {
  todo: 'À traiter',
  'in-progress': 'En cours',
  in_progress: 'En cours',
  en_attente_complement_demandeur: 'Attente compléments',
  en_attente_retour_externe: 'Attente retour externe',
  en_attente_retour_ticket_itp: 'Attente ticket ITP (Divalto)',
  en_attente_retour_ticket_blc: 'Attente ticket BLC (Pipedrive)',
  en_attente_chiffrage: 'Attente chiffrage',
  realisee: 'Réalisée',
  cancelled: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-blue-100 text-blue-800 border-blue-300',
  'in-progress': 'bg-violet-100 text-violet-800 border-violet-300',
  in_progress: 'bg-violet-100 text-violet-800 border-violet-300',
  en_attente_complement_demandeur: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  en_attente_retour_externe: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_retour_ticket_itp: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_retour_ticket_blc: 'bg-orange-100 text-orange-800 border-orange-300',
  en_attente_chiffrage: 'bg-amber-100 text-amber-800 border-amber-300',
  realisee: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-300',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Faible', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente',
};

interface ProfileLite { id: string; display_name: string }

interface ITRequestDetailDialogProps {
  request: ITRequest;
  open: boolean;
  onClose: () => void;
  onMutated?: () => void;
  /** Map id -> display_name pour afficher demandeur / executant / referent */
  profilesMap?: Map<string, string>;
  /** Map id -> nom du projet pour le badge "Projet lié" */
  itProjectMap?: Map<string, string>;
}

export function ITRequestDetailDialog({
  request, open, onClose, onMutated, profilesMap, itProjectMap,
}: ITRequestDetailDialogProps) {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const myProfile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  const { isAdmin: realIsAdmin } = useUserRole();
  const isAdmin = realIsAdmin && !isSimulating;

  const [complementMsg, setComplementMsg] = useState('');
  const [showComplement, setShowComplement] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = request.module_data ?? {};
  const isAssignee = request.assignee_id === myProfile?.id;
  const prestation = (data.prestation as string) ?? '';
  const isDivalto = prestation.toUpperCase().includes('DIVALTO');
  const isPipedrive = prestation.toUpperCase().includes('PIPEDRIVE');
  const itProjectId = (request as any).it_project_id as string | null;

  const statusDates = (request as any).status_dates as Record<string, string> | undefined;
  // Date demande : priorite Planner.createdDateTime (date_demande) > status_dates.todo > created_at app
  const dateOuverture = useMemo(() =>
    (request as any).date_demande ?? statusDates?.todo ?? request.created_at,
    [statusDates, request.created_at, request]);
  const dateLancement = (request as any).date_lancement ?? statusDates?.['in-progress'] ?? null;
  const dateMaj = useMemo(() => {
    if (!statusDates) return request.updated_at;
    const vals = Object.values(statusDates);
    return vals.length ? vals.sort().slice(-1)[0] : request.updated_at;
  }, [statusDates, request.updated_at]);
  const dateCloture = (request as any).date_fermeture ?? statusDates?.realisee ?? statusDates?.cloturee ?? null;

  const fmt = (iso: string | null | undefined) =>
    iso ? format(parseISO(iso), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—';
  const fmtDay = (iso: string | null | undefined) =>
    iso ? format(parseISO(iso), 'dd/MM/yyyy', { locale: fr }) : '—';

  const updateStatus = async (newStatus: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', request.id);
      if (error) throw error;
      toast.success(`Statut → ${STATUS_LABELS[newStatus] ?? newStatus}`);
      onMutated?.();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer définitivement cette demande IT et tous ses commentaires/historique ?\n\nCette action est irréversible.')) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', request.id);
      if (error) throw error;
      toast.success('Demande supprimée');
      onClose();
      onMutated?.();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Pieces jointes : affichage + upload
  const attachments = (data.attachments as Array<{ name: string; url: string; size?: number }>) ?? [];
  const links = (data.links as string[]) ?? [];
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);

  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) return;
    setBusy(true);
    try {
      const updated = [...links, newLinkUrl.trim()];
      const { error } = await supabase.from('tasks')
        .update({ module_data: { ...data, links: updated } })
        .eq('id', request.id);
      if (error) throw error;
      toast.success('Lien ajouté');
      setNewLinkUrl('');
      setShowAddLink(false);
      onMutated?.();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!myProfile?.id) return;
    setBusy(true);
    try {
      const path = `it-requests/${request.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, {
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
      const updated = [...attachments, { name: file.name, url: pub.publicUrl, size: file.size }];
      const { error: tErr } = await supabase.from('tasks')
        .update({ module_data: { ...data, attachments: updated } })
        .eq('id', request.id);
      if (tErr) throw tErr;
      toast.success('Fichier ajouté');
      onMutated?.();
    } catch (e: any) {
      toast.error(`Erreur upload : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const submitComplement = async () => {
    if (!myProfile?.id || !complementMsg.trim()) return;
    setBusy(true);
    try {
      const { error: cErr } = await supabase.from('task_comments').insert({
        task_id: request.id,
        author_id: myProfile.id,
        content: '[Complément demandé] ' + complementMsg.trim(),
      });
      if (cErr) throw cErr;
      const { error: sErr } = await supabase.from('tasks')
        .update({ status: 'en_attente_complement_demandeur' })
        .eq('id', request.id);
      if (sErr) throw sErr;
      toast.success('Complément demandé');
      setComplementMsg('');
      setShowComplement(false);
      onMutated?.();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const renderActions = () => {
    if (!isAssignee && !myProfile?.permission_profile?.is_admin) {
      return <span className="text-xs text-muted-foreground">Seul l'exécutant peut faire avancer</span>;
    }
    const buttons: JSX.Element[] = [];
    switch (request.status) {
      case 'todo':
        buttons.push(<Button key="start" size="sm" onClick={() => updateStatus('in-progress')} disabled={busy}>Démarrer</Button>);
        break;
      case 'in_progress':
      case 'in-progress':
        buttons.push(<Button key="comp" size="sm" variant="outline" onClick={() => setShowComplement(true)} disabled={busy}>Demander complément</Button>);
        if (isDivalto) {
          buttons.push(<Button key="itp" size="sm" variant="outline" onClick={() => updateStatus('en_attente_retour_ticket_itp')} disabled={busy}>Attente ticket ITP</Button>);
        }
        if (isPipedrive) {
          buttons.push(<Button key="blc" size="sm" variant="outline" onClick={() => updateStatus('en_attente_retour_ticket_blc')} disabled={busy}>Attente ticket BLC</Button>);
        }
        if (isDivalto || isPipedrive) {
          buttons.push(<Button key="chf" size="sm" variant="outline" onClick={() => updateStatus('en_attente_chiffrage')} disabled={busy}>Attente chiffrage</Button>);
        }
        buttons.push(<Button key="realisee" size="sm" onClick={() => updateStatus('realisee')} disabled={busy}>Réalisée</Button>);
        break;
      case 'en_attente_complement_demandeur':
      case 'en_attente_retour_externe':
      case 'en_attente_retour_ticket_itp':
      case 'en_attente_retour_ticket_blc':
      case 'en_attente_chiffrage':
        buttons.push(<Button key="resume" size="sm" onClick={() => updateStatus('in-progress')} disabled={busy}>Reprendre</Button>);
        buttons.push(<Button key="realisee" size="sm" variant="outline" onClick={() => updateStatus('realisee')} disabled={busy}>Marquer réalisée</Button>);
        break;
      default:
        return null;
    }
    return <div className="flex flex-wrap gap-1">{buttons}</div>;
  };

  const renderInfoLine = (label: string, value: React.ReactNode, icon?: React.ReactNode) => (
    <div className="flex items-start gap-2 text-sm">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <span className="text-muted-foreground min-w-[120px] shrink-0">{label}</span>
      <span className="font-medium flex-1">{value || '—'}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="font-mono text-xs">{request.title.split(' — ')[0]}</Badge>
            <ITRequestStatusBadge
              status={(request as any).it_request_status ?? request.status}
              compact
            />
            {data.priority && (
              <Badge variant="outline" className="text-xs">
                {PRIORITY_LABELS[data.priority as string] ?? data.priority}
              </Badge>
            )}
            {prestation && <Badge variant="secondary" className="text-xs">{prestation}</Badge>}
            {itProjectId && itProjectMap?.get(itProjectId) && (
              <Badge variant="secondary" className="text-xs">📁 {itProjectMap.get(itProjectId)}</Badge>
            )}
          </div>
          <DialogTitle className="text-base">{request.title}</DialogTitle>
        </DialogHeader>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Description */}
          {request.description && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> DESCRIPTION
              </h3>
              <p className="text-sm whitespace-pre-wrap">{request.description}</p>
            </section>
          )}

          <Separator />

          {/* Bloc infos */}
          <section className="grid grid-cols-2 gap-x-4 gap-y-2">
            {renderInfoLine('Demandeur', request.requester_id ? profilesMap?.get(request.requester_id) ?? '—' : '—', <User className="h-3 w-3" />)}
            {renderInfoLine('Exécutant', request.assignee_id ? profilesMap?.get(request.assignee_id) ?? '—' : '—', <User className="h-3 w-3" />)}
            {data.referent_metier_profile_id && renderInfoLine(
              'Référent métier',
              profilesMap?.get(data.referent_metier_profile_id) ?? '—',
              <Briefcase className="h-3 w-3" />
            )}
            {data.priority && renderInfoLine('Priorité', PRIORITY_LABELS[data.priority as string] ?? data.priority, <AlertCircle className="h-3 w-3" />)}
            {renderInfoLine('Date demande', fmt(dateOuverture), <Calendar className="h-3 w-3" />)}
            {dateLancement && renderInfoLine('Date début', fmt(dateLancement), <Clock className="h-3 w-3" />)}
            {request.due_date && renderInfoLine('Échéance souhaitée', fmtDay(request.due_date), <Clock className="h-3 w-3" />)}
            {renderInfoLine('Dernière maj état', fmt(dateMaj), <Clock className="h-3 w-3" />)}
            {dateCloture && renderInfoLine('Clôturée le', fmt(dateCloture), <CheckCircle2 className="h-3 w-3" />)}
          </section>

          {/* Pieces jointes + liens */}
          <Separator />
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> PIÈCES JOINTES & LIENS
            </h3>
            <div className="space-y-2">
              {attachments.length === 0 && links.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Aucune pièce jointe ni lien</p>
              )}
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm border rounded p-2 bg-muted/30">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">
                    {a.name}
                  </a>
                  {a.size && <span className="text-xs text-muted-foreground">{Math.round(a.size / 1024)} ko</span>}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-sm border rounded p-2 bg-muted/30">
                  <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={l} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">
                    {l}
                  </a>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUploadFile(f); }}
                    disabled={busy}
                  />
                  <Button type="button" size="sm" variant="outline" disabled={busy} asChild>
                    <span><Paperclip className="h-3 w-3 mr-1" />Ajouter un fichier</span>
                  </Button>
                </label>
                <Button size="sm" variant="outline" onClick={() => setShowAddLink(s => !s)} disabled={busy}>
                  <LinkIcon className="h-3 w-3 mr-1" />Ajouter un lien
                </Button>
              </div>
              {showAddLink && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="url"
                    placeholder="https://serveur-interne/..."
                    className="flex-1 h-8 px-2 text-sm border rounded"
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    disabled={busy}
                  />
                  <Button size="sm" onClick={handleAddLink} disabled={busy || !newLinkUrl.trim()}>OK</Button>
                </div>
              )}
            </div>
          </section>

          {/* Champs specifiques prestation */}
          {(data.nom_dossier_sharepoint || data.emails_acces || data.num_ticket_itp || data.num_ticket_blc || data.logiciel_concerne) && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <ListChecks className="h-3 w-3" /> INFOS PRESTATION
                </h3>
                <div className="space-y-1.5">
                  {data.nom_dossier_sharepoint && renderInfoLine('Nom dossier SharePoint', data.nom_dossier_sharepoint as string)}
                  {data.emails_acces && renderInfoLine('Emails accès', data.emails_acces as string)}
                  {data.num_ticket_itp && renderInfoLine('N° ticket ITP', data.num_ticket_itp as string)}
                  {data.num_ticket_blc && renderInfoLine('N° ticket BLC', data.num_ticket_blc as string)}
                  {data.logiciel_concerne && renderInfoLine(
                    'Logiciel / outil concerné',
                    data.logiciel_sous_categorie
                      ? `${data.logiciel_concerne} — ${data.logiciel_sous_categorie}`
                      : data.logiciel_concerne
                  )}
                </div>
              </section>
            </>
          )}

          {/* Dialog Demander complement (overlay inline plutot que modal nested) */}
          {showComplement && (
            <>
              <Separator />
              <section className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 text-sm font-medium">
                  <AlertCircle className="h-4 w-4" /> Demander un complément au demandeur
                </div>
                <Textarea
                  rows={3}
                  value={complementMsg}
                  onChange={(e) => setComplementMsg(e.target.value)}
                  placeholder="Précise ta question (sera postée dans le chat + notif)"
                  disabled={busy}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setShowComplement(false); setComplementMsg(''); }} disabled={busy}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={submitComplement} disabled={busy || !complementMsg.trim()}>
                    Poster + demander
                  </Button>
                </div>
              </section>
            </>
          )}

          <Separator />

          {/* Chat compact (max-h-[28vh] dans le scroll global) */}
          <section className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              💬 ÉCHANGES
            </h3>
            <div className="border rounded-lg" style={{ height: '28vh', minHeight: 200 }}>
              <TaskCommentsSection taskId={request.id} className="h-full p-3" />
            </div>
          </section>
        </div>

        <DialogFooter className="p-3 border-t bg-muted/30 flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={busy} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
            )}
          </div>
          {renderActions()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
