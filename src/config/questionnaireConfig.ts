export const PILIERS = [
  { code: '00', label: '00 · Process Interne', shortLabel: 'Process', icon: 'Settings2' },
  { code: '02', label: '02 · SPV',             shortLabel: 'SPV',     icon: 'Building2' },
  { code: '04', label: '04 · Foncier',          shortLabel: 'Foncier', icon: 'MapPin' },
  { code: '05', label: '05 · Gaz',              shortLabel: 'Gaz',     icon: 'Flame' },
  { code: '06', label: '06 · Gisement',         shortLabel: 'Gisement',icon: 'Leaf' },
  { code: '07', label: '07 · Digestat',         shortLabel: 'Digestat',icon: 'Recycle' },
] as const;

export type PilierCode = '00' | '02' | '04' | '05' | '06' | '07';

export type ChampType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'percentage'
  | 'euros'
  | 'spreadsheet';

export type EvaluationRisque = 'NA' | 'C' | 'PS' | 'NC' | 'OA' | 'PF';

export interface Question {
  champ_id: string;
  pilier: PilierCode;
  section: string;
  sous_section?: string;
  label: string;
  type: ChampType;
  options?: string[];
  note?: string;
  has_evaluation_risque?: boolean;
  required?: boolean;
}

export const QUESTIONS: Question[] = [
  // PILIER 00 — PROCESS INTERNE
  { champ_id: '00_GEN_typologie', pilier: '00', section: 'GENERALITES', label: 'Typologie de projet', type: 'select', options: ['GREENFIELD EARLY', 'GREENFIELD LATE', 'BROWNFIELD'] },
  { champ_id: '00_GEN_resp1', pilier: '00', section: 'GENERALITES', label: 'Responsable de projet 1', type: 'text', note: 'Liste des noms des salariés KEON' },
  { champ_id: '00_GEN_resp2', pilier: '00', section: 'GENERALITES', label: 'Responsable de projet 2', type: 'text', note: 'Liste des noms des salariés KEON' },
  { champ_id: '00_GEN_resp3', pilier: '00', section: 'GENERALITES', label: 'Responsable de projet 3', type: 'text', note: 'Liste des noms des salariés KEON' },
  { champ_id: '00_GEN_resp4', pilier: '00', section: 'GENERALITES', label: 'Responsable de projet 4', type: 'text', note: 'Liste des noms des salariés KEON' },
  { champ_id: '00_GEN_resp_actuel', pilier: '00', section: 'GENERALITES', label: 'Responsable de projet actuel', type: 'text', note: 'Liste des noms des salariés KEON' },

  // PILIER 02 — SPV
  { champ_id: '02_GEN_spv_cree', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'SPV créée ?', type: 'select', options: ['OUI', 'NON', 'EN COURS', 'EN ATTENTE', 'A LANCER', '?'] },
  { champ_id: '02_GEN_raison_sociale', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Raison sociale', type: 'text' },
  { champ_id: '02_GEN_statut_juridique', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Statut juridique', type: 'text' },
  { champ_id: '02_GEN_code_ape', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Code APE', type: 'text' },
  { champ_id: '02_GEN_siret', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Numéro de SIRET', type: 'text' },
  { champ_id: '02_GEN_rcs', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Numéro RCS', type: 'text' },
  { champ_id: '02_GEN_date_prev_creation', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Date prévisionnelle de création', type: 'text', note: 'Format AAAA-MM-JJ' },
  { champ_id: '02_GEN_date_creation', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Date de création', type: 'text', note: 'Format AAAA-MM-JJ' },
  { champ_id: '02_GEN_date_immatriculation', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: "Date d'immatriculation", type: 'text', note: 'Format AAAA-MM-JJ' },
  { champ_id: '02_GEN_capital_social', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Montant du capital social actuel (€)', type: 'euros' },
  { champ_id: '02_GEN_capital_social_closing', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Montant du capital social au moment du closing financier (€)', type: 'euros' },
  { champ_id: '02_GEN_nb_salaries', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Nombre de salariés', type: 'number' },
  { champ_id: '02_GEN_adresse_siege', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Adresse du siège social', type: 'textarea' },
  { champ_id: '02_GEN_etablissement_secondaire', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: "Présence d'un établissement secondaire", type: 'select', options: ['OUI', 'NON'] },
  { champ_id: '02_GEN_adresse_etab_secondaire', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: "Adresse de l'établissement secondaire", type: 'textarea' },
  { champ_id: '02_GEN_president', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Nom du président', type: 'text' },
  { champ_id: '02_GEN_president_mandate', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Nom du président mandaté', type: 'text' },

  // Capitalisation et apports en comptes courants
  { champ_id: '02_CAPI_nb_actions', pilier: '02', section: 'TABLE DE CAPI ET CCA', label: "Nombre d'actions", type: 'number' },
  { champ_id: '02_CAPI_valeur_action', pilier: '02', section: 'TABLE DE CAPI ET CCA', label: "Valeur d'une action (€/action)", type: 'euros' },
  { champ_id: '02_CAPI_montant_ks', pilier: '02', section: 'TABLE DE CAPI ET CCA', label: 'Montant du capital social (KS) en €', type: 'euros' },
  { champ_id: '02_CAPI_montant_cca_engages', pilier: '02', section: 'TABLE DE CAPI ET CCA', label: 'Montant de comptes courants (CCA) engagés (€)', type: 'euros' },
  { champ_id: '02_CAPI_keon_pct', pilier: '02', section: 'TABLE DE CAPI ET CCA', sous_section: 'Phase 2', label: 'Keon.co - KS (%)', type: 'percentage', note: 'Attention, le % peut évoluer — à gérer plus tard' },

  // Structuration gouvernance — CODIR
  { champ_id: '02_GOV_codir_frequence', pilier: '02', section: 'GOUVERNANCE', sous_section: 'CODIR', label: 'Fréquence CODIR', type: 'text' },
  { champ_id: '02_GOV_codir_delai_convocation', pilier: '02', section: 'GOUVERNANCE', sous_section: 'CODIR', label: "Délai d'envoi de la convocation avant CODIR", type: 'text' },
  { champ_id: '02_GOV_majorite_simple', pilier: '02', section: 'GOUVERNANCE', sous_section: 'CODIR', label: 'Majorité simple du CODIR', type: 'text', note: 'Format X/X ou X%' },
  { champ_id: '02_GOV_majorite_qualifiee', pilier: '02', section: 'GOUVERNANCE', sous_section: 'CODIR', label: 'Majorité qualifiée du CODIR', type: 'text', note: 'Format X/X ou X%' },
  { champ_id: '02_GOV_codir_quorum', pilier: '02', section: 'GOUVERNANCE', sous_section: 'CODIR', label: 'Quorum', type: 'text' },

  // Structuration gouvernance — AG
  { champ_id: '02_GOV_ag_frequence', pilier: '02', section: 'GOUVERNANCE', sous_section: 'AG', label: 'Fréquence AG', type: 'text' },
  { champ_id: '02_GOV_ag_delai_convocation', pilier: '02', section: 'GOUVERNANCE', sous_section: 'AG', label: "Délai d'envoi de la convocation avant AG", type: 'text' },
  { champ_id: '02_GOV_ag_majorite_simple', pilier: '02', section: 'GOUVERNANCE', sous_section: 'AG', label: "Majorité simple de l'AG", type: 'text', note: 'Format X/X ou X%' },
  { champ_id: '02_GOV_ag_majorite_qualifiee', pilier: '02', section: 'GOUVERNANCE', sous_section: 'AG', label: "Majorité qualifiée de l'AG", type: 'text', note: 'Format X/X ou X%' },
  { champ_id: '02_GOV_ag_quorum', pilier: '02', section: 'GOUVERNANCE', sous_section: 'AG', label: 'Quorum', type: 'text' },

  // Structuration juridique
  { champ_id: '02_JUR_statuts_grille_dispo', pilier: '02', section: 'STRUCTURATION JURIDIQUE', sous_section: 'Statuts', label: "Grille d'analyse des statuts disponible ?", type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_JUR_statuts_conformite', pilier: '02', section: 'STRUCTURATION JURIDIQUE', sous_section: 'Statuts', label: 'Conformité des statuts à la grille ?', type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_JUR_pacte_dispo', pilier: '02', section: 'STRUCTURATION JURIDIQUE', sous_section: "Pacte d'associés", label: "Pacte d'associés disponible ?", type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_JUR_pacte_conformite', pilier: '02', section: 'STRUCTURATION JURIDIQUE', sous_section: "Pacte d'associés", label: "Conformité du pacte d'associés à la grille ?", type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_JUR_cca_grille_dispo', pilier: '02', section: 'STRUCTURATION JURIDIQUE', sous_section: "Convention d'apports en CCA", label: "Grille d'analyse de la convention d'apports en CCA disponible ?", type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_JUR_cca_conformite', pilier: '02', section: 'STRUCTURATION JURIDIQUE', sous_section: "Convention d'apports en CCA", label: "Conformité de la convention d'apports en CCA à la grille ?", type: 'select', options: ['OUI', 'NON', 'NC'] },

  // Gestion administrative et financière
  { champ_id: '02_ADM_date_cloture_comptes', pilier: '02', section: 'GESTION ADMINISTRATIVE ET FINANCIERE', label: 'Date de clôture des comptes', type: 'text', note: 'Format AAAA-MM-JJ' },
  { champ_id: '02_ADM_societe_gestion', pilier: '02', section: 'GESTION ADMINISTRATIVE ET FINANCIERE', label: 'Société en charge de la gestion administrative et financière', type: 'text' },
  { champ_id: '02_ADM_cac_impose', pilier: '02', section: 'GESTION ADMINISTRATIVE ET FINANCIERE', label: 'Commissaire aux comptes imposé ?', type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_ADM_nom_cac', pilier: '02', section: 'GESTION ADMINISTRATIVE ET FINANCIERE', label: 'Nom du commissaire aux comptes', type: 'text' },
  { champ_id: '02_ADM_frequence_tva', pilier: '02', section: 'GESTION ADMINISTRATIVE ET FINANCIERE', label: 'Fréquence de déclaration de TVA ?', type: 'text' },

  // Gestion des ressources humaines
  { champ_id: '02_RH_nb_etp', pilier: '02', section: 'GESTION DES RESSOURCES HUMAINES', sous_section: 'Informations générales', label: "Nombre d'ETP", type: 'number' },
  { champ_id: '02_RH_recrutement_qui', pilier: '02', section: 'GESTION DES RESSOURCES HUMAINES', sous_section: 'Informations générales', label: 'Qui se charge du recrutement ?', type: 'text' },
  { champ_id: '02_RH_budget_recrutement', pilier: '02', section: 'GESTION DES RESSOURCES HUMAINES', sous_section: 'Informations générales', label: 'Budget recrutement ? (€HT)', type: 'euros' },
  { champ_id: '02_RH_table_recrutement_contrats', pilier: '02', section: 'GESTION DES RESSOURCES HUMAINES', sous_section: 'Recrutement et contrats de travail', label: 'Tableau recrutement et contrats de travail', type: 'spreadsheet' },
  { champ_id: '02_RH_table_formations', pilier: '02', section: 'GESTION DES RESSOURCES HUMAINES', sous_section: 'Formations', label: 'Tableau formations', type: 'spreadsheet' },
  { champ_id: '02_RH_table_vehicules_service', pilier: '02', section: 'GESTION DES RESSOURCES HUMAINES', sous_section: 'Véhicules de service', label: 'Tableau véhicules de service', type: 'spreadsheet' },

  // Gestion de l'IT
  { champ_id: '02_IT_logiciel_grille_dispo', pilier: '02', section: "GESTION DE L'IT", sous_section: "logiciel d'exploitation", label: "Grille d'analyse des statuts disponible ?", type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_IT_logiciel_conformite', pilier: '02', section: "GESTION DE L'IT", sous_section: "logiciel d'exploitation", label: 'Conformité des statuts à la grille ?', type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_IT_ext_grille_dispo', pilier: '02', section: "GESTION DE L'IT", sous_section: 'Tâches informatiques externalisées', label: "Grille d'analyse du pacte d'associés disponible ?", type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_IT_ext_conformite', pilier: '02', section: "GESTION DE L'IT", sous_section: 'Tâches informatiques externalisées', label: "Conformité du pacte d'associé à la grille ?", type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_IT_int_grille_dispo', pilier: '02', section: "GESTION DE L'IT", sous_section: 'Tâches informatiques internalisées', label: "Grille d'analyse de la convention d'apports en CCA disponible ?", type: 'select', options: ['OUI', 'NON', 'NC'] },
  { champ_id: '02_IT_int_conformite', pilier: '02', section: "GESTION DE L'IT", sous_section: 'Tâches informatiques internalisées', label: "Conformité de la convention d'apports en CCA à la grille ?", type: 'select', options: ['OUI', 'NON', 'NC'] },

  // PILIER 04 — FONCIER
  { champ_id: '04_GEN_pays', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Pays', type: 'text' },
  { champ_id: '04_GEN_region', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Région', type: 'text' },
  { champ_id: '04_GEN_departement_nom', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Département — Nom', type: 'text', note: 'Si France : liste des départements. Sinon titre / objet.' },
  { champ_id: '04_GEN_departement_num', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Département — N°', type: 'text' },
  { champ_id: '04_GEN_commune', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Commune', type: 'text' },
  { champ_id: '04_GEN_code_postal', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Code postal', type: 'text' },
  { champ_id: '04_GEN_type_foncier', pilier: '04', section: 'GENERALITES', sous_section: 'Type de foncier', label: 'Type de foncier', type: 'select', options: ['Agricole', 'Industriel', 'Autre'] },
  { champ_id: '04_GEN_surface_m2', pilier: '04', section: 'GENERALITES', sous_section: 'Parcelle entière', label: 'Surface totale de la parcelle (m²)', type: 'number' },
  { champ_id: '04_GEN_proprietaire_p1', pilier: '04', section: 'GENERALITES', sous_section: 'Parcelle 1', label: 'Propriétaire actuel (Parcelle 1)', type: 'text' },
  { champ_id: '04_URB_doc_urbanisme', pilier: '04', section: 'URBANISME', sous_section: 'Généralités', label: "Document d'urbanisme en vigueur en début de projet", type: 'select', options: ['PLU', 'RNU', 'Carte communale'] },
  { champ_id: '04_URB_zonage_debut', pilier: '04', section: 'URBANISME', sous_section: 'Généralités', label: 'Zonage en début de projet', type: 'text' },
  { champ_id: '04_URB_zonage_contraignant', pilier: '04', section: 'URBANISME', sous_section: 'Généralités', label: 'Zonage contraignant ?', type: 'text' },
  { champ_id: '04_SEC_p1_niv1_avancement', pilier: '04', section: 'SECURISATION', sous_section: 'Parcelle 1', label: 'Sécurisation niveau 1 : avancement', type: 'select', options: ['NC', 'A LANCER', 'A DEMARRER', 'EN COURS', 'EN ATTENTE', 'SIGNE', 'LOI SIGNEE', 'ACHETE'] },
  { champ_id: '04_SEC_p1_niv2_type', pilier: '04', section: 'SECURISATION', sous_section: 'Parcelle 1', label: 'Sécurisation niveau 2 : type', type: 'select', options: ['Compromis de vente', 'Promesse de bail', 'NC', 'EN COURS', 'LOI SIGNEE', 'ACHETE'] },
  { champ_id: '04_SEC_p2_niv2_type', pilier: '04', section: 'SECURISATION', sous_section: 'Parcelle 2', label: 'Sécurisation niveau 2 : type', type: 'select', options: ['Compromis de vente', 'Promesse de bail', 'NC', 'EN COURS', 'LOI SIGNEE', 'ACHETE'] },
  { champ_id: '04_SEC_p3_niv2_type', pilier: '04', section: 'SECURISATION', sous_section: 'Parcelle 3', label: 'Sécurisation niveau 2 : type', type: 'select', options: ['Compromis de vente', 'Promesse de bail', 'NC', 'EN COURS', 'LOI SIGNEE', 'ACHETE'] },

  // PILIER 05 — GAZ
  { champ_id: '05_GEN_cmax1', pilier: '05', section: 'GENERALITES', sous_section: 'Evolution Cmax', label: 'Cmax 1 (Nm³CH4/h)', type: 'number' },
  { champ_id: '05_GEN_cmax2', pilier: '05', section: 'GENERALITES', sous_section: 'Evolution Cmax', label: 'Cmax 2 (Nm³CH4/h)', type: 'number' },
  { champ_id: '05_GEN_cmax3', pilier: '05', section: 'GENERALITES', sous_section: 'Evolution Cmax', label: 'Cmax 3 (Nm³CH4/h)', type: 'number' },
  { champ_id: '05_GEN_gestionnaire_reseau', pilier: '05', section: 'GENERALITES', sous_section: "Réseau d'injection", label: 'Nom du gestionnaire de réseau', type: 'text', note: 'Ex : GRDF, GRT GAZ, Natran' },
  { champ_id: '05_INJ_etiage_pct', pilier: '05', section: 'INJECTION', sous_section: 'Etude détaillée', label: "% d'étiage / écrêtement (étude préalable)", type: 'percentage' },
  { champ_id: '05_CONTRAT_mecanisme1', pilier: '05', section: 'CONTRAT DE VENTE DE BIOMETHANE', sous_section: 'Mécanisme tarifaire', label: 'Type de mécanisme tarifaire privilégié (1er choix)', type: 'text', note: 'Ex : Tarif 2011, Tarif 2020, CPB, BPA' },
  { champ_id: '05_CONTRAT_mecanisme2', pilier: '05', section: 'CONTRAT DE VENTE DE BIOMETHANE', sous_section: 'Mécanisme tarifaire', label: 'Type de mécanisme tarifaire (2ème choix)', type: 'text' },
  { champ_id: '05_EVO_debit_max_injection', pilier: '05', section: 'EVOLUTIVITE', sous_section: 'Injection', label: "Débit maximal prévu par le débit d'injection (Nm³CH4/h)", type: 'number' },

  // PILIER 06 — GISEMENT
  { champ_id: '06_GEN_statut_agricole', pilier: '06', section: 'INFORMATIONS GENERALES', label: 'Statut agricole ?', type: 'select', options: ['Oui', 'Non', 'NC'], has_evaluation_risque: true },
  { champ_id: '06_GEN_quantite_totale', pilier: '06', section: 'INFORMATIONS GENERALES', label: 'Quantité totale de gisement (tMB/an)', type: 'number', note: "La quantité est-elle conforme à l'ICPE envisagée ?" },
  { champ_id: '06_GEN_pct_effluents', pilier: '06', section: 'INFORMATIONS GENERALES', label: "Dont % effluents d'élevage", type: 'percentage', note: 'Conforme au tarif et aux subventions envisagés ?' },
  { champ_id: '06_GEN_pct_cultures', pilier: '06', section: 'INFORMATIONS GENERALES', label: 'Dont % cultures', type: 'percentage', note: 'Si statut agricole : doit être > 50%' },
  { champ_id: '06_GEN_pct_dechets_iaa', pilier: '06', section: 'INFORMATIONS GENERALES', label: 'Dont % déchets IAA et biodéchets', type: 'percentage' },
  { champ_id: '06_GEN_pct_maitrise_actionnaires', pilier: '06', section: 'INFORMATIONS GENERALES', label: 'Dont % maîtrisés par les actionnaires', type: 'percentage' },
  { champ_id: '06_GEN_taux_sous_contrat', pilier: '06', section: 'INFORMATIONS GENERALES', label: 'Taux de productible biométhane sous contrat (%)', type: 'percentage' },
  { champ_id: '06_GEN_taux_sous_loi', pilier: '06', section: 'INFORMATIONS GENERALES', label: 'Taux de productible biométhane sous LOI (%)', type: 'percentage', has_evaluation_risque: true },

  // PILIER 07 — DIGESTAT
  { champ_id: '07_DIG_eligible_digagri', pilier: '07', section: "PLAN D'EPANDAGE", sous_section: 'DIGAGRI', label: 'Éligible au digagri ?', type: 'select', options: ['Oui', 'Non', 'NC'] },
  { champ_id: '07_DIG_plan_epandage_necessaire', pilier: '07', section: "PLAN D'EPANDAGE", sous_section: "PLAN D'EPANDAGE", label: "Plan d'épandage nécessaire ?", type: 'select', options: ['Oui', 'Non', 'NC'] },
  { champ_id: '07_DIG_surface_epandable', pilier: '07', section: "PLAN D'EPANDAGE", sous_section: "PLAN D'EPANDAGE", label: 'Surface épandable (ha)', type: 'number' },
];

export const OPTIONS_EVALUATION_RISQUE = ['NA', 'C', 'PS', 'NC', 'OA', 'PF'];

export function getSectionsByPilier(pilierCode: PilierCode) {
  const questions = QUESTIONS.filter(q => q.pilier === pilierCode);
  const sections = [...new Set(questions.map(q => q.section))];
  return sections.map(section => ({
    section,
    sousSections: [...new Set(questions.filter(q => q.section === section).map(q => q.sous_section).filter(Boolean))] as string[],
    questions: questions.filter(q => q.section === section),
  }));
}
