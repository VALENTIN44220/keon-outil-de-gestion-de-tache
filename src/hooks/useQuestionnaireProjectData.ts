import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BEProject } from '@/types/beProject';

export type QuestionnaireProjectMap = Record<string, Record<string, string>>;

/**
 * Charge les valeurs de questionnaire pour tous les projets.
 * Lit depuis project_field_values (jointure avec questionnaire_field_definitions
 * pour récupérer le champ_id). Ne dépend plus de la config statique QUESTIONS.
 *
 * Retourne : { projectId: { champ_id: valeur, ... } }
 */
export function useQuestionnaireProjectData(projects: BEProject[]) {
  const [qstData, setQstData] = useState<QuestionnaireProjectMap>({});
  const [keonProjectIds, setKeonProjectIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projects.length === 0) return;

    (async () => {
      const { data, error } = await (supabase as any)
        .from('project_field_values')
        .select(`
          project_id,
          valeur,
          field_def:questionnaire_field_definitions!field_def_id(champ_id)
        `)
        .not('valeur', 'is', null)
        .neq('valeur', '');

      if (error) {
        console.error('Erreur chargement données questionnaire:', error);
        return;
      }

      const map: QuestionnaireProjectMap = {};
      const ids = new Set<string>();

      for (const row of (data || []) as { project_id: string; valeur: string; field_def: { champ_id: string } | null }[]) {
        const champId = row.field_def?.champ_id;
        if (!champId || !row.valeur) continue;
        if (!map[row.project_id]) map[row.project_id] = {};
        map[row.project_id][champId] = row.valeur;
        ids.add(row.project_id);
      }

      setQstData(map);
      setKeonProjectIds(ids);
    })();
  }, [projects]);

  /** Valeur d'un champ pour un projet */
  const getQstValue = (projectId: string, champId: string): string | undefined => {
    return qstData[projectId]?.[champId];
  };

  /** Valeurs distinctes d'un champ_id sur tous les projets */
  const getDistinctValues = (champId: string): string[] => {
    const set = new Set<string>();
    for (const projectData of Object.values(qstData)) {
      const v = projectData[champId];
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  };

  return { qstData, keonProjectIds, getQstValue, getDistinctValues };
}
