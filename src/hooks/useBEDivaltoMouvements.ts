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
 * Fusionne les lignes brutes par numero_piece :
 *   - source='gescom' apporte le HT reel + champs descriptifs prioritaires
 *   - source='compta' apporte le TTC, complete les champs descriptifs vides
 * Renseigne montant_ht (reel ou estime depuis TTC).
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
        type_mouv: row.type_mouv,
        prefpino: row.prefpino,
        code_affaire: row.code_affaire,
        date_piece: row.date_piece,
        tiers_code: row.tiers_code,
        nom_tiers: row.nom_tiers,
        libelle: row.libelle,
        exercice: row.exercice,
        montant_ht: null,
        montant_ht_reel: null,
        montant_ttc: null,
        ht_estime: false,
        has_gescom: false,
        has_compta: false,
      };
      map.set(key, g);
    }

    if (row.source === 'gescom') {
      g.has_gescom = true;
      g.montant_ht_reel = row.montant_ht ?? g.montant_ht_reel;
      g.libelle = row.libelle ?? g.libelle;
      g.tiers_code = row.tiers_code ?? g.tiers_code;
      g.nom_tiers = row.nom_tiers ?? g.nom_tiers;
      g.date_piece = row.date_piece ?? g.date_piece;
      g.exercice = row.exercice ?? g.exercice;
    } else if (row.source === 'compta') {
      g.has_compta = true;
      g.montant_ttc = row.montant_ht ?? g.montant_ttc;
      g.libelle ??= row.libelle;
      g.tiers_code ??= row.tiers_code;
      g.nom_tiers ??= row.nom_tiers;
      g.date_piece ??= row.date_piece;
      g.exercice ??= row.exercice;
    }
  }

  for (const g of map.values()) {
    if (g.montant_ht_reel != null) {
      g.montant_ht = g.montant_ht_reel;
      g.ht_estime = false;
    } else if (g.montant_ttc != null) {
      g.montant_ht = g.montant_ttc / (1 + TVA_RATE);
      g.ht_estime = true;
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
  typeMouv?: BEDivaltoTypeMouv | BEDivaltoTypeMouv[];
  exercice?: number;
}

/**
 * Mouvements Divalto rattaches a une affaire (via code_affaire),
 * consolides gescom/compta par piece. Limite a 500 lignes brutes
 * (~250 pieces apres dedup) -- ample pour une affaire BE.
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
        .from('be_divalto_mouvements')
        .select('*')
        .eq('code_affaire', codeAffaire);

      if (options?.typeMouv) {
        const types = Array.isArray(options.typeMouv) ? options.typeMouv : [options.typeMouv];
        q = q.in('type_mouv', types);
      }
      if (options?.exercice) {
        q = q.eq('exercice', options.exercice);
      }

      const { data, error } = await q.order('date_piece', { ascending: false }).limit(500);
      if (error) throw error;
      return groupBEMouvementsByPiece((data as BEDivaltoMouvement[]) ?? []);
    },
    enabled: !!codeAffaire,
  });
}
