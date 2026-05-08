/**
 * chunkedInQuery — exécute une requête `.in('col', ids)` en plusieurs lots et
 * fusionne les résultats.
 *
 * Pourquoi ? PostgREST envoie les filtres `in.(...)` dans la querystring, et
 * un nombre élevé d'IDs (typiquement 500+) dépasse la limite de longueur
 * d'URL côté CDN/proxy (~16-32KB) → erreur 400.
 *
 * Avec `chunkSize=150` (UUID = 36 chars + 3 chars de séparateur encodé), une
 * requête fait ~6KB max, ce qui passe sans problème.
 *
 * Usage :
 * ```
 * const rows = await chunkedInQuery(taskIds, (chunk) =>
 *   supabase.from('task_checklists').select('task_id, is_completed').in('task_id', chunk)
 * );
 * ```
 */
import type { PostgrestError } from '@supabase/supabase-js';

const DEFAULT_CHUNK_SIZE = 150;

export async function chunkedInQuery<T>(
  ids: string[],
  buildQuery: (chunk: string[]) => Promise<{ data: T[] | null; error: PostgrestError | null }>,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<{ data: T[]; errors: PostgrestError[] }> {
  if (ids.length === 0) return { data: [], errors: [] };

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }

  // Exécution parallèle de tous les chunks
  const results = await Promise.all(chunks.map(buildQuery));

  const data: T[] = [];
  const errors: PostgrestError[] = [];
  for (const r of results) {
    if (r.error) errors.push(r.error);
    if (r.data) data.push(...r.data);
  }
  return { data, errors };
}
