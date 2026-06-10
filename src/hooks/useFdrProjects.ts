import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { FdrProjectInput, FdrChangelogAction } from '@/types/fdr';

/** Projet FDR enrichi des champs d'affichage / filtres pour la feuille de route. */
export interface FdrRoadmapProject extends FdrProjectInput {
  categorie_fdr?: string | null;
  pilier?: string | null;
  priorite?: string | null;
  pct_avancement?: number | null;
}

/** Tous les projets IT au format moteur de calcul, avec champs de filtre. */
export function useFdrProjects() {
  return useQuery<FdrRoadmapProject[]>({
    queryKey: ['fdr-projects'],
    queryFn: async () => {
      const { data: projects, error: pErr } = await supabase
        .from('it_projects')
        .select(`
          id, code_projet_digital, nom_projet,
          statut_portefeuille, sur_feuille_de_route,
          date_kickoff, date_mep_saisie, delai_projete_mois, echeance_cible,
          suivi_j_mois, profil_principal,
          externe, pct_reduction_si_externe,
          activite_metier, categorie_fdr, pilier, priorite, pct_avancement
        `);
      if (pErr) throw pErr;

      const { data: loads, error: lErr } = await supabase
        .from('it_project_load')
        .select('it_project_id, profil_id, j_mois, profil:fdr_profils(code)');
      if (lErr) throw lErr;

      const loadsByProject: Record<string, Array<{ profil_code: string; j_mois: number }>> = {};
      for (const l of loads ?? []) {
        const code = (l.profil as any)?.code;
        if (!code) continue;
        (loadsByProject[l.it_project_id] ??= []).push({ profil_code: code, j_mois: l.j_mois });
      }

      return (projects ?? []).map(p => ({
        id: p.id,
        code: p.code_projet_digital,
        nom: p.nom_projet,
        activite_metier: p.activite_metier,
        profil_principal: p.profil_principal,
        statut_portefeuille: (p.statut_portefeuille ?? 'Idée') as FdrProjectInput['statut_portefeuille'],
        sur_feuille_de_route: p.sur_feuille_de_route ?? true,
        date_kickoff: p.date_kickoff,
        date_mep_saisie: p.date_mep_saisie,
        delai_projete_mois: p.delai_projete_mois,
        echeance_cible: p.echeance_cible,
        suivi_j_mois: p.suivi_j_mois ?? 0,
        loads: loadsByProject[p.id] ?? [],
        externe: p.externe ?? false,
        pct_reduction_si_externe: p.pct_reduction_si_externe ?? 0,
        categorie_fdr: p.categorie_fdr,
        pilier: p.pilier,
        priorite: p.priorite,
        pct_avancement: p.pct_avancement,
      }));
    },
    staleTime: 30_000,
  });
}

export interface FdrProjectPatch {
  projectId: string;
  /** Champs it_projects à mettre à jour. */
  patch: Record<string, unknown>;
  /** Pour le journal : action + détail par champ. */
  action: FdrChangelogAction;
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
}

/** Patch un projet + écrit le journal fdr_changelog. Utilisé par drag/resize/menu contextuel et l'undo/redo. */
export function usePatchFdrProject() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ projectId, patch, action, changes }: FdrProjectPatch) => {
      const { error } = await supabase.from('it_projects').update(patch).eq('id', projectId);
      if (error) throw error;

      const rows = changes.map(c => ({
        it_project_id: projectId,
        user_id: user?.id ?? null,
        action,
        field_changed: c.field,
        old_value: c.oldValue == null ? null : String(c.oldValue),
        new_value: c.newValue == null ? null : String(c.newValue),
      }));
      if (rows.length > 0) {
        // Le journal ne doit jamais bloquer la modification elle-même.
        const { error: logErr } = await supabase.from('fdr_changelog').insert(rows);
        if (logErr) console.warn('[fdr_changelog]', logErr.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fdr-projects'] });
      qc.invalidateQueries({ queryKey: ['fdr-capacity-matrix'] });
    },
  });
}
