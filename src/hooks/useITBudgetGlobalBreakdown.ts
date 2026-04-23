import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITBudgetLine } from '@/types/itProject';

/**
 * Agrégation mensuelle globale et par fournisseur, pour l'écran Suivi
 * budgétaire IT. Croise les lignes budgétaires en scope avec les commandes
 * et factures Divalto liées.
 *
 * Principes :
 * - Budget mensuel : déduit de `budget_type` (mensuel = 12× le montant ;
 *   annuel = montant unique sur `mois_budget`).
 * - Commandé : HT des commandes Divalto ventilé sur `date_commande`.
 * - Facturé : HT consolidé (gescom, fallback TTC/1.20 sur compta seul)
 *   des factures Divalto ventilé sur `date_facture`.
 */

const TVA_RATE = 0.20;

export interface MonthlyRow {
  mois: number;
  budget: number;
  commande: number;
  facture: number;
}

export interface SupplierRow {
  tiers: string;
  nomfournisseur: string | null;
  budget: number;
  commande: number;
  facture: number;
  ecart: number;   // budget - facture (positif = économie, négatif = dépassement)
}

interface LineMin {
  id: string;
  fournisseur_prevu: string | null;
  budget_type: string | null;
  mois_budget: number | null;
  montant_budget: number | null;
  montant_budget_revise: number | null;
}

interface CommandeRaw {
  budget_line_id: string;
  it_divalto_commandes: {
    tiers: string | null;
    nomfournisseur: string | null;
    montant_ht: number | null;
    date_commande: string | null;
  } | null;
}

interface FactureRaw {
  budget_line_id: string;
  fullcdno_fac: string;
}

interface DivaltoFactureRaw {
  reference: string;
  source: string | null;
  tiers: string | null;
  nomfournisseur: string | null;
  montant_ht: number | null;
  date_facture: string | null;
}

/** Consolide les factures gescom/compta (dédup par reference) pour obtenir un HT exploitable. */
function consolideFactures(rows: DivaltoFactureRaw[]): Map<string, { tiers: string | null; nomfournisseur: string | null; montant_ht: number | null; date_facture: string | null }> {
  const map = new Map<string, { htReel: number | null; ttc: number | null; tiers: string | null; nomfournisseur: string | null; date_facture: string | null }>();
  for (const r of rows) {
    const key = (r.reference ?? '').trim();
    if (!key) continue;
    let g = map.get(key);
    if (!g) {
      g = { htReel: null, ttc: null, tiers: r.tiers, nomfournisseur: r.nomfournisseur, date_facture: r.date_facture };
      map.set(key, g);
    }
    const src = (r.source ?? '').toLowerCase();
    if (src === 'gescom') {
      g.htReel = r.montant_ht ?? g.htReel;
      g.tiers = r.tiers ?? g.tiers;
      g.nomfournisseur = r.nomfournisseur ?? g.nomfournisseur;
      g.date_facture = r.date_facture ?? g.date_facture;
    } else if (src === 'compta') {
      g.ttc = r.montant_ht ?? g.ttc;
      g.tiers ??= r.tiers;
      g.nomfournisseur ??= r.nomfournisseur;
      g.date_facture ??= r.date_facture;
    } else {
      g.htReel ??= r.montant_ht;
    }
  }
  const out = new Map<string, { tiers: string | null; nomfournisseur: string | null; montant_ht: number | null; date_facture: string | null }>();
  for (const [ref, g] of map.entries()) {
    const montant_ht = g.htReel != null ? g.htReel : (g.ttc != null ? g.ttc / (1 + TVA_RATE) : null);
    out.set(ref, { tiers: g.tiers, nomfournisseur: g.nomfournisseur, montant_ht, date_facture: g.date_facture });
  }
  return out;
}

