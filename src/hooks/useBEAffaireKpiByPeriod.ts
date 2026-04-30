import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BEDivaltoTypeMouv } from '@/types/beAffaire';

const sb = supabase as any;

/** KPI affaire filtres sur une plage de dates (re-agregation cote client). */
export interface BEAffaireKpiPeriod {
  /** Code affaire (passe en input). */
  code_affaire: string;
  date_from: string | null;
  date_to: string | null;
  // Budget Divalto
  ca_engage: number;
  ca_constate: number;
  cogs_engage: number;
  cogs_constate: number;
  marge_brute: number;
  marge_directe: number;
  nb_commandes: number;
  nb_factures: number;
  // Temps & RH
  jours_declares: number;
  heures_declarees: number;
  cout_rh_declare: number;
  nb_collaborateurs: number;
}

interface MouvRow {
  type_mouv: BEDivaltoTypeMouv;
  numero_piece: string;
  montant_ht: number | null;
  date_piece: string | null;
}

interface SaisieRow {
  user_id: string | null;
  duree_heures: number;
  date_saisie: string;
  // Joined: profile.be_poste -> tjm
  profiles?: { be_poste: string | null } | null;
}

interface TjmRow {
  poste: string;
  tjm: number;
}

/**
 * Hook unifie KPI affaire avec filtre periode.
 * Si dateFrom/dateTo NULL : pas de filtre (tout l'historique).
 * Re-agrege raw data : be_divalto_mouvements + lucca_saisie_temps + be_tjm_referentiel.
 */
export function useBEAffaireKpiByPeriod(
  codeAffaire: string | null | undefined,
  dateFrom: string | null,
  dateTo: string | null,
) {
  return useQuery({
    queryKey: ['be-affaire-kpi-period', codeAffaire, dateFrom, dateTo],
    queryFn: async (): Promise<BEAffaireKpiPeriod> => {
      const empty: BEAffaireKpiPeriod = {
        code_affaire: codeAffaire ?? '',
        date_from: dateFrom,
        date_to: dateTo,
        ca_engage: 0,
        ca_constate: 0,
        cogs_engage: 0,
        cogs_constate: 0,
        marge_brute: 0,
        marge_directe: 0,
        nb_commandes: 0,
        nb_factures: 0,
        jours_declares: 0,
        heures_declarees: 0,
        cout_rh_declare: 0,
        nb_collaborateurs: 0,
      };
      if (!codeAffaire) return empty;

      // 1) Mouvements Divalto pour le code_affaire (filtre par date_piece)
      let mvQuery = sb
        .from('be_divalto_mouvements')
        .select('type_mouv,numero_piece,montant_ht,date_piece')
        .eq('code_affaire', codeAffaire);
      if (dateFrom) mvQuery = mvQuery.gte('date_piece', dateFrom);
      if (dateTo) mvQuery = mvQuery.lte('date_piece', dateTo);
      const { data: mvData, error: mvErr } = await mvQuery;
      if (mvErr) throw mvErr;

      const mouvs = (mvData ?? []) as MouvRow[];

      // 2) Saisies de temps pour le code_site = code_affaire (filtre par date_saisie)
      let stQuery = sb
        .from('lucca_saisie_temps')
        .select('user_id,duree_heures,date_saisie,profiles(be_poste)')
        .eq('code_site', codeAffaire);
      if (dateFrom) stQuery = stQuery.gte('date_saisie', dateFrom);
      if (dateTo) stQuery = stQuery.lte('date_saisie', dateTo);
      const { data: stData, error: stErr } = await stQuery;
      if (stErr) throw stErr;

      const saisies = (stData ?? []) as SaisieRow[];

      // 3) TJM referentiel
      const { data: tjmData } = await sb.from('be_tjm_referentiel').select('poste,tjm');
      const tjmByPoste = new Map<string, number>();
      for (const t of (tjmData ?? []) as TjmRow[]) {
        tjmByPoste.set(t.poste, Number(t.tjm) || 0);
      }

      // Aggregations Divalto
      let caEngage = 0, caConstate = 0, cogsEngage = 0, cogsConstate = 0;
      const numCommandes = new Set<string>();
      const numFactures = new Set<string>();
      for (const m of mouvs) {
        const ht = m.montant_ht ?? 0;
        if (m.type_mouv === 'CCN') { caEngage += ht; numCommandes.add(m.numero_piece); }
        else if (m.type_mouv === 'CFN') { cogsEngage += ht; numCommandes.add(m.numero_piece); }
        else if (m.type_mouv === 'FCN') { caConstate += ht; numFactures.add(m.numero_piece); }
        else if (m.type_mouv === 'FFN') { cogsConstate += ht; numFactures.add(m.numero_piece); }
      }
      const margeBrute = caConstate - cogsConstate;

      // Aggregations Lucca
      let heures = 0;
      let coutRh = 0;
      const collabs = new Set<string>();
      for (const s of saisies) {
        const h = Number(s.duree_heures) || 0;
        heures += h;
        if (s.user_id) collabs.add(s.user_id);
        const poste = s.profiles?.be_poste ?? null;
        const tjm = poste ? (tjmByPoste.get(poste) ?? 0) : 0;
        coutRh += (h / 8.0) * tjm;
      }
      const jours = heures / 8.0;

      return {
        code_affaire: codeAffaire,
        date_from: dateFrom,
        date_to: dateTo,
        ca_engage: caEngage,
        ca_constate: caConstate,
        cogs_engage: cogsEngage,
        cogs_constate: cogsConstate,
        marge_brute: margeBrute,
        marge_directe: margeBrute - coutRh,
        nb_commandes: numCommandes.size,
        nb_factures: numFactures.size,
        jours_declares: jours,
        heures_declarees: heures,
        cout_rh_declare: coutRh,
        nb_collaborateurs: collabs.size,
      };
    },
    enabled: !!codeAffaire,
  });
}
