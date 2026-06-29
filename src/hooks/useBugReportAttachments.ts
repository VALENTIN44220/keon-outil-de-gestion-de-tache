import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useCurrentProfileId } from '@/hooks/useBugReports';
import type { BugReportAttachment } from '@/types/bugReport';

const BUCKET = 'bug-attachments';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/** Pièces jointes d'un ticket : liste + upload (Storage) + suppression. */
export function useBugReportAttachments(bugReportId: string | null) {
  const uploadedBy = useCurrentProfileId();
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<BugReportAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!bugReportId) { setAttachments([]); return; }
    setIsLoading(true);
    try {
      const { data, error } = await db()
        .from('bug_report_attachments')
        .select('*')
        .eq('bug_report_id', bugReportId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAttachments((data ?? []) as BugReportAttachment[]);
    } catch (e) {
      console.error('Error fetching attachments:', e);
    } finally {
      setIsLoading(false);
    }
  }, [bugReportId]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  /** Upload un fichier vers le bucket et enregistre la métadonnée. */
  const uploadAttachment = async (file: File, targetBugId?: string): Promise<boolean> => {
    const bugId = targetBugId ?? bugReportId;
    if (!bugId) return false;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: 'Maximum 10 Mo.', variant: 'destructive' });
      return false;
    }
    setIsUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${bugId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: insErr } = await db().from('bug_report_attachments').insert({
        bug_report_id: bugId,
        name: file.name,
        url: pub.publicUrl,
        storage_path: path,
        type: file.type || null,
        uploaded_by: uploadedBy,
      });
      if (insErr) throw insErr;
      await fetchAttachments();
      return true;
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e, "Échec de l'envoi du fichier"), variant: 'destructive' });
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = async (att: BugReportAttachment) => {
    try {
      if (att.storage_path) await supabase.storage.from(BUCKET).remove([att.storage_path]);
      const { error } = await db().from('bug_report_attachments').delete().eq('id', att.id);
      if (error) throw error;
      await fetchAttachments();
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  return { attachments, isLoading, isUploading, uploadAttachment, removeAttachment, refetch: fetchAttachments };
}
