export interface BEProject {
  id: string;
  code_projet: string;
  nom_projet: string;
  description: string | null;
  // Adresses
  adresse_site: string | null;
  adresse_societe: string | null;
  pays: string | null;
  pays_site: string | null;
  region: string | null;
  departement: string | null;
  // Identifiants externes
  code_divalto: string | null;
  siret: string | null;
  // Dates clés
  date_cloture_bancaire: string | null;
  date_cloture_juridique: string | null;
  date_os_etude: string | null;
  date_os_travaux: string | null;
  // Classification
  actionnariat: string | null;
  regime_icpe: string | null;
  typologie: string | null;
  // Équipe projet
  charge_affaires_id: string | null;
  developpeur_id: string | null;
  ingenieur_etudes_id: string | null;
  ingenieur_realisation_id: string | null;
  projeteur_id: string | null;
  // Métadonnées
  status: 'active' | 'closed' | 'on_hold';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BETaskLabel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export type ActionnariType = 'solo' | 'minoritaire' | 'majoritaire' | 'paritaire';
export type TypologieType = 'metha_agricole' | 'metha_territoriale' | 'autre';
export type ProjectStatus = 'active' | 'closed' | 'on_hold';
