/**
 * Logique « régime ICPE » des jalons projet BE (partagée synthèse / fiche / import).
 *
 * Un projet suit UN régime ICPE (Déclaration / Enregistrement / Autorisation) ;
 * les jalons ICPE pertinents diffèrent selon le régime.
 */
export const ICPE_TYPES = ['icpe_depot', 'icpe_completude', 'icpe_arrete', 'icpe_purge'];

const ICPE_BY_REGIME: Record<string, string[]> = {
  declaration:    ['icpe_depot', 'icpe_completude', 'icpe_purge'],           // pas d'arrêté (récépissé)
  enregistrement: ['icpe_depot', 'icpe_completude', 'icpe_arrete', 'icpe_purge'],
  autorisation:   ['icpe_depot', 'icpe_arrete', 'icpe_purge'],               // enquête publique, pas de complétude
};

export function regimeKey(r: string | null): string | null {
  if (!r) return null;
  const s = r.toLowerCase();
  if (s.startsWith('déc') || s.startsWith('dec')) return 'declaration';
  if (s.startsWith('enreg')) return 'enregistrement';
  if (s.startsWith('autor')) return 'autorisation';
  return null;
}

/** Un type de jalon est-il pertinent pour ce projet (selon son régime ICPE) ? */
export function isApplicable(regime: string | null, typeCode: string): boolean {
  if (!ICPE_TYPES.includes(typeCode)) return true;       // non-ICPE : toujours applicable
  const key = regimeKey(regime);
  if (!key) return true;                                  // régime inconnu : tout applicable
  return ICPE_BY_REGIME[key].includes(typeCode);
}
