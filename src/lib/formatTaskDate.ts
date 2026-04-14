import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Parse une valeur `due_date` / `start_date` souvent stockée en `YYYY-MM-DD` :
 * évite `new Date('YYYY-MM-DD')` (interprété en UTC) qui décale le jour affiché selon le fuseau.
 */
export function parseTaskCalendarDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const dayOnly = dateStr.split('T')[0];
  const parts = dayOnly.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

export function formatTaskCalendarDate(
  dateStr: string | null | undefined,
  pattern = 'dd/MM/yyyy'
): string {
  const d = parseTaskCalendarDate(dateStr);
  if (!d) return '';
  return format(d, pattern, { locale: fr });
}
