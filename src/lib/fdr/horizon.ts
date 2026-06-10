/**
 * Dérivation de l'horizon de feuille de route (repris de l'onglet Matrice de l'Excel).
 *
 * Règle :
 *  - Abandonné                                   → 'Abandonné'
 *  - Tâche permanente / En développement / Déployé → 'En cours'
 *  - Sinon (Idée, Proposition) selon le kickoff :
 *      kickoff ≤ 2027        → '2027'
 *      kickoff 2028–2030     → '2030'
 *      kickoff > 2030 / vide → 'Vision 2035'
 */

import type { FdrRoadmapProject } from '@/hooks/useFdrProjects';

export type FdrHorizon = 'En cours' | '2027' | '2030' | 'Vision 2035' | 'Abandonné';

export const FDR_HORIZONS: FdrHorizon[] = ['En cours', '2027', '2030', 'Vision 2035', 'Abandonné'];

export const HORIZON_CONFIG: Record<FdrHorizon, { label: string; className: string }> = {
  'En cours':    { label: 'En cours',    className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  '2027':        { label: 'FDR 2027',    className: 'bg-blue-100 text-blue-700 border-blue-300' },
  '2030':        { label: 'FDR 2030',    className: 'bg-violet-100 text-violet-700 border-violet-300' },
  'Vision 2035': { label: 'Vision 2035', className: 'bg-slate-100 text-slate-600 border-slate-300' },
  'Abandonné':   { label: 'Abandonné',   className: 'bg-red-100 text-red-700 border-red-300' },
};

export function deriveHorizon(p: Pick<FdrRoadmapProject, 'statut_portefeuille' | 'date_kickoff'>): FdrHorizon {
  if (p.statut_portefeuille === 'Abandonné') return 'Abandonné';
  if (
    p.statut_portefeuille === 'Tâche permanente' ||
    p.statut_portefeuille === 'En développement' ||
    p.statut_portefeuille === 'Déployé'
  ) return 'En cours';

  const year = p.date_kickoff ? parseInt(p.date_kickoff.slice(0, 4)) : null;
  if (year == null || year > 2030) return 'Vision 2035';
  if (year <= 2027) return '2027';
  return '2030';
}
