#!/usr/bin/env node
/**
 * Fusionne le BE_prestations_v2.xlsx rempli par le user (saisies État en
 * sortie + Dépend de + etc.) avec la nouvelle structure v3 (ajout colonne
 * « Catégorie d'état » auto-mappée + onglet ÉTATS avec colonne Catégorie).
 */
import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC = process.argv[2] || join(__dirname, '..', 'BE_prestations_v2.xlsx');
const OUT = process.argv[3] || join(__dirname, '..', 'BE_prestations_v3.xlsx');

const wb = XLSX.read(readFileSync(SRC), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['PRESTATIONS'], { defval: null });
console.log(`▶ ${rows.length} étapes chargées depuis v2`);

// États BE avec catégorie macro (modèle de référence — l'utilisateur peut
// ajuster les Catégories dans l'onglet ÉTATS du fichier final)
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

// Heuristique pour suggérer une catégorie macro à partir d'un code d'état
function suggestCategory(code) {
  const c = (code || '').toLowerCase();
  // Termine / final
  if (/_ok$|_obtenu$|_obtenue$|_valide$|_valides$|cloturee|annulee|envoyee$|envoye$/.test(c)) {
    // Mais certains "envoye" sont en attente retour admin (dossier envoyé à admin)
    if (/^dossier_envoye|^audit_envoye/.test(c)) return 'EN_ATTENTE_RETOUR_ADMIN';
    if (/pc_obtenu|agrement.*obtenu|mise_en_service|purge_ok|raccordement_valide|reception_ok|offre_envoyee|etude_envoyee|pac_envoye/.test(c))
      return 'TERMINE';
    return 'EN_COURS'; // ex: validation_marge_ok, plans_valides, revue_ok
  }
  // En attente retour admin
  if (/depose|deposee|deposes|deposes$|complements|completude|enquete|arrete|coderst|panneau_affich|visite_real|consultation|administration/.test(c))
    return 'EN_ATTENTE_RETOUR_ADMIN';
  // En attente validation
  if (/a_valider|a_relire|valider$/.test(c)) return 'EN_ATTENTE_VALIDATION';
  // Soumis
  if (/soumise|affectee/.test(c)) return 'SOUMIS';
  // En cours
  if (/redige|realise|realisee|execution|chantier|pilotage|cdc_|conception/.test(c)) return 'EN_COURS';
  return '';  // à compléter manuellement
}

// Collecte tous les codes uniques saisis par l'utilisateur dans PRESTATIONS
const usedCodes = new Set(
  rows.map(r => (r['État en sortie'] || '').toString().trim()).filter(Boolean)
);

// Ajoute les codes nouveaux à etatsBE (ceux qui ne sont pas déjà présents)
const existingCodes = new Set(etatsBE.map(e => e.Code));
let nextOrder = Math.max(...etatsBE.map(e => e.Ordre)) + 10;
for (const code of usedCodes) {
  if (existingCodes.has(code)) continue;
  etatsBE.push({
    Code: code,
    Libellé: code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    Couleur: 'bg-slate-100 text-slate-700',
    Ordre: nextOrder,
    'État initial': 'non',
    'État final': 'non',
    'Catégorie': suggestCategory(code),
  });
  nextOrder += 10;
}
// Tri final par ordre
etatsBE.sort((a, b) => (a.Ordre || 0) - (b.Ordre || 0));

const stateToCat = new Map(etatsBE.map(e => [e.Code, e.Catégorie]));
console.log(`  → ${etatsBE.length} états (20 initiaux + ${etatsBE.length - 20} créés depuis tes saisies)`);

// Enrichit chaque ligne avec « Catégorie d'état » dérivée de « État en sortie »
const enriched = rows.map(r => ({
  ...r,
  "Catégorie d'état": (r['État en sortie'] || '').toString().trim()
    ? (stateToCat.get((r['État en sortie'] || '').toString().trim()) || '')
    : '',
}));

const filled = enriched.filter(r => (r['État en sortie'] || '').trim()).length;
const withDep = enriched.filter(r => String(r['Dépend de (étape n°)'] || '').trim()).length;
console.log(`  → ${filled} avec État en sortie, ${withDep} avec Dépendance — toutes préservées`);

