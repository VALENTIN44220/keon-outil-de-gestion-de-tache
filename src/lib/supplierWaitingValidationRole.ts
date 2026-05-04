/** Aligné sur apply_supplier_waiting_validation (permission_profiles.name). */
export type SupplierWaitingValidationRole = 'achat' | 'compta' | 'hybrid' | 'other';

const HYBRID_PROFILE_NAMES = new Set([
  'achat et comptabilité',
  'comptabilité et achat',
  'achat & comptabilité',
  'comptabilité & achat',
  'achat / comptabilité',
  'comptabilité / achat',
]);

export function supplierWaitingValidationRoleFromProfileName(
  name: string | null | undefined,
): SupplierWaitingValidationRole {
  const v = (name ?? '').trim().toLowerCase();
  if (!v) return 'other';
  if (HYBRID_PROFILE_NAMES.has(v)) return 'hybrid';
  if (v === 'comptabilité') return 'compta';
  if (v === 'achat') return 'achat';
  return 'other';
}

/**
 * Extrait le nom du profil de permission depuis un objet profile.
 * Gère le cas où permission_profile est un objet OU un tableau (selon la config Supabase).
 */
export function extractPermissionProfileName(
  profile: { permission_profile?: unknown } | null | undefined,
): string {
  const pp = profile?.permission_profile;
  if (!pp) return '';
  // Supabase peut renvoyer un tableau (relation one-to-many) ou un objet (many-to-one)
  const obj = Array.isArray(pp) ? pp[0] : pp;
  if (!obj || typeof obj !== 'object') return '';
  return String((obj as Record<string, unknown>).name ?? '');
}
