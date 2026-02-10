import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SupplierCategorie = string;
export type SupplierFamille = string;

export function useSupplierCategories() {
  return useQuery({
    queryKey: ["supplier_categorisation", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_categorisation")
        .select("categorie")
        .eq("active", true);

      if (error) throw error;

      // distinct + tri
      const uniq = Array.from(
        new Set((data ?? []).map((r: any) => (r.categorie ?? "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "fr"));

      return uniq as SupplierCategorie[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useSupplierFamillesByCategorie(categorie?: string | null) {
  return useQuery({
    queryKey: ["supplier_categorisation", "familles", categorie ?? ""],
    enabled: !!categorie,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_categorisation")
        .select("famille")
        .eq("active", true)
        .eq("categorie", categorie as string);

      if (error) throw error;

      const uniq = Array.from(
        new Set((data ?? []).map((r: any) => (r.famille ?? "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "fr"));

      return uniq as SupplierFamille[];
    },
    staleTime: 10 * 60 * 1000,
  });
}
