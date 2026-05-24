import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  BEDivaltoMouvement,
  BEDivaltoMouvementGrouped,
  BEDivaltoTypeMouv,
} from '@/types/beAffaire';

const sb = supabase as any;

/** TVA appliquee en fallback quand on n'a que la valeur TTC (compta) sans contrepartie gescom. */
const TVA_RATE = 0.20;

/**
 * Convertit une ligne brute de divalto_mouvements_all en forme BEDivaltoMouvement.
 *
 * Convention divalto_mouvements_all :
 *   - tiers_code ILIKE 'C%' (client/CA) : montant_ht stocké NÉGATIF → on negate
 *     pour que l'affichage reste positif (cohérent avec l'ancien be_divalto_mouvements).
 *   - tiers_code ILIKE 'F%' (fournisseur/COGS) : montant_ht déjà positif.
 *   - prefix : équivalent de type_mouv pour les affaires NASKEO (CCN, CFN, FCN, FFN…).
 */
function mapRowToMouvement(r: any): BEDivaltoMouvement {
  const isClient = (r.tiers_code as string | null)?.startsWith('C') ?? false;
  return {
    ...r,
    type_mouv: (r.prefix ?? '') as BEDivaltoTypeMouv,
    prefpino:   r.prefix ?? '',
    montant_tva: null,
    // Normalise : CA négatif → positif pour la cohérence d'affichage
    montant_ht: isClient ? -(r.montant_ht ?? 0) : (r.montant_ht ?? 0),
  } as BEDivaltoMouvement;
}

/**
 * Fusionne les lignes brutes par numero_piece :
 *   - source='gescom' apporte le HT réel + champs descriptifs prioritaires
 *   - source='compta' apporte le TTC, complète les champs descriptifs vides
 * Renseigne montant_ht (réel ou estimé depuis TTC).
 */
export function groupBEMouvementsByPiece(
  rows: BEDivaltoMouvement[],
): BEDivaltoMouvementGrouped[] {
  const map = new Map<string, BEDivaltoMouvementGrouped>();

  for (const row of rows) {
    const key = (row.numero_piece ?? '').trim();
    if (!key) continue;

    let g = map.get(key);
    if (!g) {
      g = {
        numero_piece: key,
        type_mouv:    row.type_mouv,
        prefpino:     row.prefpino,
        code_affaire: row.code_affaire,
        date_piece:   row.date_piece,
        tiers_code:   row.tiers_code,
        nom_tiers:    row.nom_tiers,
        libelle:      row.libelle,
        exercice:     row.exercice,
        montant_ht:       null,
        montant_ht_reel:  null,
        montant_ttc:      null,
        ht_estime:    false,
        has_gescom:   false,
        has_compta:   false,
      };
      map.set(key, g);
    }

    if (row.source === 'gescom') {
      g.has_gescom = true;
      g.montant_ht_reel = row.montant_ht ?? g.montant_ht_reel;
      g.libelle    = row.libelle    ?? g.libelle;
      g.tiers_code = row.tiers_code ?? g.tiers_code;
      g.nom_tiers  = row.nom_tiers  ?? g.nom_tiers;
      g.date_piece = row.date_piece ?? g.date_piece;
      g.exercice   = row.exercice   ?? g.exercice;
    } else if (row.source === 'compta') {
      g.has_compta = true;
      g.montant_ttc = row.montant_ht ?? g.montant_ttc;
      g.libelle    ??= row.libelle;
      g.tiers_code ??= row.tiers_code;
      g.nom_tiers  ??= row.nom_tiers;
      g.date_piece ??= row.date_piece;
      g.exercice   ??= row.exercice;
    }
  }

  for (const g of map.values()) {
    if (g.montant_ht_reel != null) {
      g.montant_ht = g.montant_ht_reel;
      g.ht_estime  = false;
    } else if (g.montant_ttc != null) {
      g.montant_ht = g.montant_ttc / (1 + TVA_RATE);
      g.ht_estime  = true;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const da = a.date_piece ?? '';
    const db = b.date_piece ?? '';
    if (da !== db) return da < db ? 1 : -1;
    return a.numero_piece.localeCompare(b.numero_piece);
  });
}

export interface UseBEDivaltoOptions {
  /** Filtre sur prefix (équivalent de type_mouv) ex: 'CCN', ['CCN','CFK']. */
  typeMouv?: BEDivaltoTypeMouv | BEDivaltoTypeMouv[];
  exercice?: number;
}

/**
 * Mouvements Divalto rattachés à une affaire (via code_affaire),
 * consolidés gescom/compta par pièce. Limite à 500 lignes brutes.
 * Source : divalto_mouvements_all (classification par code tiers C% client, F% fournisseur).
 */
export function useBEDivaltoMouvements(
  codeAffaire: string | null | undefined,
  options?: UseBEDivaltoOptions,
) {
  const typesKey = Array.isArray(options?.typeMouv)
    ? options?.typeMouv.join(',')
    : (options?.typeMouv ?? '');

  return useQuery({
    queryKey: ['be-divalto-mouvements', codeAffaire, typesKey, options?.exercice],
    queryFn: async (): Promise<BEDivaltoMouvementGrouped[]> => {
      if (!codeAffaire) return [];

      let q = sb
        .from('divalto_mouvements_all')
        .select('*')
        .eq('code_affaire', codeAffaire);

      if (options?.typeMouv) {
        // prefix = type_mouv pour les données NASKEO (CCN, CFN, FCN, FFN…)
        const types = Array.isArray(options.typeMouv) ? options.typeMouv : [options.typeMouv];
        q = q.in('prefix', types);
      }
      if (options?.exercice) {
        q = q.eq('exercice', options.exercice);
      }

      const { data, error } = await q.order('date_piece', { ascending: false }).limit(500);
      if (error) throw error;

      // Mappe les colonnes de divalto_mouvements_all vers BEDivaltoMouvement
      const rows = (data ?? []).map(mapRowToMouvement);
      return groupBEMouvementsByPiece(rows);
    },
    enabled: !!codeAffaire,
  });
}
