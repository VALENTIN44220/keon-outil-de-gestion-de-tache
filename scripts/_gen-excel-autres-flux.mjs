#!/usr/bin/env node
/**
 * Fichier Excel « Autres flux » :
 *   - SERVICE_ACHAT : 3 étapes existantes (avec colonnes Affectation pour compléter)
 *   - NOUVELLES_ETAPES : squelette vide pour saisir des étapes sur IT / RH / Comm / etc.
 *   - PROCESS_REFERENCE : UUID des process_templates qui n'ont pas encore d'étapes
 *   - PROFILES_REFERENCE : UUID des utilisateurs actifs (pour recopier dans Affectation cible)
 *   - DEPARTMENTS_REFERENCE : UUID des départements
 *   - ETATS_PAR_FLUX : 7 états par défaut (à dupliquer par flux)
 *
 * Note : l'AFFECTATION est attachée au **sous-processus** (sub_process_templates),
 * pas à chaque étape. Donc on remplit les colonnes Affectation UNIQUEMENT sur la
 * 1ʳᵉ ligne (N°=1) de chaque ID_sous_processus.
 */
import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Snapshot statique des profils + départements ──────────────────────────
// Source : scripts/_refs-snapshot.json (régénéré ponctuellement via MCP Supabase).
const snap = JSON.parse(readFileSync(join(__dirname, '_refs-snapshot.json'), 'utf8'));
const profiles = snap.profiles || [];
const departments = snap.departments || [];
const groups = snap.groups || [];

const flowsSnap = JSON.parse(readFileSync(join(__dirname, '_flows-snapshot.json'), 'utf8'));
const flows = flowsSnap.flows || [];
const tableEffects = flowsSnap.table_effects || [];

// ─── Types d'affectation supportés (voir sub_process_templates.assignment_type) ──
//   • fixed_user        : utilisateur fixé (renseigne la colonne UUID avec un id de profile)
//   • fixed_role        : un rôle / job_title (renseigne UUID = job_title_id)
//   • manager_dispatch  : un manager « dispatch » qui ré-affecte ensuite (UUID = profile_id)
//   • manager_requester : le manager du demandeur (laisse UUID vide)
//   • requester         : le demandeur lui-même (laisse UUID vide)
//   • group             : un groupe d'utilisateurs (UUID = group_id)
//   • department        : un département cible (UUID = department_id)
const ASSIGNMENT_TYPES = [
  'fixed_user',
  'fixed_role',
  'manager_dispatch',
  'manager_requester',
  'requester',
  'group',
  'department',
];

// ─── Étapes existantes SERVICE ACHAT ───────────────────────────────────────
const achat = [
  // Sous-processus 1 : flux state-machine (2 affectataires différents) — déjà en place via wf_workflows
  { 'ID_étape': 'd1111111-1111-1111-1111-111111111111', 'ID_sous_processus': 'c1111111-1111-1111-1111-111111111111', 'Sous-processus': 'DEMANDE DE NOUVEAU FOURNISSEUR', 'N°': 1, 'Étape': 'Vérification fournisseur', 'Durée (j)': 1, 'Démarrage': 'parallele',         'Dépend de (étape n°)': '',  'Délai après précédente (j)': 0, 'Affectation type': 'group', 'Affectation cible (UUID)': 'a1111111-1111-1111-1111-111111111111', 'Affectation cible (nom)': 'Service Achat', 'Validation N1': 'aucune', 'Valideur N1': '', 'Validation N2': 'aucune', 'Valideur N2': '', 'État en sortie': 'en_cours' },
  { 'ID_étape': 'd2222222-2222-2222-2222-222222222222', 'ID_sous_processus': 'c1111111-1111-1111-1111-111111111111', 'Sous-processus': 'DEMANDE DE NOUVEAU FOURNISSEUR', 'N°': 2, 'Étape': 'Création fournisseur',    'Durée (j)': 1, 'Démarrage': 'apres_precedente', 'Dépend de (étape n°)': '1', 'Délai après précédente (j)': 0, 'Affectation type': 'group', 'Affectation cible (UUID)': 'a2222222-2222-2222-2222-222222222222', 'Affectation cible (nom)': 'Comptabilité', 'Validation N1': 'aucune', 'Valideur N1': '', 'Validation N2': 'aucune', 'Valideur N2': '', 'État en sortie': 'terminee' },
  // Sous-processus 2 : 1 seule étape, affectation simple
  { 'ID_étape': '35a65b15-63ae-4d31-94dc-f0f18d39339c', 'ID_sous_processus': '951d6c3c-82ca-4468-97ca-ca51275da573', 'Sous-processus': 'DEMANDE DIVERSES SERVICE ACHAT (HORS NOUVEAU FOURNISSEUR)', 'N°': 1, 'Étape': 'REPONDRE AU TICKET', 'Durée (j)': 1, 'Démarrage': 'parallele', 'Dépend de (étape n°)': '', 'Délai après précédente (j)': 0, 'Affectation type': 'group', 'Affectation cible (UUID)': 'a1111111-1111-1111-1111-111111111111', 'Affectation cible (nom)': 'Service Achat', 'Validation N1': 'aucune', 'Valideur N1': '', 'Validation N2': 'aucune', 'Valideur N2': '', 'État en sortie': 'terminee' },
];

