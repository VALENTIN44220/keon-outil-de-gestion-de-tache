/**
 * Bulk-push du CSV historique des NC vers public._nc_staging via supabase-js.
 * Après run, on déclenche le INSERT INTO nc_declarations via SQL.
 */
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY manquants dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const inputPath = process.argv[2] ?? 'C:\\Users\\vltbe\\Downloads\\QUALITE_NC-AC.csv';
const raw = readFileSync(inputPath, 'utf8');
const startIdx = raw.indexOf('"20');
const rows = parse(raw.slice(startIdx), {
  columns: false, skip_empty_lines: true, relax_quotes: true, relax_column_count: true,
});

const PROCESSUS_MAP = {
  'P-Op1: Vendre - Commerce': 'P-Op1',
  'P-Op2 : Développer - Investir': 'P-Op2',
  'P-Op3: Concevoir - Dimensionner (BE Nsk)': 'P-Op3',
  'P-Op4: Réaliser - Construire': 'P-Op4',
  'P-Op5: Assister ( labo, maintenance, pièce, négociant déchet ou CO2,...)': 'P-Op5',
  'P-Op6: Exploiter - Produire': 'P-Op6',
  'P-Sup1: Management de la  Qualité': 'P-Sup1',
  'P-Sup2: Management des Ressources Humaines': 'P-Sup2',
  'P-Sup3 Communication-Marketing': 'P-Sup3',
  'P-Sup4 : Gestion des documents et de l\'information': 'P-Sup4',
  'P-Sup5 : Achats et Compta': 'P-Sup5',
  'P-Sup6: Innover et développer': 'P-Sup6',
  'P-Man1 : Management de la direction': 'P-Man1',
};
const IDENTIFICATION_MAP = {
  'Points de vigilance': 'points_vigilance',
  'Non-Conformité Qualité': 'nc_qualite',
  'Axe d\'amélioration': 'axe_amelioration',
  'Non-conformité fournisseur': 'nc_fournisseur',
  'Incident site': 'incident_site',
};
const APPARITION_MAP = {
  'Oui': 'oui', 'Non': 'non', 'Ne sais pas': 'ne_sais_pas', 'Non concerné': 'non_concerne',
};
const STATUS_MAP = {
  'NOUVELLE': 'nouvelle', 'AFFECTEE': 'affectee',
  'EN COURS': 'en_cours', 'LEVEE/TERMINEE': 'cloturee',
};
const EFFICACITE_MAP = { 'Efficace': 'efficace', 'A améliorer': 'a_ameliorer', 'Inefficace': 'inefficace' };

const isoDate = (s) => {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
};

const records = [];
let skipped = 0;

for (const r of rows) {
  const title = (r[3] ?? '').toString().trim();
  if (!r[0] || !title) { skipped++; continue; }

  records.push({
    date_constat: isoDate(r[0]),
    processus_code: PROCESSUS_MAP[r[1]] ?? null,
    status: STATUS_MAP[r[2]] ?? 'nouvelle',
    title: title.slice(0, 300),
    societe_code: r[4] || null,
    code_projet: r[5] || null,
    identification: IDENTIFICATION_MAP[r[6]] ?? null,
    metier_code: r[8] || null,
    fournisseur_nom: r[10] || null,
    description_problem: r[11] || null,
    apparition_ailleurs: APPARITION_MAP[r[12]] ?? null,
    causes_racines: r[13] || null,
    actions_correctives: r[14] || null,
    actions_preventives: r[15] || null,
    efficacite_action: EFFICACITE_MAP[r[18]] ?? null,
    date_cloture_souhaitee: isoDate(r[22]),
    declarant_email: r[7]?.split(';')[0]?.trim() || null,
    pilote_email: r[9]?.split(';')[0]?.trim() || null,
  });
}

console.log(`Parsed ${records.length} records (${skipped} skipped)`);

// Bulk insert par paquets de 100
let inserted = 0;
for (let i = 0; i < records.length; i += 100) {
  const batch = records.slice(i, i + 100);
  const { data, error } = await supabase.from('_nc_staging').insert(batch).select('date_constat');
  if (error) { console.error(`Batch ${i}-${i + batch.length} error:`, error.message); process.exit(2); }
  inserted += data?.length ?? batch.length;
  console.log(`Inserted ${inserted}/${records.length}`);
}

console.log(`✓ ${inserted} lignes insérées dans _nc_staging`);
console.log(`Maintenant exécute le INSERT FROM staging via execute_sql`);
