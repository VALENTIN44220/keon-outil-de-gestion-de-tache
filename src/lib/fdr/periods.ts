/**
 * Granularité temporelle par année (repli des colonnes mois → trimestre → année).
 * Partagé entre la Feuille de route et le Plan de charge IT.
 */
import { cmpYM } from './calculationEngine';

export type YearGran = 'month' | 'quarter' | 'year';

export const GRAN_CYCLE: Record<YearGran, YearGran> = { month: 'quarter', quarter: 'year', year: 'month' };
export const GRAN_LETTER: Record<YearGran, string> = { month: 'M', quarter: 'T', year: 'A' };

/** Une colonne affichée = 1 mois, 1 trimestre ou 1 année. */
export interface Period {
  key: string;
  label: string;
  sub?: string;
  year: string;
  kind: YearGran;
  months: string[];
}

export function fmtYMShort(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

/** Construit la liste des colonnes en repliant chaque année selon sa granularité. */
export function buildPeriods(months: string[], gran: Record<string, YearGran>): Period[] {
  const byYear = new Map<string, string[]>();
  for (const ym of months) {
    const y = ym.slice(0, 4);
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(ym);
  }
  const periods: Period[] = [];
  for (const [year, yms] of byYear) {
    const g = gran[year] ?? 'month';
    if (g === 'year') {
      periods.push({ key: `Y-${year}`, label: year, year, kind: 'year', months: yms });
    } else if (g === 'quarter') {
      const q = new Map<number, string[]>();
      for (const ym of yms) {
        const qq = Math.ceil(parseInt(ym.slice(5, 7)) / 3);
        (q.get(qq) ?? q.set(qq, []).get(qq)!).push(ym);
      }
      for (const [qq, qms] of [...q.entries()].sort((a, b) => a[0] - b[0])) {
        periods.push({ key: `Q-${year}-${qq}`, label: `T${qq}`, sub: year.slice(2), year, kind: 'quarter', months: qms });
      }
    } else {
      for (const ym of yms) periods.push({ key: ym, label: fmtYMShort(ym), year, kind: 'month', months: [ym] });
    }
  }
  return periods;
}

/** Index de la colonne contenant un mois (clamp -1 / length hors horizon). */
export function periodIndexOfMonth(periods: Period[], ym: string | null): number | null {
  if (!ym) return null;
  for (let i = 0; i < periods.length; i++) if (periods[i].months.includes(ym)) return i;
  if (periods.length === 0) return null;
  return cmpYM(ym, periods[0].months[0]) < 0 ? -1 : periods.length;
}