// ─── Templates vides pour les autres process IT/RH/Comm/etc. ──────────────
const ROW_TEMPLATE = {
  'ID_processus': '',
  'Processus':    '',
  'ID_sous_processus': '',
  'Sous-processus':    '',
  'N°':           1,
  'Étape':        '',
  'Durée (j)':    1,
  'Démarrage':    'parallele',
  'Dépend de (étape n°)': '',
  'Délai après précédente (j)': 0,
  // ⬇ Affectation : à remplir SEULEMENT sur la ligne N°=1 de chaque sous-processus
  'Affectation type':         '',
  'Affectation cible (UUID)': '',
  'Affectation cible (nom)':  '',
  'Validation N1':'aucune',
  'Valideur N1':  '',
  'Validation N2':'aucune',
  'Valideur N2':  '',
  'État en sortie': '',
};

const blankRows = Array.from({ length: 8 }, () => ({ ...ROW_TEMPLATE }));

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

// ─── États « par défaut » suggérés ─────────────────────────────────────────
const etatsParDefaut = [
  { 'ID_processus': '', 'Processus': '', Code: 'soumise',  Libellé: 'Soumise',  Couleur: 'bg-slate-100 text-slate-700',     Ordre: 10, 'État initial': 'oui', 'État final': 'non', 'Catégorie': 'SOUMIS' },
  { 'ID_processus': '', 'Processus': '', Code: 'en_cours', Libellé: 'En cours', Couleur: 'bg-amber-100 text-amber-700',     Ordre: 20, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_COURS' },
  { 'ID_processus': '', 'Processus': '', Code: 'a_valider',Libellé: 'À valider',Couleur: 'bg-violet-100 text-violet-700',   Ordre: 30, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_ATTENTE_VALIDATION' },
  { 'ID_processus': '', 'Processus': '', Code: 'validee',  Libellé: 'Validée',  Couleur: 'bg-emerald-100 text-emerald-700', Ordre: 40, 'État initial': 'non', 'État final': 'non', 'Catégorie': 'EN_COURS' },
  { 'ID_processus': '', 'Processus': '', Code: 'terminee', Libellé: 'Terminée', Couleur: 'bg-emerald-200 text-emerald-800', Ordre: 50, 'État initial': 'non', 'État final': 'oui', 'Catégorie': 'TERMINE' },
  { 'ID_processus': '', 'Processus': '', Code: 'refusee',  Libellé: 'Refusée',  Couleur: 'bg-red-100 text-red-700',         Ordre: 60, 'État initial': 'non', 'État final': 'oui', 'Catégorie': 'TERMINE' },
  { 'ID_processus': '', 'Processus': '', Code: 'annulee',  Libellé: 'Annulée',  Couleur: 'bg-red-100 text-red-700',         Ordre: 70, 'État initial': 'non', 'État final': 'oui', 'Catégorie': 'TERMINE' },
];

// ─── Construction du classeur ──────────────────────────────────────────────
const wb = XLSX.utils.book_new();
const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'FFF3E8' } } };
function styleHeader(ws) {
  if (!ws['!ref']) return;
  const r = XLSX.utils.decode_range(ws['!ref']);
  for (let C = r.s.c; C <= r.e.c; C++) {
    const c = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (c) c.s = headerStyle;
  }
}

