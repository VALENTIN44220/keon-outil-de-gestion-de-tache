/**
 * Import du CSV historique des Non-Conformités SharePoint → Supabase.
 *
 * Usage :
 *   node scripts/import-nc-csv.mjs <path-to-csv> > out.sql
 *
 * Le script parse le CSV (avec multi-lignes quotés), résout les emails
 * Rédacteur/Pilote en profile.id via la table profiles, et génère des
 * INSERT INTO nc_declarations (...) VALUES (...) qu'on applique via MCP.
 */
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const inputPath = process.argv[2] ?? 'C:\\Users\\vltbe\\Downloads\\QUALITE_NC-AC.csv';
const raw = readFileSync(inputPath, 'utf8');

// On saute la 1ère section (schéma JSON) et on garde uniquement les data rows.
// Heuristique : les data rows commencent par une date ISO ouvrante guillemet.
const startIdx = raw.indexOf('"20');
const dataRaw = raw.slice(startIdx);

// Parse comme du CSV standard (la section schéma est exclue)
const rows = parse(dataRaw, {
  columns: false,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
  trim: false,
});

// Mapping observé en analysant la structure :
// 0  Date du constat (ISO)
// 1  Nom du processus (label SharePoint)
// 2  ETAT DE LA NC (NOUVELLE / AFFECTEE / EN COURS / LEVEE/TERMINEE / vide)
// 3  Intitulé de la NC
// 4  Société
// 5  Code projet (4 lettres)
// 6  Identification (label SharePoint)
// 7  Rédacteur (email)
// 8  Métier
// 9  Pilote (email — peut être multi avec ;)
// 10 Nom du fournisseur (ou source)
// 11 Description du problème
// 12 Apparition possible (Oui/Non/...)
// 13 Causes racines
// 14 Actions correctives
// 15 Actions préventives
// 16 Created at (auto SharePoint — on ignore, on garde created_at par défaut now())
// 17 Item ID interne (ignore)
// 18 Efficacité de l'action ?
// 19-21 (champs auto SharePoint)
// 22 Date de clôture souhaitée

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
  'Oui': 'oui',
  'Non': 'non',
  'Ne sais pas': 'ne_sais_pas',
  'Non concerné': 'non_concerne',
};

const STATUS_MAP = {
  'NOUVELLE': 'nouvelle',
  'AFFECTEE': 'affectee',
  'EN COURS': 'en_cours',
  'LEVEE/TERMINEE': 'cloturee',
};

const EFFICACITE_MAP = {
  'Efficace': 'efficace',
  'A améliorer': 'a_ameliorer',
  'Inefficace': 'inefficace',
};

function sqlStr(s) {
  if (s === null || s === undefined || s === '') return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

function sqlDate(s) {
  if (!s) return 'NULL';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? `'${m[1]}'` : 'NULL';
}

function emailLookup(email) {
  // On ne résout pas en SQL inline ici (jointure ferait planter
  // l'INSERT si l'email n'existe pas). On garde l'email en commentaire,
  // et on fait l'UPDATE dans un second SQL avec un JOIN sur profiles.
  if (!email) return null;
  return email.split(';')[0].trim();  // premier email si multi
}

const inserts = [];
const emailUpdates = [];
let skipped = 0;

rows.forEach((r, i) => {
  if (!r[0] || !r[3]) { skipped++; return; }  // pas de date ou pas d'intitulé

  const title = (r[3] ?? '').trim();
  if (!title) { skipped++; return; }

  const declarantEmail = emailLookup(r[7]);
  const piloteEmail    = emailLookup(r[9]);

  const insertSql = `(${[
    sqlDate(r[0]),                                         // date_constat
    sqlStr(PROCESSUS_MAP[r[1]] ?? r[1] ?? null),           // processus_code
    sqlStr(STATUS_MAP[r[2]] ?? 'nouvelle'),                // status
    sqlStr(title.slice(0, 300)),                           // title
    sqlStr(r[4] ?? null),                                  // societe_code
    sqlStr(r[5] ?? null),                                  // code_projet
    sqlStr(IDENTIFICATION_MAP[r[6]] ?? null),              // identification
    sqlStr(r[8] ?? null),                                  // metier_code
    sqlStr(r[10] ?? null),                                 // fournisseur_nom
    sqlStr(r[11] ?? null),                                 // description_problem
    sqlStr(APPARITION_MAP[r[12]] ?? null),                 // apparition_ailleurs
    sqlStr(r[13] ?? null),                                 // causes_racines
    sqlStr(r[14] ?? null),                                 // actions_correctives
    sqlStr(r[15] ?? null),                                 // actions_preventives
    sqlStr(EFFICACITE_MAP[r[18]] ?? null),                 // efficacite_action
    sqlDate(r[22]),                                         // date_cloture_souhaitee
    sqlStr(declarantEmail),                                // tag temporaire (sera retiré)
    sqlStr(piloteEmail),
  ].join(', ')})`;

  inserts.push(insertSql);
});

// Génère le SQL final
// On découpe en batches de 50 lignes (chacun < 35KB pour passer dans MCP)
import { writeFileSync, mkdirSync } from 'fs';
mkdirSync('scripts/nc-batches', { recursive: true });

const BATCH_SIZE = 50;
const batches = [];
for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
  batches.push(inserts.slice(i, i + BATCH_SIZE));
}

console.error(`Generated ${batches.length} batches of up to ${BATCH_SIZE} NCs each (${inserts.length} total, ${skipped} skipped)`);

batches.forEach((batch, idx) => {
  const sql = `INSERT INTO public._nc_staging VALUES\n${batch.join(',\n')};\n`;
  writeFileSync(`scripts/nc-batches/batch-${String(idx + 1).padStart(2, '0')}.sql`, sql, 'utf8');
});

// Step 3 final
const finalSql = `INSERT INTO nc_declarations (
  date_constat, processus_code, status, title, societe_code,
  code_projet, identification, metier_code, fournisseur_nom,
  description_problem, apparition_ailleurs, causes_racines,
  actions_correctives, actions_preventives, efficacite_action,
  date_cloture_souhaitee, declarant_id, pilote_id, created_at
)
SELECT
  i.date_constat, i.processus_code, i.status, i.title, i.societe_code,
  i.code_projet, i.identification, i.metier_code, i.fournisseur_nom,
  i.description_problem, i.apparition_ailleurs, i.causes_racines,
  i.actions_correctives, i.actions_preventives, i.efficacite_action,
  i.date_cloture_souhaitee,
  (SELECT p.id FROM profiles p WHERE LOWER(p.lovable_email) = LOWER(i.declarant_email) OR LOWER(p.secondary_email) = LOWER(i.declarant_email) LIMIT 1),
  (SELECT p.id FROM profiles p WHERE LOWER(p.lovable_email) = LOWER(i.pilote_email) OR LOWER(p.secondary_email) = LOWER(i.pilote_email) LIMIT 1),
  COALESCE(i.date_constat::timestamptz, now())
FROM public._nc_staging i;

DROP TABLE public._nc_staging;`;

writeFileSync('scripts/nc-batches/final.sql', finalSql, 'utf8');

console.error(`Done. Apply each batch then final.sql`);
