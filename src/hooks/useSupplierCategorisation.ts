// src/hooks/useSupplierCategorisation.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SupplierCategorie = string;
export type SupplierFamille = string;

type CategoryRow = {
  categorie: string | null;
  famille: string | null;
  active: boolean | null;
};

export function useSupplierCategories() {
  return useQuery({
    queryKey: ["categories_ref", "categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("supplier_categorisation")
        .select("categorie,active")
        .eq("active", true);

      if (error) throw error;

      const uniq = Array.from(
        new Set(
          (data ?? [])
            .map((r: any) => (r.categorie ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a: string, b: string) => a.localeCompare(b, "fr"));

      return uniq as SupplierCategorie[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Toutes les paires (categorie, famille) actives, pour le navigateur tabulaire.
 */
export function useSupplierCategorisationRows() {
  return useQuery({
    queryKey: ["categories_ref", "rows_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("supplier_categorisation")
        .select("categorie,famille,active")
        .eq("active", true);
      if (error) throw error;
      const rows = (data ?? [])
        .map((r: any) => ({
          categorie: (r.categorie ?? "").trim(),
          famille: (r.famille ?? "").trim(),
        }))
        .filter((r: { categorie: string; famille: string }) => r.categorie && r.famille);
      // Dedup
      const seen = new Set<string>();
      const out: Array<{ categorie: string; famille: string }> = [];
      for (const r of rows) {
        const key = `${r.categorie}::${r.famille}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(r);
      }
      out.sort((a, b) => a.categorie.localeCompare(b.categorie, "fr") || a.famille.localeCompare(b.famille, "fr"));
      return out;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Familles actives (toutes catégories), pour sélecteurs sans filtre catégorie. */
export function useSupplierFamillesAll() {
  return useQuery({
    queryKey: ["categories_ref", "familles_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("supplier_categorisation")
        .select("famille,active")
        .eq("active", true);

      if (error) throw error;

      const uniq = Array.from(
        new Set(
          (data ?? [])
            .map((r: any) => (r.famille ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a: string, b: string) => a.localeCompare(b, "fr"));

      return uniq as SupplierFamille[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useSupplierFamillesByCategorie(categorie?: string | null) {
  return useQuery({
    queryKey: ["categories_ref", "familles", categorie ?? ""],
    enabled: !!categorie && categorie !== "all",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("supplier_categorisation")
        .select("famille,active,categorie")
        .eq("active", true)
        .eq("categorie", categorie as string);

      if (error) throw error;

      const uniq = Array.from(
        new Set(
          (data ?? [])
            .map((r: any) => (r.famille ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a: string, b: string) => a.localeCompare(b, "fr"));

      return uniq as SupplierFamille[];
    },
    staleTime: 10 * 60 * 1000,
  });
}
