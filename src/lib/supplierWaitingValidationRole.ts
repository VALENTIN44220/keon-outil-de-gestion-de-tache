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