// 0) EXISTANT — dump complet de tous les flux configurés en DB (hors BE)
const wsExisting = XLSX.utils.json_to_sheet(flows.map(f => ({
  'Processus': f.process_name,
  'Sous-processus': f.sp_name,
  'N° sp': f.sp_order,
  'Affectation type (sp)': f.assignment_type,
  'Affectation cible (sp)': f.cible_nom,
  'UUID cible (sp)': f.cible_uuid,
  'Type cible': f.cible_kind,
  'N° étape': f.tt_order,
  'Étape': f.tt_title,
  'Durée (j)': f.default_duration_days,
  'Démarrage': f.start_mode,
  'Override groupe (étape)': f.tt_target_group_name || '',
  'UUID override (étape)': f.tt_target_group_id || '',
  'Validation': f.validation,
  'ID processus': f.process_id,
  'ID sous-processus': f.sp_id,
  'ID étape': f.tt_id,
})));
wsExisting['!cols'] = [{wch:32},{wch:42},{wch:6},{wch:18},{wch:32},{wch:38},{wch:14},{wch:6},{wch:48},{wch:8},{wch:12},{wch:22},{wch:38},{wch:12},{wch:38},{wch:38},{wch:38}];
styleHeader(wsExisting);
XLSX.utils.book_append_sheet(wb, wsExisting, 'EXISTANT');

// 0bis) TABLE_EFFECTS — documentation des effets de bord sur tables métier
const wsEffects = XLSX.utils.json_to_sheet(tableEffects.map(e => ({
  'Processus': e.process_name,
  'Sous-processus': e.sp_name,
  'Étape concernée': e.step,
  'Table impactée': e.table,
  'Action': e.action,
  'Champs copiés': e.fields_copied,
  'Notes': e.notes,
})));
wsEffects['!cols'] = [{wch:32},{wch:48},{wch:42},{wch:34},{wch:36},{wch:60},{wch:80}];
styleHeader(wsEffects);
XLSX.utils.book_append_sheet(wb, wsEffects, 'TABLE_EFFECTS');

// 1) SERVICE_ACHAT (existant)
const wsAchat = XLSX.utils.json_to_sheet(achat);
wsAchat['!cols'] = [{wch:38},{wch:38},{wch:48},{wch:5},{wch:36},{wch:11},{wch:18},{wch:20},{wch:24},{wch:20},{wch:38},{wch:30},{wch:18},{wch:18},{wch:22},{wch:18},{wch:22}];
styleHeader(wsAchat);
XLSX.utils.book_append_sheet(wb, wsAchat, 'SERVICE_ACHAT');

// 2) NOUVELLES_ETAPES (vide pour saisie)
const wsNew = XLSX.utils.json_to_sheet(blankRows);
wsNew['!cols'] = [{wch:38},{wch:42},{wch:38},{wch:42},{wch:5},{wch:36},{wch:11},{wch:18},{wch:20},{wch:24},{wch:20},{wch:38},{wch:30},{wch:18},{wch:18},{wch:22},{wch:18},{wch:22}];
styleHeader(wsNew);
XLSX.utils.book_append_sheet(wb, wsNew, 'NOUVELLES_ETAPES');

// 3) PROCESS_REFERENCE
const wsRef = XLSX.utils.json_to_sheet(processRef);
wsRef['!cols'] = [{ wch: 40 }, { wch: 50 }];
styleHeader(wsRef);
XLSX.utils.book_append_sheet(wb, wsRef, 'PROCESS_REFERENCE');

// 4) PROFILES_REFERENCE — pour récupérer les UUIDs des utilisateurs
const wsProf = XLSX.utils.json_to_sheet(
  profiles.map(p => ({
    'UUID': p.id,
    'Nom': p.display_name,
    'Fonction': p.job_title || '',
    'Département': p.dept || '',
  })),
);
wsProf['!cols'] = [{ wch: 40 }, { wch: 32 }, { wch: 48 }, { wch: 28 }];
styleHeader(wsProf);
XLSX.utils.book_append_sheet(wb, wsProf, 'PROFILES_REFERENCE');

