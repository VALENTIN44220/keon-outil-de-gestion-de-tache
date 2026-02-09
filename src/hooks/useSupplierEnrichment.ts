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
  status: string;
  entite: string;
  categorie: string;
  segment: string;
}

const PAGE_SIZE = 1000;

async function fetchAllSuppliers(filters: SupplierFilters): Promise<SupplierEnrichment[]> {
  const all: SupplierEnrichment[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('supplier_purchase_enrichment')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (filters.search) {
      query = query.or(
        `tiers.ilike.%${filters.search}%,nomfournisseur.ilike.%${filters.search}%,famille.ilike.%${filters.search}%,segment.ilike.%${filters.search}%,entite.ilike.%${filters.search}%`
      );
    }
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.entite && filters.entite !== 'all') query = query.eq('entite', filters.entite);
    if (filters.categorie && filters.categorie !== 'all') query = query.eq('categorie', filters.categorie);
    if (filters.segment && filters.segment !== 'all') query = query.eq('segment', filters.segment);

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as SupplierEnrichment[];
    all.push(...page);

    if (page.length < PAGE_SIZE) break; // dernière page
    from += PAGE_SIZE;
  }

  return all;
}

async function fetchAllFilterOptions(): Promise<{ entites: string[]; categories: string[]; segments: string[] }> {
  const rows: { entite: string | null; categorie: string | null; segment: string | null }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('supplier_purchase_enrichment')
      .select('entite,categorie,segment')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as { entite: string | null; categorie: string | null; segment: string | null }[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const entites = [...new Set(rows.map(r => r.entite).filter(Boolean))] as string[];
  const categories = [...new Set(rows.map(r => r.categorie).filter(Boolean))] as string[];
  const segments = [...new Set(rows.map(r => r.segment).filter(Boolean))] as string[];

  return { entites, categories, segments };
}

export function useSupplierEnrichment(filters: SupplierFilters) {
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, refetch } = useQuery({
    queryKey: ['supplier-enrichment', filters],
    queryFn: () => fetchAllSuppliers(filters),
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
  });

  return {
    suppliers,
    isLoading,
    refetch,
    updateSupplier,
    filterOptions: filterOptions || { entites: [], categories: [], segments: [] },
  };
}

export function useSupplierById(id: string | null) {
  return useQuery({
    queryKey: ['supplier-enrichment', id],
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

      setLastRefresh(new D
