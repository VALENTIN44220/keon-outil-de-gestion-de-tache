import { describe, it, expect } from 'vitest';
import {
  isPermanentCode, mapPriority, mapPillar, normalizeDate, mapImportRow, resolveProfile,
} from './excelIO';

describe('isPermanentCode', () => {
  it('détecte RUN-*, PROJ-*, PILOT-*', () => {
    expect(isPermanentCode('RUN-001')).toBe(true);
    expect(isPermanentCode('PROJ-12')).toBe(true);
    expect(isPermanentCode('PILOT-3')).toBe(true);
    expect(isPermanentCode('run-001')).toBe(true);
  });
  it('rejette les codes projets normaux', () => {
    expect(isPermanentCode('NSK_IT-01048')).toBe(false);
    expect(isPermanentCode('PROJET-1')).toBe(false);
  });
});

describe('mapPriority', () => {
  it('mappe les priorités FDR vers it_projects.priorite', () => {
    expect(mapPriority('Critique')).toBe('critique');
    expect(mapPriority('Élevée')).toBe('haute');
    expect(mapPriority('Normale')).toBe('normale');
    expect(mapPriority('À définir')).toBeNull();
    expect(mapPriority(null)).toBeNull();
    expect(mapPriority('inconnu')).toBeNull();
  });
});

describe('mapPillar', () => {
  it('extrait le code P1–P5 du libellé long', () => {
    expect(mapPillar('P1 Humain & compétences')).toBe('P1');
    expect(mapPillar('P2 Donnée & décision')).toBe('P2');
    expect(mapPillar('P4 Sécurité & souveraineté')).toBe('P4');
    expect(mapPillar('P3')).toBe('P3');
  });
  it('retourne null si pas de code pilier', () => {
    expect(mapPillar('Humain')).toBeNull();
    expect(mapPillar(null)).toBeNull();
    expect(mapPillar('P9 inconnu')).toBeNull();
  });
});

describe('normalizeDate', () => {
  it('accepte YYYY-MM-DD', () => {
    expect(normalizeDate('2026-06-01')).toBe('2026-06-01');
  });
  it('accepte DD/MM/YYYY', () => {
    expect(normalizeDate('01/06/2026')).toBe('2026-06-01');
    expect(normalizeDate('5/7/2027')).toBe('2027-07-05');
  });
  it('convertit les numéros de série Excel', () => {
    // 46174 = 2026-06-01
    expect(normalizeDate(46174)).toBe('2026-06-01');
  });
  it('retourne null pour vide/invalide', () => {
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate('abc')).toBeNull();
  });
});

describe('mapImportRow', () => {
  it('retourne null sans code', () => {
    expect(mapImportRow({ code: '', name: 'X' })).toBeNull();
  });

  it('mappe une ligne projet standard', () => {
    const r = mapImportRow({
      code: 'NSK_IT-01048',
      name: 'Portail client',
      category: 'IA',
      status: 'En développement',
      progress_pct: 40,
      priority: 'Élevée',
      business_activity: 'COMMERCE',
      pillar: 'P2 Donnée & décision',
      profile: 'Chef de projet dev/IA/data',
      start_date: '2026-06-01',
      due_date: '2026-12-01',
      build_days_month: 5,
      run_days_month: 2,
      external_budget_eur: 0,
    })!;
    expect(r.code).toBe('NSK_IT-01048');
    expect(r.projectFields.statut_portefeuille).toBe('En développement');
    expect(r.projectFields.categorie_fdr).toBe('IA');
    expect(r.projectFields.priorite).toBe('haute');
    expect(r.projectFields.pilier).toBe('P2');
    expect(r.projectFields.date_kickoff).toBe('2026-06-01');
    expect(r.projectFields.date_mep_saisie).toBe('2026-12-01'); // cycle projet
    expect(r.projectFields.echeance_cible).toBeNull();
    expect(r.projectFields.suivi_j_mois).toBe(2);
    expect(r.buildJMois).toBe(5);
    expect(r.warnings).toEqual([]);
  });

  it('force Tâche permanente pour RUN-* et place due_date en échéance', () => {
    const r = mapImportRow({
      code: 'RUN-001',
      name: 'Support N1',
      status: 'En développement', // ignoré : RUN-* prime
      start_date: '2026-06-01',
      due_date: '2030-12-31',
      build_days_month: 4,
    })!;
    expect(r.projectFields.statut_portefeuille).toBe('Tâche permanente');
    expect(r.projectFields.echeance_cible).toBe('2030-12-31');
    expect(r.projectFields.date_mep_saisie).toBeNull();
  });

  it('statut inconnu → Idée avec warning', () => {
    const r = mapImportRow({ code: 'X-1', name: 'X', status: 'wip' })!;
    expect(r.projectFields.statut_portefeuille).toBe('Idée');
    expect(r.warnings.length).toBe(1);
  });

  it('Abandonné → exclu de la feuille de route', () => {
    const r = mapImportRow({ code: 'X-2', name: 'X', status: 'Abandonné' })!;
    expect(r.projectFields.sur_feuille_de_route).toBe(false);
  });
});

describe('resolveProfile', () => {
  const profils = [
    { id: '1', code: 'cp_dev_ia_data', nom: 'Chef de projet dev/IA/data' },
    { id: '2', code: 'cp_digital', nom: 'Chef de projet digital' },
    { id: '3', code: 'rsi', nom: 'RSI — capacité totale (pilotage + appui)' },
  ];

  it('match exact sur le nom', () => {
    expect(resolveProfile('Chef de projet digital', profils)?.code).toBe('cp_digital');
  });
  it('match exact sur le code', () => {
    expect(resolveProfile('rsi', profils)?.code).toBe('rsi');
  });
  it('match partiel insensible aux accents', () => {
    expect(resolveProfile('chef de projet dev/ia/data', profils)?.code).toBe('cp_dev_ia_data');
  });
  it('retourne null si introuvable', () => {
    expect(resolveProfile('Inconnu', profils)).toBeNull();
    expect(resolveProfile(null, profils)).toBeNull();
  });
});
