/**
 * ModuleDetailDialog — fenetre de detail unifiee pour tous les modules
 * (IT, Logistique, Maintenance, ...).
 *
 * Le dialog est piloté par une "config de detail" :
 *  - header : numero (extrait du titre), titre, badges (statut, priorite, +custom)
 *  - description
 *  - bloc info (grille) : libelle / valeur / icone
 *  - sections metier : titre + grille de champs (par module)
 *  - pieces jointes & liens (upload + add link)
 *  - chat compact
 *  - footer : actions par statut + bouton supprimer (admin)
 *
 * Chaque module fournit sa config dans son `<module>DispatchConfig.tsx`
 * et la branche dans `ModuleDispatchView` via `DetailDialog`.
 */
import { useState, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TaskCommentsSection } from '@/components/tasks/TaskCommentsSection';
import {
  AlertCircle, CheckCircle2, Trash2, Paperclip, Link as LinkIcon, ExternalLink, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DetailInfoLine {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export interface DetailSection {
  title: string;
  icon?: ReactNode;
  /** Soit une grille de champs (label/value), soit un node libre */
  fields?: DetailInfoLine[];
  content?: ReactNode;
}

export interface DetailAttachment {
  name: string;
  url: string;
  size?: number;
}

export interface DetailStatusAction {
  key: string;
  label: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  /** Si fourni : execute cette callback. Sinon : update le statut vers `targetStatus`. */
  onClick?: () => void | Promise<void>;
  targetStatus?: string;
  extraData?: Record<string, any>;
}

export interface DetailComplementConfig {
  /** Statut a appliquer apres post du complement (ex: 'en_attente_complement_demandeur') */
  targetStatus: string;
  /** Prefixe ajoute au commentaire poste */
  commentPrefix?: string;
  /** Libelle du bouton declencheur affiche dans la barre d'actions */
  triggerLabel?: string;
}

export interface ModuleDetailDialogProps {
  open: boolean;
  onClose: () => void;

  // Identite
  taskId: string;
  /** Numero affiche en badge mono (ex: D-LOGISTIQUE-TRANSP-00002). Si absent : extrait avant " — " du titre. */
  numero?: string;
  title: string;
  description?: string;

  // Statut & priorite
  status: string;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  priority?: string;
  priorityLabels?: Record<string, string>;

  // Badges custom additionnels (URGENT, prestation, filiale, projet…)
  extraBadges?: ReactNode;

  // Bloc info (grille 2 colonnes)
  infoLines: DetailInfoLine[];

  // Sections metier (Marchandise, Expéditeur, Destinataire, Suivi…)
  sections?: DetailSection[];

  // Pieces jointes & liens (lus depuis module_data)
  attachments?: DetailAttachment[];
  links?: string[];
  /** Si true : permet d'uploader/ajouter (sinon read-only) */
  allowAttachmentMutation?: boolean;
  /** Storage path prefix utilise pour upload (default: `{module}/{taskId}/...`) */
  attachmentPathPrefix?: string;

  // Complement form (IT)
  complementConfig?: DetailComplementConfig;
  /** Profile id de l'utilisateur courant (pour insert task_comments) */
  myProfileId?: string;

  // Actions de workflow (footer droit)
  statusActions?: DetailStatusAction[];
  /** Callback appelée après tout changement (refetch + parfois fermeture) */
  refetch: () => void;

  // Delete (footer gauche)
  isAdmin: boolean;
  allowDelete?: boolean;
  onDeleteConfirm?: string; // message confirm

  /** Texte qui apparait sous les actions si l'utilisateur n'est pas autorise */
  notAuthorizedHint?: string;
  authorized?: boolean; // par defaut true
}

const DEFAULT_PRIORITY_LABELS: Record<string, string> = {
  low: 'Faible', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente',
};

export function ModuleDetailDialog(props: ModuleDetailDialogProps) {
  const {
    open, onClose,
    taskId, numero, title, description,
    status, statusLabels, statusColors, priority, priorityLabels,
    extraBadges, infoLines, sections,
    attachments, links, allowAttachmentMutation, attachmentPathPrefix,
    complementConfig, myProfileId,
    statusActions, refetch,
    isAdmin, allowDelete, onDeleteConfirm,
    notAuthorizedHint, authorized = true,
  } = props;

  const [busy, setBusy] = useState(false);
  const [showComplement, setShowComplement] = useState(false);
  const [complementMsg, setComplementMsg] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const numeroDisplay = numero ?? (title.includes(' — ') ? title.split(' — ')[0] : '');
  const titleDisplay = title;

  const updateStatus = async (newStatus: string, extra?: Record<string, any>) => {
    setBusy(true);
    try {
      const updates: any = { status: newStatus };
      if (extra) {
        // Refetch current row pour merger module_data proprement
        const { data: row } = await supabase.from('tasks').select('module_data').eq('id', taskId).maybeSingle();
        const merged = { ...((row as any)?.module_data ?? {}), ...extra };
        updates.module_data = merged;
      }
      const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
      if (error) throw error;
      toast.success(`Statut → ${statusLabels[newStatus] ?? newStatus}`);
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const msg = onDeleteConfirm ?? 'Supprimer définitivement cette demande ?\n\nCette action est irréversible.';
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      toast.success('Demande supprimée');
      onClose();
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!allowAttachmentMutation) return;
    setBusy(true);
    try {
      const prefix = attachmentPathPrefix ?? `requests/${taskId}`;
      const path = `${prefix}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
      const { data: row } = await supabase.from('tasks').select('module_data').eq('id', taskId).maybeSingle();
      const current = (row as any)?.module_data ?? {};
      const updated = [...(current.attachments ?? []), { name: file.name, url: pub.publicUrl, size: file.size }];
      const { error: tErr } = await supabase.from('tasks')
        .update({ module_data: { ...current, attachments: updated } })
        .eq('id', taskId);
      if (tErr) throw tErr;
      toast.success('Fichier ajouté');
      refetch();
    } catch (e: any) {
      toast.error(`Erreur upload : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAddLink = async () => {
    if (!allowAttachmentMutation || !newLinkUrl.trim()) return;
    setBusy(true);
    try {
      const { data: row } = await supabase.from('tasks').select('module_data').eq('id', taskId).maybeSingle();
      const current = (row as any)?.module_data ?? {};
      const updated = [...(current.links ?? []), newLinkUrl.trim()];
      const { error } = await supabase.from('tasks')
        .update({ module_data: { ...current, links: updated } })
        .eq('id', taskId);
      if (error) throw error;
      toast.success('Lien ajouté');
      setNewLinkUrl('');
      setShowAddLink(false);
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const submitComplement = async () => {
    if (!complementConfig || !myProfileId || !complementMsg.trim()) return;
    setBusy(true);
    try {
      const prefix = complementConfig.commentPrefix ?? '[Complément demandé] ';
      const { error: cErr } = await supabase.from('task_comments').insert({
        task_id: taskId,
        author_id: myProfileId,
        content: prefix + complementMsg.trim(),
      });
      if (cErr) throw cErr;
      const { error: sErr } = await supabase.from('tasks')
        .update({ status: complementConfig.targetStatus })
        .eq('id', taskId);
      if (sErr) throw sErr;
      toast.success('Complément demandé');
      setComplementMsg('');
      setShowComplement(false);
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleStatusActionClick = async (a: DetailStatusAction) => {
    if (a.onClick) {
      await a.onClick();
    } else if (a.targetStatus) {
      await updateStatus(a.targetStatus, a.extraData);
    }
  };

  const renderInfoLine = (line: DetailInfoLine) => (
    <div className="flex items-start gap-2 text-sm" key={line.label}>
      {line.icon && <span className="text-muted-foreground mt-0.5">{line.icon}</span>}
      <span className="text-muted-foreground min-w-[120px] shrink-0">{line.label}</span>
      <span className="font-medium flex-1">{line.value || '—'}</span>
    </div>
  );

  const priLabels = priorityLabels ?? DEFAULT_PRIORITY_LABELS;
  const hasAttachmentsBlock = !!(attachments || links || allowAttachmentMutation);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* HEADER */}
        <DialogHeader className="p-4 pb-3 border-b">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {numeroDisplay && <Badge variant="outline" className="font-mono text-xs">{numeroDisplay}</Badge>}
            <Badge variant="outline" className={cn('text-xs', statusColors[status])}>
              {statusLabels[status] ?? status}
            </Badge>
            {priority && (
              <Badge variant="outline" className="text-xs">
                {priLabels[priority] ?? priority}
              </Badge>
            )}
            {extraBadges}
          </div>
          <DialogTitle className="text-base">{titleDisplay}</DialogTitle>
        </DialogHeader>

        {/* CORPS scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {description && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> DESCRIPTION
              </h3>
              <p className="text-sm whitespace-pre-wrap">{description}</p>
            </section>
          )}

          {(description) && <Separator />}

          {/* Bloc info */}
          {infoLines.length > 0 && (
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {infoLines.map(renderInfoLine)}
            </section>
          )}

          {/* Sections metier */}
          {sections?.map((s, i) => (
            <div key={i}>
              <Separator />
              <section className="pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  {s.icon} {s.title.toUpperCase()}
                </h3>
                {s.fields && s.fields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {s.fields.map(renderInfoLine)}
                  </div>
                )}
                {s.content}
              </section>
            </div>
          ))}

          {/* Pieces jointes & liens */}
          {hasAttachmentsBlock && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> PIÈCES JOINTES & LIENS
                </h3>
                <div className="space-y-2">
                  {(!attachments?.length && !links?.length) && (
                    <p className="text-xs text-muted-foreground italic">Aucune pièce jointe ni lien</p>
                  )}
                  {attachments?.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded p-2 bg-muted/30">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">
                        {a.name}
                      </a>
                      {a.size && <span className="text-xs text-muted-foreground">{Math.round(a.size / 1024)} ko</span>}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ))}
                  {links?.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded p-2 bg-muted/30">
                      <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={l} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">
                        {l}
                      </a>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ))}
                  {allowAttachmentMutation && (
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
                  )}
                  {showAddLink && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="url"
                        placeholder="https://..."
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
            </>
          )}

          {/* Demander complement form (IT) */}
          {showComplement && complementConfig && (
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

          {/* Echanges */}
          <section className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              💬 ÉCHANGES
            </h3>
            <div className="border rounded-lg" style={{ height: '28vh', minHeight: 200 }}>
              <TaskCommentsSection taskId={taskId} className="h-full p-3" />
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <DialogFooter className="p-3 border-t bg-muted/30 flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
            {isAdmin && allowDelete && (
              <Button
                variant="ghost" size="sm" onClick={handleDelete} disabled={busy}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
            )}
          </div>
          {!authorized ? (
            <span className="text-xs text-muted-foreground">{notAuthorizedHint ?? "Non autorisé pour ce statut"}</span>
          ) : (
            <div className="flex flex-wrap gap-1 items-center">
              {complementConfig && (
                <Button
                  size="sm" variant="outline" onClick={() => setShowComplement(true)} disabled={busy || showComplement}
                >
                  {complementConfig.triggerLabel ?? 'Demander complément'}
                </Button>
              )}
              {statusActions?.map((a) => (
                <Button
                  key={a.key}
                  size="sm"
                  variant={a.variant ?? 'default'}
                  onClick={() => void handleStatusActionClick(a)}
                  disabled={busy}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Helper : icone de check pour les status terminaux */
export const DoneIcon = CheckCircle2;
