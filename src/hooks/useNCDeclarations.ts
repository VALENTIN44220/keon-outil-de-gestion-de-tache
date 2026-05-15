/**
 * useNCDeclarations — hook centralisé pour les Non-Conformités SMQ
 *
 * Gère :
 *  - liste filtrable des NC (avec realtime)
 *  - création d'une NC
 *  - changement de statut (avec audit auto via trigger DB)
 *  - mise à jour des champs métier
 *  - récupération du pilote auto selon le processus
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { toast } from 'sonner';
import type {
  NCDeclaration,
  NCStatus,
  NCAction,
  NCAttachment,
  NCStatusHistory,
} from '@/types/smqNC';

export interface NCFilters {
  status?: NCStatus | 'all';
  societe?: string;
  processus?: string;
  metier?: string;
  identification?: string;
  search?: string;
}

export function useNCDeclarations(filters: NCFilters = {}) {
  const [items, setItems] = useState<NCDeclaration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const instanceId = useId();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      let q = supabase
        .from('nc_declarations')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters.societe)         q = q.eq('societe_code', filters.societe);
      if (filters.processus)       q = q.eq('processus_code', filters.processus);
      if (filters.metier)          q = q.eq('metier_code', filters.metier);
      if (filters.identification)  q = q.eq('identification', filters.identification);
      if (filters.search) {
        const s = filters.search.trim();
        if (s) q = q.or(`title.ilike.%${s}%,description_problem.ilike.%${s}%,nc_number.ilike.%${s}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as NCDeclaration[]);
    } catch (e) {
      console.error('[useNCDeclarations] fetch error:', e);
      toast.error('Erreur de chargement des NC');
    } finally {
      setIsLoading(false);
    }
  }, [filters.status, filters.societe, filters.processus, filters.metier, filters.identification, filters.search]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Realtime : recharge sur tout changement
  useEffect(() => {
    const channel = supabase
      .channel(`nc-declarations:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nc_declarations' }, () => {
        void fetchAll();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchAll, instanceId]);

  return { items, isLoading, refetch: fetchAll };
}

// ─── Hook pour une NC unique avec ses actions/attachments/historique ────
export function useNCDetail(ncId: string | null) {
  const [nc, setNc] = useState<NCDeclaration | null>(null);
  const [actions, setActions] = useState<NCAction[]>([]);
  const [attachments, setAttachments] = useState<NCAttachment[]>([]);
  const [history, setHistory] = useState<NCStatusHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const instanceId = useId();

  const fetchDetail = useCallback(async () => {
    if (!ncId) return;
    setIsLoading(true);
    try {
      const [{ data: ncData }, { data: actData }, { data: attData }, { data: histData }] = await Promise.all([
        supabase.from('nc_declarations').select('*').eq('id', ncId).maybeSingle(),
        supabase.from('nc_actions').select('*').eq('nc_id', ncId).order('created_at', { ascending: true }),
        supabase.from('nc_attachments').select('*').eq('nc_id', ncId).order('created_at', { ascending: true }),
        supabase.from('nc_status_history').select('*').eq('nc_id', ncId).order('changed_at', { ascending: false }),
      ]);
      setNc((ncData as NCDeclaration | null) ?? null);
      setActions((actData ?? []) as NCAction[]);
      setAttachments((attData ?? []) as NCAttachment[]);
      setHistory((histData ?? []) as NCStatusHistory[]);
    } catch (e) {
      console.error('[useNCDetail] fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [ncId]);

  useEffect(() => { void fetchDetail(); }, [fetchDetail]);

  useEffect(() => {
    if (!ncId) return;
    const channel = supabase
      .channel(`nc-detail-${ncId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nc_declarations', filter: `id=eq.${ncId}` }, () => void fetchDetail())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nc_actions',      filter: `nc_id=eq.${ncId}` }, () => void fetchDetail())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nc_attachments',  filter: `nc_id=eq.${ncId}` }, () => void fetchDetail())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [ncId, fetchDetail, instanceId]);

  return { nc, actions, attachments, history, isLoading, refetch: fetchDetail };
}

// ─── Action : créer une NC ───────────────────────────────────────────────
export function useCreateNC() {
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const declarant = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  return useCallback(async (payload: Partial<NCDeclaration> & { title: string; date_constat: string }) => {
    if (!declarant?.id) {
      toast.error('Profil non chargé — impossible de créer la NC');
      return null;
    }

    // Pilote auto : prend le mapping admin selon processus, sinon NC fournisseur → Alexandre Baffou
    let pilote_id: string | null = payload.pilote_id ?? null;

    if (!pilote_id && payload.identification === 'nc_fournisseur') {
      const { data: alex } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', '%baffou%')
        .limit(1)
        .maybeSingle();
      pilote_id = alex?.id ?? null;
    }

    if (!pilote_id && payload.processus_code) {
      const { data: pilotRow } = await supabase
        .from('nc_process_pilots')
        .select('pilote_id')
        .eq('processus_code', payload.processus_code)
        .maybeSingle();
      pilote_id = pilotRow?.pilote_id ?? null;
    }

    const { data, error } = await supabase
      .from('nc_declarations')
      .insert({
        title: payload.title,
        description_problem: payload.description_problem ?? null,
        date_constat: payload.date_constat,
        date_cloture_souhaitee: payload.date_cloture_souhaitee ?? null,
        declarant_id: declarant.id,
        pilote_id,
        processus_code: payload.processus_code ?? null,
        metier_code: payload.metier_code ?? null,
        societe_code: payload.societe_code ?? null,
        identification: payload.identification ?? null,
        apparition_ailleurs: payload.apparition_ailleurs ?? null,
        fournisseur_nom: payload.fournisseur_nom ?? null,
        code_projet: payload.code_projet ?? null,
        causes_racines: payload.causes_racines ?? null,
        actions_correctives: payload.actions_correctives ?? null,
        actions_preventives: payload.actions_preventives ?? null,
        status: pilote_id ? 'affectee' : 'nouvelle',
      })
      .select()
      .single();

    if (error) {
      console.error('[useCreateNC] insert error:', error);
      toast.error(`Erreur création NC : ${error.message}`);
      return null;
    }
    toast.success(`${data.nc_number} créée${pilote_id ? ' et affectée au pilote' : ''}`);
    return data as NCDeclaration;
  }, [declarant?.id]);
}

// ─── Action : changer le statut d'une NC ──────────────────────────────────
export function useChangeNCStatus() {
  return useCallback(async (ncId: string, newStatus: NCStatus) => {
    const { error } = await supabase
      .from('nc_declarations')
      .update({ status: newStatus })
      .eq('id', ncId);
    if (error) {
      toast.error(`Erreur changement statut : ${error.message}`);
      return false;
    }
    toast.success('Statut mis à jour');
    return true;
  }, []);
}
