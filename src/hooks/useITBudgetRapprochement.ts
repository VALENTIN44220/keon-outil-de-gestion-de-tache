import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** TVA appliquée en fallback quand seule la source `compta` (TTC) est disponible. */
const TVA_RATE = 0.20;

export interface DivaltoCommande {
  fullcdno: string;
  tiers: string | null;
  nomfournisseur: string | null;
  montant_ht: number | null;
  date_commande: string | null;
}

/**
 * Facture Divalto consolidée après dédup par `reference` :
 *   - gescom stocke le vrai HT dans `montant_ht`
 *   - compta stocke en fait le TTC dans la même colonne
 * On extrait les deux faces et on calcule un HT exploitable (réel ou estimé).
 */
export interface DivaltoFactureGrouped {
  reference: string;
  tiers: string | null;
  nomfournisseur: string | null;
  libelle: string | null;
  montant_ht_reel: number | null;
  montant_ttc: number | null;
  /** HT exploitable : réel si dispo, sinon ttc/(1+tva). null si aucune des deux. */
  montant_ht: number | null;
  ht_estime: boolean;
  date_facture: string | null;
  has_gescom: boolean;
  has_compta: boolean;
}

interface DivaltoFactureRaw {
  reference: string;
  source: string | null;
  tiers: string | null;
  nomfournisseur: string | null;
  libelle: string | null;
  montant_ht: number | null;
  date_facture: string | null;
}