// 5) DEPARTMENTS_REFERENCE
const wsDept = XLSX.utils.json_to_sheet(
  departments.map(d => ({ 'UUID': d.id, 'Département': d.name })),
);
wsDept['!cols'] = [{ wch: 40 }, { wch: 40 }];
styleHeader(wsDept);
XLSX.utils.book_append_sheet(wb, wsDept, 'DEPARTMENTS_REFERENCE');

// 5bis) GROUPS_REFERENCE — UUID des groupes (collaborator_groups)
const wsGroups = XLSX.utils.json_to_sheet(
  groups.map(g => ({
    'UUID': g.id,
    'Groupe': g.name,
    'Description': g.description || '',
    'Membres': g.members ?? '',
  })),
);
wsGroups['!cols'] = [{ wch: 40 }, { wch: 28 }, { wch: 50 }, { wch: 10 }];
styleHeader(wsGroups);
XLSX.utils.book_append_sheet(wb, wsGroups, 'GROUPS_REFERENCE');

// 6) ASSIGNMENT_TYPES — petite cheat-sheet
const wsAt = XLSX.utils.json_to_sheet([
  { 'Affectation type': 'fixed_user',        'Description': 'Personne fixée — colle son UUID dans « Affectation cible (UUID) »' },
  { 'Affectation type': 'fixed_role',        'Description': 'Rôle / job_title — colle l\'UUID du job_title' },
  { 'Affectation type': 'manager_dispatch',  'Description': 'Un manager qui ré-affecte ensuite (cas BE) — UUID du manager' },
  { 'Affectation type': 'manager_requester', 'Description': 'Manager du demandeur (auto à la création) — UUID vide' },
  { 'Affectation type': 'requester',         'Description': 'Le demandeur lui-même — UUID vide' },
  { 'Affectation type': 'group',             'Description': 'Groupe d\'utilisateurs — UUID du groupe' },
  { 'Affectation type': 'department',        'Description': 'Département cible — UUID du département' },
]);
wsAt['!cols'] = [{ wch: 22 }, { wch: 90 }];
styleHeader(wsAt);
XLSX.utils.book_append_sheet(wb, wsAt, 'ASSIGNMENT_TYPES');

// 7) ETATS_PAR_FLUX
const wsEtats = XLSX.utils.json_to_sheet(etatsParDefaut);
wsEtats['!cols'] = [{wch:40},{wch:42},{wch:18},{wch:24},{wch:34},{wch:8},{wch:14},{wch:12},{wch:24}];
styleHeader(wsEtats);
XLSX.utils.book_append_sheet(wb, wsEtats, 'ETATS_PAR_FLUX');

