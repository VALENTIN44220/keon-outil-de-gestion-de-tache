// Réglage d'affichage de la vue « Tableau » (DenseTableView).
// Le nombre de lignes rendues par défaut est paramétrable depuis le mode admin
// (onglet « Affichage »). Plafonner le DOM évite les lenteurs et les
// clignotements au chargement quand le périmètre contient beaucoup de tâches.

export const TABLE_PAGE_SIZE_STORAGE_KEY = 'dense-table-page-size';
export const DEFAULT_TABLE_PAGE_SIZE = 100;
export const MIN_TABLE_PAGE_SIZE = 10;
export const MAX_TABLE_PAGE_SIZE = 1000;

// Événement diffusé quand le réglage change, pour rafraîchir les vues montées
// sans rechargement de page (localStorage seul ne notifie pas l'onglet courant).
export const TABLE_PAGE_SIZE_EVENT = 'table-page-size-changed';

function clamp(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_TABLE_PAGE_SIZE;
  return Math.min(MAX_TABLE_PAGE_SIZE, Math.max(MIN_TABLE_PAGE_SIZE, Math.round(n)));
}

export function getTablePageSize(): number {
  try {
    const stored = localStorage.getItem(TABLE_PAGE_SIZE_STORAGE_KEY);
    if (stored == null) return DEFAULT_TABLE_PAGE_SIZE;
    return clamp(Number(stored));
  } catch {
    return DEFAULT_TABLE_PAGE_SIZE;
  }
}

export function setTablePageSize(value: number): number {
  const clamped = clamp(value);
  try {
    localStorage.setItem(TABLE_PAGE_SIZE_STORAGE_KEY, String(clamped));
    window.dispatchEvent(new CustomEvent(TABLE_PAGE_SIZE_EVENT, { detail: clamped }));
  } catch {
    // localStorage indisponible : on retourne quand même la valeur validée.
  }
  return clamped;
}
