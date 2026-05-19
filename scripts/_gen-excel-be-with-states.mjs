#!/usr/bin/env node
/**
 * Génère le fichier Excel BE avec la nouvelle colonne « État en sortie »
 * + un onglet ÉTATS éditable pour la liste des états du processus.
 */
import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMP_PATH = process.argv[2];
if (!DUMP_PATH) { console.error('Usage: node _gen-excel-be-with-states.mjs <dump.txt>'); process.exit(1); }

function extractRows(raw) {
  const outer = JSON.parse(raw);
  const wrapped = JSON.parse(outer[0].text);
  const m = wrapped.result.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]+?\])\s*<\/untrusted-data-/);
  return JSON.parse(m[1].trim());
}

const rows = extractRows(readFileSync(DUMP_PATH, 'utf8'));
console.log(`▶ ${rows.length} étapes BE chargées`);

// États BE (seed appliqué en migration — édités via onglet ÉTATS)
const etatsBE = [
  { Code: 'soumise',             Libellé: 'Soumise',                  Couleur: 'bg-slate-100 text-slate-700',    Ordre: 10,  'État initial': 'oui', 'État final': 'non' },
  { Code: 'affectee',            Libellé: 'Affectée',                 Couleur: 'bg-blue-100 text-blue-700',      Ordre: 20,  'État initial': 'non', 'État final': 'non' },
  { Code: 'en_cours',            Libellé: 'En cours',                 Couleur: 'bg-amber-100 text-amber-700',    Ordre: 30,  'État initial': 'non', 'État final': 'non' },
  { Code: 'a_relire',            Libellé: 'À relire',                 Couleur: 'bg-violet-100 text-violet-700',  Ordre: 40,  'État initial': 'non', 'État final': 'non' },
  { Code: 'a_valider',           Libellé: 'À valider',                Couleur: 'bg-orange-100 text-orange-700',  Ordre: 50,  'État initial': 'non', 'État final': 'non' },
  { Code: 'valide',              Libellé: 'Validé',                   Couleur: 'bg-emerald-100 text-emerald-700',Ordre: 60,  'État initial': 'non', 'État final': 'non' },
  { Code: 'dossier_redige',      Libellé: 'Dossier rédigé',           Couleur: 'bg-cyan-100 text-cyan-700',      Ordre: 70,  'État initial': 'non', 'État final': 'non' },
  { Code: 'plans_realises',      Libellé: 'Plans réalisés',           Couleur: 'bg-cyan-100 text-cyan-700',      Ordre: 80,  'État initial': 'non', 'État final': 'non' },
  { Code: 'pc_depose',           Libellé: 'PC déposé',                Couleur: 'bg-indigo-100 text-indigo-700',  Ordre: 90,  'État initial': 'non', 'État final': 'non' },
  { Code: 'icpe_dossier_depose', Libellé: 'ICPE dossier déposé',      Couleur: 'bg-indigo-100 text-indigo-700',  Ordre: 100, 'État initial': 'non', 'État final': 'non' },
  { Code: 'completude_obtenue',  Libellé: 'Complétude obtenue',       Couleur: 'bg-indigo-100 text-indigo-700',  Ordre: 110, 'État initial': 'non', 'État final': 'non' },
  { Code: 'arrete_publie',       Libellé: 'Arrêté publié',            Couleur: 'bg-violet-100 text-violet-700',  Ordre: 120, 'État initial': 'non', 'État final': 'non' },
  { Code: 'pc_obtenu',           Libellé: 'PC obtenu',                Couleur: 'bg-emerald-100 text-emerald-700',Ordre: 130, 'État initial': 'non', 'État final': 'non' },
  { Code: 'agrement_obtenu',     Libellé: 'Agrément obtenu',          Couleur: 'bg-emerald-100 text-emerald-700',Ordre: 140, 'État initial': 'non', 'État final': 'non' },
  { Code: 'visite_realisee',     Libellé: 'Visite admin. réalisée',   Couleur: 'bg-violet-100 text-violet-700',  Ordre: 150, 'État initial': 'non', 'État final': 'non' },
  { Code: 'offre_envoyee',       Libellé: 'Offre envoyée',            Couleur: 'bg-emerald-100 text-emerald-700',Ordre: 160, 'État initial': 'non', 'État final': 'non' },
  { Code: 'mise_en_service',     Libellé: 'Mise en service',          Couleur: 'bg-emerald-100 text-emerald-700',Ordre: 170, 'État initial': 'non', 'État final': 'non' },
  { Code: 'purge_ok',            Libellé: 'Purge OK',                 Couleur: 'bg-emerald-200 text-emerald-800',Ordre: 180, 'État initial': 'non', 'État final': 'non' },
  { Code: 'cloturee',            Libellé: 'Clôturée',                 Couleur: 'bg-slate-200 text-slate-800',    Ordre: 190, 'État initial': 'non', 'État final': 'oui' },
  { Code: 'annulee',             Libellé: 'Annulée',                  Couleur: 'bg-red-100 text-red-700',        Ordre: 200, 'État initial': 'non', 'État final': 'oui' },
];

const wb = XLSX.utils.book_new();

