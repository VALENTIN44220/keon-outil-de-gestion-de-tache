import { describe, it, expect } from 'vitest';
import {
  computeCapacityMatrix,
  computeProjectMonthLoads,
  generateHorizon,
  addMonths,
  toYM,
  getMepRetenue,
  totalBuildNet,
} from './calculationEngine';
import type { FdrProjectInput, FdrEngineSettings } from '@/types/fdr';

// ---- Fixtures ----

const BASE_SETTINGS: FdrEngineSettings = {
  jours_productifs_mois: 18,
  echeance_standard_permanentes: '2030-12',
  horizon_debut: '2026-06',
  horizon_duree_mois: 6, // juin→nov 2026 pour les tests
  profils: [
    { code: 'cp_dev_ia_data', capacite_j_mois: 18 },
    { code: 'cp_digital',     capacite_j_mois: 18 },
    { code: 'rsi',            capacite_j_mois: 18 },
    { code: 'tech_it',        capacite_j_mois: 18 },
    { code: 'resp_it',        capacite_j_mois: 0  },
  ],
};

const makeProject = (overrides: Partial<FdrProjectInput>): FdrProjectInput => ({
  id: 'p1',
  code: 'NSK_IT-00001',
  nom: 'Projet test',
  statut_portefeuille: 'En développement',
  sur_feuille_de_route: true,
  date_kickoff: '2026-06-01',
  delai_projete_mois: 3,       // MEP = sept 2026
  suivi_j_mois: 2,
  profil_principal: 'cp_dev_ia_data',
  loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 5 }],
  externe: false,
  pct_reduction_si_externe: 0,
  ...overrides,
});

// ---- Utilitaires ----

describe('toYM', () => {
  it('extrait YYYY-MM depuis YYYY-MM-DD', () => {
    expect(toYM('2026-06-15')).toBe('2026-06');
  });
  it('retourne YYYY-MM tel quel', () => {
    expect(toYM('2026-06')).toBe('2026-06');
  });
  it('retourne null pour null/undefined', () => {
    expect(toYM(null)).toBeNull();
    expect(toYM(undefined)).toBeNull();
  });
});

