import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ITBudgetLine } from '@/types/itProject';
import { lineAnnualBudgetRevise } from '@/lib/itBudgetTotals';

/**
 * Agrégation mensuelle globale et par fournisseur, pour l'écran Suivi
 * budgétaire IT. Croise les lignes budgétaires en scope avec les commandes
 * et factures Divalto liées.
 *
 * Source : divalto_mouvements_all (en remplacement des anciennes tables
 * it_divalto_commandes / it_divalto_factures).
 * La résolution se fait en 2 étapes : (1) liens via it_budget_line_commandes/_factures,
 * (2) lookup des montants dans divalto_mouvements_all par numero_piece.
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
  ecart: number;
}

/** Références Divalto rattachées à une ligne budgétaire. */
export interface LineLinkedRefs {
  commandes: string[];
  factures: string[];
}

interface LineMin {
  id: string;
  fournisseur_prevu: string | null;
  budget_type: string | null;
  mois_budget: number | null;
  montant_budget: number | null;
  montant_budget_revise: number | null;
}

/** Lien table it_budget_line_commandes */
interface CommandeLink {
  budget_line_id: string;
  fullcdno: string;
}

/** Lien table it_budget_line_factures */
interface FactureLink {
  budget_line_id: string;
  fullcdno_fac: string;
}

/** Données Divalto résolues pour une commande (forme interne compatible avec CommandeRaw). */
interface CommandeRaw {
  budget_line_id: string;
  fullcdno: string;
  it_divalto_commandes: {
    tiers: string | null;
    nomfournisseur: string | null;
    montant_ht: number | null;
    date_commande: string | null;
  } | null;
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

  // ── Commandes : 2 étapes ─────────────────────────────────────────────────
  // Étape 1 : liens it_budget_line_commandes → fullcdno
  // Étape 2 : lookup dans divalto_mouvements_all par numero_piece
  const commandesQuery = useQuery({
    queryKey: ['it-budget-global-commandes', lineIdsKey],
    queryFn: async () => {
      if (lineIds.length === 0) return [] as CommandeRaw[];

      // Étape 1 : liens
      const { data: links, error: e1 } = await supabase
        .from('it_budget_line_commandes')
        .select('budget_line_id, fullcdno')
        .in('budget_line_id', lineIds);
      if (e1) throw e1;
      const linksArr = (links ?? []) as CommandeLink[];
      const refs = Array.from(new Set(linksArr.map(l => l.fullcdno).filter(Boolean)));
      if (refs.length === 0) {
        return linksArr.map(l => ({ budget_line_id: l.budget_line_id, fullcdno: l.fullcdno, it_divalto_commandes: null })) as CommandeRaw[];
      }

      // Étape 2 : données Divalto
      const { data: divaltoData, error: e2 } = await (supabase as any)
        .from('divalto_mouvements_all')
        .select('numero_piece, tiers_code, nom_tiers, montant_ht, date_piece')
        .in('numero_piece', refs)
        .eq('doc_type', 'commande');
      if (e2) throw e2;

      // Agrégat par pièce (somme multi-lignes éventuelles)
      const dMap = new Map<string, { tiers: string|null; nomfournisseur: string|null; montant_ht: number|null; date_commande: string|null }>();
      for (const d of divaltoData ?? []) {
        const existing = dMap.get(d.numero_piece);
        if (!existing) {
          dMap.set(d.numero_piece, { tiers: d.tiers_code, nomfournisseur: d.nom_tiers, montant_ht: d.montant_ht, date_commande: d.date_piece });
        } else {
          existing.montant_ht = (existing.montant_ht ?? 0) + (d.montant_ht ?? 0);
        }
      }

      return linksArr.map(l => ({
        budget_line_id: l.budget_line_id,
        fullcdno: l.fullcdno,
        it_divalto_commandes: dMap.get(l.fullcdno) ?? null,
      })) as CommandeRaw[];
    },
    enabled: lineIds.length > 0,
  });