/** Agrège les lignes brutes par `reference`, séparant gescom (HT réel) et compta (TTC). */
function groupFacturesByReference(rows: DivaltoFactureRaw[]): DivaltoFactureGrouped[] {
  const map = new Map<string, DivaltoFactureGrouped>();

  for (const row of rows) {
    const key = (row.reference ?? '').trim();
    if (!key) continue;

    let g = map.get(key);
    if (!g) {
      g = {
        reference: key,
        tiers: row.tiers,
        nomfournisseur: row.nomfournisseur,
        libelle: row.libelle,
        montant_ht_reel: null,
        montant_ttc: null,
        montant_ht: null,
        ht_estime: false,
        date_facture: row.date_facture,
        has_gescom: false,
        has_compta: false,
      };
      map.set(key, g);
    }

    const src = (row.source ?? '').toLowerCase();
    if (src === 'gescom') {
      g.has_gescom = true;
      g.montant_ht_reel = row.montant_ht ?? g.montant_ht_reel;
      g.libelle    = row.libelle    ?? g.libelle;
      g.tiers      = row.tiers      ?? g.tiers;
      g.nomfournisseur = row.nomfournisseur ?? g.nomfournisseur;
      g.date_facture   = row.date_facture   ?? g.date_facture;
    } else if (src === 'compta') {
      g.has_compta = true;
      g.montant_ttc = row.montant_ht ?? g.montant_ttc;
      g.libelle    ??= row.libelle;
      g.tiers      ??= row.tiers;
      g.nomfournisseur ??= row.nomfournisseur;
      g.date_facture   ??= row.date_facture;
    } else {
      g.montant_ht_reel ??= row.montant_ht;
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

  return Array.from(map.values());
}

/**
 * Rapprochement d'une ligne budget IT avec les pièces Divalto.
 * Source : divalto_mouvements_all (en remplacement de it_divalto_commandes/_factures).
 *
 * Les tables de liens (it_budget_line_commandes, it_budget_line_factures) sont conservées
 * pour stocker les associations ; seule la résolution des montants change de source.
 */
export function useITBudgetRapprochement(
  budgetLineId: string | null,
  fournisseurPrevu: string | null
) {
  const qc = useQueryClient();

  // ── Commandes liées ───────────────────────────────────────────────────────
  // 2 étapes : liens → lookup dans divalto_mouvements_all
  const commandesQuery = useQuery({
    queryKey: ['it-budget-commandes-liees', budgetLineId],
    queryFn: async () => {
      if (!budgetLineId) return [];

      // Étape 1 : liens
      const { data: linksData, error: e1 } = await supabase
        .from('it_budget_line_commandes')
        .select('id, budget_line_id, fullcdno, created_at')
        .eq('budget_line_id', budgetLineId);
      if (e1) throw e1;
      const links = (linksData ?? []) as { id: string; budget_line_id: string; fullcdno: string; created_at: string }[];

      const refs = Array.from(new Set(links.map(l => l.fullcdno).filter(Boolean)));
      if (refs.length === 0) {
        return links.map(l => ({ ...l, it_divalto_commandes: null }));
      }

      // Étape 2 : données Divalto (agrégat par pièce)
      const { data: divaltoData, error: e2 } = await (supabase as any)
        .from('divalto_mouvements_all')
        .select('numero_piece, tiers_code, nom_tiers, montant_ht, date_piece')
        .in('numero_piece', refs)
        .eq('doc_type', 'commande');
      if (e2) throw e2;

      const dMap = new Map<string, { fullcdno: string; tiers: string|null; nomfournisseur: string|null; montant_ht: number|null; date_commande: string|null }>();
      for (const d of divaltoData ?? []) {
        const existing = dMap.get(d.numero_piece);
        if (!existing) {
          dMap.set(d.numero_piece, { fullcdno: d.numero_piece, tiers: d.tiers_code, nomfournisseur: d.nom_tiers, montant_ht: d.montant_ht, date_commande: d.date_piece });
        } else {
          existing.montant_ht = (existing.montant_ht ?? 0) + (d.montant_ht ?? 0);
        }
      }

      return links.map(l => ({
        ...l,
        it_divalto_commandes: dMap.get(l.fullcdno) ?? null,
      }));
    },
    enabled: !!budgetLineId,
  });

  // ── Factures liées ────────────────────────────────────────────────────────
  const facturesQuery = useQuery({
    queryKey: ['it-budget-factures-liees', budgetLineId],
    queryFn: async () => {
      if (!budgetLineId) return { links: [], grouped: [] as DivaltoFactureGrouped[] };

      // Étape 1 : liens
      const { data: linksData, error: e1 } = await supabase
        .from('it_budget_line_factures')
        .select('id, budget_line_id, fullcdno_fac, created_at')
        .eq('budget_line_id', budgetLineId);
      if (e1) throw e1;
      const links = (linksData ?? []) as { id: string; budget_line_id: string; fullcdno_fac: string; created_at: string }[];

      const refs = Array.from(new Set(links.map(l => l.fullcdno_fac).filter(Boolean)));
      if (refs.length === 0) return { links, grouped: [] };

      // Étape 2 : données Divalto
      const { data: divaltoData, error: e2 } = await (supabase as any)
        .from('divalto_mouvements_all')
        .select('numero_piece, source, tiers_code, nom_tiers, libelle, montant_ht, date_piece')
        .in('numero_piece', refs)
        .eq('doc_type', 'facture');
      if (e2) throw e2;

      // Mappe au format DivaltoFactureRaw pour groupFacturesByReference
      const rawRows: DivaltoFactureRaw[] = (divaltoData ?? []).map((d: any) => ({
        reference:     d.numero_piece,
        source:        d.source,
        tiers:         d.tiers_code,
        nomfournisseur: d.nom_tiers,
        libelle:       d.libelle,
        montant_ht:    d.montant_ht,
        date_facture:  d.date_piece,
      }));

      return { links, grouped: groupFacturesByReference(rawRows) };
    },
    enabled: !!budgetLineId,
  });

  // ── Recherche : commandes disponibles dans Divalto ───────────────────────
  const searchCommandes = async (query: string): Promise<DivaltoCommande[]> => {
    let q = (supabase as any)
      .from('divalto_mouvements_all')
      .select('numero_piece, tiers_code, nom_tiers, montant_ht, date_piece')
      .eq('doc_type', 'commande')
      .order('date_piece', { ascending: false })
      .limit(100);   // 2× limit pour couvrir les doublons gescom/compta
    if (fournisseurPrevu) q = q.eq('tiers_code', fournisseurPrevu);
    if (query.trim())     q = q.ilike('numero_piece', `%${query.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;

    // Déduplique par numero_piece (cas multi-lignes) et mappe vers DivaltoCommande
    const seen = new Map<string, DivaltoCommande>();
    for (const d of data ?? []) {
      const existing = seen.get(d.numero_piece);
      if (!existing) {
        seen.set(d.numero_piece, {
          fullcdno:      d.numero_piece,
          tiers:         d.tiers_code,
          nomfournisseur: d.nom_tiers,
          montant_ht:    d.montant_ht,
          date_commande: d.date_piece,
        });
      } else {
        existing.montant_ht = (existing.montant_ht ?? 0) + (d.montant_ht ?? 0);
      }
    }
    return Array.from(seen.values()).slice(0, 50);
  };

  // ── Recherche : factures disponibles dans Divalto ────────────────────────
  const searchFactures = async (query: string): Promise<DivaltoFactureGrouped[]> => {
    let q = (supabase as any)
      .from('divalto_mouvements_all')
      .select('numero_piece, source, tiers_code, nom_tiers, libelle, montant_ht, date_piece')
      .eq('doc_type', 'facture')
      .order('date_piece', { ascending: false })
      .limit(200);
    if (fournisseurPrevu) q = q.eq('tiers_code', fournisseurPrevu);
    if (query.trim())     q = q.ilike('numero_piece', `%${query.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;

    const rawRows: DivaltoFactureRaw[] = (data ?? []).map((d: any) => ({
      reference:     d.numero_piece,
      source:        d.source,
      tiers:         d.tiers_code,
      nomfournisseur: d.nom_tiers,
      libelle:       d.libelle,
      montant_ht:    d.montant_ht,
      date_facture:  d.date_piece,
    }));
    const grouped = groupFacturesByReference(rawRows);
    grouped.sort((a, b) => {
      const da = a.date_facture ?? '';
      const db = b.date_facture ?? '';
      if (da !== db) return da < db ? 1 : -1;
      return a.reference.localeCompare(b.reference);
    });
    return grouped.slice(0, 50);
  };

  // ── Mutations link/unlink ─────────────────────────────────────────────────
  const lierCommande = useMutation({
    mutationFn: async (fullcdno: string) => {
      const { error } = await supabase
        .from('it_budget_line_commandes')
        .insert({ budget_line_id: budgetLineId!, fullcdno });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-budget-commandes-liees', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
    },
  });

  const delierCommande = useMutation({
    mutationFn: async (lienId: string) => {
      const { error } = await supabase.from('it_budget_line_commandes').delete().eq('id', lienId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-budget-commandes-liees', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
    },
  });

  const lierFacture = useMutation({
    mutationFn: async (fullcdno_fac: string) => {
      const { error } = await supabase
        .from('it_budget_line_factures')
        .insert({ budget_line_id: budgetLineId!, fullcdno_fac });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-budget-factures-liees', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
    },
  });

  const delierFacture = useMutation({
    mutationFn: async (lienId: string) => {
      const { error } = await supabase.from('it_budget_line_factures').delete().eq('id', lienId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['it-budget-factures-liees', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
    },
  });

  // ── Agrégats locaux ───────────────────────────────────────────────────────
  const engage = (commandesQuery.data ?? []).reduce((s: number, l: any) => {
    return s + ((l.it_divalto_commandes as any)?.montant_ht ?? 0);
  }, 0);

  const facturesData = facturesQuery.data ?? { links: [], grouped: [] as DivaltoFactureGrouped[] };
  const constate = facturesData.grouped.reduce((s, g) => s + (g.montant_ht ?? 0), 0);

  return {
    commandesLiees: commandesQuery.data ?? [],
    facturesLiees: facturesData.links,
    facturesLieesGrouped: facturesData.grouped,
    isLoading: commandesQuery.isLoading || facturesQuery.isLoading,
    searchCommandes,
    searchFactures,
    lierCommande,
    delierCommande,
    lierFacture,
    delierFacture,
    engage,
    constate,
  };
}
