import { useState, useCallback } from 'react';
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
  validite_prix: string | null;         // "YYYY-MM-DD" ou null
  validite_du_contrat: string | null;   // "YYYY-MM-DD" ou null
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
  status: string;        // 'all' | ...
  entite: string;        // 'all' | ...
  categorie: string;     // 'all' | ...
  segment: string;       // 'all' | ...
  sous_segment: string;  // 'all' | ...

  validite_prix_from?: string;       // "YYYY-MM-DD"
  validite_prix_to?: string;         // "YYYY-MM-DD"
  validite_contrat_from?: string;    // "YYYY-MM-DD"
  validite_contrat_to?: string;      // "YYYY-MM-DD"
}

const PAGE_SIZE_DEFAULT = 200;

// ---------- Helpers ----------
function applyCommonFilters(
  query: ReturnType<typeof supabase.from>,
  filters: SupplierFilters
) {
  // search multi-colonnes
  if (filters.search) {
    query = query.or(
      `tiers.ilike.%${filters.search}%,nomfournisseur.ilike.%${filters.search}%,famille.ilike.%${filters.search}%,segment.ilike.%${filters.search}%,sous_segment.ilike.%${filters.search}%,entite.ilike.%${filters.search}%`
    );
  }

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.entite && filters.entite !== 'all') query = query.eq('entite', filters.entite);
  if (filters.categorie && filters.categorie !== 'all') query = query.eq('categorie', filters.categorie);
  if (filters.segment && filters.segment !== 'all') query = query.eq('segment', filters.segment);
  if (filters.sous_segment && filters.sous_segment !== 'all') query = query.eq('sous_segment', filters.sous_segment);

  // Filtres de date (string ISO "YYYY-MM-DD" => OK en comparaison lexicographique)
  if (filters.validite_prix_from) query = query.gte('validite_prix', filters.validite_prix_from);
  if (filters.validite_prix_to) query = query.lte('validite_prix', filters.validite_prix_to);

  if (filters.validite_contrat_from) query = query.gte('validite_du_contrat', filters.validite_contrat_from);
  if (filters.validite_contrat_to) query = query.lte('validite_du_contrat', filters.validite_contrat_to);

  return query;
}

async function fetchSuppliersPage(filters: SupplierFilters, page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // count exact = total lignes correspondant aux filtres
  let query = supabase
    .from('supplier_purchase_enrichment')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false });

  query = applyCommonFilters(query, filters);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    rows: (data ?? []) as SupplierEnrichment[],
    total: count ?? 0,
  };
}

async function fetchAllFilterOptions(): Promise<{
  entites: string[];
  categories: string[];
  segments: string[];
  sous_segments: string[];
}> {
  // On pagine, sinon Supabase/PostgREST limite à 1000
  const PAGE = 1000;
  let from = 0;

  const rows: { entite: string | null; categorie: string | null; segment: string | null; sous_segment: string | null }[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('supplier_purchase_enrichment')
      .select('entite,categorie,segment,sous_segment')
      .range(from, from + PAGE - 1);

    if (error) throw error;

    const page = (data ?? []) as typeof rows;
    rows.push(...page);

    if (page.length < PAGE) break;
    from += PAGE;
  }

  const entites = [...new Set(rows.map(r => r.entite).filter(Boolean))] as string[];
  const categories = [...new Set(rows.map(r => r.categorie).filter(Boolean))] as string[];
  const segments = [...new Set(rows.map(r => r.segment).filter(Boolean))] as string[];
  const sous_segments = [...new Set(rows.map(r => r.sous_segment).filter(Boolean))] as string[];

  // tri alpha
  entites.sort();
  categories.sort();
  segments.sort();
  sous_segments.sort();

  return { entites, categories, segments, sous_segments };
}

// ---------- Hook principal ----------
export function useSupplierEnrichment(filters: SupplierFilters, page: number, pageSize = PAGE_SIZE_DEFAULT) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supplier-enrichment', filters, page, pageSize],
    queryFn: () => fetchSuppliersPage(filters, page, pageSize),
    keepPreviousData: true,
  });

  const suppliers = data?.rows ?? [];
  const total = data?.total ?? 0;

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
      queryClient.invalidateQueries({ queryKey: ['supplier-filter-options'] });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les modifications',
        variant: 'destructive',
      });
      console.error('Update error:', error);
    },
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['supplier-filter-options'],
    queryFn: fetchAllFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

  return {
    suppliers,
    total,
    isLoading,
    refetch,
    updateSupplier,
    filterOptions: filterOptions || { entites: [], categories: [], segments: [], sous_segments: [] },
  };
}

// ---------- Refresh button ----------
export function useRefreshFromDatalake() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (lastRefresh && Date.now() - lastRefresh.getTime() < 60000) {
      toast({
        title: 'Actualisation récente',
        description: 'Veuillez patienter avant de rafraîchir à nouveau.',
      });
      return;
    }

    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['supplier-enrichment'] });
      await queryClient.invalidateQueries({ queryKey: ['supplier-filter-options'] });

      setLastRefresh(new Date());
      toast({ title: 'Actualisation terminée', description: 'Données mises à jour.' });
    } catch (error) {
      console.error('Refresh error:', error);
      toast({ title: 'Erreur', description: 'Impossible de rafraîchir.', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  }, [lastRefresh, queryClient]);

  return { refresh, isRefreshing, lastRefresh };
}
