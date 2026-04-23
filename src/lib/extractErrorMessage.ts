/**
 * Extrait un message lisible d'une valeur d'erreur hétérogène.
 *
 * Supabase renvoie des `PostgrestError` (`{ message, code, details, hint }`)
 * qui n'héritent PAS de `Error` — un simple `e instanceof Error` les rate et
 * retombe sur un libellé générique. Cet utilitaire gère les trois cas courants :
 * `Error` standard, objet avec `message`/`details`/`hint`, et valeurs brutes.
 */
export function extractErrorMessage(e: unknown, fallback = 'Erreur inconnue'): string {
  if (!e) return fallback;
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    const pick = (k: string): string | null => {
      const v = obj[k];
      return typeof v === 'string' && v.trim() ? v : null;
    };
    return pick('message') ?? pick('details') ?? pick('hint') ?? fallback;
  }
  return fallback;
}
