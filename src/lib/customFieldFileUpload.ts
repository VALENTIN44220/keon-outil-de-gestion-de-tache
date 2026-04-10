/**
 * Pièces jointes des champs personnalisés type « fichier » : images, PDF, tableurs.
 * (Côté UI `accept` + validation `validateSingleField` — le serveur peut appliquer ses propres règles.)
 */

/** Valeur de l'attribut HTML `accept` pour le sélecteur de fichier. */
export const CUSTOM_FIELD_FILE_ACCEPT = [
  'image/*',
  'application/pdf',
  '.pdf',
  'text/csv',
  '.csv',
  'application/vnd.ms-excel',
  '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsx',
  'application/vnd.oasis.opendocument.spreadsheet',
  '.ods',
].join(',');

const SPREADSHEET_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/comma-separated-values',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
]);

const ALLOWED_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'heic',
  'tif',
  'tiff',
  'pdf',
  'csv',
  'xls',
  'xlsx',
  'ods',
]);

function fileExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

/** true si le fichier est une image, un PDF ou un tableur pris en charge (MIME et/ou extension). */
export function isCustomFieldUploadAllowed(file: File): boolean {
  const mime = (file.type || '').toLowerCase().trim();
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/pdf') return true;
  if (SPREADSHEET_MIMES.has(mime)) return true;

  return ALLOWED_EXT.has(fileExtension(file.name));
}

export const CUSTOM_FIELD_FILE_TYPE_HINT_FR =
  'Formats acceptés : images, PDF, tableurs (CSV, XLS, XLSX, ODS).';

export const CUSTOM_FIELD_FILE_TYPE_ERROR_FR =
  'Format non autorisé. Utilisez une image, un PDF ou un tableur (CSV, XLS, XLSX, ODS).';
