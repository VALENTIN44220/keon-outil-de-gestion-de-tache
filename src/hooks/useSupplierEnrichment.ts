import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SupplierStatus = 'a_completer' | 'en_cours' | 'complet' | null;

export type SupplierFilters = {
  search: string;
  status: 'all' | 'a_completer' | 'en_cours' | 'complet';
  entite: string;      // 'all' ou valeur
  categorie: string;   // 'all' ou valeur
  segment: string;     // 'all' ou valeur
  sous_segment?: string; // 'all' ou valeur

  // format YYYY-MM-DD (input type="date")
  validite_prix_from?: string;
  validite_prix_to?: string;
  validite_contrat_from?: string;
  validite_contrat_to?: string;
};

export type SupplierRow = {
  id: string;
  tiers: string;
  nomfournisseur: string | null;
  categorie: string | null;
  famille: string | null;
  segment: string | null;
  sous_segment: string | null;
  entite: string | null;
  status: SupplierStatus;
  completeness_score: number | null;
  validite_prix: string | null;
  validite_du_contrat: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
  // + autres champs éventuels, gardés dynamiquement
  [k: string]: any;
};

type FilterOptions = {
  entites: string[];
  categories: string[];
  segments: string[];
  sous_segments: string[];
  stats?: {
    a_completer: number;
    en_cours: number;
    complet: number;
  };
};

function uniqSorted(arr: (string | null | undefined)[]) {
  return Array.from(
    new Set(arr.map(v => (v ?? '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'fr'));
}

function applySearch(q: any, search: string) {
  const s = (search || '').trim();
  if (!s) return q;

  // PostgREST: or=(col.ilike.*x*,col2.ilike.*x*)
  const pattern = `*${s.replace(/\*/g, '').replace(/,/g, ' ')}*`;
  return q.or(
    [
      `tiers.ilike.${pattern}`,
      `nomfournisseur.ilike.${pattern}`,
      `famille.ilike.${pattern}`,
      `segment.ilike.${pattern}`,
      `sous_segment.ilike.${pattern}`,
      `entite.ilike.${pattern}`,
      `categorie.ilike.${pattern}`,
    ].join(',')
  );
}

function applyFilters(q: any, f: SupplierFilters) {
  if (f.status && f.status !== 'all') q = q.eq('status', f.status);
  if (f.entite && f.entite !== 'all') q = q.eq('entite', f.entite);
  if (f.categorie && f.categorie !== 'all') q = q.eq('categorie', f.categorie);
  if (f.segment && f.segment !== 'all') q = q.eq('segment', f.segment);
  if (f.sous_segment && f.sous_segment !== 'all') q = q.eq('sous_segment', f.sous_segment);

  // dates (on compare en ISO, Supabase stocke souvent en date ou string ISO)
  if (f.validite_prix_from) q = q.gte('validite_prix', f.validite_prix_from);
  if (f.validite_prix_to) q = q.lte('validite_prix', f.validite_prix_to);

  if (f.validite_contrat_from) q = q.gte('validite_du_contrat', f.validite_contrat_from);
  if (f.validite_contrat_to) q = q.lte('validite_du_contrat', f.validite_contrat_to);

  return q;
}

export function useSupplierEnrichment(filters: SupplierFilters, page = 0, pageSize = 200) {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    entites: [],
    categories: [],
    segments: [],
    sous_segments: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const key = useMemo(() => JSON.stringify({ filters, page, pageSize }), [filters, page, pageSize]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);

      // 1) Liste paginée + total
      let q = supabase
        .from('supplier_purchase_enrichment')
        .select('*', { count: 'exact' });

      q = applySearch(q, filters.search);
      q = applyFilters(q, filters);

      // tri (adapter si besoin)
      q = q.order('tiers', { ascending: true });

      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (cancelled) return;

      if (error) {
        // en prod: toast
        console.error('useSupplierEnrichment list error', error);
        setSuppliers([]);
        setTotal(0);
      } else {
        setSuppliers((data as SupplierRow[]) ?? []);
        setTotal(count ?? 0);
      }

      // 2) Options de filtres (sur dataset filtré par search uniquement, pour rester cohérent)
      // Si tu veux options globales (toutes valeurs), retire applySearch/applyFilters ici.
      let qOpt = supabase
        .from('supplier_purchase_enrichment')
        .select('entite,categorie,segment,sous_segment,status', { count: 'exact' });

      qOpt = applySearch(qOpt, filters.search);
      // IMPORTANT: on ne filtre PAS par entité/catégorie/segment ici sinon les listes se vident
      // (on veut “toutes les catégories/segments disponibles”)
      // Donc on n'appelle pas applyFilters()

      const { data: optData, error: optErr } = await qOpt;
      if (cancelled) return;

      if (optErr) {
        console.error('useSupplierEnrichment options error', optErr);
        setFilterOptions(prev => ({ ...prev }));
      } else {
        const rows = (optData as any[]) ?? [];
        const entites = uniqSorted(rows.map(r => r.entite));
        const categories = uniqSorted(rows.map(r => r.categorie));
        const segments = uniqSorted(rows.map(r => r.segment));
        const sous_segments = uniqSorted(rows.map(r => r.sous_segment));

        const stats = {
          a_completer: rows.filter(r => r.status === 'a_completer').length,
          en_cours: rows.filter(r => r.status === 'en_cours').length,
          complet: rows.filter(r => r.status === 'complet').length,
        };

        setFilterOptions({ entites, categories, segments, sous_segments, stats });
      }

      setIsLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { suppliers, total, isLoading, filterOptions };
}

/**
 * ✅ FIX: export attendu par SupplierDetailDrawer.tsx
 */
export function useSupplierById(id: string | null) {
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!id) {
        setSupplier(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('supplier_purchase_enrichment')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;

      if (err) {
        console.error('useSupplierById error', err);
        setError(err);
        setSupplier(null);
      } else {
        setSupplier((data as SupplierRow) ?? null);
      }
      setIsLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { supplier, isLoading, error };
}
