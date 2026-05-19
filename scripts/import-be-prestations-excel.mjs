#!/usr/bin/env node
/**
 * Import du fichier Excel rempli → met à jour les task_templates BE.
 *
 * Usage :
 *   node scripts/import-be-prestations-excel.mjs <fichier.xlsx> [--dry-run] [--yes]
 *
 * Options :
 *   --dry-run  : affiche le diff sans rien écrire
 *   --yes      : ne demande pas de confirmation
 *
 * Sécurités :
 *   - Backup JSON du contenu actuel avant toute modification
 *   - Validation stricte de tous les champs enum
 *   - Résolution des noms d'utilisateurs → UUID
 *   - Confirmation interactive avant écriture
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const autoYes = args.includes('--yes');

if (!filePath) {
  console.error('❌ Usage : node scripts/import-be-prestations-excel.mjs <fichier.xlsx> [--dry-run] [--yes]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Variables d\'env requises : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(url, key);

// ───────── Mappings enum ─────────
const START_MODE_MAP = {
  'parallele':         'parallel',
  'apres_precedente':  'after_previous',
  'apres_specifique':  'after_specific',
};
const VAL_TYPE_MAP = {
  'aucune':           { db: 'none',      needsUser: false },
  'demandeur':        { db: 'requester', needsUser: false },
  'manager':          { db: 'manager',   needsUser: false },
  'utilisateur_fixe': { db: 'free',      needsUser: true },
};
const CATEGORY_MAP = {
  'Réglementaire':    'be_reglementaire',
  'BE':               'be',
};

// ───────── Lecture du fichier ─────────
console.log(`▶ Lecture de ${filePath}…`);
const wb = XLSX.readFile(resolve(filePath));
const ws = wb.Sheets['PRESTATIONS'];
if (!ws) { console.error('❌ Onglet « PRESTATIONS » introuvable'); process.exit(1); }
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
console.log(`  → ${rows.length} lignes lues`);

// ───────── Fetch DB actuelle ─────────
console.log('▶ Chargement de l\'état DB actuel…');
const { data: dbSubs } = await sb
  .from('sub_process_templates').select('id, name, be_category, dispatch_manager_id')
  .eq('process_template_id', BE_PROCESS_ID).eq('is_shared', true);
const subIds = dbSubs.map(s => s.id);
const { data: dbTasks } = await sb
  .from('task_templates')
  .select('id, sub_process_template_id, title, default_duration_days, order_index, start_mode, depends_on_task_template_id, delay_after_previous_days, validation_level_1, validator_level_1_id, validation_level_2, validator_level_2_id, is_milestone, milestone_label, auto_milestone_delay_days, auto_milestone_label, required_docs_count, required_docs_description')
  .in('sub_process_template_id', subIds);
const { data: dbProfiles } = await sb.from('profiles').select('id, display_name');
const profileIdByName = new Map(dbProfiles.map(p => [(p.display_name || '').trim().toLowerCase(), p.id]));
const taskById = new Map(dbTasks.map(t => [t.id, t]));
const subByName = new Map(dbSubs.map(s => [s.name.trim().toLowerCase(), s]));

// ───────── Backup ─────────
if (!dryRun) {
  const backupDir = join(__dirname, '..', '_backups');
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `be_task_templates_backup_${ts}.json`);
  writeFileSync(backupPath, JSON.stringify({ subs: dbSubs, tasks: dbTasks }, null, 2));
  console.log(`  → Backup : ${backupPath}`);
}

// ───────── Validation + planification des changements ─────────
const errors = [];
const toUpdate = [];
const toInsert = [];
const toDelete = [];

function resolveProfileId(name) {
  if (!name || !name.trim()) return null;
  const id = profileIdByName.get(name.trim().toLowerCase());
  if (!id) errors.push(`Utilisateur introuvable : « ${name} »`);
  return id ?? null;
}

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const rowNum = i + 2; // +1 header, +1 0-indexed

  const idStep = (r['ID_étape'] || r['ID_etape'] || '').toString().trim();
  const idSub = (r['ID_prestation'] || '').toString().trim();

  // DELETE
  if (idStep.startsWith('DELETE:')) {
    const taskId = idStep.replace(/^DELETE:\s*/, '');
    if (taskById.has(taskId)) toDelete.push(taskId);
    else errors.push(`L${rowNum} DELETE : étape introuvable « ${taskId} »`);
    continue;
  }

  // Mappings enum
  const startMode = START_MODE_MAP[r['Démarrage']];
  if (!startMode) { errors.push(`L${rowNum} Démarrage invalide : « ${r['Démarrage']} »`); continue; }

  const val1Meta = VAL_TYPE_MAP[r['Validation N1']];
  if (!val1Meta) { errors.push(`L${rowNum} Validation N1 invalide : « ${r['Validation N1']} »`); continue; }
  const val2Meta = VAL_TYPE_MAP[r['Validation N2']];
  if (!val2Meta) { errors.push(`L${rowNum} Validation N2 invalide : « ${r['Validation N2']} »`); continue; }

  const val1UserId = val1Meta.needsUser ? resolveProfileId(r['Valideur N1']) : null;
  const val2UserId = val2Meta.needsUser ? resolveProfileId(r['Valideur N2']) : null;

  // Dépendance après_spécifique : « 2 — Titre exact »
  let dependsOnTaskId = null;
  if (startMode === 'after_specific') {
    const dep = (r['Dépend de (étape n°)'] || '').toString().trim();
    if (!dep) {
      errors.push(`L${rowNum} : Démarrage=apres_specifique nécessite « Dépend de »`);
    } else {
      // Cherche dans la même prestation par titre exact
      const depTitle = dep.replace(/^\d+\s*—\s*/, '').trim().toLowerCase();
      const candidate = dbTasks.find(t =>
        t.sub_process_template_id === idSub &&
        (t.title || '').trim().toLowerCase() === depTitle
      );
      if (!candidate) errors.push(`L${rowNum} Dépendance introuvable : « ${dep} »`);
      else dependsOnTaskId = candidate.id;
    }
  }

  const isMilestone = (r['Jalon timeline (oui/non)'] || '').toString().toLowerCase() === 'oui';
  const autoDelay = parseInt(r['Jalon différé J+ (jours)']) || null;

  const payload = {
    title: (r['Étape'] || '').toString().trim(),
    default_duration_days: Math.max(1, parseInt(r['Durée (jours)']) || 1),
    default_duration_unit: 'days',
    order_index: ((parseInt(r['N°']) || 1) * 10),
    start_mode: startMode,
    depends_on_task_template_id: dependsOnTaskId,
    delay_after_previous_days: Math.max(0, parseInt(r['Délai après précédente (j)']) || 0),
    validation_level_1: val1Meta.db,
    validator_level_1_id: val1UserId,
    validation_level_2: val2Meta.db,
    validator_level_2_id: val2UserId,
    is_milestone: isMilestone,
    milestone_label: isMilestone ? ((r['Libellé jalon'] || '').toString().trim() || null) : null,
    auto_milestone_delay_days: isMilestone && autoDelay ? autoDelay : null,
    auto_milestone_label: isMilestone && autoDelay ? ((r['Libellé jalon différé'] || '').toString().trim() || null) : null,
    required_docs_count: Math.max(0, parseInt(r['Docs obligatoires (nb)']) || 0),
    required_docs_description: (r['Description docs'] || '').toString().trim() || null,
  };

  if (idStep && taskById.has(idStep)) {
    // UPDATE
    const existing = taskById.get(idStep);
    const diff = {};
    for (const [k, v] of Object.entries(payload)) {
      if (JSON.stringify(existing[k]) !== JSON.stringify(v)) diff[k] = v;
    }
    if (Object.keys(diff).length > 0) toUpdate.push({ id: idStep, diff });
  } else if (!idStep) {
    // INSERT
    if (!idSub) { errors.push(`L${rowNum} INSERT : ID_prestation requis`); continue; }
    toInsert.push({ ...payload, sub_process_template_id: idSub });
  } else {
    errors.push(`L${rowNum} ID_étape « ${idStep} » introuvable en base — pour créer une étape, laisse cette case vide`);
  }
}

