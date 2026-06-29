/**
 * Export Excel du plan de charge par scénario — fonction pure (hors React).
 *
 * Produit un classeur multi-feuilles :
 *   - « Synthèse » : comparateur de tous les scénarios (pic ETP, surcharge, ROI…)
 *   - 1 feuille par scénario : leviers + ROI + matrice de charge (demande /
 *     capacité simulée / écart par profil × mois) + cascade RSI + classification.
 *
 * Réutilise exactement le même pipeline de calcul que la page Plan de charge
 * (computeCapacityMatrix → applyProjectOverrides → applyHires → classifyProjects
 * → computeScenarioRoi), pour garantir des chiffres identiques à l'écran.
 */
import * as XLSX from 'xlsx';
import { computeCapacityMatrix } from './calculationEngine';
import {
  applyHires, applyProjectOverrides, classifyProjects, peakEtp,
} from './planningSimulation';
import { computeScenarioRoi } from '@/lib/it/scenarioRoi';
import { fmtYMShort } from './periods';
import type { FdrProjectInput, FdrEngineSettings } from '@/types/fdr';
import type { ITProjectRHHorsIT } from '@/types/itProject';
import type {
  SimulatedHire, ProjectOverride, ScenarioAssumptions,
} from '@/hooks/useFdrHireScenarios';

const round1 = (n: number) => Math.round(n * 10) / 10;

type ActiveProfil = { code: string; nom: string; capacite_j_mois: number };
type RoiData = {
  rhHorsITByProject: Record<string, ITProjectRHHorsIT[]>;
  tjmMap: Record<string, number>;
} | undefined;

/** Un scénario à exporter (les leviers ; baseline = leviers vides). */
export interface ExportScenario {
  nom: string;
  hires: SimulatedHire[];
  overrides: ProjectOverride[];
  assumptions: ScenarioAssumptions;
}

export interface BuildScenariosWorkbookOpts {
  inputs: FdrProjectInput[];
  engineSettings: FdrEngineSettings;
  activeProfils: ActiveProfil[];
  joursProductifs: number;
  roiData: RoiData;
  scenarios: ExportScenario[];
}

type Row = (string | number)[];

