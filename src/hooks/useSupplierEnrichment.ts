// src/hooks/useSupplierEnrichment.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface SupplierEnrichment {
  id: string;
  tiers: string;
  nomfournisseur: string | null;
  categorie: string | null;
  famille_source_initiale: string | null;
  famille: string | null;
  segment: string | null;
  sous_segment: string | null;
  entite: string | null;
  type_de_contrat: string | null;
  validite_prix: string | null;
  validite_du_contrat: string | null;
  date_premiere_signature: string | null;
  avenants: string | null;
  evolution_tarif_2026: string | null;
  echeances_de_paiement: string | null;
  delai_de_paiement: string | null;
  penalites: string | null;
  exclusivite_non_sollicitation: string | null;
  remise: string | null;
  rfa: string | null;
  incoterm: string | null;
  garanties_bancaire_et_equipement: string | null;
  transport: string | null;
  nom_contact: string | null;
  poste: string | null;
  adresse_mail: string | null;
  telephone: string | null;
  commentaires: string | null;
  completeness_score: number;
  status: 'a_completer' | 'en_cours' | 'complet';
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface SupplierFilters {
  search: string;
  status: string; // 'all' | ...
  entite: string; // 'all' | ...
  categorie: string; // 'all' | ...
  segment: string; // 'all' | ...
  sous_segment?: string; // 'all' | ...
  validite_prix_from?: string; // yyyy-mm-dd
  validite_prix_to?: string; // yyyy-mm-dd
  validite_contrat_from?: string; // yyyy-mm-dd
  validite_contrat_to?: string; // yyyy-mm-dd
}

type FilterOptions = {
  entites: string[];
  categories: string[];
  segments: string[];
  sous_segments: string[];
  stats: {
    total: number;
    a_completer: number;
    en_cours: number;
    complet: number;
  };
};

function applyFilters(
  q: any,
  filters: SupplierFilters,
  opts?: { excludeStatus?: boolean }
) {
  let query = q;

  const search = (filters.search || '').trim();
  if (search) {
    // OR multi-colonnes
    query = query.or(
      [
        `tiers.ilike.%${search}%`,
        `nomfournisseur.ilike.%${search}%`,
        `famille.ilike.%${search}%`,
        `segment.ilike.%${search}%`,
        `sous_segment.ilike.%${search}%`,
        `entite.ilike.%${search}%`,
      ].join(',')
    );
  }

  if (!opts?.excludeStatus && filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.entite && filters.entite !== 'all') query = query.eq('entite', filters.entite);
  if (filters.categorie && filters.categorie !== 'all') query = query.eq('categorie', filters.categorie);
  if (filters.segment && filters.segment !== 'all') query = query.eq('segment', filters.segment);
  if (filters.sous_segment && filters.sous_segment !== 'all') query = query.eq('sous_segment', filters.sous_segment);

  // Dates (YYYY-MM-DD). On filtre uniquement si non vide.
  if (filters.validite_prix_from) query = query.gte('validite_prix', filters.validite_prix_from);
  if (filters.validite_prix_to) query = query.lte('validite_prix', filters.validite_prix_to);

  if (filters.validite_contrat_from) query = query.gte('validite_du_contrat', filters.validite_contrat_from);
  if (filters.validite_contrat_to) query = query.lte('validite_du_contrat', filters.validite_contrat_to);

  return query;
}

export function useSupplierEnrichment(filters: SupplierFilters, page = 0, pageSize = 200) {
  const queryClient = useQueryClient();

  // LISTE paginée + total
  const listQuery = useQuery<{ suppliers: SupplierEnrichment[]; total: number }>({
    queryKey: ['supplier-enrichment', 'list', filters, page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from('supplier_purchase_enrichment')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false });

      q = applyFilters(q, filters);

      const { data, error, count } = await q.range(from, to);
      if (error) throw error;

      return {
        suppliers: (data ?? []) as SupplierEnrichment[],
        total: count ?? 0,
      };
    },
    placeholderData: (prev) => prev,
  });

  // OPTIONS de filtres + stats (sans pagination)
  const optionsQuery = useQuery({
    queryKey: ['supplier-enrichment', 'filter-options'],
    queryFn: async (): Promise<FilterOptions> => {
      // On récupère uniquement les colonnes nécessaires aux options (pas *)
      const { data, error } = await supabase
        .from('supplier_purchase_enrichment')
        .select('entite,categorie,segment,sous_segment,status');

      if (error) throw error;

      const entites = Array.from(new Set((data ?? []).map((r: any) => r.entite).filter(Boolean))).sort();
      const categories = Array.from(new Set((data ?? []).map((r: any) => r.categorie).filter(Boolean))).sort();
      const segments = Array.from(new Set((data ?? []).map((r: any) => r.segment).filter(Boolean))).sort();
      const sous_segments = Array.from(new Set((data ?? []).map((r: any) => r.sous_segment).filter(Boolean))).sort();

      // Stats : on les calcule côté API avec count exact, en réappliquant les filtres SAUF status
      const baseCountQuery = () =>
        applyFilters(
          supabase.from('supplier_purchase_enrichment').select('id', { count: 'exact', head: true }),
          filters,
          { excludeStatus: true }
        );

      const [{ count: total }, { count: a }, { count: e }, { count: c }] = await Promise.all([
        baseCountQuery(),
        baseCountQuery().eq('status', 'a_completer'),
        baseCountQuery().eq('status', 'en_cours'),
        baseCountQuery().eq('status', 'complet'),
      ]);

      return {
        entites,
        categories,
        segments,
        sous_segments,
        stats: {
          total: total ?? 0,
          a_completer: a ?? 0,
          en_cours: e ?? 0,
          complet: c ?? 0,
        },
      };
    },
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupplierEnrichment> & { id: string }) => {
      const { data, error } = await supabase
        .from('supplier_purchase_enrichment')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-enrichment'] });
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les modifications',
        variant: 'destructive',
      });
    },
  });

  return {
    suppliers: listQuery.data?.suppliers ?? [],
    total: listQuery.data?.total ?? 0,
    isLoading: listQuery.isLoading,
    filterOptions:
      optionsQuery.data ??
      ({
        entites: [],
        categories: [],
        segments: [],
        sous_segments: [],
        stats: { total: 0, a_completer: 0, en_cours: 0, complet: 0 },
      } as FilterOptions),
    updateSupplier,
  };
}

export function useSupplierById(id: string | null) {
  return useQuery({
    queryKey: ['supplier-enrichment', 'by-id', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('supplier_purchase_enrichment')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as SupplierEnrichment;
    },
    enabled: !!id,
  });
}
