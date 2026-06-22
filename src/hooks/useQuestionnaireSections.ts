import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PilierCode } from '@/config/questionnaireConfig';

export interface SectionRow {
  id: string;
  pilier_code: string;
  section: string;
  label: string | null;
  order_index: number;
}

export interface SousSectionRow {
  id: string;
  pilier_code: string;
  section: string;
  sous_section: string;
  order_index: number;
}

const SECTIONS_KEY = 'questionnaire-sections';
const SOUS_SECTIONS_KEY = 'questionnaire-sous-sections';

/** Ordre global des sections d'un pilier (partagé par toutes les SPV). */
export function useQuestionnaireSections(pilierCode?: PilierCode | string) {
  return useQuery<SectionRow[]>({
    queryKey: [SECTIONS_KEY, pilierCode ?? 'all'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let query = (supabase as any)
        .from('questionnaire_sections')
        .select('*')
        .order('order_index', { ascending: true });
      if (pilierCode) query = query.eq('pilier_code', pilierCode);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SectionRow[];
    },
  });
}

/** Ordre global des sous-sections d'un pilier. */
export function useQuestionnaireSousSections(pilierCode?: PilierCode | string) {
  return useQuery<SousSectionRow[]>({
    queryKey: [SOUS_SECTIONS_KEY, pilierCode ?? 'all'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let query = (supabase as any)
        .from('questionnaire_sous_sections')
        .select('*')
        .order('order_index', { ascending: true });
      if (pilierCode) query = query.eq('pilier_code', pilierCode);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SousSectionRow[];
    },
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [SECTIONS_KEY] });
  queryClient.invalidateQueries({ queryKey: [SOUS_SECTIONS_KEY] });
  queryClient.invalidateQueries({ queryKey: ['questionnaire-field-defs'] });
  queryClient.invalidateQueries({ queryKey: ['questionnaire-field-defs-admin'] });
}

/** Crée une section (vide). Apparaît immédiatement sur toutes les SPV. */
export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pilier_code, section }: { pilier_code: string; section: string }) => {
      const { data: max } = await (supabase as any)
        .from('questionnaire_sections')
        .select('order_index')
        .eq('pilier_code', pilier_code)
        .order('order_index', { ascending: false })
        .limit(1);
      const nextOrder = (max?.[0]?.order_index ?? 0) + 10;
      const { error } = await (supabase as any)
        .from('questionnaire_sections')
        .insert({ pilier_code, section, order_index: nextOrder });
      if (error) throw error;
      return true;
    },
    onSuccess: () => { toast.success('Section créée'); invalidateAll(queryClient); },
    onError: (e: any) => {
      console.error('Erreur création section:', e);
      toast.error(e?.code === '23505' ? 'Cette section existe déjà' : 'Erreur lors de la création de la section');
    },
  });
}

/**
 * Renomme une section : met à jour le texte sur TOUS les champs, la table
 * d'ordre des sections et les sous-sections rattachées. Déployé partout.
 */
export function useRenameSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pilier_code, oldName, newName }: { pilier_code: string; oldName: string; newName: string }) => {
      const ops = [
        (supabase as any).from('questionnaire_field_definitions')
          .update({ section: newName }).eq('pilier_code', pilier_code).eq('section', oldName),
        (supabase as any).from('questionnaire_sections')
          .update({ section: newName }).eq('pilier_code', pilier_code).eq('section', oldName),
        (supabase as any).from('questionnaire_sous_sections')
          .update({ section: newName }).eq('pilier_code', pilier_code).eq('section', oldName),
      ];
      for (const op of ops) { const { error } = await op; if (error) throw error; }
      return true;
    },
    onSuccess: () => { toast.success('Section renommée'); invalidateAll(queryClient); },
    onError: (e: any) => { console.error('Erreur renommage section:', e); toast.error('Erreur lors du renommage'); },
  });
}

