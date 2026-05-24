import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  ndf: number;
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

/**
 * Ligne brute lue depuis divalto_mouvements_all.
 * Convention : tiers_code ILIKE 'C%' = client (CA, montant_ht stocké négatif).
 *              tiers_code ILIKE 'F%' = fournisseur (COGS, montant_ht positif).
 */
interface MouvRow {
  doc_type: 'commande' | 'facture';
  tiers_code: string | null;
  numero_piece: string;
  montant_ht: number | null;
  date_piece: string | null;
}

interface SaisieRow {
  user_id: string | null;
  duree_heures: number;
  date_saisie: string;
  profiles?: { be_poste: string | null } | null;
}

interface TjmRow {
  poste: string;
  tjm: number;
}

/**
 * Hook unifié KPI affaire avec filtre période.
 * Source : divalto_mouvements_all (classification par code tiers C% client, F% fournisseur).
 * Si dateFrom/dateTo NULL : pas de filtre (tout l'historique).
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
        ndf: 0,
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

      // 1) Mouvements Divalto (source unifiée) pour ce code_affaire
      let mvQuery = sb
        .from('divalto_mouvements_all')
        .select('doc_type,tiers_code,numero_piece,montant_ht,date_piece')
        .eq('code_affaire', codeAffaire);
      if (dateFrom) mvQuery = mvQuery.gte('date_piece', dateFrom);
      if (dateTo)   mvQuery = mvQuery.lte('date_piece', dateTo);
      const { data: mvData, error: mvErr } = await mvQuery;
      if (mvErr) throw mvErr;

      const mouvs = (mvData ?? []) as MouvRow[];

      // 2) Saisies de temps Lucca (filtre par date_saisie)
      let stQuery = sb
        .from('lucca_saisie_temps')
        .select('user_id,duree_heures,date_saisie,profiles(be_poste)')
        .eq('code_site', codeAffaire);
      if (dateFrom) stQuery = stQuery.gte('date_saisie', dateFrom);
      if (dateTo)   stQuery = stQuery.lte('date_saisie', dateTo);
      const { data: stData, error: stErr } = await stQuery;
      if (stErr) throw stErr;

      const saisies = (stData ?? []) as SaisieRow[];

      // 2bis) Notes de frais Lucca (axe_1 = préfixe 5 chars du code_affaire)
      const code5 = codeAffaire.length >= 5 ? codeAffaire.substring(0, 5) : codeAffaire;
      let ndfQuery = sb
        .from('lucca_notes_frais')
        .select('montant_ht,date_depense')
        .eq('axe_1', code5);
      if (dateFrom) ndfQuery = ndfQuery.gte('date_depense', dateFrom);
      if (dateTo)   ndfQuery = ndfQuery.lte('date_depense', dateTo);
      const { data: ndfData, error: ndfErr } = await ndfQuery;
      if (ndfErr) throw ndfErr;
      const ndfRows = (ndfData ?? []) as { montant_ht: number | null; date_depense: string }[];

      // 3) TJM référentiel
      const { data: tjmData } = await sb.from('be_tjm_referentiel').select('poste,tjm');
      const tjmByPoste = new Map<string, number>();
      for (const t of (tjmData ?? []) as TjmRow[]) {
        tjmByPoste.set(t.poste, Number(t.tjm) || 0);
      }

      // ── Agrégations Divalto ───────────────────────────────────────────────
      // Convention divalto_mouvements_all :
      //   client (C*) → montant_ht négatif → negate pour CA positif
      //   fournisseur (F*) → montant_ht positif
      let caEngage = 0, caConstate = 0, cogsEngage = 0, cogsConstate = 0;
      const numCommandes = new Set<string>();
      const numFactures  = new Set<string>();

      for (const m of mouvs) {
        const ht = m.montant_ht ?? 0;
        const isClient = m.tiers_code?.startsWith('C') ?? false;
        const isFourni = m.tiers_code?.startsWith('F') ?? false;

        if (m.doc_type === 'commande') {
          numCommandes.add(m.numero_piece);
          if (isClient) caEngage    += -ht;  // negate : stocké négatif
          if (isFourni) cogsEngage  +=  ht;
        } else if (m.doc_type === 'facture') {
          numFactures.add(m.numero_piece);
          if (isClient) caConstate  += -ht;
          if (isFourni) cogsConstate +=  ht;
        }
      }

      // NDF
      let ndfTotal = 0;
      for (const n of ndfRows) ndfTotal += Number(n.montant_ht) || 0;

      const margeBrute = caConstate - cogsConstate - ndfTotal;

      // ── Agrégations Lucca ─────────────────────────────────────────────────
      let heures = 0;
      let coutRh = 0;
      const collabs = new Set<string>();
      for (const s of saisies) {
        const h = Number(s.duree_heures) || 0;
        heures += h;
        if (s.user_id) collabs.add(s.user_id);
        const poste = s.profiles?.be_poste ?? null;
        const tjm   = poste ? (tjmByPoste.get(poste) ?? 0) : 0;
        coutRh += (h / 8.0) * tjm;
      }
      const jours = heures / 8.0;

      return {
        code_affaire: codeAffaire,
        date_from: dateFrom,
        date_to: dateTo,
        ca_engage:      caEngage,
        ca_constate:    caConstate,
        cogs_engage:    cogsEngage,
        cogs_constate:  cogsConstate,
        ndf:            ndfTotal,
        marge_brute:    margeBrute,
        marge_directe:  margeBrute - coutRh,
        nb_commandes:   numCommandes.size,
        nb_factures:    numFactures.size,
        jours_declares: jours,
        heures_declarees: heures,
        cout_rh_declare: coutRh,
        nb_collaborateurs: collabs.size,
      };
    },
    enabled: !!codeAffaire,
  });
}
