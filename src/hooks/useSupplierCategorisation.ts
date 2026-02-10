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
        .from("categories")
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

export function useSupplierFamillesByCategorie(categorie?: string | null) {
  return useQuery({
    queryKey: ["categories_ref", "familles", categorie ?? ""],
    enabled: !!categorie && categorie !== "all",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
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