/** Réordonne les sections (réécrit order_index en lot). */
export function useReorderSections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; order_index: number }>) => {
      for (const it of items) {
        const { error } = await (supabase as any)
          .from('questionnaire_sections')
          .update({ order_index: it.order_index })
          .eq('id', it.id);
        if (error) throw error;
      }
      return true;
    },
    onSuccess: () => invalidateAll(queryClient),
    onError: (e: any) => { console.error('Erreur réordonnancement sections:', e); toast.error('Erreur lors du réordonnancement'); },
  });
}

/**
 * Supprime une section. Refuse s'il reste des champs actifs rattachés
 * (la garde se fait côté UI). Supprime aussi ses sous-sections d'ordre.
 */
export function useDeleteSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pilier_code, section }: { pilier_code: string; section: string }) => {
      await (supabase as any).from('questionnaire_sous_sections')
        .delete().eq('pilier_code', pilier_code).eq('section', section);
      const { error } = await (supabase as any).from('questionnaire_sections')
        .delete().eq('pilier_code', pilier_code).eq('section', section);
      if (error) throw error;
      return true;
    },
    onSuccess: () => { toast.success('Section supprimée'); invalidateAll(queryClient); },
    onError: (e: any) => { console.error('Erreur suppression section:', e); toast.error('Erreur lors de la suppression'); },
  });
}

// ─── Sous-sections ─────────────────────────────────────────────────────────────

export function useCreateSousSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pilier_code, section, sous_section }: { pilier_code: string; section: string; sous_section: string }) => {
      const { data: max } = await (supabase as any)
        .from('questionnaire_sous_sections')
        .select('order_index')
        .eq('pilier_code', pilier_code).eq('section', section)
        .order('order_index', { ascending: false }).limit(1);
      const nextOrder = (max?.[0]?.order_index ?? 0) + 10;
      const { error } = await (supabase as any)
        .from('questionnaire_sous_sections')
        .insert({ pilier_code, section, sous_section, order_index: nextOrder });
      if (error) throw error;
      return true;
    },
    onSuccess: () => { toast.success('Sous-section créée'); invalidateAll(queryClient); },
    onError: (e: any) => {
      console.error('Erreur création sous-section:', e);
      toast.error(e?.code === '23505' ? 'Cette sous-section existe déjà' : 'Erreur lors de la création');
    },
  });
}

export function useRenameSousSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pilier_code, section, oldName, newName }: { pilier_code: string; section: string; oldName: string; newName: string }) => {
      const ops = [
        (supabase as any).from('questionnaire_field_definitions')
          .update({ sous_section: newName })
          .eq('pilier_code', pilier_code).eq('section', section).eq('sous_section', oldName),
        (supabase as any).from('questionnaire_sous_sections')
          .update({ sous_section: newName })
          .eq('pilier_code', pilier_code).eq('section', section).eq('sous_section', oldName),
      ];
      for (const op of ops) { const { error } = await op; if (error) throw error; }
      return true;
    },
    onSuccess: () => { toast.success('Sous-section renommée'); invalidateAll(queryClient); },
    onError: (e: any) => { console.error('Erreur renommage sous-section:', e); toast.error('Erreur lors du renommage'); },
  });
}

export function useReorderSousSections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; order_index: number }>) => {
      for (const it of items) {
        const { error } = await (supabase as any)
          .from('questionnaire_sous_sections')
          .update({ order_index: it.order_index })
          .eq('id', it.id);
        if (error) throw error;
      }
      return true;
    },
    onSuccess: () => invalidateAll(queryClient),
    onError: (e: any) => { console.error('Erreur réordonnancement sous-sections:', e); toast.error('Erreur lors du réordonnancement'); },
  });
}

export function useDeleteSousSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pilier_code, section, sous_section }: { pilier_code: string; section: string; sous_section: string }) => {
      const { error } = await (supabase as any).from('questionnaire_sous_sections')
        .delete().eq('pilier_code', pilier_code).eq('section', section).eq('sous_section', sous_section);
      if (error) throw error;
      return true;
    },
    onSuccess: () => { toast.success('Sous-section supprimée'); invalidateAll(queryClient); },
    onError: (e: any) => { console.error('Erreur suppression sous-section:', e); toast.error('Erreur lors de la suppression'); },
  });
}