describe('generateHorizon', () => {
  it('génère N mois consécutifs', () => {
    const h = generateHorizon('2026-11', 3);
    expect(h).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('passe correctement de décembre à janvier', () => {
    const h = generateHorizon('2026-12', 2);
    expect(h).toEqual(['2026-12', '2027-01']);
  });
});

describe('addMonths', () => {
  it('ajoute des mois normalement', () => {
    expect(addMonths('2026-06', 3)).toBe('2026-09');
  });
  it('passe en janvier de l\'année suivante', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
  });
  it('gère zéro mois', () => {
    expect(addMonths('2026-06', 0)).toBe('2026-06');
  });
});

// ---- computeProjectMonthLoads ----

describe('computeProjectMonthLoads — Abandonné', () => {
  it('retourne [] quel que soit le mois', () => {
    const p = makeProject({ statut_portefeuille: 'Abandonné' });
    expect(computeProjectMonthLoads(p, '2026-06', BASE_SETTINGS)).toEqual([]);
    expect(computeProjectMonthLoads(p, '2026-09', BASE_SETTINGS)).toEqual([]);
  });
});

describe('computeProjectMonthLoads — hors feuille de route', () => {
  it('retourne [] quel que soit le mois', () => {
    const p = makeProject({ sur_feuille_de_route: false });
    expect(computeProjectMonthLoads(p, '2026-06', BASE_SETTINGS)).toEqual([]);
  });
});

describe('computeProjectMonthLoads — Tâche permanente', () => {
  const perm = makeProject({
    statut_portefeuille: 'Tâche permanente',
    date_kickoff: '2026-06-01',
    echeance_cible: '2026-08-31', // juin, juillet, août
    delai_projete_mois: undefined,
    date_mep_saisie: undefined,
    loads: [{ profil_code: 'tech_it', j_mois: 4 }],
  });

  it('charge dans la plage kickoff–echeance', () => {
    const r = computeProjectMonthLoads(perm, '2026-07', BASE_SETTINGS);
    expect(r).toEqual([{ profil_code: 'tech_it', j_mois: 4 }]);
  });
  it('pas de charge avant kickoff', () => {
    const r = computeProjectMonthLoads(perm, '2026-05', BASE_SETTINGS);
    expect(r).toEqual([]);
  });
  it('pas de charge après echeance', () => {
    const r = computeProjectMonthLoads(perm, '2026-09', BASE_SETTINGS);
    expect(r).toEqual([]);
  });
  it('utilise echeance_standard_permanentes si echeance_cible est absent', () => {
    const p2 = makeProject({
      statut_portefeuille: 'Tâche permanente',
      date_kickoff: '2026-06-01',
      echeance_cible: undefined,
      date_mep_saisie: undefined,
      loads: [{ profil_code: 'tech_it', j_mois: 3 }],
    });
    const settings = { ...BASE_SETTINGS, echeance_standard_permanentes: '2030-12' };
    const r = computeProjectMonthLoads(p2, '2026-09', settings);
    expect(r).toEqual([{ profil_code: 'tech_it', j_mois: 3 }]);
  });
});

describe('computeProjectMonthLoads — cycle projet build→suivi', () => {
  // kickoff=juin, delai=3 → MEP=sept, suivi après sept
  const p = makeProject();

  it('phase build : charge profil correct en juin', () => {
    const r = computeProjectMonthLoads(p, '2026-06', BASE_SETTINGS);
    expect(r).toEqual([{ profil_code: 'cp_dev_ia_data', j_mois: 5 }]);
  });
  it('phase build : charge en août (m < MEP sept)', () => {
    const r = computeProjectMonthLoads(p, '2026-08', BASE_SETTINGS);
    expect(r).toEqual([{ profil_code: 'cp_dev_ia_data', j_mois: 5 }]);
  });
  it('phase suivi : charge profil_principal en sept (m = MEP)', () => {
    const r = computeProjectMonthLoads(p, '2026-09', BASE_SETTINGS);
    expect(r).toEqual([{ profil_code: 'cp_dev_ia_data', j_mois: 2 }]);
  });
  it('phase suivi : charge en nov (m > MEP)', () => {
    const r = computeProjectMonthLoads(p, '2026-11', BASE_SETTINGS);
    expect(r).toEqual([{ profil_code: 'cp_dev_ia_data', j_mois: 2 }]);
  });
  it('aucune charge avant kickoff', () => {
    const r = computeProjectMonthLoads(p, '2026-05', BASE_SETTINGS);
    expect(r).toEqual([]);
  });
});

describe('computeProjectMonthLoads — MEP saisie manuellement', () => {
  it('date_mep_saisie prend le dessus sur kickoff + delai', () => {
    const p = makeProject({
      date_kickoff: '2026-06-01',
      delai_projete_mois: 3,       // calcul = 2026-09
      date_mep_saisie: '2026-07-01', // forcé à juillet
    });
    // juin : avant MEP → build
    expect(computeProjectMonthLoads(p, '2026-06', BASE_SETTINGS))
      .toEqual([{ profil_code: 'cp_dev_ia_data', j_mois: 5 }]);
    // juillet : = MEP forcée → suivi
    expect(computeProjectMonthLoads(p, '2026-07', BASE_SETTINGS))
      .toEqual([{ profil_code: 'cp_dev_ia_data', j_mois: 2 }]);
  });
});

describe('computeProjectMonthLoads — externalisation', () => {
  it('réduit la charge build du pourcentage', () => {
    const p = makeProject({
      externe: true,
      pct_reduction_si_externe: 0.5,
      loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 10 }],
    });
    const r = computeProjectMonthLoads(p, '2026-06', BASE_SETTINGS);
    expect(r).toEqual([{ profil_code: 'cp_dev_ia_data', j_mois: 5 }]);
  });
  it('réduction à 100% → charge nulle', () => {
    const p = makeProject({
      externe: true,
      pct_reduction_si_externe: 1,
    });
    const r = computeProjectMonthLoads(p, '2026-06', BASE_SETTINGS);
    expect(r).toEqual([]);
  });
});

// ---- computeCapacityMatrix ----

describe('computeCapacityMatrix — matrice globale', () => {
  it('génère le bon nombre de mois', () => {
    const matrix = computeCapacityMatrix([], BASE_SETTINGS);
    expect(matrix.months).toHaveLength(6);
  });

  it('demande nulle si aucun projet', () => {
    const matrix = computeCapacityMatrix([], BASE_SETTINGS);
    const row = matrix.by_profil['cp_dev_ia_data'];
    expect(Object.values(row.demande).every(v => v === 0)).toBe(true);
  });

  it('agrège la demande de plusieurs projets sur le même profil', () => {
    const p1 = makeProject({ id: 'p1', loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 5 }] });
    const p2 = makeProject({ id: 'p2', loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 3 }] });
    const matrix = computeCapacityMatrix([p1, p2], BASE_SETTINGS);
    // juin = 5+3 = 8 (build)
    expect(matrix.by_profil['cp_dev_ia_data'].demande['2026-06']).toBe(8);
  });

  it('calcule l\'écart correctement', () => {
    const p = makeProject({ loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 10 }] });
    const matrix = computeCapacityMatrix([p], BASE_SETTINGS);
    // capacité 18 − demande 10 = 8
    expect(matrix.by_profil['cp_dev_ia_data'].ecart['2026-06']).toBe(8);
  });

  it('identifie le pic mensuel', () => {
    // Un projet de 10 j en juin seulement (MEP = juillet)
    const p = makeProject({
      date_kickoff: '2026-06-01',
      delai_projete_mois: 1, // MEP = juillet
      loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 10 }],
      suivi_j_mois: 0,
    });
    const matrix = computeCapacityMatrix([p], BASE_SETTINGS);
    const pic = matrix.by_profil['cp_dev_ia_data'].pic;
    expect(pic?.ym).toBe('2026-06');
    expect(pic?.value).toBe(10);
  });
});

