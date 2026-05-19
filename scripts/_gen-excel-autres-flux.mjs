#!/usr/bin/env node
/**
 * Fichier Excel « Autres flux » :
 *   - SERVICE_ACHAT : 3 étapes existantes
 *   - Onglet IT_PROPOSE, RH_PROPOSE, COMM_PROPOSE, etc. — squelettes vides
 *     pour que le métier remplisse les étapes
 *   - Un onglet ÉTATS par flux
 */
import XLSX from 'xlsx';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Étapes existantes SERVICE ACHAT ───────────────────────────────────────
const achat = [
  { 'ID_étape': 'd1111111-1111-1111-1111-111111111111', 'ID_sous_processus': 'c1111111-1111-1111-1111-111111111111', 'Sous-processus': 'DEMANDE DE NOUVEAU FOURNISSEUR',                'N°': 1, 'Étape': 'Vérification fournisseur',  'Durée (j)': 1, 'Démarrage': 'parallele',         'Dépend de (étape n°)': '', 'Délai après précédente (j)': 0, 'Validation N1': 'aucune', 'Valideur N1': '', 'Validation N2': 'aucune', 'Valideur N2': '', 'État en sortie': '' },
  { 'ID_étape': 'd2222222-2222-2222-2222-222222222222', 'ID_sous_processus': 'c1111111-1111-1111-1111-111111111111', 'Sous-processus': 'DEMANDE DE NOUVEAU FOURNISSEUR',                'N°': 2, 'Étape': 'Création fournisseur',     'Durée (j)': 1, 'Démarrage': 'apres_precedente', 'Dépend de (étape n°)': '', 'Délai après précédente (j)': 0, 'Validation N1': 'aucune', 'Valideur N1': '', 'Validation N2': 'aucune', 'Valideur N2': '', 'État en sortie': '' },
  { 'ID_étape': '35a65b15-63ae-4d31-94dc-f0f18d39339c', 'ID_sous_processus': '951d6c3c-82ca-4468-97ca-ca51275da573', 'Sous-processus': 'DEMANDE DIVERSES SERVICE ACHAT (HORS NOUVEAU FOURNISSEUR)', 'N°': 1, 'Étape': 'REPONDRE AU TICKET',     'Durée (j)': 1, 'Démarrage': 'parallele',         'Dépend de (étape n°)': '', 'Délai après précédente (j)': 0, 'Validation N1': 'aucune', 'Valideur N1': '', 'Validation N2': 'aucune', 'Valideur N2': '', 'État en sortie': '' },
];

// ─── Templates vides pour les autres process IT/RH/Comm/etc. ──────────────
// L'utilisateur ajoute des lignes : ID_processus + nom + N° + étape + durée etc.
const ROW_TEMPLATE = {
  'ID_processus': '',          // ← à recopier depuis l'onglet PROCESS_REFERENCE
  'Processus':    '',
  'N°':           1,
  'Étape':        '',
  'Durée (j)':    1,
  'Démarrage':    'parallele',
  'Dépend de (étape n°)': '',
  'Délai après précédente (j)': 0,
  'Validation N1':'aucune',
  'Valideur N1':  '',
  'Validation N2':'aucune',
  'Valideur N2':  '',
  'État en sortie': '',
};

// 3 lignes vides pour amorcer la saisie (le user peut en ajouter)
const blankRows = Array.from({ length: 5 }, () => ({ ...ROW_TEMPLATE }));