/** Nettoie un nom de scénario pour en faire un nom de feuille Excel valide & unique. */
function sheetName(raw: string, used: Set<string>): string {
  let base = (raw || 'Scénario').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Scénario';
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base.slice(0, 28 - String(i).length - 1)} ${i}`;
    i++;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Calcule tout ce dont on a besoin pour un scénario donné. */
function computeScenario(o: ExportScenario, opts: BuildScenariosWorkbookOpts) {
  const { inputs, engineSettings, joursProductifs, roiData } = opts;
  const sInputs = applyProjectOverrides(inputs, o.overrides ?? []);
  const matrix = computeCapacityMatrix(sInputs, engineSettings);
  const adjusted = applyHires(matrix, o.hires ?? [], joursProductifs);
  const { tenable, aRisque } = classifyProjects(sInputs, adjusted, engineSettings);
  const roi = roiData
    ? computeScenarioRoi(tenable, roiData.rhHorsITByProject, roiData.tjmMap, o.hires ?? [], o.assumptions ?? {}, joursProductifs)
    : null;
  const surcharge = adjusted.cascade.filter(r => r.sous_effectif_net > 0).length;
  return { sInputs, adjusted, tenable, aRisque, roi, surcharge, peak: peakEtp(adjusted.cascade) };
}

/** Feuille de synthèse : une ligne par scénario. */
function buildSynthese(opts: BuildScenariosWorkbookOpts): XLSX.WorkSheet {
  const rows: Row[] = [];
  rows.push(['Synthèse des scénarios — Plan de charge IT']);
  rows.push([`Jours productifs / mois / ETP : ${opts.joursProductifs}`]);
  rows.push([]);
  rows.push([
    'Scénario', 'ETP à recruter (pic)', 'Mois en surcharge', 'Projets tenables',
    'Projets à risque', 'Gain annuel (€)', 'Coût build RH (€)', 'COGS externalisation (€)',
    'Coût embauches (€/an)', 'Coût ST (€/an)', 'Bilan annuel (€)', 'Temps de retour (ans)',
  ]);
  for (const sc of opts.scenarios) {
    const c = computeScenario(sc, opts);
    rows.push([
      sc.nom,
      round1(c.peak),
      c.surcharge,
      c.tenable.length,
      c.aRisque.length,
      c.roi ? Math.round(c.roi.gain_annuel_eur) : '',
      c.roi ? Math.round(c.roi.rh_build_eur) : '',
      c.roi ? Math.round(c.roi.cogs_eur) : '',
      c.roi ? Math.round(c.roi.cout_embauches_eur) : '',
      c.roi ? Math.round(c.roi.cout_st_eur) : '',
      c.roi ? Math.round(c.roi.bilan_annuel_eur) : '',
      c.roi?.temps_retour_an != null ? round1(c.roi.temps_retour_an) : '',
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, ...Array(11).fill({ wch: 16 })];
  return ws;
}

/** Feuille détaillée d'un scénario. */
function buildScenarioSheet(sc: ExportScenario, opts: BuildScenariosWorkbookOpts): XLSX.WorkSheet {
  const { activeProfils } = opts;
  const c = computeScenario(sc, opts);
  const months = c.adjusted.months;
  const fmtM = (ym: string) => fmtYMShort(ym);
  const profilNom = (code: string) => activeProfils.find(p => p.code === code)?.nom ?? code;
  const projById = new Map(opts.inputs.map(p => [p.id, p]));

  const rows: Row[] = [];
  rows.push([`Scénario : ${sc.nom}`]);
  rows.push([
    `ETP à recruter (pic) : ${round1(c.peak)}`,
    `Mois en surcharge : ${c.surcharge}`,
    `Tenables : ${c.tenable.length}`,
    `À risque : ${c.aRisque.length}`,
  ]);
  rows.push([]);

  // ---- Leviers ----
  rows.push(['LEVIERS DU SCÉNARIO']);
  rows.push(['Renforts (embauches / sous-traitance)']);
  if ((sc.hires ?? []).length === 0) {
    rows.push(['', 'Aucun renfort']);
  } else {
    rows.push(['', 'Type', 'Profil', 'ETP', 'À partir de', '= j/mois ajoutés']);
    for (const h of sc.hires) {
      rows.push([
        '',
        h.kind === 'sous_traitance' ? 'Sous-traitance' : 'Embauche',
        profilNom(h.profil_code),
        Number(h.nb_etp) || 0,
        h.start_ym ? fmtM(h.start_ym) : '',
        round1((Number(h.nb_etp) || 0) * opts.joursProductifs),
      ]);
    }
  }
  const dateOv = (sc.overrides ?? []).filter(o => o.date_kickoff !== undefined || o.date_mep_saisie !== undefined);
  const extOv = (sc.overrides ?? []).filter(o => o.externe !== undefined || o.pct_reduction_si_externe !== undefined || o.budget_externe_eur !== undefined);
  rows.push([]);
  rows.push(['Dates de lancement décalées']);
  if (dateOv.length === 0) {
    rows.push(['', 'Aucun décalage']);
  } else {
    rows.push(['', 'Projet', 'Kickoff', 'MEP saisie']);
    for (const o of dateOv) {
      const p = projById.get(o.it_project_id);
      rows.push([
        '',
        p ? `${p.code} · ${p.nom}` : o.it_project_id,
        o.date_kickoff ? fmtM(o.date_kickoff) : '—',
        o.date_mep_saisie ? fmtM(o.date_mep_saisie) : '—',
      ]);
    }
  }
  rows.push([]);
  rows.push(['Externalisation par projet']);
  if (extOv.length === 0) {
    rows.push(['', 'Aucune externalisation']);
  } else {
    rows.push(['', 'Projet', 'Externe', 'Réduction interne (%)', 'Budget ST (€)']);
    for (const o of extOv) {
      const p = projById.get(o.it_project_id);
      rows.push([
        '',
        p ? `${p.code} · ${p.nom}` : o.it_project_id,
        o.externe ? 'Oui' : 'Non',
        o.pct_reduction_si_externe != null ? Math.round(o.pct_reduction_si_externe * 100) : '',
        o.budget_externe_eur ?? '',
      ]);
    }
  }
  rows.push([]);

  // ---- ROI ----
  if (c.roi) {
    rows.push(['ROI AGRÉGÉ (projets tenables)']);
    rows.push(['Gain annuel (€)', Math.round(c.roi.gain_annuel_eur)]);
    rows.push(['Coût build RH (€, one-shot)', Math.round(c.roi.rh_build_eur)]);
    rows.push(['COGS externalisation (€)', Math.round(c.roi.cogs_eur)]);
    rows.push(['Coût embauches (€/an)', Math.round(c.roi.cout_embauches_eur)]);
    rows.push(['Coût ST générique (€/an)', Math.round(c.roi.cout_st_eur)]);
    rows.push(['BILAN annuel (€)', Math.round(c.roi.bilan_annuel_eur)]);
    rows.push(['Temps de retour (ans)', c.roi.temps_retour_an != null ? round1(c.roi.temps_retour_an) : '—']);
    rows.push([]);
  }

  // ---- Matrice de charge ----
  const monthCols = months.map(fmtM);
  // Bloc A — Demande
  rows.push(['DEMANDE (j/mois) — par profil × mois']);
  rows.push(['Profil', 'Capacité base (j/mois)', ...monthCols]);
  const totalDem: Record<string, number> = {};
  for (const p of activeProfils) {
    const r = c.adjusted.by_profil[p.code];
    if (!r) continue;
    const vals = months.map(ym => { const v = round1(r.demande[ym] ?? 0); totalDem[ym] = (totalDem[ym] ?? 0) + v; return v; });
    rows.push([p.nom, p.capacite_j_mois, ...vals]);
  }
  rows.push(['TOTAL demande', '', ...months.map(ym => round1(totalDem[ym] ?? 0))]);
  rows.push([]);

  // Bloc B — Capacité simulée (base + renforts)
  rows.push(['CAPACITÉ SIMULÉE (base + renforts, j/mois) — par profil × mois']);
  rows.push(['Profil', 'Capacité base (j/mois)', ...monthCols]);
  for (const p of activeProfils) {
    const r = c.adjusted.by_profil[p.code];
    if (!r) continue;
    const vals = months.map(ym => round1(r.capaciteBase + (r.addedCap[ym] ?? 0)));
    rows.push([p.nom, p.capacite_j_mois, ...vals]);
  }
  rows.push([]);

  // Bloc C — Écart
  rows.push(['ÉCART (capacité simulée − demande, j/mois) — par profil × mois']);
  rows.push(['Profil', '', ...monthCols]);
  for (const p of activeProfils) {
    const r = c.adjusted.by_profil[p.code];
    if (!r) continue;
    rows.push([p.nom, '', ...months.map(ym => round1(r.ecart[ym] ?? 0))]);
  }
  rows.push([]);

  // ---- Cascade RSI ----
  rows.push(['CASCADE RSI & ETP À RECRUTER — par mois']);
  rows.push(['Indicateur', '', ...monthCols]);
  const casc = new Map(c.adjusted.cascade.map(r => [r.ym, r]));
  rows.push(['Sous-effectif projets (j)', '', ...months.map(ym => round1(casc.get(ym)?.sous_effectif_projets ?? 0))]);
  rows.push(['Appui RSI mobilisé (j)', '', ...months.map(ym => round1(casc.get(ym)?.appui_rsi ?? 0))]);
  rows.push(['Sous-effectif net (j)', '', ...months.map(ym => round1(casc.get(ym)?.sous_effectif_net ?? 0))]);
  rows.push(['ETP à recruter', '', ...months.map(ym => round1(casc.get(ym)?.etp_a_recruter ?? 0))]);
  rows.push([]);

  // ---- Classification ----
  rows.push([`PROJETS TENABLES (${c.tenable.length})`]);
  for (const p of c.tenable) rows.push(['', `${p.code} · ${p.nom}`]);
  rows.push([]);
  rows.push([`PROJETS À RISQUE (${c.aRisque.length})`]);
  for (const p of c.aRisque) rows.push(['', `${p.code} · ${p.nom}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 34 }, { wch: 18 }, ...months.map(() => ({ wch: 9 }))];
  return ws;
}

/** Construit le classeur complet (synthèse + une feuille par scénario). */
export function buildScenariosWorkbook(opts: BuildScenariosWorkbookOpts): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSynthese(opts), 'Synthèse');
  const used = new Set<string>(['synthèse']);
  for (const sc of opts.scenarios) {
    XLSX.utils.book_append_sheet(wb, buildScenarioSheet(sc, opts), sheetName(sc.nom, used));
  }
  return wb;
}
