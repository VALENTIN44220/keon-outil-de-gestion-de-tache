export const PILIERS = [
  { code: '00', label: '00 · Process Interne', shortLabel: 'Process', icon: 'Settings2' },
  { code: '02', label: '02 · SPV',             shortLabel: 'SPV',     icon: 'Building2' },
  { code: '04', label: '04 · Foncier',          shortLabel: 'Foncier', icon: 'MapPin' },
  { code: '05', label: '05 · Gaz',              shortLabel: 'Gaz',     icon: 'Flame' },
  { code: '06', label: '06 · Gisement',         shortLabel: 'Gisement',icon: 'Leaf' },
  { code: '07', label: '07 · Digestat',         shortLabel: 'Digestat',icon: 'Recycle' },
] as const;

export type PilierCode = '00' | '02' | '04' | '05' | '06' | '07';

export type ChampType = 'text' | 'textarea' | 'select' | 'number' | 'percentage' | 'euros';

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
  { champ_id: '02_GEN_capital_social', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Capital social actuel de la SPV (€)', type: 'euros' },
  { champ_id: '02_GEN_president', pilier: '02', section: 'GENERALITES', sous_section: 'Données admin.', label: 'Nom du président', type: 'text' },
  { champ_id: '02_CAPI_keon_pct', pilier: '02', section: 'TABLE DE CAPI ET CCA', sous_section: 'Phase 2', label: 'Keon.co - KS (%)', type: 'percentage', note: 'Attention, le % peut évoluer — à gérer plus tard' },
  { champ_id: '02_GOV_majorite_simple', pilier: '02', section: 'GOUVERNANCE', sous_section: 'CODIR', label: 'Majorité simple du CODIR', type: 'text', note: 'Format X/X ou X%' },
  { champ_id: '02_GOV_majorite_qualifiee', pilier: '02', section: 'GOUVERNANCE', sous_section: 'CODIR', label: 'Majorité qualifiée du CODIR', type: 'text', note: 'Format X/X ou X%' },

  // PILIER 04 — FONCIER
  { champ_id: '04_GEN_pays', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Pays', type: 'text' },
  { champ_id: '04_GEN_region', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Région', type: 'text' },
  { champ_id: '04_GEN_departement_nom', pilier: '04', section: 'GENERALITES', sous_section: 'Localisation', label: 'Département — Nom', type: 'text', note: 'Si France : liste des départements. Sinon texte court.' },
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
