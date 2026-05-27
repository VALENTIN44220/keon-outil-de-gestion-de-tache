// ================================================
// BE Affaire Types — Module Suivi budget par affaire (Divalto)
// ================================================

export type BEAffaireStatus =
  | 'ouverte'
  | 'en_cours'
  | 'suspendue'
  | 'cloturee'
  | 'annulee';

export type BEAffaireSourceCreation = 'manuelle' | 'demande_be' | 'import';

export interface BEAffaire {
  id: string;
  be_project_id: string;
  /** Code analytique Divalto, ex: 'EDOLEAEX'. UNIQUE. */
  code_affaire: string;
  libelle: string | null;
  description: string | null;
  status: BEAffaireStatus;
  date_ouverture: string | null;
  date_cloture: string | null;
  source_creation: BEAffaireSourceCreation;
  /** FK molle vers tasks.id (renseigne quand l'affaire est creee depuis le flux de demandes BE - F1). */
  source_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BEBudgetLineStatut =
  | 'brouillon'
  | 'valide'
  | 'engage_partiel'
  | 'engage_total'
  | 'facture_partiel'
  | 'facture_total'
  | 'clos'
  | 'anomalie';

export interface BEAffaireBudgetLine {
  id: string;
  be_affaire_id: string;
  poste: string;
  fournisseur_prevu: string | null;
  description: string | null;
  montant_budget: number;
  montant_budget_revise: number | null;
  type_depense: string | null;
  exercice: number | null;
  statut: BEBudgetLineStatut;
  commentaire: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BEDivaltoTypeMouv = 'CCN' | 'CFK' | 'FCN' | 'FFK';
export type BEDivaltoSource = 'gescom' | 'compta';

/** Ligne brute lue depuis be_divalto_mouvements (1 row par numero_piece × source). */
export interface BEDivaltoMouvement {
  id: string;
  numero_piece: string;
  prefpino: string;
  type_mouv: BEDivaltoTypeMouv;
  source: BEDivaltoSource;
  axe_0001: string | null;
  axe_0002: string | null;
  /** Colonne GENERATED = axe_0001 || axe_0002. */
  code_affaire: string | null;
  date_piece: string | null;
  exercice: number | null;
  tiers_code: string | null;
  nom_tiers: string | null;
  libelle: string | null;
  compte_general: string | null;
  /** Pour source='gescom' : HT reel. Pour source='compta' : TTC. */
  montant_ht: number | null;
  montant_tva: number | null;
  devise: string;
  fabric_synced_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Mouvement Divalto consolide apres dedup par numero_piece :
 * fusion des entrees gescom (HT reel) et compta (TTC).
 */
export interface BEDivaltoMouvementGrouped {
  numero_piece: string;
  type_mouv: BEDivaltoTypeMouv;
  prefpino: string;
  code_affaire: string | null;
  date_piece: string | null;
  tiers_code: string | null;
  nom_tiers: string | null;
  libelle: string | null;
  exercice: number | null;
  /** HT exploitable : reel (gescom) si dispo, sinon TTC/(1+TVA). null si rien. */
  montant_ht: number | null;
  /** HT reel (gescom uniquement). */
  montant_ht_reel: number | null;
  /** TTC (compta uniquement). */
  montant_ttc: number | null;
  /** true si montant_ht est derive du TTC (pas de gescom dispo). */
  ht_estime: boolean;
  has_gescom: boolean;
  has_compta: boolean;
}

/** Vue v_be_affaire_budget_kpi (agregat par affaire). */
export interface BEAffaireBudgetKPI {
  be_affaire_id: string;
  be_project_id: string;
  code_affaire: string;
  affaire_libelle: string | null;
  affaire_status: BEAffaireStatus;
  /** CA client engage = commandes client signées (CC). */
  ca_engage_brut: number;
  /** CA client constate = factures client (FC). */
  ca_constate_brut: number;
  /** COGS fournisseur engage = commandes fournisseur (CF). */
  cogs_engage_brut: number;
  /** COGS fournisseur constate = factures fournisseur (FF). */
  cogs_constate_brut: number;
  /** Notes de frais. */
  ndf_brut: number;
  /** MB = CA constate - COGS constate (sans RH). */
  marge_constatee_brut: number;
  marge_brute_brut: number;
  /** MSCD = MB - RH declare (Lucca x TJM). */
  marge_directe_brut: number;
  cout_rh_declare: number;
  jours_declares: number;
  heures_declarees: number;
  nb_collaborateurs: number;
  engage_montant_brut: number;
  constate_montant_brut: number;
  nb_commandes: number;
  nb_factures: number;
  /** Devis client SANS commande liée = CA Potentiel. */
  devis_client_brut: number;
  /** Devis client déjà convertis en commande (info). */
  devis_client_converti_brut: number;
  devis_fournisseur_brut: number;
  nb_devis: number;
}

/** Vue v_be_project_budget_kpi (agregat par projet, somme des affaires). */
export interface BEProjectBudgetKPI {
  be_project_id: string;
  code_projet: string;
  nb_affaires: number;
  ca_engage_brut: number;
  ca_constate_brut: number;
  cogs_engage_brut: number;
  cogs_constate_brut: number;
  ndf_brut: number;
  marge_constatee_brut: number;
  marge_brute_brut: number;
  marge_directe_brut: number;
  engage_montant_brut: number;
  constate_montant_brut: number;
  nb_commandes: number;
  nb_factures: number;
}

// ================================================
// Configs UI
// ================================================

export const BE_AFFAIRE_STATUS_CONFIG: Record<
  BEAffaireStatus,
  { label: string; className: string }
> = {
  ouverte:   { label: 'Ouverte',   className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  en_cours:  { label: 'En cours',  className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  suspendue: { label: 'Suspendue', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  cloturee:  { label: 'Clôturée',  className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  annulee:   { label: 'Annulée',   className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

export const BE_BUDGET_LINE_STATUT_CONFIG: Record<
  BEBudgetLineStatut,
  { label: string; className: string }
> = {
  brouillon:       { label: 'Brouillon',        className: 'bg-slate-100 text-slate-600 border-slate-300' },
  valide:          { label: 'Validé',           className: 'bg-green-100 text-green-700 border-green-300' },
  engage_partiel:  { label: 'Engagé partiel',   className: 'bg-blue-100 text-blue-700 border-blue-300' },
  engage_total:    { label: 'Engagé total',     className: 'bg-blue-200 text-blue-800 border-blue-400' },
  facture_partiel: { label: 'Facturé partiel',  className: 'bg-violet-100 text-violet-700 border-violet-300' },
  facture_total:   { label: 'Facturé total',    className: 'bg-violet-200 text-violet-800 border-violet-400' },
  clos:            { label: 'Clos',             className: 'bg-gray-100 text-gray-500 border-gray-300' },
  anomalie:        { label: 'Anomalie',         className: 'bg-red-100 text-red-700 border-red-300' },
};

export const BE_DIVALTO_TYPE_MOUV_LABEL: Record<BEDivaltoTypeMouv, string> = {
  CCN: 'Commande (CCN)',
  CFK: 'Cmd. cadre (CFK)',
  FCN: 'Facture (FCN)',
  FFK: 'Fact. cadre (FFK)',
};

/**
 * Extrait le code projet (4 caracteres) du code_affaire.
 * Ex: 'EDOLEAEX' -> 'DOLE'. Indice UX uniquement (auto-suggestion projet
 * lors de la creation d'une affaire). Le rattachement reste explicite via
 * be_affaires.be_project_id.
 */
export function extractProjectCodeFromAffaire(
  codeAffaire: string | null | undefined,
): string | null {
  if (!codeAffaire || codeAffaire.length < 5) return null;
  return codeAffaire.substring(1, 5);
}

/**
 * Code activité = 3 dernières lettres du code_affaire
 * (ex: 'EDOLEAEX' -> 'AEX', 'XXXX-ETD' -> 'ETD'). Renvoie null si le code est
 * trop court. Sert à filtrer les affaires par type d'activité (EDT, PCU, …).
 */
export function extractActiviteFromAffaire(
  codeAffaire: string | null | undefined,
): string | null {
  if (!codeAffaire) return null;
  const c = codeAffaire.trim();
  if (c.length < 3) return null;
  return c.slice(-3).toUpperCase();
}

// ================================================
// Types pour le détail des pièces Divalto
// ================================================

export type BEPieceCategorie =
  | 'ca_potentiel'      // Devis client sans commande = CA prévisionnel
  | 'ca_vendu'          // Commande client signée (CC)
  | 'ca_constate'       // Facture client (FC)
  | 'cogs_prevu'        // Commande fournisseur (CF)
  | 'cogs_constate'     // Facture fournisseur (FF)
  | 'devis_fournisseur' // Devis fournisseur
  | 'autre';

export const BE_PIECE_CAT_LABEL: Record<BEPieceCategorie, string> = {
  ca_potentiel:      'Devis client (CA potentiel)',
  ca_vendu:          'Commande client (CA vendu)',
  ca_constate:       'Facture client (CA constaté)',
  cogs_prevu:        'Commande fournisseur (COGS prévu)',
  cogs_constate:     'Facture fournisseur (COGS constaté)',
  devis_fournisseur: 'Devis fournisseur',
  autre:             'Autre',
};

export const BE_PIECE_CAT_COLOR: Record<BEPieceCategorie, string> = {
  ca_potentiel:      'text-violet-600',
  ca_vendu:          'text-blue-600',
  ca_constate:       'text-blue-900',
  cogs_prevu:        'text-orange-500',
  cogs_constate:     'text-orange-800',
  devis_fournisseur: 'text-violet-400',
  autre:             'text-muted-foreground',
};

export const BE_PIECE_CAT_BG: Record<BEPieceCategorie, string> = {
  ca_potentiel:      'bg-violet-50 border-violet-200',
  ca_vendu:          'bg-blue-50 border-blue-200',
  ca_constate:       'bg-blue-100 border-blue-300',
  cogs_prevu:        'bg-orange-50 border-orange-200',
  cogs_constate:     'bg-orange-100 border-orange-300',
  devis_fournisseur: 'bg-violet-50 border-violet-100',
  autre:             'bg-muted border-border',
};

export interface BEAffairePiece {
  doc_type: string;
  numero_piece: string | null;
  prefix: string | null;
  tiers_code: string | null;
  nom_tiers: string | null;
  montant_ht: number;
  date_piece: string | null;
  libelle: string | null;
  libelle_entete: string | null;
  fullcdno_lie: string | null; // lien devis → commande
}

/** Catégorise une pièce BE + renvoie montant positif présentable. */
export function classifyBEPiece(p: BEAffairePiece): { categorie: BEPieceCategorie; montant: number } {
  const isClient      = (p.tiers_code ?? '').toUpperCase().startsWith('C');
  const isFournisseur = (p.tiers_code ?? '').toUpperCase().startsWith('F');
  const isFacture     = p.doc_type === 'facture';
  const isDevis       = p.doc_type === 'devis';
  const isCommande    = p.doc_type === 'commande';
  const hasLien       = p.fullcdno_lie && p.fullcdno_lie !== '';
  const montant = isClient ? -Number(p.montant_ht || 0) : Number(p.montant_ht || 0);

  let categorie: BEPieceCategorie = 'autre';
  if (isDevis) {
    if (isClient && !hasLien)   categorie = 'ca_potentiel';      // DC sans commande
    else if (isFournisseur)     categorie = 'devis_fournisseur';
    // devis client avec lien = déjà converti, on classe comme ca_vendu
    else if (isClient && hasLien) categorie = 'ca_vendu';
  } else if (isCommande) {
    categorie = isClient ? 'ca_vendu' : 'cogs_prevu';
  } else if (isFacture) {
    categorie = isClient ? 'ca_constate' : 'cogs_constate';
  }
  return { categorie, montant };
}
