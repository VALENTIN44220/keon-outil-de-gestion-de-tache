import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInnoRole } from '@/hooks/useInnoRole';
import { type InnoRequest, type InnoFilters } from '@/components/innovation/constants';

export function useInnovationRequests(filters: InnoFilters) {
  const { profile } = useAuth();
  const { isInnoAdmin } = useInnoRole();

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['inno-demandes', profile?.id, isInnoAdmin],
    queryFn: async () => {
      let query = supabase
        .from('inno_demandes')
        .select('*, demandeur:profiles!inno_demandes_demandeur_id_fkey(display_name)')
        .order('created_at', { ascending: false });

      if (!isInnoAdmin && profile?.id) {
        query = query.eq('demandeur_id', profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  // Map to InnoRequest[]
  const requests: InnoRequest[] = useMemo(() => {
    if (!rawData) return [];
    return rawData.map((r: any) => ({
      id: r.id,
      title: r.nom_projet,
      status: r.statut_demande || 'Soumise',
      priority: r.priorisation_urgence || 'medium',
      request_number: null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      requester_name: r.demandeur?.display_name || '-',
      nom_projet: r.nom_projet || '',
      code_projet: r.code_projet || '',
      theme: r.theme || '',
      sous_theme: r.sous_theme || '',
      descriptif: r.descriptif || '',
      commentaire_demande: r.commentaire_demande || '',
      gain_attendu: r.gain_attendu || '',
      partenaires_identifies: r.partenaires_identifies || '',
      entite_concernee: r.entite_concernee || '',
      usage_inno: r.usage || '',
      ebitda_retour_financier: r.ebitda_retour_financier,
      capex_investissement: r.capex_investissement,
      roi: r.roi,
      commentaires_financiers: r.commentaires_financiers || '',
      temps_caracteristique: r.temps_caracteristique || '',
      difficulte_complexite: r.difficulte_complexite,
      niveau_strategique: r.niveau_strategique,
      etiquettes: Array.isArray(r.etiquettes) ? r.etiquettes.join(', ') : (r.etiquettes || ''),
      sponsor: r.sponsor || '',
      commentaire_projet: r.commentaire_projet || '',
    }));
  }, [rawData]);

  // Apply filters
  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false;
      if (filters.entite && filters.entite !== 'all' && r.entite_concernee !== filters.entite) return false;
      if (filters.codeProjet && filters.codeProjet !== 'all' && r.code_projet !== filters.codeProjet) return false;
      if (filters.usage && filters.usage !== 'all' && r.usage_inno !== filters.usage) return false;
      if (filters.theme && filters.theme !== 'all' && r.theme !== filters.theme) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !r.nom_projet.toLowerCase().includes(s) &&
          !r.code_projet.toLowerCase().includes(s) &&
          !r.descriptif.toLowerCase().includes(s) &&
          !r.requester_name.toLowerCase().includes(s) &&
          !r.theme.toLowerCase().includes(s) &&
          !r.sous_theme.toLowerCase().includes(s)
        ) return false;
      }
      if (filters.dateFrom && new Date(r.created_at) < filters.dateFrom) return false;
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > to) return false;
      }
      return true;
    });
  }, [requests, filters]);

  // Distinct values for filter dropdowns
  const distinctValues = useMemo(() => ({
    statuses: [...new Set(requests.map(r => r.status))],
    entites: [...new Set(requests.map(r => r.entite_concernee).filter(Boolean))],
    codeProjets: [...new Set(requests.map(r => r.code_projet).filter(Boolean))],
    usages: [...new Set(requests.map(r => r.usage_inno).filter(Boolean))],
    themes: [...new Set(requests.map(r => r.theme).filter(Boolean))],
  }), [requests]);

  // Status counters
  const counters = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.status] = (map[r.status] || 0) + 1; });
    return map;
  }, [filtered]);

  return { requests: filtered, allRequests: requests, isLoading, distinctValues, counters, total: filtered.length };
}