// Onglet PRESTATIONS (avec nouvelle colonne « État en sortie »)
const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = [
  { wch: 38 }, { wch: 38 },           // IDs
  { wch: 38 }, { wch: 14 }, { wch: 22 }, { wch: 4 },  // Prestation/Cat/Dispatch/N°
  { wch: 42 },                          // Étape
  { wch: 13 }, { wch: 20 }, { wch: 36 }, { wch: 22 }, // Durée/Démarrage/Dépend/Délai
  { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, // Validations
  { wch: 22 }, { wch: 32 }, { wch: 22 }, { wch: 32 }, // Jalon
  { wch: 22 }, { wch: 50 },             // Docs
  { wch: 24 },                          // ★ État en sortie
];
const range = XLSX.utils.decode_range(ws['!ref']);
for (let C = range.s.c; C <= range.e.c; C++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFF3E8' } } };
}
const lastCol = XLSX.utils.encode_col(range.e.c);
ws['!autofilter'] = { ref: `A1:${lastCol}1` };
XLSX.utils.book_append_sheet(wb, ws, 'PRESTATIONS');

// Onglet ÉTATS — éditable
const wsEtats = XLSX.utils.json_to_sheet(etatsBE);
wsEtats['!cols'] = [{ wch: 24 }, { wch: 32 }, { wch: 40 }, { wch: 8 }, { wch: 14 }, { wch: 12 }];
const eRange = XLSX.utils.decode_range(wsEtats['!ref']);
for (let C = eRange.s.c; C <= eRange.e.c; C++) {
  const cell = wsEtats[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'E0E7FF' } } };
}
XLSX.utils.book_append_sheet(wb, wsEtats, 'ÉTATS');

// Onglet DROPDOWNS
const wsDrop = XLSX.utils.aoa_to_sheet([
  ['Colonne', 'Valeurs autorisées', 'Notes'],
  ['Démarrage', 'parallele | apres_precedente | apres_specifique', 'Quand cette étape démarre'],
  ['Validation N1/N2', 'aucune | demandeur | manager | utilisateur_fixe', 'Type de validation'],
  ['Valideur N1/N2', 'Nom EXACT du profil', 'Obligatoire si validation = utilisateur_fixe'],
  ['Jalon timeline (oui/non)', 'oui | non', 'Crée un point sur la timeline projet'],
  ['Délai après précédente (j)', 'Entier ≥ 0', 'Jours à attendre après la fin du prédécesseur'],
  ['Dépend de (étape n°)', '« 5 — Titre exact »', 'Obligatoire si Démarrage = apres_specifique'],
  ['★ État en sortie', 'Code (cf. onglet ÉTATS, colonne Code)', 'État que la demande prend quand cette étape est complétée'],
  [],
  ['Conventions :'],
  ['  • ID_étape, ID_prestation = LECTURE SEULE'],
  ['  • Onglet ÉTATS : ajoute/supprime des lignes pour modifier la liste des états du processus BE'],
  ['  • Le « Code » sert d\'identifiant technique (jamais affiché) — utilise des slugs (sans accents, sans espace, ex: pc_depose)'],
  ['  • « État initial = oui » sur 1 seule ligne max (état par défaut à la création d\'une demande)'],
  ['  • « État final = oui » sur les états terminaux (cloturee, annulee)'],
]);
wsDrop['!cols'] = [{ wch: 30 }, { wch: 55 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, wsDrop, 'DROPDOWNS');

// Onglet LISEZ-MOI
const wsHelp = XLSX.utils.aoa_to_sheet([
  ['🛠  Paramétrage en masse — Prestations BE (avec États)'],
  [],
  ['CE FICHIER contient :'],
  [`  • ${rows.length} étapes (task_templates) des 21 prestations BE`],
  [`  • ${etatsBE.length} états du processus BE (modifiables dans l\'onglet ÉTATS)`],
  [],
  ['POUR MODIFIER :'],
  ['  1. Ouvrir l\'onglet PRESTATIONS'],
  ['  2. Renseigner la colonne « État en sortie » pour chaque étape qui doit faire évoluer la demande'],
  ['     → recopie le « Code » de l\'onglet ÉTATS (ex: dossier_redige, pc_depose, valide…)'],
  ['     → laisse vide si l\'étape n\'a pas d\'impact sur l\'état métier (ex: étape interne)'],
  ['  3. Pour modifier la liste des états : éditer l\'onglet ÉTATS (ajouter, supprimer, renommer)'],
  ['  4. Enregistrer et renvoyer le fichier à Claude'],
  [],
  ['EXEMPLES DE MAPPING :'],
  ['  Rédaction dossier   → dossier_redige'],
  ['  Réalisation des plans → plans_realises'],
  ['  Dépôt PC            → pc_depose'],
  ['  Complétude obtenue  → completude_obtenue'],
  ['  Validation marge    → valide'],
  ['  Purge               → purge_ok'],
]);
wsHelp['!cols'] = [{ wch: 100 }];
XLSX.utils.book_append_sheet(wb, wsHelp, 'LISEZ-MOI');

const out = join(__dirname, '..', 'BE_prestations_v2.xlsx');
XLSX.writeFile(wb, out);
console.log(`✅ Fichier BE v2 : ${out}`);
