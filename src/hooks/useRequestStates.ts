/**
 * useRequestStates — Liste des états métier d'un processus.
 *
 * Source : table `request_states` (1 ligne par état configuré dans
 * l'éditeur de processus + Excel d'import).
 *
 * Fournit aussi des helpers de mapping code → catégorie macro (5+1 valeurs)
 * pour les filtres simplifiés des listes de demandes.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface RequestState {
  id: string;
  process_template_id: string;
  code: string;
  label: string;
  color: string | null;
  order_index: number | null;
  is_initial: boolean;
  is_final: boolean;
  state_category: string | null;
}

/** 6 catégories macro pour les filtres simplifiés des listes de demandes. */
export const MACRO_STATE_CATEGORIES = [
  { key: 'SOUMIS',                  label: 'Soumis',                       color: 'bg-slate-100 text-slate-700' },
  { key: 'EN_COURS',                label: 'En cours',                     color: 'bg-amber-100 text-amber-700' },
  { key: 'EN_ATTENTE_VALIDATION',   label: 'En attente validation',        color: 'bg-violet-100 text-violet-700' },
  { key: 'EN_ATTENTE_RETOUR_ADMIN', label: 'En attente retour admin.',     color: 'bg-indigo-100 text-indigo-700' },
  { key: 'EN_ATTENTE_TRAVAUX',      label: 'En attente travaux',           color: 'bg-orange-100 text-orange-700' },
  { key: 'TERMINE',                 label: 'Terminé',                      color: 'bg-emerald-100 text-emerald-700' },
] as const;

export type MacroStateCategory = (typeof MACRO_STATE_CATEGORIES)[number]['key'];

export function macroStateLabel(key: string | null | undefined): string {
  if (!key) return '—';
  const m = MACRO_STATE_CATEGORIES.find(c => c.key === key);
  return m?.label ?? key;
}

export function macroStateColor(key: string | null | undefined): string {
  if (!key) return 'bg-slate-100 text-slate-600';
  return MACRO_STATE_CATEGORIES.find(c => c.key === key)?.color ?? 'bg-slate-100 text-slate-600';
}

/**
 * Charge tous les états d'un processus. Cache long (les états changent rarement).
 */
export function useRequestStates(processTemplateId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['request-states', processTemplateId],
    queryFn: async (): Promise<RequestState[]> => {
      if (!processTemplateId) return [];
      const { data, error } = await (supabase as any)
        .from('request_states')
        .select('*')
        .eq('process_template_id', processTemplateId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as RequestState[];
    },
    enabled: !!processTemplateId,
    staleTime: 5 * 60_000, // 5 min
  });

  const byCode = useMemo(() => {
    const m = new Map<string, RequestState>();
    for (const s of query.data ?? []) m.set(s.code, s);
    return m;
  }, [query.data]);

  return {
    states: query.data ?? [],
    statesByCode: byCode,
    isLoading: query.isLoading,
    /** Récupère le label affichable depuis le code stocké en DB. */
    labelOf: (code: string | null | undefined) => code ? (byCode.get(code)?.label ?? code) : '—',
    /** Récupère la couleur Tailwind depuis le code. */
    colorOf: (code: string | null | undefined) => code ? (byCode.get(code)?.color ?? 'bg-slate-100 text-slate-600') : 'bg-slate-100 text-slate-600',
    /** Récupère la catégorie macro depuis le code. */
    macroOf: (code: string | null | undefined): MacroStateCategory | null => {
      if (!code) return null;
      return (byCode.get(code)?.state_category as MacroStateCategory | null) ?? null;
    },
  };
}

/** ID du process BE (constante référencée à plusieurs endroits) */
export const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';
