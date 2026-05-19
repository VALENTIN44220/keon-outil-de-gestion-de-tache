#!/usr/bin/env node
/**
 * Génère le fichier Excel BE à partir du dump MCP (résultat SQL déjà sauvé sur disque)
 * — utilisé en one-shot pour livrer le fichier sans avoir besoin de la service_role_key.
 */
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMP_PATH = process.argv[2];
if (!DUMP_PATH) { console.error('Usage: node _gen-excel-from-mcp-dump.mjs <dump.txt>'); process.exit(1); }

// Le dump est un JSON [{type:'text', text:'<inner>'}] et l'inner est un JSON encapsulé
// dans un wrapper « result » … on parse récursivement jusqu'à trouver le tableau de rows.
function extractRows(raw) {
  // Format du dump : [ { type: "text", text: "{\"result\":\"... <untrusted>JSON</untrusted> ...\"}" } ]
  const outer = JSON.parse(raw);
  if (!Array.isArray(outer) || !outer[0]?.text) throw new Error('Format dump non reconnu');
  // outer[0].text est lui-même un JSON contenant un champ result string
  const wrapped = JSON.parse(outer[0].text);
  if (typeof wrapped.result !== 'string') throw new Error('Champ result manquant');
  // Le result string contient :
  //   "... within the below <untrusted-data-X> boundaries.\n\n<untrusted-data-X>\n[JSON]\n</untrusted-data-X>\n\nUse this data..."
  // Le 1er match du regex tombait sur "boundaries.". On cible la balise suivie d'un \n et d'un [
  const m = wrapped.result.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]+?\])\s*<\/untrusted-data-/);
  if (!m) throw new Error('Bloc untrusted-data avec tableau JSON introuvable');
  return JSON.parse(m[1].trim());
}

const raw = readFileSync(DUMP_PATH, 'utf8');
const rows = extractRows(raw);
if (!Array.isArray(rows)) { console.error('❌ Format inattendu'); process.exit(1); }
console.log(`▶ ${rows.length} lignes chargées`);

// ─── Construction xlsx ───
const wb = XLSX.utils.book_new();

// Onglet PRESTATIONS
const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = [
  { wch: 38 }, { wch: 38 },         // IDs (à ne pas modifier)
  { wch: 38 }, { wch: 14 }, { wch: 22 }, { wch: 4 }, // Presta / Cat / Dispatch / N°
  { wch: 42 },                       // Étape
  { wch: 13 }, { wch: 20 }, { wch: 36 }, { wch: 22 }, // Durée / Démarrage / Dépend / Délai
  { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, // Validations
  { wch: 22 }, { wch: 32 }, { wch: 22 }, { wch: 32 }, // Jalon
  { wch: 22 }, { wch: 50 },          // Docs
];
// Bold header
const range = XLSX.utils.decode_range(ws['!ref']);
for (let C = range.s.c; C <= range.e.c; C++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFF3E8' } } };
}
// Freeze row 1
ws['!freeze'] = { xSplit: 0, ySplit: 1 };
XLSX.utils.book_append_sheet(wb, ws, 'PRESTATIONS');

// Onglet DROPDOWNS (référence des valeurs autorisées)
const wsDrop = XLSX.utils.aoa_to_sheet([
  ['Colonne', 'Valeurs autorisées', 'Notes'],
  ['Démarrage', 'parallele | apres_precedente | apres_specifique', 'Quand cette étape démarre'],
  ['Validation N1', 'aucune | demandeur | manager | utilisateur_fixe', 'Niveau 1 de validation'],
  ['Validation N2', 'aucune | demandeur | manager | utilisateur_fixe', 'Niveau 2 de validation'],
  ['Valideur N1/N2', 'Nom EXACT depuis Supabase', 'Obligatoire si Validation = utilisateur_fixe'],
  ['Jalon timeline (oui/non)', 'oui | non', 'Crée un point sur la timeline du projet'],
  ['Délai après précédente (j)', '0, 1, 2, … (entier ≥ 0)', 'Jours à attendre après la fin du prédécesseur'],
  ['Dépend de (étape n°)', '« 5 — Titre exact de l\'étape »', 'Obligatoire si Démarrage = apres_specifique'],
  ['Catégorie', 'Réglementaire | BE', 'Indicative — lecture seule (à modifier dans la prestation parente)'],
  [],
  ['Conventions Excel :'],
  ['  • ID_étape, ID_prestation, Prestation, Catégorie, Dispatcher = LECTURE SEULE (clés techniques)'],
  ['  • Pour ajouter une étape : laisse ID_étape vide, remplis le reste avec ID_prestation valide'],
  ['  • Pour supprimer une étape : préfixe ID_étape par « DELETE: » (ex: DELETE:abc123…)'],
  ['  • Sauvegarde le fichier puis renvoie-le à Claude (ou lance le script d\'import)'],
]);
wsDrop['!cols'] = [{ wch: 30 }, { wch: 55 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, wsDrop, 'DROPDOWNS');

// Onglet LISEZ-MOI
const wsHelp = XLSX.utils.aoa_to_sheet([
  ['🛠  Paramétrage en masse — Prestations BE'],
  [],
  ['CE FICHIER contient toutes les étapes (task_templates) des 21 prestations BE.'],
  [`Total : ${rows.length} étapes réparties sur ${new Set(rows.map(r => r['ID_prestation'])).size} prestations.`],
  [],
  ['POUR MODIFIER :'],
  ['  1. Ouvrir l\'onglet PRESTATIONS'],
  ['  2. Filtrer / trier selon le besoin (autofilter activé)'],
  ['  3. Modifier les colonnes éditables (cf. onglet DROPDOWNS)'],
  ['  4. Enregistrer'],
  ['  5. Renvoyer le fichier à Claude OU lancer l\'import :'],
  ['     node scripts/import-be-prestations-excel.mjs <chemin>.xlsx --dry-run'],
  ['     node scripts/import-be-prestations-excel.mjs <chemin>.xlsx'],
  [],
  ['SÉCURITÉ :'],
  ['  • Le script de réimport fait un backup JSON avant chaque modification'],
  ['  • Validation stricte de tous les enums + résolution des noms valideurs'],
  ['  • Affiche un diff précis et demande confirmation'],
]);
wsHelp['!cols'] = [{ wch: 100 }];
XLSX.utils.book_append_sheet(wb, wsHelp, 'LISEZ-MOI');

// Autofilter sur PRESTATIONS
const lastCol = XLSX.utils.encode_col(range.e.c);
ws['!autofilter'] = { ref: `A1:${lastCol}1` };

const out = join(__dirname, '..', 'BE_prestations_parametrage.xlsx');
XLSX.writeFile(wb, out);
console.log(`✅ Fichier écrit : ${out}`);
