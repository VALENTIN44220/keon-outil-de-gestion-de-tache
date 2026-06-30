import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFdrSettings, useFdrProfils } from './useFdrSettings';
import { toYM } from '@/lib/fdr/calculationEngine';
import type { FdrProjectInput, FdrEngineSettings } from '@/types/fdr';

export interface FdrProjectInputsResult {
  inputs: FdrProjectInput[];
  engineSettings: FdrEngineSettings;
}

/**
 * Charge les projets IT (champs FDR) + leur ventilation build et les transforme
 * en `FdrProjectInput[]` prêts pour le moteur, accompagnés des `FdrEngineSettings`.
 *
 * Découplé de `useFdrCapacityMatrix` pour pouvoir réutiliser les mêmes inputs
 * dans les simulations de scénario (overrides de dates / externalisation) sans
 * refaire les requêtes.
 */
export function useFdrProjectInputs() {
  const { data: settings } = useFdrSettings();
  const { data: profils = [] } = useFdrProfils();

  return useQuery<FdrProjectInputsResult>({
    queryKey: ['fdr-project-inputs', settings?.id, profils.map((p) => p.id).join(',')],
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
          externe, pct_reduction_si_externe, budget_externe_eur,
          activite_metier, categorie_fdr
        `);
      if (pErr) throw pErr;

      // 2. Récupère toute la ventilation build (j/mois uniforme)
      const { data: loads, error: lErr } = await supabase
        .from('it_project_load')
        .select('it_project_id, profil_id, j_mois, profil:fdr_profils(code)');
      if (lErr) throw lErr;

      // 2bis. Détail mensuel optionnel
      const { data: monthRows } = await (supabase as any)
        .from('it_project_load_months')
        .select('it_project_id, j_mois, ym, profil:fdr_profils(code)');
      // proj → code → { ym: j_mois }
      const monthsMap: Record<string, Record<string, Record<string, number>>> = {};
      for (const m of (monthRows ?? []) as any[]) {
        const code = m.profil?.code;
        if (!code) continue;
        ((monthsMap[m.it_project_id] ??= {})[code] ??= {})[m.ym] = Number(m.j_mois) || 0;
      }

      // Index loads par projet (+ attache le détail mensuel)
      const loadsByProject: Record<string, Array<{ profil_code: string; j_mois: number; months?: Record<string, number> }>> = {};
      const seen: Record<string, Set<string>> = {};
      for (const l of loads ?? []) {
        const code = (l.profil as any)?.code;
        if (!code) continue;
        (loadsByProject[l.it_project_id] ??= []).push({
          profil_code: code, j_mois: l.j_mois, months: monthsMap[l.it_project_id]?.[code],
        });
        (seen[l.it_project_id] ??= new Set()).add(code);
      }
      // Profils ayant uniquement du détail mensuel (pas de ligne it_project_load)
      for (const [proj, byCode] of Object.entries(monthsMap)) {
        for (const code of Object.keys(byCode)) {
          if (!seen[proj]?.has(code)) {
            (loadsByProject[proj] ??= []).push({ profil_code: code, j_mois: 0, months: byCode[code] });
          }
        }
      }

      // 3. Transforme en FdrProjectInput
      const inputs: FdrProjectInput[] = (projects ?? []).map((p) => ({
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
        budget_externe_eur: p.budget_externe_eur ?? null,
      }));

      // 4. Construit FdrEngineSettings
      const engineSettings: FdrEngineSettings = {
        jours_productifs_mois: settings!.jours_productifs_mois,
        echeance_standard_permanentes: toYM(settings!.echeance_standard_permanentes) ?? '2030-12',
        horizon_debut: toYM(settings!.horizon_debut) ?? '2026-06',
        horizon_duree_mois: settings!.horizon_duree_mois,
        profils: profils
          .filter((p) => p.actif)
          .map((p) => ({ code: p.code, capacite_j_mois: p.capacite_j_mois })),
      };

      return { inputs, engineSettings };
    },
    staleTime: 30_000,
  });
}
