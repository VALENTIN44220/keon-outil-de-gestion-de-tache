import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import type { PilierCode } from '@/config/questionnaireConfig';
import type { FieldDefinition } from '@/hooks/useQuestionnaireFieldDefs';

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
  const { isAdmin } = useUserRole();
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canReadPilier = useCallback((pilierCode: PilierCode): boolean => {
    if (isAdmin) return true;
    if (!profile?.permission_profile_id) return false;
    const pp = (profile as any)?.permission_profile;
    if (!pp) return true;
    return pp[`qst_pilier_${pilierCode}_read`] === true;
  }, [profile, isAdmin]);

  const canWritePilier = useCallback((pilierCode: PilierCode): boolean => {
    if (isAdmin) return true;
    if (!profile?.permission_profile_id) return false;
    const pp = (profile as any)?.permission_profile;
    if (!pp) return false;
    return pp[`qst_pilier_${pilierCode}_write`] === true;
  }, [profile, isAdmin]);

  /**
   * Charge les réponses pour un pilier depuis project_field_values,
   * en joignant questionnaire_field_definitions pour récupérer le champ_id.
   */
  const fetchAnswers = useCallback(async (pilierCode: PilierCode) => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('project_field_values')
        .select(`
          valeur,
          valeur_evaluation,
          updated_at,
          updated_by,
          field_def:questionnaire_field_definitions!field_def_id(champ_id, pilier_code)
        `)
        .eq('project_id', projectId)
        .eq('questionnaire_field_definitions.pilier_code', pilierCode);

      if (error) throw error;

      const map: AnswersMap = {};
      (data || []).forEach((row: any) => {
        const champId = row.field_def?.champ_id;
        if (!champId) return;
        map[champId] = {
          champ_id: champId,
          valeur: row.valeur,
          valeur_evaluation: row.valeur_evaluation,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
        };
      });
      setAnswers(prev => ({ ...prev, ...map }));
    } catch (err: any) {
      console.error('Erreur chargement réponses questionnaire:', err);
      toast.error('Erreur lors du chargement des réponses');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  /**
   * Sauvegarde les réponses d'une section dans project_field_values.
   * Accepte un tableau de FieldDefinition (qui contient field_def_id).
   */
  const saveSectionAnswers = useCallback(async (
    pilierCode: PilierCode,
    section: string,
    fieldDefs: FieldDefinition[],
    localAnswers: AnswersMap
  ) => {
    if (!projectId || !user) return false;
    setIsSaving(true);
    try {
      const upsertRows = fieldDefs.map(fd => ({
        project_id: projectId,
        field_def_id: fd.id,
        valeur: localAnswers[fd.champ_id]?.valeur ?? null,
        valeur_evaluation: localAnswers[fd.champ_id]?.valeur_evaluation ?? null,
        updated_by: profile?.id || null,
      }));

      const { error } = await (supabase as any)
        .from('project_field_values')
        .upsert(upsertRows, { onConflict: 'project_id,field_def_id' });

      if (error) throw error;

      setAnswers(prev => {
        const next = { ...prev };
        upsertRows.forEach((row, i) => {
          const champId = fieldDefs[i].champ_id;
          next[champId] = {
            champ_id: champId,
            valeur: row.valeur,
            valeur_evaluation: row.valeur_evaluation,
          };
        });
        return next;
      });

      toast.success('Section sauvegardée avec succès');
      return true;
    } catch (err: any) {
      console.error('Erreur sauvegarde questionnaire:', err);
      toast.error('Erreur lors de la sauvegarde');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [projectId, user, profile]);

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
