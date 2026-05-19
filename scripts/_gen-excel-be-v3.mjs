#!/usr/bin/env node
/**
 * Fichier Excel BE v3 :
 *  - Colonne « État en sortie » (état métier détaillé)
 *  - Nouvelle colonne « Catégorie d'état » (filtre macro)
 *  - Onglet ÉTATS avec colonne « Catégorie » (mappage état détaillé → macro)
 */
import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMP_PATH = process.argv[2];
if (!DUMP_PATH) { console.error('Usage: node _gen-excel-be-v3.mjs <dump.txt>'); process.exit(1); }

function extractRows(raw) {
  const outer = JSON.parse(raw);
  const wrapped = JSON.parse(outer[0].text);
  const m = wrapped.result.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]+?\])\s*<\/untrusted-data-/);
  return JSON.parse(m[1].trim());
}

const rows = extractRows(readFileSync(DUMP_PATH, 'utf8'));
console.log(`▶ ${rows.length} étapes BE chargées`);

// ─── États BE avec catégorie macro ─────────────────────────────────────────
const etatsBE = [
  { Code: 'soumise',             Libellé: 'Soumise',                       Couleur: 'bg-slate-100 text-slate-700',     Ordre: 10,  'État initial': 'oui', 'État final': 'non', 'Catégorie': 'SOUMIS' },
  { Code: 'affectee',            Libellé: 'Affectée',                      Couleur: 'bg-blue-100 text-blue-700',       Ordre: 20,  'État initial': 'non', 'État final': 'non', 'Catégorie': 'SOUMIS' },
  { Code: 'en_cours',            Libellé: 'En cours',                      Couleur: 'bg-amber-100 text-amber-700',     Ordre: 30,  'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_COURS' },
  { Code: 'a_relire',            Libellé: 'À relire',                      Couleur: 'bg-violet-100 text-violet-700',   Ordre: 40,  'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_ATTENTE_VALIDATION' },
  { Code: 'a_valider',           Libellé: 'À valider',                     Couleur: 'bg-orange-100 text-orange-700',   Ordre: 50,  'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_ATTENTE_VALIDATION' },
  { Code: 'valide',              Libellé: 'Validé',                        Couleur: 'bg-emerald-100 text-emerald-700', Ordre: 60,  'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_COURS' },
  { Code: 'dossier_redige',      Libellé: 'Dossier rédigé',                Couleur: 'bg-cyan-100 text-cyan-700',       Ordre: 70,  'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_COURS' },
  { Code: 'plans_realises',      Libellé: 'Plans réalisés',                Couleur: 'bg-cyan-100 text-cyan-700',       Ordre: 80,  'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_COURS' },
  { Code: 'pc_depose',           Libellé: 'PC déposé',                     Couleur: 'bg-indigo-100 text-indigo-700',   Ordre: 90,  'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_ATTENTE_RETOUR_ADMIN' },
  { Code: 'icpe_dossier_depose', Libellé: 'ICPE dossier déposé',           Couleur: 'bg-indigo-100 text-indigo-700',   Ordre: 100, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_ATTENTE_RETOUR_ADMIN' },
  { Code: 'completude_obtenue',  Libellé: 'Complétude obtenue',            Couleur: 'bg-indigo-100 text-indigo-700',   Ordre: 110, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_ATTENTE_RETOUR_ADMIN' },
  { Code: 'arrete_publie',       Libellé: 'Arrêté publié',                 Couleur: 'bg-violet-100 text-violet-700',   Ordre: 120, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_ATTENTE_RETOUR_ADMIN' },
  { Code: 'pc_obtenu',           Libellé: 'PC obtenu',                     Couleur: 'bg-emerald-100 text-emerald-700', Ordre: 130, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'TERMINE' },
  { Code: 'agrement_obtenu',     Libellé: 'Agrément obtenu',               Couleur: 'bg-emerald-100 text-emerald-700', Ordre: 140, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'TERMINE' },
  { Code: 'visite_realisee',     Libellé: 'Visite administration réalisée',Couleur: 'bg-violet-100 text-violet-700',   Ordre: 150, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_ATTENTE_RETOUR_ADMIN' },
  { Code: 'offre_envoyee',       Libellé: 'Offre envoyée',                 Couleur: 'bg-emerald-100 text-emerald-700', Ordre: 160, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'TERMINE' },
  { Code: 'mise_en_service',     Libellé: 'Mise en service',               Couleur: 'bg-emerald-100 text-emerald-700', Ordre: 170, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'TERMINE' },
  { Code: 'purge_ok',            Libellé: 'Purge OK',                      Couleur: 'bg-emerald-200 text-emerald-800', Ordre: 180, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'TERMINE' },
  { Code: 'cloturee',            Libellé: 'Clôturée',                      Couleur: 'bg-slate-200 text-slate-800',     Ordre: 190, 'État initial': 'non', 'État final': 'oui', 'Catégorie': 'TERMINE' },
  { Code: 'annulee',             Libellé: 'Annulée',                       Couleur: 'bg-red-100 text-red-700',         Ordre: 200, 'État initial': 'non', 'État final': 'oui', 'Catégorie': 'TERMINE' },
];

// Mapping rapide état détaillé → catégorie macro
const stateToCat = new Map(etatsBE.map(e => [e.Code, e.Catégorie]));

// ─── Enrichit chaque ligne PRESTATIONS avec « Catégorie d'état » ──────────
const enrichedRows = rows.map(r => {
  const etat = (r['État en sortie'] || '').toString().trim();
  const cat = etat ? (stateToCat.get(etat) || '') : '';
  return { ...r, "Catégorie d'état": cat };
});

const wb = XLSX.utils.book_new();

// 1) Onglet PRESTATIONS
const ws = XLSX.utils.json_to_sheet(enrichedRows);
ws['!cols'] = [
  { wch: 38 }, { wch: 38 },           // IDs
  { wch: 38 }, { wch: 14 }, { wch: 22 }, { wch: 4 },
  { wch: 42 },
  { wch: 13 }, { wch: 20 }, { wch: 36 }, { wch: 22 },
  { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 },
  { wch: 22 }, { wch: 32 }, { wch: 22 }, { wch: 32 },
  { wch: 22 }, { wch: 50 },
  { wch: 24 },                          // État en sortie
  { wch: 28 },                          // ★ Catégorie d'état
];
const range = XLSX.utils.decode_range(ws['!ref']);
for (let C = range.s.c; C <= range.e.c; C++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFF3E8' } } };
}
const lastCol = XLSX.utils.encode_col(range.e.c);
ws['!autofilter'] = { ref: `A1:${lastCol}1` };
XLSX.utils.book_append_sheet(wb, ws, 'PRESTATIONS');

// 2) Onglet ÉTATS
const wsEtats = XLSX.utils.json_to_sheet(etatsBE);
wsEtats['!cols'] = [{ wch: 24 }, { wch: 32 }, { wch: 40 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 28 }];
const eRange = XLSX.utils.decode_range(wsEtats['!ref']);
for (let C = eRange.s.c; C <= eRange.e.c; C++) {
  const cell = wsEtats[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'E0E7FF' } } };
}
XLSX.utils.book_append_sheet(wb, wsEtats, 'ÉTATS');

// 3) Onglet DROPDOWNS
const wsDrop = XLSX.utils.aoa_to_sheet([
  ['Colonne', 'Valeurs autorisées', 'Notes'],
  ['Démarrage', 'parallele | apres_precedente | apres_specifique', 'Quand cette étape démarre'],
  ['Validation N1/N2', 'aucune | demandeur | manager | utilisateur_fixe', 'Type de validation'],
  ['Valideur N1/N2', 'Nom EXACT du profil', 'Obligatoire si validation = utilisateur_fixe'],
  ['Jalon timeline (oui/non)', 'oui | non', 'Crée un point sur la timeline projet'],
  ['Délai après précédente (j)', 'Entier ≥ 0', 'Jours à attendre après la fin du prédécesseur'],
  ['Dépend de (étape n°)', '« 5 — Titre exact »', 'Obligatoire si Démarrage = apres_specifique'],
  ['★ État en sortie', 'Code (cf. onglet ÉTATS, colonne Code)', 'État détaillé que la demande prend à la complétion de l\'étape'],
  ['★ Catégorie d\'état', 'SOUMIS | EN_COURS | EN_ATTENTE_VALIDATION | EN_ATTENTE_RETOUR_ADMIN | TERMINE', 'Catégorie macro pour les filtres simplifiés (mapping auto depuis l\'état en sortie via l\'onglet ÉTATS)'],
  [],
  ['Conventions :'],
  ['  • La colonne « Catégorie d\'état » du tableau PRESTATIONS est REMPLIE AUTOMATIQUEMENT à partir'],
  ['    de l\'état en sortie de l\'étape via le mapping de l\'onglet ÉTATS (colonne Catégorie).'],
  ['  • Pour modifier la catégorie d\'une étape : modifier la catégorie de son état détaillé dans l\'onglet ÉTATS.'],
  ['  • Le N° est local à chaque prestation (1, 2, 3… par prestation).'],
  ['  • « État initial = oui » sur 1 seule ligne maximum dans ÉTATS.'],
]);
wsDrop['!cols'] = [{ wch: 30 }, { wch: 70 }, { wch: 65 }];
XLSX.utils.book_append_sheet(wb, wsDrop, 'DROPDOWNS');

// 4) Onglet LISEZ-MOI
const wsHelp = XLSX.utils.aoa_to_sheet([
  ['🛠  Paramétrage en masse — Prestations BE v3'],
  [],
  ['CE FICHIER contient :'],
  [`  • ${enrichedRows.length} étapes (task_templates) des 21 prestations BE`],
  [`  • ${etatsBE.length} états du processus BE (modifiables dans l\'onglet ÉTATS)`],
  [],
  ['NOUVEAUTÉS v3 :'],
  ['  ★ Colonne « État en sortie » (état détaillé) — déjà présente v2'],
  ['  ★ Colonne « Catégorie d\'état » — NOUVELLE (filtre macro pour l\'UI)'],
  ['  ★ Onglet ÉTATS : nouvelle colonne « Catégorie » qui lie chaque état détaillé à une catégorie macro'],
  [],
  ['LES 5 CATÉGORIES MACRO :'],
  ['  • SOUMIS                    → demande créée, pas encore prise en charge'],
  ['  • EN_COURS                  → en réalisation par l\'équipe interne'],
  ['  • EN_ATTENTE_VALIDATION     → en attente de relecture/validation interne'],
  ['  • EN_ATTENTE_RETOUR_ADMIN   → dossier déposé chez l\'administration, on attend son retour'],
  ['  • TERMINE                   → clôturée ou annulée'],
  [],
  ['LA COLONNE « Catégorie d\'état » DU TABLEAU EST AUTO-CALCULÉE :'],
  ['  • Si tu mets « pc_depose » en « État en sortie » → Catégorie d\'état = EN_ATTENTE_RETOUR_ADMIN'],
  ['  • Si tu changes la Catégorie d\'un état dans l\'onglet ÉTATS, toutes les étapes utilisant cet état héritent automatiquement'],
  ['  • Pour réajuster un état macro : édite l\'onglet ÉTATS (colonne Catégorie)'],
  [],
  ['POUR MODIFIER :'],
  ['  1. Onglet PRESTATIONS : remplir « État en sortie » sur les étapes pivotales'],
  ['  2. Onglet ÉTATS : ajuster la colonne « Catégorie » si un état doit changer de groupe macro'],
  ['  3. Enregistrer et renvoyer le fichier à Claude'],
  ['  4. Claude appliquera + ajoutera le filtre macro côté UI (Demandes BE, dispatch, mes demandes…)'],
]);
wsHelp['!cols'] = [{ wch: 110 }];
XLSX.utils.book_append_sheet(wb, wsHelp, 'LISEZ-MOI');

const out = join(__dirname, '..', 'BE_prestations_v3.xlsx');
XLSX.writeFile(wb, out);
console.log(`✅ Fichier BE v3 : ${out}`);
