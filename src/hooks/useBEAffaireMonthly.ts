import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface BEAffaireMonthRow {
  /** YYYY-MM (ex: 2026-04). */
  mois: string;
  /** Date du 1er du mois (pour graphique). */
  date: string;
  ca_engage: number;
  ca_constate: number;
  cogs_engage: number;
  cogs_constate: number;
  ndf: number;
  marge_brute: number;
  marge_directe: number;
  jours: number;
  heures: number;
  cout_rh: number;
}

interface MouvRow {
  type_mouv: 'CCN' | 'CFN' | 'FCN' | 'FFN';
  date_piece: string | null;
  montant_ht: number | null;
}

interface SaisieRow {
  date_saisie: string;
  duree_heures: number;
  profiles?: { be_poste: string | null } | null;
}

interface NdfRow {
  date_depense: string;
  montant_ht: number | null;
}

interface TjmRow {
  poste: string;
  tjm: number;
}

/**
 * Aggregation MENSUELLE pour une affaire :
 *   CA / COGS / NDF / RH par mois sur la plage [dateFrom, dateTo].
 * Si dateFrom/dateTo NULL : tout l'historique.
 */
export function useBEAffaireMonthly(
  codeAffaire: string | null | undefined,
  dateFrom: string | null,
  dateTo: string | null,
) {
  return useQuery({
    queryKey: ['be-affaire-monthly', codeAffaire, dateFrom, dateTo],
    queryFn: async (): Promise<BEAffaireMonthRow[]> => {
      if (!codeAffaire) return [];

      // 1. Mouvements
      let mvQuery = sb
        .from('be_divalto_mouvements')
        .select('type_mouv,date_piece,montant_ht')
        .eq('code_affaire', codeAffaire)
        .not('date_piece', 'is', null);
      if (dateFrom) mvQuery = mvQuery.gte('date_piece', dateFrom);
      if (dateTo) mvQuery = mvQuery.lte('date_piece', dateTo);
      const { data: mvData, error: mvErr } = await mvQuery;
      if (mvErr) throw mvErr;

      // 2. Saisies temps + profile poste pour cout RH
      let stQuery = sb
        .from('lucca_saisie_temps')
        .select('date_saisie,duree_heures,profiles(be_poste)')
        .eq('code_site', codeAffaire);
      if (dateFrom) stQuery = stQuery.gte('date_saisie', dateFrom);
      if (dateTo) stQuery = stQuery.lte('date_saisie', dateTo);
      const { data: stData, error: stErr } = await stQuery;
      if (stErr) throw stErr;

      // 3. NDF Lucca filtrees par axe_1 = prefixe 5 chars du code_affaire
      const code5 = codeAffaire.length >= 5 ? codeAffaire.substring(0, 5) : codeAffaire;
      let ndfQuery = sb
        .from('lucca_notes_frais')
        .select('date_depense,montant_ht')
        .eq('axe_1', code5);
      if (dateFrom) ndfQuery = ndfQuery.gte('date_depense', dateFrom);
      if (dateTo) ndfQuery = ndfQuery.lte('date_depense', dateTo);
      const { data: ndfData } = await ndfQuery;

      // 4. TJM
      const { data: tjmData } = await sb.from('be_tjm_referentiel').select('poste,tjm');
      const tjmByPoste = new Map<string, number>();
      for (const t of (tjmData ?? []) as TjmRow[]) {
        tjmByPoste.set(t.poste, Number(t.tjm) || 0);
      }

      // Aggregation par mois
      const months = new Map<string, BEAffaireMonthRow>();
      const ensure = (mois: string): BEAffaireMonthRow => {
        let row = months.get(mois);
        if (!row) {
          row = {
            mois,
            date: `${mois}-01`,
            ca_engage: 0, ca_constate: 0,
            cogs_engage: 0, cogs_constate: 0,
            ndf: 0,
            marge_brute: 0, marge_directe: 0,
            jours: 0, heures: 0, cout_rh: 0,
          };
          months.set(mois, row);
        }
        return row;
      };

      // Mouvements
      for (const m of (mvData ?? []) as MouvRow[]) {
        if (!m.date_piece) continue;
        const mois = m.date_piece.slice(0, 7);
        const row = ensure(mois);
        const ht = m.montant_ht ?? 0;
        switch (m.type_mouv) {
          case 'CCN': row.ca_engage += ht; break;
          case 'FCN': row.ca_constate += ht; break;
          case 'CFN': row.cogs_engage += ht; break;
          case 'FFN': row.cogs_constate += ht; break;
        }
      }

      // NDF
      for (const n of (ndfData ?? []) as NdfRow[]) {
        if (!n.date_depense) continue;
        const mois = n.date_depense.slice(0, 7);
        const row = ensure(mois);
        row.ndf += Number(n.montant_ht) || 0;
      }

      // Saisies
      for (const s of (stData ?? []) as SaisieRow[]) {
        if (!s.date_saisie) continue;
        const mois = s.date_saisie.slice(0, 7);
        const row = ensure(mois);
        const h = Number(s.duree_heures) || 0;
        row.heures += h;
        row.jours += h / 8;
        const poste = s.profiles?.be_poste ?? null;
        const tjm = poste ? (tjmByPoste.get(poste) ?? 0) : 0;
        row.cout_rh += (h / 8) * tjm;
      }

      // Calcul des marges (avec NDF)
      for (const row of months.values()) {
        row.marge_brute = row.ca_constate - row.cogs_constate - row.ndf;
        row.marge_directe = row.marge_brute - row.cout_rh;
      }

      return Array.from(months.values()).sort((a, b) => a.mois.localeCompare(b.mois));
    },
    enabled: !!codeAffaire,
  });
}
