import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  BEAffaire,
  BEAffaireBudgetKPI,
  BEAffaireStatus,
  BEAffaireSourceCreation,
} from '@/types/beAffaire';

// Cast volontaire : les nouvelles tables ne sont pas encore dans
// src/integrations/supabase/types.ts (regenerer apres migration).
const sb = supabase as any;

export interface CreateBEAffaireInput {
  be_project_id: string;
  code_affaire: string;
  libelle?: string | null;
  description?: string | null;
  date_ouverture?: string | null;
  source_creation?: BEAffaireSourceCreation;
  source_request_id?: string | null;
}

/**
 * Liste les affaires d'un projet BE + KPIs agregés depuis la vue
 * v_be_affaire_budget_kpi (engage / constate par affaire).
 */
export function useBEAffaires(projectId: string | undefined) {
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['be-affaires', projectId],
    queryFn: async (): Promise<BEAffaire[]> => {
      if (!projectId) return [];
      const { data, error } = await sb
        .from('be_affaires')
        .select('*')
        .eq('be_project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as BEAffaire[]) ?? [];
    },
    enabled: !!projectId,
  });

  const kpisQuery = useQuery({
    queryKey: ['be-affaires-kpis', projectId],
    queryFn: async (): Promise<BEAffaireBudgetKPI[]> => {
      if (!projectId) return [];
      const { data, error } = await sb
        .from('v_be_affaire_budget_kpi')
        .select('*')
        .eq('be_project_id', projectId);
      if (error) throw error;
      return (data as BEAffaireBudgetKPI[]) ?? [];
    },
    enabled: !!projectId,
  });

  const createAffaire = useMutation({
    mutationFn: async (input: CreateBEAffaireInput) => {
      const { data, error } = await sb
        .from('be_affaires')
        .insert({
          be_project_id: input.be_project_id,
          code_affaire: input.code_affaire.trim(),
          libelle: input.libelle ?? null,
          description: input.description ?? null,
          date_ouverture: input.date_ouverture ?? null,
          source_creation: input.source_creation ?? 'manuelle',
          source_request_id: input.source_request_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as BEAffaire;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['be-affaires', a.be_project_id] });
      qc.invalidateQueries({ queryKey: ['be-affaires-kpis', a.be_project_id] });
    },
  });

  const updateAffaire = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BEAffaire> }) => {
      const { data, error } = await sb
        .from('be_affaires')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BEAffaire;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['be-affaires', a.be_project_id] });
      qc.invalidateQueries({ queryKey: ['be-affaires-kpis', a.be_project_id] });
      qc.invalidateQueries({ queryKey: ['be-affaire', a.id] });
    },
  });

  const deleteAffaire = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('be_affaires').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-affaires', projectId] });
      qc.invalidateQueries({ queryKey: ['be-affaires-kpis', projectId] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BEAffaireStatus }) => {
      const updates: Partial<BEAffaire> = { status };
      if (status === 'cloturee') updates.date_cloture = new Date().toISOString().slice(0, 10);
      const { data, error } = await sb
        .from('be_affaires')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BEAffaire;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['be-affaires', a.be_project_id] });
      qc.invalidateQueries({ queryKey: ['be-affaire', a.id] });
    },
  });

  const kpisByAffaireId = useMemo(() => {
    const m = new Map<string, BEAffaireBudgetKPI>();
    for (const k of kpisQuery.data ?? []) m.set(k.be_affaire_id, k);
    return m;
  }, [kpisQuery.data]);

  return {
    affaires: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    kpis: kpisQuery.data ?? [],
    kpisByAffaireId,
    createAffaire,
    updateAffaire,
    deleteAffaire,
    updateStatus,
  };
}

/** Fetch d'une affaire seule (pour la page detail). */
export function useBEAffaireById(affaireId: string | undefined) {
  return useQuery({
    queryKey: ['be-affaire', affaireId],
    queryFn: async (): Promise<BEAffaire | null> => {
      if (!affaireId) return null;
      const { data, error } = await sb
        .from('be_affaires')
        .select('*')
        .eq('id', affaireId)
        .maybeSingle();
      if (error) throw error;
      return (data as BEAffaire | null) ?? null;
    },
    enabled: !!affaireId,
  });
}

export interface BEDivaltoAvailableAffaire {
  code_affaire: string;
  nb_pieces: number;
  total_ht: number;
  /** True si une affaire existe deja avec ce code dans be_affaires. */
  already_used: boolean;
}

/**
 * Suggere des code_affaire issus de be_divalto_mouvements qui correspondent
 * au projet courant (chars 2-5 du code_affaire = code_projet en 4 lettres).
 * Pratique pour la creation d'une affaire : on propose tous les codes
 * Divalto deja imputes au projet, avec leur volume.
 */
export function useBEDivaltoAvailableAffaires(
  projectCode: string | null | undefined,
  existingAffaireCodes: string[] = [],
) {
  const projectCodeUpper = projectCode?.trim().toUpperCase() ?? '';
  const usable = projectCodeUpper.length === 4;

  return useQuery({
    queryKey: ['be-divalto-available-affaires', projectCodeUpper],
    queryFn: async (): Promise<BEDivaltoAvailableAffaire[]> => {
      if (!usable) return [];

      // On filtre Divalto : code_affaire dont chars 2-5 = projectCode (case-insensitive)
      // On limite a 100 codes distincts max - amplement suffisant.
      const { data, error } = await sb
        .from('be_divalto_mouvements')
        .select('code_affaire, montant_ht')
        .ilike('code_affaire', `_${projectCodeUpper}%`)
        .not('code_affaire', 'is', null);
      if (error) throw error;

      // Agrege en memoire (Postgrest gratuit n'aime pas le GROUP BY natif)
      const byCode = new Map<string, { nb: number; ht: number }>();
      for (const row of (data ?? []) as { code_affaire: string; montant_ht: number | null }[]) {
        const key = row.code_affaire.trim();
        const cur = byCode.get(key) ?? { nb: 0, ht: 0 };
        cur.nb += 1;
        cur.ht += row.montant_ht ?? 0;
        byCode.set(key, cur);
      }

      const usedSet = new Set(existingAffaireCodes.map(c => c.trim().toUpperCase()));
      const result: BEDivaltoAvailableAffaire[] = Array.from(byCode.entries())
        .map(([code_affaire, { nb, ht }]) => ({
          code_affaire,
          nb_pieces: nb,
          total_ht: ht,
          already_used: usedSet.has(code_affaire.toUpperCase()),
        }))
        .sort((a, b) => b.total_ht - a.total_ht);

      return result;
    },
    enabled: usable,
  });
}

/**
 * Verifie si un code_affaire est deja utilise (UNIQUE en base).
 * Usage : validation cote dialog de creation pour eviter le 23505.
 */
export function useBEAffaireCodeIsAvailable(codeAffaire: string | null | undefined) {
  return useQuery({
    queryKey: ['be-affaire-code-available', codeAffaire],
    queryFn: async (): Promise<boolean> => {
      if (!codeAffaire?.trim()) return true;
      const { data, error } = await sb
        .from('be_affaires')
        .select('id')
        .eq('code_affaire', codeAffaire.trim())
        .maybeSingle();
      if (error) throw error;
      return !data;
    },
    enabled: !!codeAffaire?.trim(),
  });
}
