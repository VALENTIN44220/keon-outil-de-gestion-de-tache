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
  engage_montant_brut: number;
  constate_montant_brut: number;
  nb_commandes: number;
  nb_factures: number;
}

/** Vue v_be_project_budget_kpi (agregat par projet, somme des affaires). */
export interface BEProjectBudgetKPI {
  be_project_id: string;
  code_projet: string;
  nb_affaires: number;
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
