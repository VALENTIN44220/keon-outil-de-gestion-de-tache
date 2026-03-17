import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInnoRole } from '@/hooks/useInnoRole';
import { INNOVATION_PROCESS_ID, type InnoRequest, type InnoFilters } from '@/components/innovation/constants';

export function useInnovationRequests(filters: InnoFilters) {
  const { profile } = useAuth();
  const { isInnoAdmin } = useInnoRole();

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['inno-requests-full', profile?.id, isInnoAdmin],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('id, title, status, priority, request_number, created_at, updated_at, requester_id, requester:profiles!tasks_requester_id_fkey(display_name)')
        .eq('type', 'request')
        .eq('source_process_template_id', INNOVATION_PROCESS_ID)
        .order('created_at', { ascending: false });

      if (!isInnoAdmin && profile?.id) {
        query = query.eq('requester_id', profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  // Fetch field values for all innovation requests
  const requestIds = rawData?.map(r => r.id) || [];
  const { data: fieldValues } = useQuery({
    queryKey: ['inno-field-values', requestIds],
    queryFn: async () => {
      if (requestIds.length === 0) return [];
      const { data, error } = await supabase
        .from('request_field_values')
        .select('task_id, value, field:template_custom_fields!request_field_values_field_id_fkey(name)')
        .in('task_id', requestIds);
      if (error) throw error;
      return data || [];
    },
    enabled: requestIds.length > 0,
  });

  // Flatten into InnoRequest[]
  const requests: InnoRequest[] = useMemo(() => {
    if (!rawData) return [];
    const fieldMap = new Map<string, Map<string, string>>();
    (fieldValues || []).forEach((fv: any) => {
      if (!fieldMap.has(fv.task_id)) fieldMap.set(fv.task_id, new Map());
      fieldMap.get(fv.task_id)!.set(fv.field?.name || '', fv.value || '');
    });

    return rawData.map(r => {
      const fields = fieldMap.get(r.id) || new Map();
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        request_number: r.request_number,
        created_at: r.created_at,
        updated_at: r.updated_at,
        requester_name: (r as any).requester?.display_name || '-',
        nom_projet: fields.get('nom_projet') || '',
        code_projet: fields.get('code_projet') || '',
        theme: fields.get('theme') || '',
        sous_theme: fields.get('sous_theme') || '',
        descriptif: fields.get('descriptif') || '',
        commentaire_demande: fields.get('commentaire_demande') || '',
        gain_attendu: fields.get('gain_attendu') || '',
        partenaires_identifies: fields.get('partenaires_identifies') || '',
        entite_concernee: fields.get('entite_concernee') || '',
        usage_inno: fields.get('usage_inno') || '',
        ebitda_retour_financier: fields.get('ebitda_retour_financier') ? Number(fields.get('ebitda_retour_financier')) : null,
        capex_investissement: fields.get('capex_investissement') ? Number(fields.get('capex_investissement')) : null,
        roi: fields.get('roi') ? Number(fields.get('roi')) : null,
        commentaires_financiers: fields.get('commentaires_financiers') || '',
        temps_caracteristique: fields.get('temps_caracteristique') || '',
        difficulte_complexite: fields.get('difficulte_complexite') ? Number(fields.get('difficulte_complexite')) : null,
        niveau_strategique: fields.get('niveau_strategique') ? Number(fields.get('niveau_strategique')) : null,
        etiquettes: fields.get('etiquettes') || '',
        sponsor: fields.get('sponsor') || '',
        commentaire_projet: fields.get('commentaire_projet') || '',
      };
    });
  }, [rawData, fieldValues]);

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
          !(r.request_number || '').toLowerCase().includes(s)
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
  }), [requests]);

  // Status counters
  const counters = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.status] = (map[r.status] || 0) + 1; });
    return map;
  }, [filtered]);

  return { requests: filtered, allRequests: requests, isLoading, distinctValues, counters, total: filtered.length };
}