// ─── Référence des process_templates qui n'ont pas encore d'étapes ───────
const processRef = [
  { 'ID_processus': '11111111-1111-4111-8111-111111111306', 'Processus': 'IT - Demande d intervention IT' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111307', 'Processus': 'IT - Support materiel bureautique' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111302', 'Processus': 'IT - Support Divalto' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111303', 'Processus': 'IT - Support Pipedrive' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111304', 'Processus': 'IT - Support Lucca' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111301', 'Processus': 'IT - Ouverture dossier SharePoint' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111305', 'Processus': 'IT - Reporting Power BI' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111309', 'Processus': 'IT - Reporting hors Power BI' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111310', 'Processus': 'IT - Application dediee' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111308', 'Processus': 'IT - Ticket Planner (sync auto)' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111101', 'Processus': 'Maintenance - Demande de materiel' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111201', 'Processus': 'Logistique - Demande de transport' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111401', 'Processus': 'Comm - Demande communication marketing' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111402', 'Processus': 'Comm - Reservation stand nomade' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111501', 'Processus': 'Innovation - Nouvelle demande' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111502', 'Processus': 'Innovation - MAJ avancement projet' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111601', 'Processus': 'RH - Onboarding' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111602', 'Processus': 'RH - Offboarding' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111603', 'Processus': 'RH - Mutation' },
  { 'ID_processus': '11111111-1111-4111-8111-111111111604', 'Processus': 'RH - Promotion' },
];

// ─── États « par défaut » suggérés (à dupliquer pour chaque process) ───────
const etatsParDefaut = [
  { 'ID_processus': '', 'Processus': '', Code: 'soumise',     Libellé: 'Soumise',     Couleur: 'bg-slate-100 text-slate-700',     Ordre: 10,  'État initial': 'oui', 'État final': 'non' },
  { 'ID_processus': '', 'Processus': '', Code: 'en_cours',    Libellé: 'En cours',    Couleur: 'bg-amber-100 text-amber-700',     Ordre: 20,  'État initial': 'non', 'État final': 'non' },
  { 'ID_processus': '', 'Processus': '', Code: 'a_valider',   Libellé: 'À valider',   Couleur: 'bg-violet-100 text-violet-700',   Ordre: 30,  'État initial': 'non', 'État final': 'non' },
  { 'ID_processus': '', 'Processus': '', Code: 'validee',     Libellé: 'Validée',     Couleur: 'bg-emerald-100 text-emerald-700', Ordre: 40,  'État initial': 'non', 'État final': 'non' },
  { 'ID_processus': '', 'Processus': '', Code: 'terminee',    Libellé: 'Terminée',    Couleur: 'bg-emerald-200 text-emerald-800', Ordre: 50,  'État initial': 'non', 'État final': 'oui' },
  { 'ID_processus': '', 'Processus': '', Code: 'refusee',     Libellé: 'Refusée',     Couleur: 'bg-red-100 text-red-700',         Ordre: 60,  'État initial': 'non', 'État final': 'oui' },
  { 'ID_processus': '', 'Processus': '', Code: 'annulee',     Libellé: 'Annulée',     Couleur: 'bg-red-100 text-red-700',         Ordre: 70,  'État initial': 'non', 'État final': 'oui' },
];

const wb = XLSX.utils.book_new();

