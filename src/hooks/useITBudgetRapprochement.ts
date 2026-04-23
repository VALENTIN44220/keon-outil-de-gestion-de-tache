import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** TVA appliquée en fallback quand on n'a que la valeur TTC (compta) sans contrepartie gescom. */
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
 * On extrait les deux faces et on calcule un HT exploitable (reel ou estimé).
 */
export interface DivaltoFactureGrouped {
  reference: string;
  tiers: string | null;
  nomfournisseur: string | null;
  libelle: string | null;
  montant_ht_reel: number | null;   // gescom uniquement
  montant_ttc: number | null;       // compta uniquement
  /** HT exploitable : reel si dispo, sinon ttc/(1+tva). null si aucune des deux. */
  montant_ht: number | null;
  ht_estime: boolean;               // true si dérivé du TTC (pas de gescom)
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

/**
 * Agrège les lignes brutes de `it_divalto_factures` : une ligne par `reference`
 * avec HT (gescom) et TTC (compta) séparés.
 */
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
      // Privilégier les infos gescom (libellé souvent plus descriptif côté engagement)
      g.libelle = row.libelle ?? g.libelle;
      g.tiers = row.tiers ?? g.tiers;
      g.nomfournisseur = row.nomfournisseur ?? g.nomfournisseur;
      g.date_facture = row.date_facture ?? g.date_facture;
    } else if (src === 'compta') {
      g.has_compta = true;
      g.montant_ttc = row.montant_ht ?? g.montant_ttc;
      // Ne remplace les champs descriptifs que s'ils sont encore vides
      g.libelle ??= row.libelle;
      g.tiers ??= row.tiers;
      g.nomfournisseur ??= row.nomfournisseur;
      g.date_facture ??= row.date_facture;
    } else {
      // source inconnue : on la traite comme gescom (valeur brute = HT)
      g.montant_ht_reel ??= row.montant_ht;
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

  return Array.from(map.values());
}

export function useITBudgetRapprochement(
  budgetLineId: string | null,
  fournisseurPrevu: string | null
) {
  const qc = useQueryClient();

  const commandesQuery = useQuery({
    queryKey: ['it-budget-commandes-liees', budgetLineId],
    queryFn: async () => {
      if (!budgetLineId) return [];
      const { data, error } = await supabase
        .from('it_budget_line_commandes')
        .select('id, budget_line_id, fullcdno, created_at, it_divalto_commandes(fullcdno, tiers, nomfournisseur, montant_ht, date_commande)')
        .eq('budget_line_id', budgetLineId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!budgetLineId,
  });

  /**
   * Factures liées : on récupère d'abord les liens, puis les lignes divalto
   * correspondantes (toutes sources confondues), qu'on agrège pour avoir HT
   * réel + TTC par référence.
   */
  const facturesQuery = useQuery({
    queryKey: ['it-budget-factures-liees', budgetLineId],
    queryFn: async () => {
      if (!budgetLineId) return { links: [], grouped: [] as DivaltoFactureGrouped[] };
      const { data: links, error: e1 } = await supabase
        .from('it_budget_line_factures')
        .select('id, budget_line_id, fullcdno_fac, created_at')
        .eq('budget_line_id', budgetLineId);
      if (e1) throw e1;

      const refs = Array.from(
        new Set(
          ((links ?? []) as { fullcdno_fac: string | null }[])
            .map((l) => l.fullcdno_fac)
            .filter((v): v is string => !!v)
        )
      );
      if (refs.length === 0) return { links: links ?? [], grouped: [] };

      const { data: rows, error: e2 } = await supabase
        .from('it_divalto_factures')
        .select('reference, source, tiers, nomfournisseur, libelle, montant_ht, date_facture')
        .in('reference', refs);
      if (e2) throw e2;

      return {
        links: links ?? [],
        grouped: groupFacturesByReference((rows ?? []) as DivaltoFactureRaw[]),
      };
    },
    enabled: !!budgetLineId,
  });

  const searchCommandes = async (query: string): Promise<DivaltoCommande[]> => {
    let q = supabase
      .from('it_divalto_commandes')
      .select('fullcdno, tiers, nomfournisseur, montant_ht, date_commande')
      .order('date_commande', { ascending: false })
      .limit(50);
    if (fournisseurPrevu) q = q.eq('tiers', fournisseurPrevu);
    if (query.trim()) q = q.ilike('fullcdno', `%${query.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as DivaltoCommande[];
  };

  const searchFactures = async (query: string): Promise<DivaltoFactureGrouped[]> => {
    // On récupère TOUTES les sources puis on agrège : un FFK = 1 entrée affichée
    let q = supabase
      .from('it_divalto_factures')
      .select('reference, source, tiers, nomfournisseur, libelle, montant_ht, date_facture')
      .order('date_facture', { ascending: false })
      .limit(200); // marge pour couvrir la dédup (jusqu'à 100 FFK uniques)
    if (fournisseurPrevu) q = q.eq('tiers', fournisseurPrevu);
    if (query.trim()) q = q.ilike('reference', `%${query.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    const grouped = groupFacturesByReference((data ?? []) as DivaltoFactureRaw[]);
    // Trier par date desc puis par référence
    grouped.sort((a, b) => {
      const da = a.date_facture ?? '';
      const db = b.date_facture ?? '';
      if (da !== db) return da < db ? 1 : -1;
      return a.reference.localeCompare(b.reference);
    });
    return grouped.slice(0, 50);
  };

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
