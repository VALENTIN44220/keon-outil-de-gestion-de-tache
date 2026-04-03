export const SUPPLIER_VISIBLE_COLUMNS_STORAGE_KEY = 'keon-supplier-visible-columns-v1';

/** Retourne les clés valides ou null si rien à appliquer. */
export function readSupplierVisibleColumnsFromStorage(validKeys: ReadonlySet<string>): string[] | null {
  try {
    const raw = localStorage.getItem(SUPPLIER_VISIBLE_COLUMNS_STORAGE_KEY);
    if (raw == null || raw.trim() === '') return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const cols = parsed.filter((k): k is string => typeof k === 'string' && validKeys.has(k));
    if (cols.length === 0) return null;
    return cols;
  } catch {
    return null;
  }
}

/** Indique si l'utilisateur a déjà une préférence colonnes dans ce navigateur (ne pas l'écraser au chargement du preset par défaut). */
export function hasSupplierVisibleColumnsInStorage(): boolean {
  try {
    const raw = localStorage.getItem(SUPPLIER_VISIBLE_COLUMNS_STORAGE_KEY);
    return raw != null && raw.trim() !== '' && raw.trim() !== '[]';
  } catch {
    return false;
  }
}