export function useITBudgetGlobalBreakdown(lines: ITBudgetLine[]) {
  const lineIds = useMemo(() => lines.map((l) => l.id), [lines]);
  const lineIdsKey = lineIds.join(',');

  const commandesQuery = useQuery({
    queryKey: ['it-budget-global-commandes', lineIdsKey],
    queryFn: async () => {
      if (lineIds.length === 0) return [] as CommandeRaw[];
      const { data, error } = await supabase
        .from('it_budget_line_commandes')
        .select('budget_line_id, it_divalto_commandes(tiers, nomfournisseur, montant_ht, date_commande)')
        .in('budget_line_id', lineIds);
      if (error) throw error;
      return (data ?? []) as unknown as CommandeRaw[];
    },
    enabled: lineIds.length > 0,
  });

  const facturesQuery = useQuery({
    queryKey: ['it-budget-global-factures', lineIdsKey],
    queryFn: async () => {
      if (lineIds.length === 0) return { links: [] as FactureRaw[], consolide: new Map() };
      const { data: links, error: e1 } = await supabase
        .from('it_budget_line_factures')
        .select('budget_line_id, fullcdno_fac')
        .in('budget_line_id', lineIds);
      if (e1) throw e1;
      const refs = Array.from(new Set((links ?? []).map((l: { fullcdno_fac: string | null }) => l.fullcdno_fac).filter((v): v is string => !!v)));
      if (refs.length === 0) {
        return { links: (links ?? []) as unknown as FactureRaw[], consolide: new Map() };
      }
      const { data: rows, error: e2 } = await supabase
        .from('it_divalto_factures')
        .select('reference, source, tiers, nomfournisseur, montant_ht, date_facture')
        .in('reference', refs);
      if (e2) throw e2;
      return {
        links: (links ?? []) as unknown as FactureRaw[],
        consolide: consolideFactures((rows ?? []) as DivaltoFactureRaw[]),
      };
    },
    enabled: lineIds.length > 0,
  });

  /** Map budget_line_id → fournisseur_prevu (pour retomber sur un tiers quand la commande n'a pas le tiers renseigné). */
  const lineById = useMemo(() => {
    const m = new Map<string, LineMin>();
    for (const l of lines) {
      m.set(l.id, {
        id: l.id,
        fournisseur_prevu: l.fournisseur_prevu ?? null,
        budget_type: l.budget_type ?? null,
        mois_budget: l.mois_budget ?? null,
        montant_budget: l.montant_budget ?? null,
        montant_budget_revise: l.montant_budget_revise ?? null,
      });
    }
    return m;
  }, [lines]);

  // ── Ventilation mensuelle ─────────────────────────────────────────────
  const monthlyRows: MonthlyRow[] = useMemo(() => {
    const init: MonthlyRow[] = Array.from({ length: 12 }, (_, i) => ({
      mois: i + 1, budget: 0, commande: 0, facture: 0,
    }));

    for (const l of lines) {
      const montant = l.montant_budget_revise ?? l.montant_budget ?? 0;
      if (l.budget_type === 'mensuel') {
        for (let i = 0; i < 12; i++) init[i].budget += montant;
      } else if (l.budget_type === 'annuel' && l.mois_budget && l.mois_budget >= 1 && l.mois_budget <= 12) {
        init[l.mois_budget - 1].budget += montant;
      }
    }

    for (const c of commandesQuery.data ?? []) {
      const div = c.it_divalto_commandes;
      if (!div?.date_commande) continue;
      const m = new Date(div.date_commande).getMonth();
      if (m >= 0 && m < 12) init[m].commande += div.montant_ht ?? 0;
    }

    if (facturesQuery.data) {
      const { links, consolide } = facturesQuery.data;
      for (const link of links) {
        const f = consolide.get(link.fullcdno_fac);
        if (!f?.date_facture) continue;
        const m = new Date(f.date_facture).getMonth();
        if (m >= 0 && m < 12) init[m].facture += f.montant_ht ?? 0;
      }
    }

    return init;
  }, [lines, commandesQuery.data, facturesQuery.data]);

  // ── Vue par fournisseur ───────────────────────────────────────────────
  const supplierRows: SupplierRow[] = useMemo(() => {
    const map = new Map<string, SupplierRow>();
    const keyOf = (tiers: string | null, nom: string | null) => {
      const k = (tiers ?? '').trim() || (nom ?? '').trim() || '—';
      return k;
    };
    const getOrInit = (tiers: string | null, nom: string | null): SupplierRow => {
      const key = keyOf(tiers, nom);
      let s = map.get(key);
      if (!s) {
        s = { tiers: tiers ?? '—', nomfournisseur: nom, budget: 0, commande: 0, facture: 0, ecart: 0 };
        map.set(key, s);
      }
      return s;
    };

    // Budget : on utilise le fournisseur_prevu de la ligne
    for (const l of lines) {
      const tiers = l.fournisseur_prevu ?? null;
      if (!tiers) continue;
      const s = getOrInit(tiers, null);
      s.budget += l.montant_budget_revise ?? l.montant_budget ?? 0;
    }

    // Commandes : prend le tiers de la commande (fallback ligne si vide)
    for (const c of commandesQuery.data ?? []) {
      const div = c.it_divalto_commandes;
      if (!div) continue;
      const line = lineById.get(c.budget_line_id);
      const tiers = div.tiers ?? line?.fournisseur_prevu ?? null;
      const nom = div.nomfournisseur;
      if (!tiers && !nom) continue;
      const s = getOrInit(tiers, nom);
      if (!s.nomfournisseur && nom) s.nomfournisseur = nom;
      s.commande += div.montant_ht ?? 0;
    }

    // Factures : même logique via consolide
    if (facturesQuery.data) {
      const { links, consolide } = facturesQuery.data;
      for (const link of links) {
        const f = consolide.get(link.fullcdno_fac);
        if (!f) continue;
        const line = lineById.get(link.budget_line_id);
        const tiers = f.tiers ?? line?.fournisseur_prevu ?? null;
        if (!tiers && !f.nomfournisseur) continue;
        const s = getOrInit(tiers, f.nomfournisseur);
        if (!s.nomfournisseur && f.nomfournisseur) s.nomfournisseur = f.nomfournisseur;
        s.facture += f.montant_ht ?? 0;
      }
    }

    for (const s of map.values()) {
      s.ecart = s.budget - s.facture;
    }

    return Array.from(map.values()).sort((a, b) => b.budget - a.budget);
  }, [lines, commandesQuery.data, facturesQuery.data, lineById]);

  return {
    monthlyRows,
    supplierRows,
    isLoading: commandesQuery.isLoading || facturesQuery.isLoading,
  };
}
