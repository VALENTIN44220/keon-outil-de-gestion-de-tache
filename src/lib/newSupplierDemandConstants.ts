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