  // ── Factures : 2 étapes ──────────────────────────────────────────────────
  const facturesQuery = useQuery({
    queryKey: ['it-budget-global-factures', lineIdsKey],
    queryFn: async () => {
      if (lineIds.length === 0) return { links: [] as FactureLink[], consolide: new Map() };

      // Étape 1 : liens
      const { data: linksData, error: e1 } = await supabase
        .from('it_budget_line_factures')
        .select('budget_line_id, fullcdno_fac')
        .in('budget_line_id', lineIds);
      if (e1) throw e1;
      const linksArr = (linksData ?? []) as FactureLink[];
      const refs = Array.from(new Set(linksArr.map(l => l.fullcdno_fac).filter(Boolean)));
      if (refs.length === 0) {
        return { links: linksArr, consolide: new Map() };
      }

      // Étape 2 : données Divalto
      const { data: divaltoData, error: e2 } = await (supabase as any)
        .from('divalto_mouvements_all')
        .select('numero_piece, source, tiers_code, nom_tiers, montant_ht, date_piece')
        .in('numero_piece', refs)
        .eq('doc_type', 'facture');
      if (e2) throw e2;

      // Mappe au format DivaltoFactureRaw pour consolideFactures
      const rawRows: DivaltoFactureRaw[] = (divaltoData ?? []).map((d: any) => ({
        reference:    d.numero_piece,
        source:       d.source,
        tiers:        d.tiers_code,
        nomfournisseur: d.nom_tiers,
        montant_ht:   d.montant_ht,
        date_facture: d.date_piece,
      }));

      return { links: linksArr, consolide: consolideFactures(rawRows) };
    },
    enabled: lineIds.length > 0,
  });

  /** Map budget_line_id → fournisseur_prevu */
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

  // ── Ventilation mensuelle ─────────────────────────────────────────────────
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

  // ── Vue par fournisseur ───────────────────────────────────────────────────
  const supplierRows: SupplierRow[] = useMemo(() => {
    const map = new Map<string, SupplierRow>();
    const keyOf = (tiers: string | null, nom: string | null) =>
      (tiers ?? '').trim() || (nom ?? '').trim() || '—';
    const getOrInit = (tiers: string | null, nom: string | null): SupplierRow => {
      const key = keyOf(tiers, nom);
      let s = map.get(key);
      if (!s) {
        s = { tiers: tiers ?? '—', nomfournisseur: nom, budget: 0, commande: 0, facture: 0, ecart: 0 };
        map.set(key, s);
      }
      return s;
    };

    for (const l of lines) {
      const tiers = l.fournisseur_prevu ?? null;
      if (!tiers) continue;
      const s = getOrInit(tiers, null);
      s.budget += lineAnnualBudgetRevise(l);
    }

    for (const c of commandesQuery.data ?? []) {
      const div = c.it_divalto_commandes;
      if (!div) continue;
      const line = lineById.get(c.budget_line_id);
      const tiers = div.tiers ?? line?.fournisseur_prevu ?? null;
      const nom   = div.nomfournisseur;
      if (!tiers && !nom) continue;
      const s = getOrInit(tiers, nom);
      if (!s.nomfournisseur && nom) s.nomfournisseur = nom;
      s.commande += div.montant_ht ?? 0;
    }

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

  // ── Mapping ligne → références Divalto liées ─────────────────────────────
  const linkedRefs: Map<string, LineLinkedRefs> = useMemo(() => {
    const map = new Map<string, LineLinkedRefs>();
    const getOrInit = (id: string): LineLinkedRefs => {
      let v = map.get(id);
      if (!v) { v = { commandes: [], factures: [] }; map.set(id, v); }
      return v;
    };
    for (const c of commandesQuery.data ?? []) {
      if (!c.fullcdno) continue;
      const v = getOrInit(c.budget_line_id);
      if (!v.commandes.includes(c.fullcdno)) v.commandes.push(c.fullcdno);
    }
    if (facturesQuery.data) {
      for (const link of facturesQuery.data.links) {
        if (!link.fullcdno_fac) continue;
        const v = getOrInit(link.budget_line_id);
        if (!v.factures.includes(link.fullcdno_fac)) v.factures.push(link.fullcdno_fac);
      }
    }
    return map;
  }, [commandesQuery.data, facturesQuery.data]);

  return {
    monthlyRows,
    supplierRows,
    linkedRefs,
    isLoading: commandesQuery.isLoading || facturesQuery.isLoading,
  };
}
