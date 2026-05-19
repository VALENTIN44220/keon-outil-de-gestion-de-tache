#!/usr/bin/env node
/**
 * Génère 2 fichiers SQL depuis BE_prestations_v3.xlsx :
 *   1. _v3_states.sql      : UPSERT request_states (codes + Catégorie macro)
 *   2. _v3_task_states.sql : UPDATE task_templates.output_state_code (+ état macro)
 */
import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';

const SRC = 'BE_prestations_v3.xlsx';
const BE_PROCESS = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

const wb = XLSX.read(readFileSync(SRC), { type: 'buffer' });
const prestations = XLSX.utils.sheet_to_json(wb.Sheets['PRESTATIONS'], { defval: null });
const etats = XLSX.utils.sheet_to_json(wb.Sheets['ÉTATS'] || wb.Sheets['ETATS'], { defval: null });

function s(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function b(v) { return /^(oui|true|yes|1)$/i.test(String(v || '').trim()) ? 'TRUE' : 'FALSE'; }
function n(v) { const x = parseInt(v); return isNaN(x) ? 'NULL' : String(x); }
function macro(v) {
  // Normalise la catégorie : EN ATTENTE TRAVAUX → EN_ATTENTE_TRAVAUX
  return (v || '').toString().trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');
}

// ── 1) UPSERT request_states en UN seul VALUES ────────────────────────────
const tuples = [];
for (const e of etats) {
  const code = (e.Code || '').toString().trim();
  if (!code) continue;
  const cat = macro(e['Catégorie']);
  tuples.push(`(${s(BE_PROCESS)}, ${s(code)}, ${s(e['Libellé'])}, ${s(e['Couleur'])}, ${n(e['Ordre'])}, ${b(e['État initial'])}, ${b(e['État final'])}, ${cat ? s(cat) : 'NULL'})`);
}
const upsertSql = `INSERT INTO request_states (process_template_id, code, label, color, order_index, is_initial, is_final, state_category) VALUES
${tuples.join(',\n')}
ON CONFLICT (process_template_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  order_index = EXCLUDED.order_index,
  is_initial = EXCLUDED.is_initial,
  is_final = EXCLUDED.is_final,
  state_category = EXCLUDED.state_category;`;
writeFileSync('C:/Users/vltbe/AppData/Local/Temp/v3_states.sql', upsertSql);
console.log(`✅ v3_states.sql : ${tuples.length} UPSERT en 1 statement`);

// ── 2) UPDATE task_templates en 1 statement via VALUES + JOIN ─────────────
const ttuples = [];
for (const r of prestations) {
  const id = (r['ID_étape'] || '').toString().trim();
  const state = (r['État en sortie'] || '').toString().trim();
  if (!id || !state) continue;
  ttuples.push(`(${s(id)}::uuid, ${s(state)})`);
}
const updSql = `UPDATE task_templates tt
SET output_state_code = v.state_code
FROM (VALUES
${ttuples.join(',\n')}
) AS v(id, state_code)
WHERE tt.id = v.id;`;
writeFileSync('C:/Users/vltbe/AppData/Local/Temp/v3_task_states.sql', updSql);
console.log(`✅ v3_task_states.sql : ${ttuples.length} UPDATE en 1 statement`);