describe('computeCapacityMatrix — cascade RSI', () => {
  it('calcule le sous-effectif et l\'appui RSI', () => {
    // dev/IA surchargé de 4j (demande 22, capacité 18)
    const p = makeProject({
      loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 22 }],
      suivi_j_mois: 0,
      delai_projete_mois: 10, // reste en build sur toute la période test
    });
    const matrix = computeCapacityMatrix([p], BASE_SETTINGS);
    const cascade = matrix.rsi_cascade.find(r => r.ym === '2026-06')!;

    // deficit dev = 22-18 = 4, digital = 0 → sous_effectif_projets = 4
    expect(cascade.sous_effectif_projets).toBeCloseTo(4);
    // RSI disponible = 18-0 = 18, appui = min(18, 4) = 4
    expect(cascade.appui_rsi).toBeCloseTo(4);
    // sous_effectif_net = 4-4 = 0
    expect(cascade.sous_effectif_net).toBeCloseTo(0);
    expect(cascade.etp_a_recruter).toBeCloseTo(0);
  });

  it('calcule ETP à recruter si RSI insuffisant', () => {
    // dev/IA surchargé de 30j (bien au-delà de la capacité RSI 18)
    const p = makeProject({
      loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 48 }], // 48-18=30 de déficit
      suivi_j_mois: 0,
      delai_projete_mois: 10,
    });
    const matrix = computeCapacityMatrix([p], BASE_SETTINGS);
    const cascade = matrix.rsi_cascade.find(r => r.ym === '2026-06')!;

    // sous_effectif_projets = 30, appui_rsi = min(18, 30) = 18
    expect(cascade.appui_rsi).toBeCloseTo(18);
    // sous_effectif_net = 30-18 = 12
    expect(cascade.sous_effectif_net).toBeCloseTo(12);
    // ETP = 12/18 ≈ 0.667
    expect(cascade.etp_a_recruter).toBeCloseTo(12 / 18);
  });

  it('RSI déjà chargé → appui réduit', () => {
    // RSI a 15j de demande propre, reste 3j disponibles
    const pRsi = makeProject({
      id: 'p-rsi',
      loads: [{ profil_code: 'rsi', j_mois: 15 }],
      profil_principal: 'rsi',
      suivi_j_mois: 0,
      delai_projete_mois: 10,
    });
    // dev/IA déficit = 6
    const pDev = makeProject({
      id: 'p-dev',
      loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 24 }],
      suivi_j_mois: 0,
      delai_projete_mois: 10,
    });
    const matrix = computeCapacityMatrix([pRsi, pDev], BASE_SETTINGS);
    const cascade = matrix.rsi_cascade.find(r => r.ym === '2026-06')!;

    // RSI dispo = 18-15 = 3, appui = min(3, 6) = 3
    expect(cascade.appui_rsi).toBeCloseTo(3);
    expect(cascade.sous_effectif_net).toBeCloseTo(3);
  });
});

// ---- getMepRetenue ----

describe('getMepRetenue', () => {
  it('retourne date_mep_saisie si renseignée', () => {
    const p = makeProject({ date_mep_saisie: '2026-08-15' });
    expect(getMepRetenue(p)).toBe('2026-08');
  });
  it('calcule kickoff + delai sinon', () => {
    const p = makeProject({ date_kickoff: '2026-06-01', delai_projete_mois: 3 });
    expect(getMepRetenue(p)).toBe('2026-09');
  });
  it('retourne null si données insuffisantes', () => {
    const p = makeProject({ date_kickoff: undefined, delai_projete_mois: 3 });
    expect(getMepRetenue(p)).toBeNull();
  });
});

// ---- totalBuildNet ----

describe('totalBuildNet', () => {
  it('somme les charges build sans externalisation', () => {
    const p = makeProject({
      loads: [
        { profil_code: 'cp_dev_ia_data', j_mois: 5 },
        { profil_code: 'cp_digital',     j_mois: 3 },
      ],
    });
    expect(totalBuildNet(p)).toBe(8);
  });
  it('applique la réduction si externe', () => {
    const p = makeProject({
      externe: true,
      pct_reduction_si_externe: 0.25,
      loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 8 }],
    });
    expect(totalBuildNet(p)).toBe(6);
  });
});
