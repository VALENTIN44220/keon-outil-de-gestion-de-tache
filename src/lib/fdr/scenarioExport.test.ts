import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildScenariosWorkbook, type ExportScenario } from './scenarioExport';
import type { FdrProjectInput, FdrEngineSettings } from '@/types/fdr';

const project: FdrProjectInput = {
  id: 'p1',
  code: 'NSK_IT-00001',
  nom: 'Projet test',
  statut_portefeuille: 'En développement',
  sur_feuille_de_route: true,
  date_kickoff: '2026-06-01',
  delai_projete_mois: 3,
  suivi_j_mois: 0,
  loads: [{ profil_code: 'cp_dev_ia_data', j_mois: 10 }],
  externe: false,
  pct_reduction_si_externe: 0,
};

const engineSettings: FdrEngineSettings = {
  jours_productifs_mois: 18,
  echeance_standard_permanentes: '2030-12',
  horizon_debut: '2026-06',
  horizon_duree_mois: 6,
  profils: [{ code: 'cp_dev_ia_data', capacite_j_mois: 18 }],
};

const activeProfils = [{ code: 'cp_dev_ia_data', nom: 'Dev IA / Data', capacite_j_mois: 18 }];

const scenarios: ExportScenario[] = [
  { nom: 'Baseline (sans levier)', hires: [], overrides: [], assumptions: {} },
  {
    nom: 'Avec 1 embauche',
    hires: [{ profil_code: 'cp_dev_ia_data', nb_etp: 1, start_ym: '2026-06', kind: 'embauche' }],
    overrides: [],
    assumptions: {},
  },
];

describe('buildScenariosWorkbook', () => {
  const wb = buildScenariosWorkbook({
    inputs: [project], engineSettings, activeProfils, joursProductifs: 18,
    roiData: { rhHorsITByProject: {}, tjmMap: { cp_dev_ia_data: 500 } },
    scenarios,
  });

  it('crée une feuille de synthèse + une feuille par scénario', () => {
    expect(wb.SheetNames[0]).toBe('Synthèse');
    expect(wb.SheetNames.length).toBe(3); // Synthèse + 2 scénarios
    expect(wb.SheetNames).toContain('Avec 1 embauche');
  });

  it('la synthèse contient une ligne par scénario avec le pic ETP', () => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Synthèse'], { header: 1 }) as any[][];
    const header = rows.find(r => r[0] === 'Scénario');
    expect(header).toBeDefined();
    const baselineRow = rows.find(r => r[0] === 'Baseline (sans levier)');
    expect(baselineRow).toBeDefined();
    // ETP à recruter (col 1) doit être un nombre
    expect(typeof baselineRow![1]).toBe('number');
  });

  it('la feuille scénario contient les blocs demande / capacité / cascade', () => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Avec 1 embauche'], { header: 1 }) as any[][];
    const labels = rows.map(r => String(r[0] ?? ''));
    expect(labels.some(l => l.startsWith('DEMANDE'))).toBe(true);
    expect(labels.some(l => l.startsWith('CAPACITÉ SIMULÉE'))).toBe(true);
    expect(labels.some(l => l.startsWith('CASCADE RSI'))).toBe(true);
    expect(labels).toContain('ETP à recruter');
  });
});
