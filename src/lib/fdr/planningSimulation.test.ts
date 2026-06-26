import { describe, it, expect } from 'vitest';
import { computeCapacityMatrix } from './calculationEngine';
import { applyHires, applyProjectOverrides, classifyProjects } from './planningSimulation';
import type { FdrProjectInput, FdrEngineSettings } from '@/types/fdr';

const SETTINGS: FdrEngineSettings = {
  jours_productifs_mois: 18,
  echeance_standard_permanentes: '2030-12',
  horizon_debut: '2026-06',
  horizon_duree_mois: 6, // juin → nov 2026
  profils: [
    { code: 'cp_dev_ia_data', capacite_j_mois: 18 },
    { code: 'cp_digital', capacite_j_mois: 18 },
    { code: 'rsi', capacite_j_mois: 18 },
  ],
};

const makeProject = (o: Partial<FdrProjectInput>): FdrProjectInput => ({
  id: 'p1',
  code: 'NSK_IT-00001',
  nom: 'Projet test',
  statut_portefeuille: 'En développement',
  sur_feuille_de_route: true,
  date_kickoff: '2026-06-01',
  delai_projete_mois: 3,
  suivi_j_mois: 0,
  profil_principal: 'cp_dev_ia_data',
  loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 5 }],
  externe: false,
  pct_reduction_si_externe: 0,
  ...o,
});

describe('applyProjectOverrides', () => {
  it('décale la charge quand on change le kickoff', () => {
    const inputs = [makeProject({})];
    const moved = applyProjectOverrides(inputs, [
      { it_project_id: 'p1', date_kickoff: '2026-08-01' },
    ]);
    const before = computeCapacityMatrix(inputs, SETTINGS);
    const after = computeCapacityMatrix(moved, SETTINGS);
    // Juin chargé avant, vide après le décalage à août
    expect(before.by_profil['cp_dev_ia_data'].demande['2026-06']).toBe(5);
    expect(after.by_profil['cp_dev_ia_data'].demande['2026-06']).toBe(0);
    expect(after.by_profil['cp_dev_ia_data'].demande['2026-08']).toBe(5);
  });

  it('applique l externalisation (réduction de charge)', () => {
    const inputs = [makeProject({})];
    const ext = applyProjectOverrides(inputs, [
      { it_project_id: 'p1', externe: true, pct_reduction_si_externe: 0.4 },
    ]);
    const after = computeCapacityMatrix(ext, SETTINGS);
    expect(after.by_profil['cp_dev_ia_data'].demande['2026-06']).toBeCloseTo(3); // 5 × 0.6
  });

  it('ne modifie pas les inputs d origine ni les champs absents', () => {
    const inputs = [makeProject({})];
    const out = applyProjectOverrides(inputs, [{ it_project_id: 'p1', externe: true }]);
    expect(inputs[0].externe).toBe(false); // immuable
    expect(out[0].date_kickoff).toBe('2026-06-01'); // champ absent conservé
  });

  it('retourne les inputs tels quels si aucun override', () => {
    const inputs = [makeProject({})];
    expect(applyProjectOverrides(inputs, [])).toBe(inputs);
  });
});

describe('classifyProjects', () => {
  it('classe un projet sans surcharge comme tenable', () => {
    const inputs = [makeProject({ loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 5 }] })];
    const matrix = computeCapacityMatrix(inputs, SETTINGS);
    const adjusted = applyHires(matrix, [], 18);
    const { tenable, aRisque } = classifyProjects(inputs, adjusted, SETTINGS);
    expect(tenable.map((p) => p.id)).toContain('p1');
    expect(aRisque).toHaveLength(0);
  });

  it('classe un projet en surcharge comme à risque', () => {
    const inputs = [makeProject({ loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 25 }] })];
    const matrix = computeCapacityMatrix(inputs, SETTINGS);
    const adjusted = applyHires(matrix, [], 18);
    const { tenable, aRisque } = classifyProjects(inputs, adjusted, SETTINGS);
    expect(aRisque.map((p) => p.id)).toContain('p1');
    expect(tenable).toHaveLength(0);
  });

  it('un renfort simulé peut rendre un projet tenable', () => {
    const inputs = [makeProject({ loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 25 }] })];
    const matrix = computeCapacityMatrix(inputs, SETTINGS);
    const adjusted = applyHires(
      matrix,
      [{ profil_code: 'cp_dev_ia_data', nb_etp: 1, start_ym: '2026-06', kind: 'embauche' }],
      18,
    );
    const { tenable } = classifyProjects(inputs, adjusted, SETTINGS);
    // 18 + 18 = 36 ≥ 25 → plus de surcharge
    expect(tenable.map((p) => p.id)).toContain('p1');
  });
});
