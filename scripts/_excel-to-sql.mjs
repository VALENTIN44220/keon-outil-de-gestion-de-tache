#!/usr/bin/env node
/**
 * Lit le JSON dumpé depuis l'Excel + génère un fichier SQL d'UPDATE
 * idempotent à appliquer via le MCP Supabase. Pas de connexion DB nécessaire
 * — juste un dump fidèle de ce que l'utilisateur a saisi dans l'Excel.
 */
import { readFileSync, writeFileSync } from 'fs';

const inPath  = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) { console.error('Usage: _excel-to-sql.mjs <in.json> <out.sql>'); process.exit(1); }

// Cache nom → profile_id (rempli par lookup ci-dessous — on doit déjà avoir résolu côté SQL)
// Pour simplifier, on génère du SQL qui résout les noms via subquery sur profiles.display_name.

const rows = JSON.parse(readFileSync(inPath, 'utf8'));
const STATE_MAP = { 'parallele': 'parallel', 'apres_precedente': 'after_previous', 'apres_specifique': 'after_specific' };
const VAL_MAP = {
  'aucune':           { db: 'none',      needsUser: false },
  'demandeur':        { db: 'requester', needsUser: false },
  'manager':          { db: 'manager',   needsUser: false },
  'utilisateur_fixe': { db: 'free',      needsUser: true },
};

function sqlString(s) {
  if (s === null || s === undefined || s === '') return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}
function sqlInt(n) {
  const v = parseInt(n);
  return isNaN(v) ? 'NULL' : String(v);
}
function sqlBool(b) { return b ? 'TRUE' : 'FALSE'; }
function userIdFor(name) {
  if (!name || !String(name).trim()) return 'NULL';
  // Sous-requête (LIMIT 1 pour homonymes)
  return `(SELECT id FROM profiles WHERE LOWER(display_name) = LOWER('${String(name).trim().replace(/'/g, "''")}') LIMIT 1)`;
}

const updates = [];
let updateCount = 0, skipCount = 0;

for (const r of rows) {
  const id = (r['ID_étape'] || '').trim();
  if (!id) { skipCount++; continue; }

  const startMode = STATE_MAP[r['Démarrage']];
  const val1 = VAL_MAP[r['Validation N1']];
  const val2 = VAL_MAP[r['Validation N2']];
  if (!startMode || !val1 || !val2) { skipCount++; continue; }

  const isMilestone = (r['Jalon timeline (oui/non)'] || '').toLowerCase() === 'oui';
  const autoDelay = parseInt(r['Jalon différé J+ (jours)']) || null;

  // Pour after_specific : on retrouve l'étape déclencheur par titre/N° dans la même prestation.
  // Pour after_previous : depends_on_task_template_id reste NULL (résolu via order_index au runtime).
  let dependsExpr = 'NULL';
  if (startMode === 'after_specific') {
    const dep = String(r['Dépend de (étape n°)'] || '').trim();
    if (dep) {
      // Format attendu : "5 — Titre" — on extrait le titre après le tiret long
      const m = dep.match(/^(\d+)\s*(?:[—-]\s*(.+))?$/);
      const order = m ? parseInt(m[1]) * 10 : null;
      const titleHint = m && m[2] ? m[2].trim() : null;
      if (titleHint) {
        dependsExpr = `(SELECT id FROM task_templates WHERE sub_process_template_id = ${sqlString(r['ID_prestation'])} AND LOWER(title) = LOWER(${sqlString(titleHint)}) LIMIT 1)`;
      } else if (order !== null) {
        dependsExpr = `(SELECT id FROM task_templates WHERE sub_process_template_id = ${sqlString(r['ID_prestation'])} AND order_index = ${order} LIMIT 1)`;
      }
    }
  }

  updates.push(`UPDATE task_templates SET
  title                       = ${sqlString(r['Étape'])},
  default_duration_days       = ${sqlInt(r['Durée (jours)'])},
  default_duration_unit       = 'days',
  order_index                 = ${(parseInt(r['N°']) || 1) * 10},
  start_mode                  = ${sqlString(startMode)},
  depends_on_task_template_id = ${dependsExpr},
  delay_after_previous_days   = ${sqlInt(r['Délai après précédente (j)']) === 'NULL' ? '0' : sqlInt(r['Délai après précédente (j)'])},
  validation_level_1          = ${sqlString(val1.db)},
  validator_level_1_id        = ${val1.needsUser ? userIdFor(r['Valideur N1']) : 'NULL'},
  validation_level_2          = ${sqlString(val2.db)},
  validator_level_2_id        = ${val2.needsUser ? userIdFor(r['Valideur N2']) : 'NULL'},
  is_milestone                = ${sqlBool(isMilestone)},
  milestone_label             = ${isMilestone ? sqlString(r['Libellé jalon'] || null) : 'NULL'},
  auto_milestone_delay_days   = ${isMilestone && autoDelay ? autoDelay : 'NULL'},
  auto_milestone_label        = ${isMilestone && autoDelay ? sqlString(r['Libellé jalon différé'] || null) : 'NULL'},
  required_docs_count         = ${sqlInt(r['Docs obligatoires (nb)']) === 'NULL' ? '0' : sqlInt(r['Docs obligatoires (nb)'])},
  required_docs_description   = ${sqlString(r['Description docs'])}
WHERE id = ${sqlString(id)};`);
  updateCount++;
}

writeFileSync(outPath, '-- ' + new Date().toISOString() + '\n-- ' + updateCount + ' updates\n\n' + updates.join('\n\n'));
console.log(`✅ ${updateCount} UPDATE générés (skip ${skipCount}) → ${outPath}`);
