import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PilierCode, Question } from '@/config/questionnaireConfig';

export interface QuestionnaireAnswer {
  champ_id: string;
  valeur: string | null;
  valeur_evaluation: string | null;
  updated_at?: string;
  updated_by?: string;
}

export type AnswersMap = Record<string, QuestionnaireAnswer>;

export function useProjectQuestionnaire(projectId: string, codeDivalto: string) {
  const { user, profile } = useAuth();
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canReadPilier = useCallback((pilierCode: PilierCode): boolean => {
    if (!profile?.permission_profile_id) return false;
    // We'll check via the permission profile data loaded with the profile
    const pp = (profile as any)?.permission_profile;
    if (!pp) return true; // default to true if no profile loaded yet
    return pp[`qst_pilier_${pilierCode}_read`] === true;
  }, [profile]);

  const canWritePilier = useCallback((pilierCode: PilierCode): boolean => {
    if (!profile?.permission_profile_id) return false;
    const pp = (profile as any)?.permission_profile;
    if (!pp) return false;
    return pp[`qst_pilier_${pilierCode}_write`] === true;
  }, [profile]);

  const fetchAnswers = useCallback(async (pilierCode: PilierCode) => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('project_questionnaire')
        .select('champ_id, valeur, valeur_evaluation, updated_at, updated_by')
        .eq('project_id', projectId)
        .eq('pilier_code', pilierCode);

      if (error) throw error;

      const map: AnswersMap = {};
      (data || []).forEach((row: any) => {
        map[row.champ_id] = row;
      });
      setAnswers(prev => ({ ...prev, ...map }));
    } catch (err: any) {
      console.error('Error fetching questionnaire answers:', err);
      toast.error('Erreur lors du chargement des réponses');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const saveSectionAnswers = useCallback(async (
    pilierCode: PilierCode,
    section: string,
    questions: Question[],
    localAnswers: AnswersMap
  ) => {
    if (!projectId || !user) return false;
    setIsSaving(true);
    try {
      const upsertRows = questions.map(q => ({
        project_id: projectId,
        code_divalto: codeDivalto,
        pilier_code: pilierCode,
        section: section,
        sous_section: q.sous_section || null,
        champ_id: q.champ_id,
        question: q.label,
        valeur: localAnswers[q.champ_id]?.valeur ?? null,
        valeur_evaluation: localAnswers[q.champ_id]?.valeur_evaluation ?? null,
        type_champ: q.type,
        valeurs_possibles: q.options?.join(',') || null,
        note: q.note || null,
        updated_by: profile?.id || null,
      }));

      const { error } = await (supabase as any)
        .from('project_questionnaire')
        .upsert(upsertRows, { onConflict: 'project_id,champ_id' });

      if (error) throw error;

      setAnswers(prev => {
        const next = { ...prev };
        upsertRows.forEach(row => {
          next[row.champ_id] = {
            champ_id: row.champ_id,
            valeur: row.valeur,
            valeur_evaluation: row.valeur_evaluation,
          };
        });
        return next;
      });

      toast.success('Section sauvegardée avec succès');
      return true;
    } catch (err: any) {
      console.error('Error saving questionnaire section:', err);
      toast.error('Erreur lors de la sauvegarde');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [projectId, codeDivalto, user, profile]);

  return {
    answers,
    isLoading,
    isSaving,
    fetchAnswers,
    saveSectionAnswers,
    canReadPilier,
    canWritePilier,
  };
}
