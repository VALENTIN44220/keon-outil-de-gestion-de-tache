import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Nature d'un renfort simulé : embauche interne ou sous-traitance externe. */
export type HireKind = 'embauche' | 'sous_traitance';

/** Un renfort simulé : un profil, un nombre d'ETP, à partir d'un mois 'YYYY-MM'. */
export interface SimulatedHire {
  profil_code: string;
  nb_etp: number;
  start_ym: string;
  /** 'embauche' (interne) par défaut, ou 'sous_traitance' (externe). */
  kind?: HireKind;
}

/**
 * Override d'un projet propre à un scénario : on ne stocke que les champs
 * que l'on veut faire varier ; les champs absents gardent la valeur du projet.
 */
export interface ProjectOverride {
  it_project_id: string;
  date_kickoff?: string | null;          // 'YYYY-MM-DD' ou 'YYYY-MM'
  date_mep_saisie?: string | null;       // idem
  /** Durée build (mois) — décalage/étirement depuis la feuille de route. */
  delai_projete_mois?: number | null;
  /** Échéance cible (tâches permanentes) — étirement depuis la feuille de route. */
  echeance_cible?: string | null;
  externe?: boolean;
  pct_reduction_si_externe?: number;     // 0..1
  budget_externe_eur?: number | null;
}

/** Hypothèses de coût utilisées pour le ROI agrégé d'un scénario. */
export interface ScenarioAssumptions {
  /** Coût annuel chargé d'un ETP embauché (€/an). */
  cout_annuel_etp_embauche?: number;
  /** TJM de la sous-traitance générique (€/j). */
  tjm_st?: number;
}

export interface FdrHireScenario {
  id: string;
  nom: string;
  hires: SimulatedHire[];
  project_overrides: ProjectOverride[];
  assumptions: ScenarioAssumptions;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload de création/màj d'un scénario (hires + leviers projet + hypothèses). */
export interface ScenarioPayload {
  nom: string;
  hires: SimulatedHire[];
  project_overrides?: ProjectOverride[];
  assumptions?: ScenarioAssumptions;
}

const KEY = ['fdr-hire-scenarios'];

// project_overrides/hires sont du JSONB : le typage généré du client provoque
// une instanciation de type trop profonde (TS2589) → on caste l'accès client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export function useFdrHireScenarios() {
  const qc = useQueryClient();

  const list = useQuery<FdrHireScenario[]>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await db()
        .from('fdr_hire_scenarios')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      type Row = Omit<FdrHireScenario, 'hires' | 'project_overrides' | 'assumptions'> & {
        hires: unknown;
        project_overrides?: unknown;
        assumptions?: unknown;
      };
      return ((data ?? []) as Row[]).map((r) => ({
        ...r,
        hires: Array.isArray(r.hires) ? (r.hires as SimulatedHire[]) : [],
        project_overrides: Array.isArray(r.project_overrides)
          ? (r.project_overrides as ProjectOverride[])
          : [],
        assumptions:
          r.assumptions && typeof r.assumptions === 'object'
            ? (r.assumptions as ScenarioAssumptions)
            : {},
      }));
    },
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: async (payload: ScenarioPayload) => {
      const { data, error } = await db()
        .from('fdr_hire_scenarios')
        .insert({
          nom: payload.nom,
          hires: payload.hires,
          project_overrides: payload.project_overrides ?? [],
          assumptions: payload.assumptions ?? {},
        })
        .select()
        .single();
      if (error) throw error;
      return data as FdrHireScenario;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Partial<ScenarioPayload>) => {
      const { error } = await db()
        .from('fdr_hire_scenarios')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('fdr_hire_scenarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { scenarios: list.data ?? [], isLoading: list.isLoading, create, update, remove };
}
