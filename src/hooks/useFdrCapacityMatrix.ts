import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFdrSettings, useFdrProfils } from './useFdrSettings';
import { computeCapacityMatrix, toYM } from '@/lib/fdr/calculationEngine';
import type {
  FdrCapacityMatrix,
  FdrProjectInput,
  FdrEngineSettings,
} from '@/types/fdr';

/** Charge tous les projets IT avec leurs loads et calcule la matrice capacité. */
export function useFdrCapacityMatrix() {
  const { data: settings } = useFdrSettings();
  const { data: profils = [] } = useFdrProfils();

  return useQuery<FdrCapacityMatrix>({
    queryKey: ['fdr-capacity-matrix', settings?.id, profils.map(p => p.id).join(',')],
    enabled: !!settings && profils.length > 0,
    queryFn: async () => {
      // 1. Récupère tous les projets IT avec les champs FDR
      const { data: projects, error: pErr } = await supabase
        .from('it_projects')
        .select(`
          id, code_projet_digital, nom_projet,
          statut_portefeuille, sur_feuille_de_route,
          date_kickoff, date_mep_saisie, delai_projete_mois, echeance_cible,
          suivi_j_mois, profil_principal,
          externe, pct_reduction_si_externe,
          activite_metier, categorie_fdr
        `);
      if (pErr) throw pErr;

      // 2. Récupère toute la ventilation build
      const { data: loads, error: lErr } = await supabase
        .from('it_project_load')
        .select('it_project_id, profil_id, j_mois, profil:fdr_profils(code)');
      if (lErr) throw lErr;

      // Index loads par projet
      const loadsByProject: Record<string, Array<{ profil_code: string; j_mois: number }>> = {};
      for (const l of loads ?? []) {
        const code = (l.profil as any)?.code;
        if (!code) continue;
        if (!loadsByProject[l.it_project_id]) loadsByProject[l.it_project_id] = [];
        loadsByProject[l.it_project_id].push({ profil_code: code, j_mois: l.j_mois });
      }

      // 3. Transforme en FdrProjectInput
      const inputs: FdrProjectInput[] = (projects ?? []).map(p => ({
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
      }));

      // 4. Construit FdrEngineSettings
      const engineSettings: FdrEngineSettings = {
        jours_productifs_mois: settings!.jours_productifs_mois,
        echeance_standard_permanentes: toYM(settings!.echeance_standard_permanentes) ?? '2030-12',
        horizon_debut: toYM(settings!.horizon_debut) ?? '2026-06',
        horizon_duree_mois: settings!.horizon_duree_mois,
        profils: profils
          .filter(p => p.actif)
          .map(p => ({ code: p.code, capacite_j_mois: p.capacite_j_mois })),
      };

      return computeCapacityMatrix(inputs, engineSettings);
    },
    staleTime: 30_000,
  });
}