// 8) LISEZ-MOI
const wsHelp = XLSX.utils.aoa_to_sheet([
  ['🛠  Paramétrage en masse — Autres flux'],
  [],
  ['ONGLETS :'],
  ['  0. EXISTANT             — DUMP READ-ONLY de tous les flux configurés actuellement en DB (hors BE)'],
  ['                            32 lignes : COMPTABILITÉ, GESTION REGLEMENTAIRE, Innovation, ONBOARDING,'],
  ['                            QUALITÉ SECURITE ENVIRONNEMENT, SERVICE ACHAT, SERVICE MAINTENANCE,'],
  ['                            SERVICE MARKETING, SUPPORT IT/DIGITAL (avec ses 6 sous-processus)'],
  ['  0bis. TABLE_EFFECTS     — effets de bord sur tables métier (supplier_waiting_approval,'],
  ['                            suppliers, nc_declarations, nc_actions, inno_demandes, demande_materiel)'],
  ['                            → permet de voir quelles étapes déclenchent une INSERT/UPDATE sur quelle table'],
  ['  1. SERVICE_ACHAT        — étapes existantes du flux Achat (à compléter)'],
  ['  2. NOUVELLES_ETAPES     — saisie des étapes IT / RH / Comm / Maintenance / Logistique / Innovation'],
  ['  3. PROCESS_REFERENCE    — UUID des process à utiliser dans la colonne ID_processus'],
  ['  4. PROFILES_REFERENCE   — UUID des utilisateurs (pour Affectation cible (UUID) quand type=fixed_user/manager_dispatch)'],
  ['  5. DEPARTMENTS_REFERENCE— UUID des départements (pour Affectation cible (UUID) quand type=department)'],
  ['  6. GROUPS_REFERENCE     — UUID des groupes collaborateurs (pour Affectation cible (UUID) quand type=group)'],
  ['  7. ASSIGNMENT_TYPES     — cheat-sheet des 7 modes d\'affectation supportés'],
  ['  8. ETATS_PAR_FLUX       — liste des états par processus + colonne Catégorie macro'],
  [],
  ['⚠ AFFECTATION — 2 cas à distinguer :'],
  [''],
  ['  CAS A — toutes les étapes d\'un sous-processus → MÊME affectataire :'],
  ['     Remplis Affectation type/cible UNIQUEMENT sur la ligne N°=1.'],
  ['     → Je génère un sub_process_templates classique (affectation au niveau sous-processus).'],
  [''],
  ['  CAS B — chaque étape a un affectataire DIFFÉRENT (ex: Achat puis Comptabilité) :'],
  ['     Remplis Affectation type/cible sur CHAQUE ligne (N°=1, 2, 3…).'],
  ['     → Je génère un workflow state-machine (wf_workflows/wf_steps), comme le flux'],
  ['       « Demande de nouveau fournisseur » qui passe : Vérification (groupe Achat) →'],
  ['       Création (groupe Comptabilité) → Terminé.'],
  [''],
  ['  Pour les types « requester » et « manager_requester », laisse UUID vide.'],
  ['  Pour « fixed_user » / « manager_dispatch » : colle l\'UUID depuis PROFILES_REFERENCE.'],
  ['  Pour « department » : colle l\'UUID depuis DEPARTMENTS_REFERENCE.'],
  ['  Pour « group » : colle l\'UUID depuis GROUPS_REFERENCE.'],
  [],
  ['POUR SAISIR DES ÉTAPES SUR UN FLUX SANS ÉTAPES (ex: IT - Demande d\'intervention IT) :'],
  ['  1. Va sur PROCESS_REFERENCE → copie l\'ID_processus du flux concerné'],
  ['  2. Va sur NOUVELLES_ETAPES → colle l\'ID dans ID_processus + nom dans Processus'],
  ['  3. Définis ID_sous_processus (UUID que tu inventes, format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) +'],
  ['     Sous-processus (nom). Tu peux créer plusieurs sous-processus par flux.'],
  ['  4. Pour chaque sous-processus, ajoute autant de lignes que d\'étapes (N° 1, 2, 3…)'],
  ['  5. Sur la ligne N°=1 du sous-processus, renseigne les colonnes Affectation'],
  [],
  ['POUR DÉFINIR LES ÉTATS D\'UN FLUX :'],
  ['  → ETATS_PAR_FLUX : recopie le bloc des 7 lignes par flux, ajuste si besoin.'],
  ['  → Catégorie : SOUMIS | EN_COURS | EN_ATTENTE_VALIDATION | EN_ATTENTE_RETOUR_ADMIN | EN_ATTENTE_TRAVAUX | TERMINE'],
  [],
  ['QUAND C\'EST PRÊT :'],
  ['  Renvoie ce fichier à Claude — il génèrera :'],
  ['     • UPSERT sub_process_templates (assignment_type + target_*)'],
  ['     • INSERT task_templates (étapes + output_state_code)'],
  ['     • INSERT request_states (avec catégorie macro)'],
  ['  Backup automatique avant écriture, comme pour le BE.'],
]);
wsHelp['!cols'] = [{ wch: 115 }];
XLSX.utils.book_append_sheet(wb, wsHelp, 'LISEZ-MOI');

const out = join(__dirname, '..', 'AUTRES_FLUX_parametrage.xlsx');
XLSX.writeFile(wb, out);
console.log(`✅ Fichier autres flux : ${out}`);
console.log(`   Onglets : SERVICE_ACHAT (${achat.length}) + NOUVELLES_ETAPES (vide) + PROCESS_REFERENCE (${processRef.length}) + PROFILES_REFERENCE (${profiles.length}) + DEPARTMENTS_REFERENCE (${departments.length}) + GROUPS_REFERENCE (${groups.length}) + ETATS_PAR_FLUX (${etatsParDefaut.length})`);
