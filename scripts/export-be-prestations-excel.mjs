#!/usr/bin/env node
/**
 * Export des prestations BE en Excel pour paramétrage en masse.
 *
 * Génère un fichier xlsx avec :
 *   - Onglet « PRESTATIONS » : 1 ligne par étape (task_template) avec toutes
 *     les colonnes éditables (durée, validations, jalon, dépendance, délai…)
 *   - Onglet « UTILISATEURS » : référence des UUID + noms pour les validateurs
 *   - Onglet « DROPDOWNS » : valeurs autorisées pour chaque colonne enum
 *
 * Usage :
 *   node scripts/export-be-prestations-excel.mjs
 *
 * Variables d'env requises :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Variables d\'env requises :');
  console.error('   SUPABASE_URL (ou VITE_SUPABASE_URL) = URL du projet');
  console.error('   SUPABASE_SERVICE_ROLE_KEY           = clé service_role');
  console.error('   La récupérer dans Supabase Dashboard → Settings → API.');
  process.exit(1);
}
const sb = createClient(url, key);

// ───────── Helpers ─────────
function valTypeFromDb(dbValue, validatorId) {
  if (!dbValue || dbValue === 'none') return 'aucune';
  if (dbValue === 'requester') return 'demandeur';
  if (dbValue === 'manager')   return 'manager';
  if (validatorId)             return 'utilisateur_fixe';
  return 'aucune';
}

async function main() {
  console.log('▶ Chargement des données BE…');

  // 1) Prestations BE
  const { data: subs, error: subsErr } = await sb
    .from('sub_process_templates')
    .select('id, name, description, be_category, dispatch_manager_id, order_index')
    .eq('process_template_id', BE_PROCESS_ID)
    .eq('is_shared', true)
    .order('order_index');
  if (subsErr) throw subsErr;
  console.log(`  → ${subs.length} prestations`);

  // 2) Étapes (task_templates)
  const subIds = subs.map(s => s.id);
  const { data: tasks, error: tasksErr } = await sb
    .from('task_templates')
    .select(`
      id, sub_process_template_id, title, default_duration_days,
      order_index, start_mode, depends_on_task_template_id, delay_after_previous_days,
      validation_level_1, validator_level_1_id, validation_level_2, validator_level_2_id,
      is_milestone, milestone_label, auto_milestone_delay_days, auto_milestone_label,
      required_docs_count, required_docs_description
    `)
    .in('sub_process_template_id', subIds)
    .order('sub_process_template_id')
    .order('order_index');
  if (tasksErr) throw tasksErr;
  console.log(`  → ${tasks.length} étapes`);

  // 3) Profils (pour résoudre validators + dispatch managers)
  const profileIds = new Set();
  for (const sub of subs) if (sub.dispatch_manager_id) profileIds.add(sub.dispatch_manager_id);
  for (const t of tasks) {
    if (t.validator_level_1_id) profileIds.add(t.validator_level_1_id);
    if (t.validator_level_2_id) profileIds.add(t.validator_level_2_id);
  }
  const { data: profiles } = await sb
    .from('profiles').select('id, display_name')
    .in('id', Array.from(profileIds));
  const profileNameById = new Map((profiles || []).map(p => [p.id, p.display_name]));

  // Tous les profils actifs pour la feuille de référence
  const { data: allProfiles } = await sb
    .from('profiles').select('id, display_name, department:departments(name)')
    .eq('status', 'active').order('display_name');

  const subById = new Map(subs.map(s => [s.id, s]));
  const taskById = new Map(tasks.map(t => [t.id, t]));

  // ───────── Construction des lignes Excel ─────────
  const rows = tasks.map((t, idx) => {
    const sub = subById.get(t.sub_process_template_id);
    const depends = t.depends_on_task_template_id ? taskById.get(t.depends_on_task_template_id) : null;
    return {
      'ID_étape':                t.id,
      'ID_prestation':           t.sub_process_template_id,
      'Prestation':              sub?.name ?? '',
      'Catégorie':               sub?.be_category === 'be_reglementaire' ? 'Réglementaire' : 'BE',
      'Dispatcher':              profileNameById.get(sub?.dispatch_manager_id) ?? '',
      'N°':                      Math.floor(t.order_index / 10),
      'Étape':                   t.title || '',
      'Durée (jours)':           t.default_duration_days ?? 5,
      'Démarrage':               t.start_mode === 'after_previous'  ? 'apres_precedente'
                                : t.start_mode === 'after_specific' ? 'apres_specifique'
                                : 'parallele',
      'Dépend de (étape n°)':    depends ? `${Math.floor(depends.order_index / 10)} — ${depends.title}` : '',
      'Délai après précédente (j)': t.delay_after_previous_days ?? 0,
      'Validation N1':           valTypeFromDb(t.validation_level_1, t.validator_level_1_id),
      'Valideur N1':             profileNameById.get(t.validator_level_1_id) ?? '',
      'Validation N2':           valTypeFromDb(t.validation_level_2, t.validator_level_2_id),
      'Valideur N2':             profileNameById.get(t.validator_level_2_id) ?? '',
      'Jalon timeline (oui/non)': t.is_milestone ? 'oui' : 'non',
      'Libellé jalon':           t.milestone_label ?? '',
      'Jalon différé J+ (jours)': t.auto_milestone_delay_days ?? '',
      'Libellé jalon différé':   t.auto_milestone_label ?? '',
      'Docs obligatoires (nb)':  t.required_docs_count ?? 0,
      'Description docs':        t.required_docs_description ?? '',
    };
  });

  // ───────── Génération du fichier xlsx ─────────
  const wb = XLSX.utils.book_new();

  // Onglet PRESTATIONS
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 38 }, { wch: 38 }, // IDs
    { wch: 32 }, { wch: 14 }, { wch: 22 }, { wch: 4 }, // Prestation / Catégorie / Dispatcher / N°
    { wch: 40 }, // Étape
    { wch: 13 }, { wch: 20 }, { wch: 32 }, { wch: 22 }, // Durée / Démarrage / Dépend / Délai
    { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, // Validations
    { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 32 }, // Jalon
    { wch: 20 }, { wch: 50 }, // Docs
  ];
  // Header en gras
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell) cell.s = { font: { bold: true } };
  }
  XLSX.utils.book_append_sheet(wb, ws, 'PRESTATIONS');

  // Onglet UTILISATEURS (référence pour les noms à recopier dans Valideur)
  const wsUsers = XLSX.utils.json_to_sheet(
    (allProfiles || []).map(p => ({
      'Nom complet': p.display_name,
      'Service':     p.department?.name ?? '',
      'ID Supabase': p.id,
    })),
  );
  wsUsers['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsUsers, 'UTILISATEURS');

  // Onglet DROPDOWNS (valeurs autorisées)
  const wsDropdowns = XLSX.utils.aoa_to_sheet([
    ['Colonne', 'Valeurs autorisées', 'Description'],
    ['Catégorie',     'Réglementaire / BE',                                'Catégorie de la prestation'],
    ['Démarrage',     'parallele / apres_precedente / apres_specifique',   'Quand cette étape démarre par rapport aux autres'],
    ['Validation N1', 'aucune / demandeur / manager / utilisateur_fixe',   'Type de validation niveau 1'],
    ['Validation N2', 'aucune / demandeur / manager / utilisateur_fixe',   'Type de validation niveau 2'],
    ['Jalon timeline (oui/non)', 'oui / non',                              'Si l\'étape doit apparaître comme jalon sur la timeline projet'],
    ['Valideur N1/N2', 'Copier le nom EXACT depuis l\'onglet UTILISATEURS', 'Obligatoire seulement si Validation = utilisateur_fixe'],
    ['Délai après précédente', 'Nombre de jours (entier ≥ 0)',             'Ex : 5 = démarre 5 jours après la fin de la précédente'],
    ['Dépend de (étape n°)', 'Format : « 2 — Titre exact »',                'Obligatoire si Démarrage = apres_specifique'],
  ]);
  wsDropdowns['!cols'] = [{ wch: 30 }, { wch: 55 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsDropdowns, 'DROPDOWNS');

  // Onglet INSTRUCTIONS
  const wsHelp = XLSX.utils.aoa_to_sheet([
    ['Paramétrage en masse des prestations BE'],
    [],
    ['Comment utiliser ce fichier :'],
    ['1. Ouvre l\'onglet PRESTATIONS.'],
    ['2. Modifie les colonnes que tu veux ajuster :'],
    ['     - Durée (jours)'],
    ['     - Démarrage + Délai après précédente'],
    ['     - Validations N1 / N2 + Valideur (nom exact depuis onglet UTILISATEURS)'],
    ['     - Jalon timeline + Libellé jalon + Jalon différé'],
    ['     - Docs obligatoires + Description'],
    [],
    ['3. NE MODIFIE PAS les colonnes ID_étape, ID_prestation (clés techniques).'],
    ['4. Pour ajouter une étape : laisse ID_étape vide, remplis le reste.'],
    ['5. Pour supprimer une étape : préfixe son ID_étape par « DELETE: » (ex : DELETE:abc123…)'],
    [],
    ['6. Enregistre le fichier (Excel ou xlsx).'],
    ['7. Lance le script d\'import :'],
    ['     node scripts/import-be-prestations-excel.mjs chemin/vers/fichier.xlsx'],
    [],
    ['Le script :'],
    ['  ✓ Vérifie l\'intégrité (références, valeurs enum, noms valideurs)'],
    ['  ✓ Affiche un résumé du diff avant d\'écrire'],
    ['  ✓ Demande confirmation avant d\'appliquer'],
    ['  ✓ Sauvegarde un backup JSON avant chaque modification'],
  ]);
  wsHelp['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, 'LISEZ-MOI');

  // Écriture
  const outPath = join(__dirname, '..', 'BE_prestations_parametrage.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`\n✅ Fichier généré : ${outPath}`);
  console.log(`   ${rows.length} étapes × ${Object.keys(rows[0] ?? {}).length} colonnes`);
}

main().catch(err => {
  console.error('❌', err);
  process.exit(1);
});