const outWb = XLSX.utils.book_new();

// 1) PRESTATIONS (toutes les colonnes v2 + Catégorie d'état)
const ws = XLSX.utils.json_to_sheet(enriched);
ws['!cols'] = [
  { wch: 38 }, { wch: 38 },
  { wch: 38 }, { wch: 14 }, { wch: 22 }, { wch: 4 },
  { wch: 42 },
  { wch: 13 }, { wch: 20 }, { wch: 30 }, { wch: 22 },
  { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 },
  { wch: 22 }, { wch: 32 }, { wch: 22 }, { wch: 32 },
  { wch: 22 }, { wch: 50 },
  { wch: 24 },
  { wch: 28 },
];
const r1 = XLSX.utils.decode_range(ws['!ref']);
for (let C = r1.s.c; C <= r1.e.c; C++) {
  const c = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (c) c.s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFF3E8' } } };
}
ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(r1.e.c)}1` };
XLSX.utils.book_append_sheet(outWb, ws, 'PRESTATIONS');

// 2) ÉTATS
const wsE = XLSX.utils.json_to_sheet(etatsBE);
wsE['!cols'] = [{ wch: 24 }, { wch: 34 }, { wch: 40 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 28 }];
const r2 = XLSX.utils.decode_range(wsE['!ref']);
for (let C = r2.s.c; C <= r2.e.c; C++) {
  const c = wsE[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (c) c.s = { font: { bold: true }, fill: { fgColor: { rgb: 'E0E7FF' } } };
}
XLSX.utils.book_append_sheet(outWb, wsE, 'ÉTATS');

// 3) DROPDOWNS
const wsD = XLSX.utils.aoa_to_sheet([
  ['Colonne', 'Valeurs autorisées', 'Notes'],
  ['Démarrage', 'parallele | apres_precedente | apres_specifique', 'Quand cette étape démarre'],
  ['Validation N1/N2', 'aucune | demandeur | manager | utilisateur_fixe', 'Type de validation'],
  ['Valideur N1/N2', 'Nom EXACT du profil', 'Obligatoire si validation = utilisateur_fixe'],
  ['Jalon timeline (oui/non)', 'oui | non', 'Crée un point sur la timeline projet'],
  ['Délai après précédente (j)', 'Entier ≥ 0', 'Jours à attendre après la fin du prédécesseur'],
  ['Dépend de (étape n°)', 'N° d\'étape OU « N° — Titre »', 'Obligatoire si Démarrage = apres_specifique'],
  ['★ État en sortie', 'Code (cf. onglet ÉTATS)', 'État détaillé que la demande prend à la complétion'],
  ['★ Catégorie d\'état', 'SOUMIS | EN_COURS | EN_ATTENTE_VALIDATION | EN_ATTENTE_RETOUR_ADMIN | TERMINE', 'Auto-mappée depuis l\'État en sortie (via colonne Catégorie de l\'onglet ÉTATS)'],
]);
wsD['!cols'] = [{ wch: 30 }, { wch: 70 }, { wch: 65 }];
XLSX.utils.book_append_sheet(outWb, wsD, 'DROPDOWNS');

// 4) LISEZ-MOI
const wsH = XLSX.utils.aoa_to_sheet([
  ['🛠  Paramétrage BE v3 — fusionné depuis v2 rempli'],
  [],
  [`Tes ${filled} états en sortie + ${withDep} dépendances ont été préservés.`],
  ['Nouveautés v3 :'],
  ['  ★ Colonne « Catégorie d\'état » — auto-mappée depuis « État en sortie »'],
  ['  ★ Onglet ÉTATS : nouvelle colonne « Catégorie » qui pilote le mapping'],
  [],
  ['Pour ajuster une catégorie macro : modifie la colonne « Catégorie » dans l\'onglet ÉTATS.'],
  ['Toutes les étapes qui utilisent cet état basculent automatiquement.'],
]);
wsH['!cols'] = [{ wch: 100 }];
XLSX.utils.book_append_sheet(outWb, wsH, 'LISEZ-MOI');

XLSX.writeFile(outWb, OUT);
console.log(`✅ Fichier régénéré : ${OUT}`);
