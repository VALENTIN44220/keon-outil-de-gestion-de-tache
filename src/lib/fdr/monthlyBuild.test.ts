import { describe, it, expect } from 'vitest';
import { computeProjectMonthLoads, totalBuildNet, totalBuildDays } from './calculationEngine';
import type { FdrProjectInput } from '@/types/fdr';

const settings = { echeance_standard_permanentes: '2030-12', jours_productifs_mois: 18 };

function chargeFor(p: FdrProjectInput, ym: string, code: string): number {
  return computeProjectMonthLoads(p, ym, settings).find(l => l.profil_code === code)?.j_mois ?? 0;
}

const base: FdrProjectInput = {
  id: 'p', code: 'X', nom: 'X',
  statut_portefeuille: 'En développement',
  sur_feuille_de_route: true,
  date_kickoff: '2026-06-01',
  delai_projete_mois: 4, // build : 2026-06 → 2026-09 (MEP 2026-10)
  suivi_j_mois: 0,
  externe: false,
  pct_reduction_si_externe: 0,
  loads: [
    // profil détaillé : démarre en juillet, charge variable
    { profil_code: 'dev', j_mois: 0, months: { '2026-07': 5, '2026-08': 10, '2026-09': 2 } },
    // profil uniforme : 3 j/mois sur toute la fenêtre build
    { profil_code: 'dig', j_mois: 3 },
  ],
};

describe('charge build mensuelle (détail + démarrage décalé)', () => {
  it('le profil détaillé suit ses valeurs mensuelles (0 avant son démarrage)', () => {
    expect(chargeFor(base, '2026-06', 'dev')).toBe(0);   // pas encore démarré
    expect(chargeFor(base, '2026-07', 'dev')).toBe(5);
    expect(chargeFor(base, '2026-08', 'dev')).toBe(10);
    expect(chargeFor(base, '2026-09', 'dev')).toBe(2);
    expect(chargeFor(base, '2026-10', 'dev')).toBe(0);   // après MEP (suivi)
  });

  it('le profil uniforme garde son j/mois sur toute la fenêtre build', () => {
    expect(chargeFor(base, '2026-06', 'dig')).toBe(3);
    expect(chargeFor(base, '2026-09', 'dig')).toBe(3);
    expect(chargeFor(base, '2026-10', 'dig')).toBe(0);   // après MEP
  });

  it('totalBuildDays = Σ mois (détaillé) + j/mois × délai (uniforme)', () => {
    // dev: 5+10+2 = 17 ; dig: 3 × 4 = 12 ; total 29
    expect(totalBuildDays(base)).toBe(29);
  });

  it('totalBuildNet = pic mensuel (uniforme + détaillé du mois)', () => {
    // pic en août : dig 3 + dev 10 = 13
    expect(totalBuildNet(base)).toBe(13);
  });

  it('externalisation applique le facteur de réduction', () => {
    const ext: FdrProjectInput = { ...base, externe: true, pct_reduction_si_externe: 0.5 };
    expect(chargeFor(ext, '2026-08', 'dev')).toBe(5);  // 10 × 0.5
    expect(chargeFor(ext, '2026-06', 'dig')).toBe(1.5); // 3 × 0.5
  });
});