// ───────── Résumé ─────────
console.log('\n══════ RÉSUMÉ ══════');
console.log(`  Étapes à mettre à jour : ${toUpdate.length}`);
console.log(`  Nouvelles étapes       : ${toInsert.length}`);
console.log(`  Étapes à supprimer     : ${toDelete.length}`);
console.log(`  Erreurs                : ${errors.length}`);

if (errors.length > 0) {
  console.log('\n⚠️  Erreurs :');
  errors.slice(0, 30).forEach(e => console.log('   ' + e));
  if (errors.length > 30) console.log(`   … et ${errors.length - 30} de plus`);
  console.log('\n❌ Corrige les erreurs et relance.');
  process.exit(1);
}

if (toUpdate.length + toInsert.length + toDelete.length === 0) {
  console.log('\n✅ Aucun changement détecté.');
  process.exit(0);
}

// Aperçu des 10 premiers updates
if (toUpdate.length > 0) {
  console.log('\n── Aperçu des updates (10 premiers) ──');
  for (const { id, diff } of toUpdate.slice(0, 10)) {
    const t = taskById.get(id);
    console.log(`  • ${t.title}`);
    for (const [k, v] of Object.entries(diff)) {
      console.log(`     ${k}: ${JSON.stringify(t[k])} → ${JSON.stringify(v)}`);
    }
  }
}

if (dryRun) { console.log('\n🟡 DRY-RUN, rien écrit.'); process.exit(0); }

if (!autoYes) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise(res => rl.question('\nConfirmer l\'écriture ? (yes/no) ', a => { rl.close(); res(a.trim().toLowerCase()); }));
  if (ans !== 'yes' && ans !== 'y' && ans !== 'oui' && ans !== 'o') { console.log('Annulé.'); process.exit(0); }
}

// ───────── Application ─────────
console.log('\n▶ Application…');
let ok = 0, ko = 0;
for (const { id, diff } of toUpdate) {
  const { error } = await sb.from('task_templates').update(diff).eq('id', id);
  if (error) { ko++; console.error(`  ✗ UPDATE ${id} : ${error.message}`); }
  else ok++;
}
for (const ins of toInsert) {
  const { error } = await sb.from('task_templates').insert({
    ...ins,
    process_template_id: null,
    priority: 'medium',
    visibility_level: 'public',
    is_shared: true,
  });
  if (error) { ko++; console.error(`  ✗ INSERT : ${error.message}`); }
  else ok++;
}
if (toDelete.length > 0) {
  const { error } = await sb.from('task_templates').delete().in('id', toDelete);
  if (error) { ko += toDelete.length; console.error(`  ✗ DELETE : ${error.message}`); }
  else ok += toDelete.length;
}

console.log(`\n✅ ${ok} opérations réussies, ${ko} erreurs`);