// 1) SERVICE_ACHAT (existant)
const wsAchat = XLSX.utils.json_to_sheet(achat);
wsAchat['!cols'] = [{wch:38},{wch:38},{wch:48},{wch:5},{wch:36},{wch:11},{wch:20},{wch:30},{wch:18},{wch:18},{wch:22},{wch:18},{wch:22},{wch:24}];
const r1 = XLSX.utils.decode_range(wsAchat['!ref']);
for (let C = r1.s.c; C <= r1.e.c; C++) {
  const c = wsAchat[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (c) c.s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFF3E8' } } };
}
XLSX.utils.book_append_sheet(wb, wsAchat, 'SERVICE_ACHAT');

// 2) IT / RH / COMM / MAINT / LOGI / INNO — onglet vide pour saisie
const wsNew = XLSX.utils.json_to_sheet(blankRows);
wsNew['!cols'] = [{wch:38},{wch:42},{wch:5},{wch:36},{wch:11},{wch:20},{wch:30},{wch:18},{wch:18},{wch:22},{wch:18},{wch:22},{wch:24}];
const r2 = XLSX.utils.decode_range(wsNew['!ref']);
for (let C = r2.s.c; C <= r2.e.c; C++) {
  const c = wsNew[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (c) c.s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFF3E8' } } };
}
XLSX.utils.book_append_sheet(wb, wsNew, 'NOUVELLES_ETAPES');

// 3) PROCESS_REFERENCE
const wsRef = XLSX.utils.json_to_sheet(processRef);
wsRef['!cols'] = [{ wch: 40 }, { wch: 50 }];
XLSX.utils.book_append_sheet(wb, wsRef, 'PROCESS_REFERENCE');

// 4) ÉTATS_PAR_FLUX — pré-rempli avec une suggestion neutre, le user duplique par process
const wsEtats = XLSX.utils.json_to_sheet(etatsParDefaut);
wsEtats['!cols'] = [{wch:40},{wch:42},{wch:18},{wch:24},{wch:34},{wch:8},{wch:14},{wch:12}];
const r3 = XLSX.utils.decode_range(wsEtats['!ref']);
for (let C = r3.s.c; C <= r3.e.c; C++) {
  const c = wsEtats[XLSX.utils.encode_cell({ r: 0, c: C })];
  if (c) c.s = { font: { bold: true }, fill: { fgColor: { rgb: 'E0E7FF' } } };
}
XLSX.utils.book_append_sheet(wb, wsEtats, 'ETATS_PAR_FLUX');

// 5) LISEZ-MOI
const wsHelp = XLSX.utils.aoa_to_sheet([
  ['🛠  Paramétrage en masse — Autres flux'],
  [],
  ['CE FICHIER contient 4 onglets :'],
  ['  1. SERVICE_ACHAT      : les 3 étapes existantes du flux Achat (à compléter avec États en sortie)'],
  ['  2. NOUVELLES_ETAPES   : squelette pour saisir des étapes sur les flux IT/RH/Comm/Maintenance/Logistique/Innovation'],
  ['  3. PROCESS_REFERENCE  : liste des ID des process pour recopier l\'ID_processus dans NOUVELLES_ETAPES'],
  ['  4. ETATS_PAR_FLUX     : liste des états par processus (duplique le bloc des 7 états par défaut pour chaque flux)'],
  [],
  ['POUR SAISIR DES ÉTAPES SUR UN FLUX SANS ÉTAPES ACTUELLES (ex: IT - Demande d\'intervention IT) :'],
  ['  1. Va sur PROCESS_REFERENCE → copie l\'ID_processus du flux concerné'],
  ['  2. Va sur NOUVELLES_ETAPES → colle l\'ID dans ID_processus, remplis Processus, N°, Étape, Durée…'],
  ['  3. Ajoute autant de lignes que d\'étapes (la même ID_processus se répète)'],
  [],
  ['POUR DÉFINIR LES ÉTATS D\'UN FLUX :'],
  ['  1. Va sur ETATS_PAR_FLUX'],
  ['  2. Pour chaque flux que tu veux configurer, recopie le bloc des 7 lignes (Code/Libellé/Couleur…) en renseignant'],
  ['     ID_processus + Processus correspondants. Modifie/ajoute/supprime selon besoin métier.'],
  [],
  ['QUAND C\'EST PRÊT :'],
  ['  Renvoie ce fichier à Claude — il va :'],
  ['     • Mettre à jour les états en sortie pour SERVICE_ACHAT'],
  ['     • Créer les sub_process_templates + task_templates pour NOUVELLES_ETAPES (les flux qui n\'avaient pas d\'étapes)'],
  ['     • Insérer les états dans request_states pour ETATS_PAR_FLUX'],
  ['  Backup automatique avant écriture, comme pour le BE.'],
]);
wsHelp['!cols'] = [{ wch: 110 }];
XLSX.utils.book_append_sheet(wb, wsHelp, 'LISEZ-MOI');

const out = join(__dirname, '..', 'AUTRES_FLUX_parametrage.xlsx');
XLSX.writeFile(wb, out);
console.log(`✅ Fichier autres flux : ${out}`);
console.log(`   Onglets : SERVICE_ACHAT (${achat.length} étapes) + NOUVELLES_ETAPES (vide) + PROCESS_REFERENCE (${processRef.length}) + ETATS_PAR_FLUX (${etatsParDefaut.length})`);
