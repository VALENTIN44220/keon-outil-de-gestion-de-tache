import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SupplierStatus = "all" | "a_completer" | "en_cours" | "complet";

export interface SupplierFilters {
  search: string;
  status: SupplierStatus;
  entite: string;
  categorie: string;
  segment: string;
  sous_segment?: string;
  // Filtres de date (YYYY-MM-DD) sur les champs Supabase
  validitePrixFrom?: string;
  validitePrixTo?: string;
  validiteContratFrom?: string;
  validiteContratTo?: string;

  // Pagination
  page?: number;
  pageSize?: number;
}

export interface SupplierRow {
  id: string;
  tiers: string | null;
  nomfournisseur: string | null;
  categorie: string | null;
  famille: string | null;
  segment: string | null;
  sous_segment: string | null;
  entite: string | null;

  validite_prix: string | null;
  validite_du_contrat: string | null;

  completeness_score: number | null;
  status: "a_completer" | "en_cours" | "complet" | null;

  updated_at: string | null;
  created_at?: string | null;
}

export interface SupplierFilterOptions {
  entites: string[];
  categories: string[];
  segments: string[];
  sousSegments: string[];
}

const DEFAULT_PAGE_SIZE = 200;

function uniqSorted(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(values.map(v => (v ?? "").trim()).filter(v => v.length > 0))
  ).sort((a, b) => a.localeCompare(b));
}

export function useSupplierEnrichment(filters: SupplierFilters) {
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [filterOptions, setFilterOptions] = useState<SupplierFilterOptions>({
    entites: [],
    categories: [],
    segments: [],
    sousSegments: [],
  });

  const normalized = useMemo(() => {
    return {
      search: (filters.search ?? "").trim(),
      status: filters.status ?? "all",
      entite: filters.entite ?? "all",
      categorie: filters.categorie ?? "all",
      segment: filters.segment ?? "all",
      sous_segment: filters.sous_segment ?? "all",

      validitePrixFrom: filters.validitePrixFrom,
      validitePrixTo: filters.validitePrixTo,
      validiteContratFrom: filters.validiteContratFrom,
      validiteContratTo: filters.validiteContratTo,

      page,
      pageSize,
    };
  }, [filters, page, pageSize]);

  // Charge les options de filtres (distinct) une fois (ou rarement)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // On ne récupère que les colonnes nécessaires, sans pagination stricte,
        // car le but est uniquement de construire les listes de filtres.
        const { data, error } = await supabase
          .from("supplier_purchase_enrichment")
          .select("entite,categorie,segment,sous_segment");

        if (error) throw error;
        if (cancelled) return;

        setFilterOptions({
          entites: uniqSorted(data?.map(r => r.entite)),
          categories: uniqSorted(data?.map(r => r.categorie)),
          segments: uniqSorted(data?.map(r => r.segment)),
          sousSegments: uniqSorted(data?.map(r => r.sous_segment)),
        });
      } catch (e) {
        if (!cancelled) {
          setFilterOptions({ entites: [], categories: [], segments: [], sousSegments: [] });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Charge la liste paginée + filtrée
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        let q = supabase
          .from("supplier_purchase_enrichment")
          .select(
            "id,tiers,nomfournisseur,categorie,famille,segment,sous_segment,entite,validite_prix,validite_du_contrat,completeness_score,status,updated_at,created_at",
            { count: "exact" }
          );

        // Search multi-colonnes
        if (normalized.search) {
          const s = normalized.search.replace(/,/g, " ").trim();
          // ilike avec OR via .or()
          q = q.or(
            [
              `tiers.ilike.%${s}%`,
              `nomfournisseur.ilike.%${s}%`,
              `famille.ilike.%${s}%`,
              `segment.ilike.%${s}%`,
              `sous_segment.ilike.%${s}%`,
              `entite.ilike.%${s}%`,
              `categorie.ilike.%${s}%`,
            ].join(",")
          );
        }

        // Filtres simples
        if (normalized.status !== "all") q = q.eq("status", normalized.status);
        if (normalized.entite !== "all") q = q.eq("entite", normalized.entite);
        if (normalized.categorie !== "all") q = q.eq("categorie", normalized.categorie);
        if (normalized.segment !== "all") q = q.eq("segment", normalized.segment);
        if (normalized.sous_segment !== "all") q = q.eq("sous_segment", normalized.sous_segment);

        // Filtres date (strings YYYY-MM-DD dans Supabase)
        if (normalized.validitePrixFrom) q = q.gte("validite_prix", normalized.validitePrixFrom);
        if (normalized.validitePrixTo) q = q.lte("validite_prix", normalized.validitePrixTo);
        if (normalized.validiteContratFrom) q = q.gte("validite_du_contrat", normalized.validiteContratFrom);
        if (normalized.validiteContratTo) q = q.lte("validite_du_contrat", normalized.validiteContratTo);

        // Tri stable : updated_at desc, puis tiers
        q = q.order("updated_at", { ascending: false, nullsFirst: false }).order("tiers", { ascending: true });

        // Pagination 200 / page
        const from = (normalized.page - 1) * normalized.pageSize;
        const to = from + normalized.pageSize - 1;

        const { data, error, count } = await q.range(from, to);
        if (error) throw error;

        if (cancelled) return;
        setSuppliers((data as SupplierRow[]) ?? []);
        setTotal(count ?? 0);
      } catch (e) {
        if (!cancelled) {
          setSuppliers([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalized]);

  return {
    suppliers,
    total,
    page,
    pageSize,
    isLoading,
    filterOptions,
  };
}
