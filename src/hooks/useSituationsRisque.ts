/**
 * useSituationsRisque — registre des situations à risque (COPIL SST).
 *  - liste filtrable (realtime)
 *  - création
 *  - mise à jour (état d'avancement, action, arbre des causes…)
 *  - suppression logique (deleted_at)
 *
 * NB : la table `sst_situations` n'est pas (encore) dans les types Supabase
 * générés → on caste `supabase as any`, conforme au reste du repo.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { toast } from 'sonner';
import type { SituationRisque } from '@/types/sst';

const sb = supabase as any;

export interface SSTFilters {
  type?: string;
  societe?: string;
  etat?: string;
  search?: string;
}

export function useSituationsRisque(filters: SSTFilters = {}) {
  const [items, setItems] = useState<SituationRisque[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const instanceId = useId();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      let q = sb.from('sst_situations').select('*').is('deleted_at', null)
        .order('date_evenement', { ascending: false });
      if (filters.type) q = q.eq('type_situation', filters.type);
      if (filters.societe) q = q.eq('societe', filters.societe);
      if (filters.etat) q = q.eq('etat_avancement', filters.etat);
      if (filters.search?.trim()) {
        const s = filters.search.trim();
        q = q.or(`titre.ilike.%${s}%,circonstances.ilike.%${s}%,action.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as SituationRisque[]);
    } catch (e) {
      console.error('[useSituationsRisque] fetch:', e);
      toast.error('Erreur de chargement des situations à risque');
    } finally {
      setIsLoading(false);
    }
  }, [filters.type, filters.societe, filters.etat, filters.search]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`sst-situations:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sst_situations' }, () => void fetchAll())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchAll, instanceId]);

  return { items, isLoading, refetch: fetchAll };
}

export function useCreateSituationRisque() {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const declarant = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  return useCallback(async (payload: Partial<SituationRisque> & { date_evenement: string; type_situation: string }) => {
    const { data, error } = await sb.from('sst_situations').insert({
      date_evenement: payload.date_evenement,
      type_situation: payload.type_situation,
      titre: payload.titre ?? null,
      societe: payload.societe ?? null,
      service: payload.service ?? null,
      projet: payload.projet ?? null,
      lieu_environnement: payload.lieu_environnement ?? null,
      circonstances: payload.circonstances ?? null,
      lesions: payload.lesions ?? null,
      victime_keon_id: payload.victime_keon_id ?? null,
      victime_externe: payload.victime_externe ?? null,
      temoin_id: payload.temoin_id ?? null,
      action: payload.action ?? null,
      arbre_causes: payload.arbre_causes ?? null,
      etat_avancement: payload.etat_avancement ?? 'A TRAITER',
      validation_codir: payload.validation_codir ?? null,
      declarant_id: declarant?.id ?? null,
    }).select().single();
    if (error) {
      console.error('[useCreateSituationRisque] insert:', error);
      toast.error(`Erreur création : ${error.message}`);
      return null;
    }
    toast.success('Situation à risque enregistrée');
    return data as SituationRisque;
  }, [declarant?.id]);
}

export function useUpdateSituationRisque() {
  return useCallback(async (id: string, updates: Partial<SituationRisque>) => {
    const { error } = await sb.from('sst_situations').update(updates).eq('id', id);
    if (error) {
      toast.error(`Erreur mise à jour : ${error.message}`);
      return false;
    }
    toast.success('Situation mise à jour');
    return true;
  }, []);
}

export function useDeleteSituationRisque() {
  return useCallback(async (id: string) => {
    const { error } = await sb.from('sst_situations').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast.error(`Erreur suppression : ${error.message}`);
      return false;
    }
    toast.success('Situation supprimée');
    return true;
  }, []);
}
