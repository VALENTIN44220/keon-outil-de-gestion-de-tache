import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip, Send, Trash2, History, Loader2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateBugReport, useDeleteBugReport, useBugReportStatusHistory } from '@/hooks/useBugReports';
import { useBugReportComments } from '@/hooks/useBugReportComments';
import { useBugReportAttachments } from '@/hooks/useBugReportAttachments';
import {
  BUG_TYPE_CONFIG, BUG_STATUS_CONFIG, BUG_PRIORITY_CONFIG,
  BUG_STATUS_OPTIONS, BUG_PRIORITY_OPTIONS,
  type BugReport, type BugStatus, type BugPriority,
} from '@/types/bugReport';

const NONE = '__none__';

interface BugReportDetailProps {
  bug: BugReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: fr }); } catch { return d; }
}
function initials(name?: string | null) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

export function BugReportDetail({ bug, open, onOpenChange, isAdmin }: BugReportDetailProps) {
  const update = useUpdateBugReport();
  const del = useDeleteBugReport();
  const { comments, addComment, deleteComment, isSending, userProfileId } = useBugReportComments(bug?.id ?? null);
  const { attachments, uploadAttachment, removeAttachment, isUploading } = useBugReportAttachments(bug?.id ?? null);
  const { data: history = [] } = useBugReportStatusHistory(bug?.id ?? null);

  const [message, setMessage] = useState('');
  const [people, setPeople] = useState<{ id: string; display_name: string }[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name')
      .then(({ data }) => setPeople(data ?? []));
  }, [isAdmin]);

  if (!bug) return null;

  const typeCfg = BUG_TYPE_CONFIG[bug.type];
  const statusCfg = BUG_STATUS_CONFIG[bug.status];
  const prioCfg = BUG_PRIORITY_CONFIG[bug.priority];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base pr-6">
            <span className="font-mono text-xs text-muted-foreground">{bug.ref}</span>
            <Badge className={cn(typeCfg.className, 'border text-[10px]')}>{typeCfg.icon} {typeCfg.label}</Badge>
            <span className="truncate">{bug.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Méta + badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className={cn(statusCfg.className, 'border')}>{statusCfg.label}</Badge>
            <Badge className={cn(prioCfg.className, 'border')}>{prioCfg.label}</Badge>
            <span className="text-muted-foreground">
              par <strong className="text-foreground">{bug.reporter?.display_name ?? '—'}</strong> · {fmt(bug.created_at)}
            </span>
            {bug.assignee && <span className="text-muted-foreground">· assigné à <strong className="text-foreground">{bug.assignee.display_name}</strong></span>}
          </div>

          {bug.page_url && (
            <p className="text-[11px] text-muted-foreground">Page : <code className="bg-muted px-1 rounded">{bug.page_url}</code></p>
          )}

          {bug.description && (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap">{bug.description}</div>
          )}

          {/* Triage admin */}
          {isAdmin && (
            <div className="rounded-lg border p-3 space-y-3 bg-violet-50/30">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Triage</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Statut</Label>
                  <Select value={bug.status} onValueChange={(v) =>
                    update.mutate({ id: bug.id, status: v as BugStatus, currentStatus: bug.status })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUG_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{BUG_STATUS_CONFIG[s].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Priorité</Label>
                  <Select value={bug.priority} onValueChange={(v) =>
                    update.mutate({ id: bug.id, priority: v as BugPriority })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUG_PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{BUG_PRIORITY_CONFIG[p].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Assigné à</Label>
                  <Select value={bug.assigned_to ?? NONE} onValueChange={(v) =>
                    update.mutate({ id: bug.id, assigned_to: v === NONE ? null : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Personne —</SelectItem>
                      {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => { if (confirm('Supprimer ce ticket ?')) { del.mutate(bug.id); onOpenChange(false); } }}>
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </Button>
              </div>
            </div>
          )}

          {/* Pièces jointes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pièces jointes</p>
              <label className="text-xs flex items-center gap-1.5 cursor-pointer text-violet-600 hover:text-violet-700">
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Ajouter
                <input type="file" accept="image/*,.pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.currentTarget.value = ''; }} />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune pièce jointe.</p>
            ) : (
              <div className="space-y-1">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs rounded border px-2 py-1.5">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={a.url} target="_blank" rel="noreferrer" className="truncate flex-1 text-violet-600 hover:underline">{a.name}</a>
                    {isAdmin && (
                      <button onClick={() => removeAttachment(a)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commentaires */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commentaires</p>
            <ScrollArea className="max-h-56">
              <div className="space-y-2 pr-2">
                {comments.length === 0 && <p className="text-xs text-muted-foreground">Aucun commentaire.</p>}
                {comments.map((c) => {
                  const own = c.author_id === userProfileId;
                  return (
                    <div key={c.id} className={cn('flex gap-2', own && 'flex-row-reverse')}>
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={c.author?.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px]">{initials(c.author?.display_name)}</AvatarFallback>
                      </Avatar>
                      <div className={cn('rounded-lg px-2.5 py-1.5 text-xs max-w-[80%]', own ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.author?.display_name ?? 'Utilisateur'}</span>
                          <span className={cn('text-[10px]', own ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{fmt(c.created_at)}</span>
                          {own && (
                            <button onClick={() => deleteComment(c.id)} className="opacity-70 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={1}
                placeholder="Écrire un commentaire…" className="text-sm min-h-[38px]"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (message.trim()) { addComment(message); setMessage(''); } } }} />
              <Button size="icon" disabled={isSending || !message.trim()}
                onClick={() => { addComment(message); setMessage(''); }}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Historique de statut */}
          {history.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Historique
              </p>
              {history.map((h: any) => (
                <div key={h.id} className="text-[11px] text-muted-foreground">
                  {fmt(h.changed_at)} — {h.from_status ? `${BUG_STATUS_CONFIG[h.from_status as BugStatus]?.label ?? h.from_status} → ` : ''}
                  <strong className="text-foreground">{BUG_STATUS_CONFIG[h.to_status as BugStatus]?.label ?? h.to_status}</strong>
                  {h.changer?.display_name ? ` (${h.changer.display_name})` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
