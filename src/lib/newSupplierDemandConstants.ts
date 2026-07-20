/** Délai de paiement — aligné sur le référentiel fournisseurs (SupplierDetailDrawer). */
export const SUPPLIER_DELAIS_PAIEMENT = [
  '30 jours date de facture',
  '30 jours fdm',
  '45 jours fdm',
  '60 jours',
  'variable',
] as const;

/** Pays (libellés UI). */
export const SUPPLIER_DEMAND_PAYS: { value: string; label: string }[] = [
  { value: 'France', label: 'France' },
  { value: 'Allemagne', label: 'Allemagne' },
  { value: 'Belgique', label: 'Belgique' },
  { value: 'Espagne', label: 'Espagne' },
  { value: 'Italie', label: 'Italie' },
  { value: 'Pays-Bas', label: 'Pays-Bas' },
  { value: 'Royaume-Uni', label: 'Royaume-Uni' },
  { value: 'Suisse', label: 'Suisse' },
  { value: 'Luxembourg', label: 'Luxembourg' },
  { value: 'Autriche', label: 'Autriche' },
  { value: 'Pologne', label: 'Pologne' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Irlande', label: 'Irlande' },
  { value: 'Danemark', label: 'Danemark' },
  { value: 'Suède', label: 'Suède' },
  { value: 'Norvège', label: 'Norvège' },
  { value: 'Finlande', label: 'Finlande' },
  { value: 'États-Unis', label: 'États-Unis' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Maroc', label: 'Maroc' },
  { value: 'Tunisie', label: 'Tunisie' },
  { value: "Côte d'Ivoire", label: "Côte d'Ivoire" },
  { value: 'Sénégal', label: 'Sénégal' },
  { value: 'Chine', label: 'Chine' },
  { value: 'Inde', label: 'Inde' },
  { value: 'Japon', label: 'Japon' },
  { value: 'Brésil', label: 'Brésil' },
  { value: 'Mexique', label: 'Mexique' },
  { value: 'Australie', label: 'Australie' },
  { value: 'Autre', label: 'Autre' },
];

/**
 * Zone d'intervention géographique du fournisseur.
 * Le demandeur peut cocher plusieurs départements, ou choisir « National » / « Régional ».
 * Les deux options transverses sont placées en tête de liste pour un accès rapide.
 */
const FRENCH_DEPARTEMENTS: { code: string; name: string }[] = [
  { code: '01', name: 'Ain' },
  { code: '02', name: 'Aisne' },
  { code: '03', name: 'Allier' },
  { code: '04', name: 'Alpes-de-Haute-Provence' },
  { code: '05', name: 'Hautes-Alpes' },
  { code: '06', name: 'Alpes-Maritimes' },
  { code: '07', name: 'Ardèche' },
  { code: '08', name: 'Ardennes' },
  { code: '09', name: 'Ariège' },
  { code: '10', name: 'Aube' },
  { code: '11', name: 'Aude' },
  { code: '12', name: 'Aveyron' },
  { code: '13', name: 'Bouches-du-Rhône' },
  { code: '14', name: 'Calvados' },
  { code: '15', name: 'Cantal' },
  { code: '16', name: 'Charente' },
  { code: '17', name: 'Charente-Maritime' },
  { code: '18', name: 'Cher' },
  { code: '19', name: 'Corrèze' },
  { code: '2A', name: 'Corse-du-Sud' },
  { code: '2B', name: 'Haute-Corse' },
  { code: '21', name: "Côte-d'Or" },
  { code: '22', name: "Côtes-d'Armor" },
  { code: '23', name: 'Creuse' },
  { code: '24', name: 'Dordogne' },
  { code: '25', name: 'Doubs' },
  { code: '26', name: 'Drôme' },
  { code: '27', name: 'Eure' },
  { code: '28', name: 'Eure-et-Loir' },
  { code: '29', name: 'Finistère' },
  { code: '30', name: 'Gard' },
  { code: '31', name: 'Haute-Garonne' },
  { code: '32', name: 'Gers' },
  { code: '33', name: 'Gironde' },
  { code: '34', name: 'Hérault' },
  { code: '35', name: 'Ille-et-Vilaine' },
  { code: '36', name: 'Indre' },
  { code: '37', name: 'Indre-et-Loire' },
  { code: '38', name: 'Isère' },
  { code: '39', name: 'Jura' },
  { code: '40', name: 'Landes' },
  { code: '41', name: 'Loir-et-Cher' },
  { code: '42', name: 'Loire' },
  { code: '43', name: 'Haute-Loire' },
  { code: '44', name: 'Loire-Atlantique' },
  { code: '45', name: 'Loiret' },
  { code: '46', name: 'Lot' },
  { code: '47', name: 'Lot-et-Garonne' },
  { code: '48', name: 'Lozère' },
  { code: '49', name: 'Maine-et-Loire' },
  { code: '50', name: 'Manche' },
  { code: '51', name: 'Marne' },
  { code: '52', name: 'Haute-Marne' },
  { code: '53', name: 'Mayenne' },
  { code: '54', name: 'Meurthe-et-Moselle' },
  { code: '55', name: 'Meuse' },
  { code: '56', name: 'Morbihan' },
  { code: '57', name: 'Moselle' },
  { code: '58', name: 'Nièvre' },
  { code: '59', name: 'Nord' },
  { code: '60', name: 'Oise' },
  { code: '61', name: 'Orne' },
  { code: '62', name: 'Pas-de-Calais' },
  { code: '63', name: 'Puy-de-Dôme' },
  { code: '64', name: 'Pyrénées-Atlantiques' },
  { code: '65', name: 'Hautes-Pyrénées' },
  { code: '66', name: 'Pyrénées-Orientales' },
  { code: '67', name: 'Bas-Rhin' },
  { code: '68', name: 'Haut-Rhin' },
  { code: '69', name: 'Rhône' },
  { code: '70', name: 'Haute-Saône' },
  { code: '71', name: 'Saône-et-Loire' },
  { code: '72', name: 'Sarthe' },
  { code: '73', name: 'Savoie' },
  { code: '74', name: 'Haute-Savoie' },
  { code: '75', name: 'Paris' },
  { code: '76', name: 'Seine-Maritime' },
  { code: '77', name: 'Seine-et-Marne' },
  { code: '78', name: 'Yvelines' },
  { code: '79', name: 'Deux-Sèvres' },
  { code: '80', name: 'Somme' },
  { code: '81', name: 'Tarn' },
  { code: '82', name: 'Tarn-et-Garonne' },
  { code: '83', name: 'Var' },
  { code: '84', name: 'Vaucluse' },
  { code: '85', name: 'Vendée' },
  { code: '86', name: 'Vienne' },
  { code: '87', name: 'Haute-Vienne' },
  { code: '88', name: 'Vosges' },
  { code: '89', name: 'Yonne' },
  { code: '90', name: 'Territoire de Belfort' },
  { code: '91', name: 'Essonne' },
  { code: '92', name: 'Hauts-de-Seine' },
  { code: '93', name: 'Seine-Saint-Denis' },
  { code: '94', name: 'Val-de-Marne' },
  { code: '95', name: "Val-d'Oise" },
  { code: '971', name: 'Guadeloupe' },
  { code: '972', name: 'Martinique' },
  { code: '973', name: 'Guyane' },
  { code: '974', name: 'La Réunion' },
  { code: '976', name: 'Mayotte' },
];

export const SUPPLIER_ZONE_NATIONAL = 'National';
export const SUPPLIER_ZONE_REGIONAL = 'Régional';

export const SUPPLIER_ZONE_INTERVENTION_OPTIONS: { value: string; label: string }[] = [
  { value: SUPPLIER_ZONE_NATIONAL, label: 'National (tout le territoire)' },
  { value: SUPPLIER_ZONE_REGIONAL, label: 'Régional (plusieurs départements)' },
  ...FRENCH_DEPARTEMENTS.map((d) => ({
    value: `${d.code} — ${d.name}`,
    label: `${d.code} — ${d.name}`,
  })),
];

export const CONTACT_ROLE_OPTIONS = [
  'Direction',
  'Responsable achats',
  'Assistant administratif',
  'Comptabilité',
  'Commercial',
  'Autre',
] as const;

/** Types MIME + extensions acceptées (RIB, SIRET/Kbis). */
export const SUPPLIER_DEMAND_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet';

export const SUPPLIER_DEMAND_FILE_EXT_OK = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'pdf',
  'csv',
  'xls',
  'xlsx',
  'ods',
]);

export function isAllowedDemandAttachmentFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !SUPPLIER_DEMAND_FILE_EXT_OK.has(ext)) return false;
  return true;
}
