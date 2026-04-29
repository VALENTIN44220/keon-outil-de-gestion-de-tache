// ================================================
// BE - Suivi Temps & RH par affaire (F3)
// ================================================

export type BEPoste =
  | 'charge_affaires'
  | 'developpeur'
  | 'ingenieur_etudes'
  | 'ingenieur_realisation'
  | 'projeteur'
  | 'autre';

export const BE_POSTES: BEPoste[] = [
  'charge_affaires',
  'ingenieur_etudes',
  'ingenieur_realisation',
  'projeteur',
  'developpeur',
  'autre',
];

export const BE_POSTE_LABEL: Record<BEPoste, string> = {
  charge_affaires:       'Chargé d\'affaires',
  ingenieur_etudes:      'Ingénieur études',
  ingenieur_realisation: 'Ingénieur réalisation',
  projeteur:             'Projeteur',
  developpeur:           'Développeur',
  autre:                 'Autre',
};

export const BE_POSTE_ICON: Record<BEPoste, string> = {
  charge_affaires:       '👤',
  ingenieur_etudes:      '📐',
  ingenieur_realisation: '🔧',
  projeteur:             '🖼️',
  developpeur:           '💻',
  autre:                 '👥',
};

export interface BEAffaireTempsBudget {
  id: string;
  be_affaire_id: string;
  poste: BEPoste;
  jours_budgetes: number;
  commentaire: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BETjmReferentiel {
  poste: BEPoste;
  tjm: number;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Vue v_be_affaire_temps_kpi (croisement budgete / planifie / declare). */
export interface BEAffaireTempsKPI {
  be_affaire_id: string;
  be_project_id: string;
  code_affaire: string;
  jours_budgetes: number;
  cout_rh_budgete: number;
  heures_planifiees: number;
  jours_planifies: number;
  cout_rh_planifie: number;
  heures_declarees: number;
  jours_declares: number;
  cout_rh_declare: number;
}
