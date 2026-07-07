// ─── Types module EPI ─────────────────────────────────────────────────────────

export type EPICategorie = 'classique' | 'atex' | 'accessoire' | 'casque';
export type EPITypeFlocage = 'aucun' | 'broderie_coeur' | 'marquage_coeur';
export type EPIProfil =
  | 'non_concerne'
  | 'visite'
  | 'intervenant'
  | 'operation_non_atex'
  | 'encadrement_atex'
  | 'operationnel_atex';
export type EPITypeDemande = 'ponctuelle' | 'dotation_annuelle';
export type EPILigneStatut = 'en_attente' | 'validee' | 'commandee' | 'attribuee' | 'annulee';

export const EPI_PROFIL_LABELS: Record<EPIProfil, string> = {
  non_concerne: 'Non concerné',
  visite: 'Visite',
  intervenant: 'Intervenant',
  operation_non_atex: 'Opération Non ATEX',
  encadrement_atex: 'Encadrement ATEX',
  operationnel_atex: 'Opérationnel ATEX',
};

export const EPI_CATEGORIE_LABELS: Record<EPICategorie, string> = {
  classique: 'Classique',
  atex: 'ATEX',
  accessoire: 'Accessoire',
  casque: 'Casque',
};

export const EPI_TYPE_DEMANDE_LABELS: Record<EPITypeDemande, string> = {
  ponctuelle: 'Ponctuelle',
  dotation_annuelle: 'Dotation annuelle',
};

export const EPI_LIGNE_STATUT_LABELS: Record<EPILigneStatut, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  commandee: 'Commandée',
  attribuee: 'Attribuée',
  annulee: 'Annulée',
};

export const EPI_TAILLES = [
  'S-36', 'M-38', 'L-40', 'XL-42', 'XXL-44', 'XXXL-46', 'XXXXL-48-50', 'unique',
] as const;

export const EPI_PROFILS: EPIProfil[] = [
  'non_concerne', 'visite', 'intervenant',
  'operation_non_atex', 'encadrement_atex', 'operationnel_atex',
];

export const EPI_CATEGORIES: EPICategorie[] = ['classique', 'atex', 'accessoire', 'casque'];

// ─── Interfaces BDD ──────────────────────────────────────────────────────────

export interface EPIArticle {
  id: string;
  designation: string;
  categorie: EPICategorie;
  norme: string | null;
  caracteristiques: string | null;
  type_flocage: EPITypeFlocage;
  prix_flocage: number;
  frequence_renouvellement: string | null;
  image_url: string | null;
  fiche_technique_url: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface EPIArticleTaille {
  id: string;
  article_id: string;
  taille: string;
  ref_sycomore: string;
  article_divalto_id: string | null;
  prix_achat: number;
  is_active: boolean;
}

export interface EPIProfilArticle {
  id: string;
  profil: EPIProfil;
  article_id: string;
  dotation_multiplicateur: number;
  max_quantite: number;
}

export interface EPIDemandeLigne {
  id: string;
  request_id: string;
  article_id: string;
  taille_id: string;
  quantite: number;
  prix_unitaire: number;
  prix_flocage: number;
  statut: EPILigneStatut;
  created_at: string;
  updated_at: string;
}

export interface EPIAttribution {
  id: string;
  demande_ligne_id: string | null;
  beneficiaire_id: string;
  article_id: string;
  taille_id: string;
  quantite: number;
  date_attribution: string;
  campagne_annee: number | null;
  company_id: string | null;
  created_at: string;
}

// ─── Vue agrégée (epi_requests_overview) ─────────────────────────────────────

export interface EPIRequestLigne {
  id: string;
  article_id: string;
  designation: string;
  categorie: EPICategorie;
  taille: string;
  ref_sycomore: string;
  quantite: number;
  prix_unitaire: number;
  prix_flocage: number;
  statut: EPILigneStatut;
}

export interface EPIRequest {
  task_id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  requester_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  module_data: Record<string, any> | null;
  type_demande: EPITypeDemande | null;
  profil_epi: EPIProfil | null;
  campagne_annee: string | null;
  beneficiaire_nom: string | null;
  beneficiaire_prenom: string | null;
  filiale: string | null;
  lignes: EPIRequestLigne[];
  nb_lignes: number;
  montant_total: number;
}

// ─── Catalogue enrichi (article + tailles + éligibilité) ─────────────────────

export interface EPIArticleAvecTailles extends EPIArticle {
  tailles: EPIArticleTaille[];
}

export interface EPICatalogueItem extends EPIArticleAvecTailles {
  eligibilite: EPIProfilArticle | null;
}

// ─── Panier de sélection (formulaire de demande) ─────────────────────────────

export interface EPISelectionItem {
  article: EPIArticle;
  taille: EPIArticleTaille;
  quantite: number;
  eligibilite: EPIProfilArticle;
}
