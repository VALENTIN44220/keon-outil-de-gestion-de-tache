/**
 * Import / export Excel de la feuille de route — format plat « Export AppTask ».
 *
 * Colonnes : code, name, description, category, status, progress_pct, priority,
 *            business_activity, pillar, profile, start_date, due_date,
 *            build_days_month, run_days_month, external_budget_eur
 *
 * Fonctions pures (sans Supabase ni React) : le parsing du fichier XLSX et les
 * upserts sont faits dans la couche UI.
 */

import type { StatutPortefeuille } from '@/types/fdr';
import type { FdrRoadmapProject } from '@/hooks/useFdrProjects';

export const EXPORT_COLUMNS = [
  'code', 'name', 'description', 'category', 'status', 'progress_pct', 'priority',
  'business_activity', 'pillar', 'profile', 'start_date', 'due_date',
  'build_days_month', 'run_days_month', 'external_budget_eur',
] as const;

export interface ExportAppTaskRow {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  progress_pct?: number | string | null;
  priority?: string | null;
  business_activity?: string | null;
  pillar?: string | null;
  profile?: string | null;
  start_date?: string | number | null;
  due_date?: string | number | null;
  build_days_month?: number | string | null;
  run_days_month?: number | string | null;
  external_budget_eur?: number | string | null;
}

/** Payload prêt pour l'upsert it_projects + ventilation. */
export interface FdrImportPayload {
  code: string;
  projectFields: Record<string, unknown>;
  /** Nom de profil Excel à résoudre en fdr_profils (build ventilé). */
  profileName: string | null;
  buildJMois: number;
  warnings: string[];
}

const VALID_STATUTS: StatutPortefeuille[] = [
  'Idée', 'Proposition', 'En développement', 'Déployé', 'Tâche permanente', 'Abandonné',
];

/** Les lignes RUN-*, PROJ-*, PILOT-* deviennent des tâches permanentes. */
export function isPermanentCode(code: string): boolean {
  return /^(RUN|PROJ|PILOT)-/i.test(code.trim());
}

/** Mappe la priorité Excel (Critique / Élevée / Normale / À définir) vers it_projects.priorite. */
export function mapPriority(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v || v === 'à définir' || v === 'a définir' || v === 'a definir') return null;
  if (v === 'critique') return 'critique';
  if (v === 'élevée' || v === 'elevée' || v === 'elevee' || v === 'haute') return 'haute';
  if (v === 'normale') return 'normale';
  if (v === 'basse') return 'basse';
  return null;
}

/** Extrait le code pilier P1–P5 depuis un libellé long ('P2 Donnée & décision' → 'P2'). */
export function mapPillar(raw: string | null | undefined): string | null {
  const m = (raw ?? '').trim().match(/^P([1-5])\b/i);
  return m ? `P${m[1]}` : null;
}

/** Normalise une date Excel (serial number, 'YYYY-MM-DD', 'DD/MM/YYYY') en 'YYYY-MM-DD'. */
export function normalizeDate(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    // Numéro de série Excel (epoch 1899-12-30)
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function toNum(raw: number | string | null | undefined): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/**
 * Transforme une ligne du fichier Excel en payload d'import.
 * Retourne null si la ligne est invalide (pas de code).
 */
export function mapImportRow(row: ExportAppTaskRow): FdrImportPayload | null {
  const code = (row.code ?? '').toString().trim();
  if (!code) return null;

  const warnings: string[] = [];

  // Statut : permanente forcée pour RUN-*/PROJ-*/PILOT-*
  let statut: StatutPortefeuille;
  if (isPermanentCode(code)) {
    statut = 'Tâche permanente';
  } else {
    const raw = (row.status ?? '').toString().trim();
    const found = VALID_STATUTS.find(s => s.toLowerCase() === raw.toLowerCase());
    if (found) {
      statut = found;
    } else {
      statut = 'Idée';
      if (raw) warnings.push(`Statut inconnu « ${raw} » → Idée`);
    }
  }

  // Catégorie
  const catRaw = (row.category ?? '').toString().trim().toUpperCase();
  const categorie = catRaw === 'IA' ? 'IA' : catRaw === 'HORS IA' ? 'HORS IA' : null;
  if (catRaw && !categorie) warnings.push(`Catégorie inconnue « ${row.category} »`);

  const startDate = normalizeDate(row.start_date);
  const dueDate = normalizeDate(row.due_date);
  const isPermanente = statut === 'Tâche permanente';

  const projectFields: Record<string, unknown> = {
    nom_projet: (row.name ?? code).toString().trim() || code,
    description: row.description ? String(row.description) : null,
    statut_portefeuille: statut,
    categorie_fdr: categorie,
    priorite: mapPriority(row.priority),
    pilier: mapPillar(row.pillar),
    activite_metier: row.business_activity ? String(row.business_activity).trim() : null,
    pct_avancement: Math.max(0, Math.min(100, toNum(row.progress_pct))),
    date_kickoff: startDate,
    // Permanentes : due_date = échéance ; cycle projet : due_date = MEP saisie
    echeance_cible: isPermanente ? dueDate : null,
    date_mep_saisie: isPermanente ? null : dueDate,
    suivi_j_mois: toNum(row.run_days_month),
    budget_externe_eur: toNum(row.external_budget_eur),
    sur_feuille_de_route: statut !== 'Abandonné',
  };

  return {
    code,
    projectFields,
    profileName: row.profile ? String(row.profile).trim() : null,
    buildJMois: toNum(row.build_days_month),
    warnings,
  };
}

/**
 * Résout un nom de profil Excel vers un profil FDR (insensible casse/accents, match partiel).
 */
export function resolveProfile(
  name: string | null,
  profils: Array<{ id: string; code: string; nom: string }>,
): { id: string; code: string } | null {
  if (!name) return null;
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const target = norm(name);
  // Match exact sur le code ou le nom, puis partiel
  const exact = profils.find(p => norm(p.code) === target || norm(p.nom) === target);
  if (exact) return { id: exact.id, code: exact.code };
  const partial = profils.find(p => norm(p.nom).includes(target) || target.includes(norm(p.nom)));
  return partial ? { id: partial.id, code: partial.code } : null;
}

/** Construit les lignes d'export au format « Export AppTask » depuis les projets. */
export function buildExportRows(
  projects: FdrRoadmapProject[],
  profils: Array<{ code: string; nom: string }>,
): Record<string, string | number | null>[] {
  const profilName = (code: string | null | undefined) =>
    profils.find(p => p.code === code)?.nom ?? code ?? null;

  return projects.map(p => {
    const isPermanente = p.statut_portefeuille === 'Tâche permanente';
    // Build total ventilé ; profil = principal ou le 1er ventilé
    const buildTotal = p.loads.reduce((s, l) => s + l.j_mois, 0);
    const mainProfile = p.profil_principal ?? p.loads[0]?.profil_code ?? null;
    return {
      code: p.code,
      name: p.nom,
      description: null,
      category: p.categorie_fdr ?? null,
      status: p.statut_portefeuille,
      progress_pct: p.pct_avancement ?? 0,
      priority: p.priorite ?? null,
      business_activity: p.activite_metier ?? null,
      pillar: p.pilier ?? null,
      profile: profilName(mainProfile),
      start_date: p.date_kickoff ?? null,
      due_date: (isPermanente ? p.echeance_cible : p.date_mep_saisie) ?? null,
      build_days_month: Math.round(buildTotal * 100) / 100,
      run_days_month: p.suivi_j_mois ?? 0,
      external_budget_eur: 0,
    };
  });
}
