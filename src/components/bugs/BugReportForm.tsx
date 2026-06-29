import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useCreateBugReport } from '@/hooks/useBugReports';
import { useBugReportAttachments } from '@/hooks/useBugReportAttachments';
import {
  BUG_TYPE_CONFIG, BUG_PRIORITY_CONFIG, BUG_PRIORITY_OPTIONS,
  type BugType, type BugPriority, type BugReport,
} from '@/types/bugReport';

interface BugReportFormProps {
  defaultType?: BugType;
  /** URL de la page d'où provient le signalement (pré-remplie par le bouton global). */
  defaultPageUrl?: string;
  onCreated?: (bug: BugReport) => void;
  onCancel?: () => void;
}

export function BugReportForm({ defaultType = 'bug', defaultPageUrl, onCreated, onCancel }: BugReportFormProps) {
  const [type, setType] = useState<BugType>(defaultType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<BugPriority>('normale');
  const [file, setFile] = useState<File | null>(null);
  const [pageUrl] = useState(defaultPageUrl ?? (typeof window !== 'undefined' ? window.location.pathname : ''));

  const create = useCreateBugReport();
  const { uploadAttachment } = useBugReportAttachments(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast({ title: 'Titre requis', variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      const bug = await create.mutateAsync({
        title, description, type, priority,
        page_url: pageUrl || null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
      if (file && bug?.id) await uploadAttachment(file, bug.id);
      toast({ title: 'Merci !', description: `Signalement enregistré (${bug.ref ?? ''}).` });
      onCreated?.(bug);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'enregistrer le signalement", variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Type — segmenté */}
      <div className="space-y-1.5">
        <Label className="text-xs">Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['bug', 'amelioration'] as BugType[]).map((t) => {
            const cfg = BUG_TYPE_CONFIG[t];
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  active ? cfg.className : 'border-border text-muted-foreground hover:bg-muted/50',
                )}
              >
                <span>{cfg.icon}</span> {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bug-title" className="text-xs">Titre *</Label>
        <Input id="bug-title" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'bug' ? 'Ex : Le bouton « Exporter » ne répond pas' : 'Ex : Ajouter un filtre par date'} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bug-desc" className="text-xs">Description</Label>
        <Textarea id="bug-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Décrivez ce qui se passe, les étapes pour reproduire, le comportement attendu…" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Priorité</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as BugPriority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BUG_PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>{BUG_PRIORITY_CONFIG[p].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Capture d'écran (optionnel)</Label>
          {file ? (
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border text-xs">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
          )}
        </div>
      </div>

      {pageUrl && (
        <p className="text-[11px] text-muted-foreground">Page concernée : <code className="bg-muted px-1 rounded">{pageUrl}</code></p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <Button variant="outline" onClick={onCancel} disabled={isSaving}>Annuler</Button>}
        <Button onClick={submit} disabled={isSaving || !title.trim()} className="gap-2">
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Envoyer le signalement
        </Button>
      </div>
    </div>
  );
}
