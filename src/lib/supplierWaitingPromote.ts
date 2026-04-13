import { supabase } from '@/integrations/supabase/client';

export type WaitingAttachmentMeta = {
  storage_path: string;
  file_name: string;
  attachment_kind: string;
};

export function parseWaitingAttachmentsJson(raw: unknown): WaitingAttachmentMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is WaitingAttachmentMeta =>
      typeof x === 'object' &&
      x !== null &&
      'storage_path' in x &&
      typeof (x as WaitingAttachmentMeta).storage_path === 'string',
  ) as WaitingAttachmentMeta[];
}

/** Recopie les PJ de la file d’attente vers le référentiel, puis supprime les objets du bucket d’attente. */
export async function migrateWaitingAttachmentsToEnrichment(
  enrichmentId: string,
  attachments: WaitingAttachmentMeta[],
) {
  if (attachments.length === 0) return;
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const pathsToRemove: string[] = [];

  for (const att of attachments) {
    if (!att.storage_path) continue;
    const { data: blob, error: dlErr } = await supabase.storage
      .from('supplier-waiting-attachments')
      .download(att.storage_path);
    if (dlErr || !blob) {
      console.error('supplier-waiting-attachments download', dlErr);
      pathsToRemove.push(att.storage_path);
      continue;
    }
    const ext = att.file_name.split('.').pop() || 'bin';
    const newPath = `${enrichmentId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('supplier-attachments').upload(newPath, blob);
    if (upErr) {
      console.error('supplier-attachments upload', upErr);
      continue;
    }
    const { data: signed } = await supabase.storage
      .from('supplier-attachments')
      .createSignedUrl(newPath, 60 * 60 * 24 * 365);
    const { error: insErr } = await supabase.from('supplier_attachments').insert({
      supplier_id: enrichmentId,
      file_name: att.file_name,
      file_url: signed?.signedUrl ?? '',
      storage_path: newPath,
      uploaded_by: user?.id ?? null,
    });
    if (insErr) {
      console.error('supplier_attachments insert', insErr);
      continue;
    }
    pathsToRemove.push(att.storage_path);
  }

  if (pathsToRemove.length > 0) {
    const { error: rmErr } = await supabase.storage.from('supplier-waiting-attachments').remove(pathsToRemove);
    if (rmErr) console.error('supplier-waiting-attachments remove', rmErr);
  }
}
