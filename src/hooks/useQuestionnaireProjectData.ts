import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QUESTIONNAIRE_FILTER_FIELDS } from '@/config/questionnaireFilterConfig';
import { BEProject } from '@/types/beProject';

export type QuestionnaireProjectMap = Record<string, Record<string, string>>;

/**
 * Loads all questionnaire select-field values for all projects.
 * Returns a map: { projectId: { champ_id: valeur, ... } }
 * and a helper to enrich projects with questionnaire data.
 */
export function useQuestionnaireProjectData(projects: BEProject[]) {
  const [qstData, setQstData] = useState<QuestionnaireProjectMap>({});
  const [keonProjectIds, setKeonProjectIds] = useState<Set<string>>(new Set());

  const champIds = useMemo(() => QUESTIONNAIRE_FILTER_FIELDS.map(f => f.champ_id), []);

  useEffect(() => {
    if (champIds.length === 0) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('project_questionnaire')
        .select('project_id, champ_id, valeur')
        .in('champ_id', champIds)
        .not('valeur', 'is', null)
        .neq('valeur', '');

      if (!data) return;

      const map: QuestionnaireProjectMap = {};
      const ids = new Set<string>();
      for (const row of data as { project_id: string; champ_id: string; valeur: string }[]) {
        if (!map[row.project_id]) map[row.project_id] = {};
        map[row.project_id][row.champ_id] = row.valeur;
        ids.add(row.project_id);
      }
      setQstData(map);
      setKeonProjectIds(ids);
    })();
  }, [projects, champIds]);

  /** Get questionnaire value for a project + champ_id */
  const getQstValue = (projectId: string, champId: string): string | undefined => {
    return qstData[projectId]?.[champId];
  };

  /** Get all distinct values for a given champ_id across all projects */
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
