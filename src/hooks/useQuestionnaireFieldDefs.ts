import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ChampType, PilierCode } from '@/config/questionnaireConfig';

export interface FieldDefinition {
  id: string;
  champ_id: string;
  pilier_code: PilierCode;
  section: string;
  sous_section: string | null;
  label: string;
  type: ChampType;
  options: string[] | null;
  note: string | null;
  has_evaluation_risque: boolean;
  required: boolean;
  order_index: number;
  is_builtin: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SectionGroup {
  section: string;
  sousSections: string[];
  fields: FieldDefinition[];
}

/** Charge toutes les définitions de champs actives pour un pilier donné */
export function useQuestionnaireFieldDefs(pilierCode?: PilierCode | string) {
  return useQuery<FieldDefinition[]>({
    queryKey: ['questionnaire-field-defs', pilierCode ?? 'all'],
    staleTime: 5 * 60 * 1000, // 5 min — les defs changent peu souvent
    queryFn: async () => {
      let query = (supabase as any)
        .from('questionnaire_field_definitions')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (pilierCode) {
        query = query.eq('pilier_code', pilierCode);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Mappe type_champ → type pour compatibilité avec les composants existants
      return (data as any[]).map(row => ({
        ...row,
        type: row.type_champ as ChampType,
      })) as FieldDefinition[];
    },
  });
}

/** Charge toutes les définitions (tous piliers), utile pour useQuestionnaireProjectData */
export function useAllQuestionnaireFieldDefs() {
  return useQuestionnaireFieldDefs(undefined);
}

/** Regroupe les champs par section/sous-section pour un pilier */
export function groupFieldsBySection(fields: FieldDefinition[]): SectionGroup[] {
  const sections = [...new Set(fields.map(f => f.section))];
  return sections.map(section => {
    const sectionFields = fields.filter(f => f.section === section);
    const sousSections = [
      ...new Set(sectionFields.map(f => f.sous_section).filter(Boolean)),
    ] as string[];
    return { section, sousSections, fields: sectionFields };
  });
}

export interface NewCustomFieldInput {
  pilier_code: PilierCode;
  section: string;
  sous_section?: string;
  label: string;
  type: ChampType;
  options?: string[];
  note?: string;
}

/** Mutation pour ajouter un champ personnalisé */
export function useAddCustomField() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: NewCustomFieldInput) => {
      // Génère un champ_id stable à partir du pilier + label
      const slug = input.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 40);
      const champ_id = `${input.pilier_code}_CUSTOM_${slug}_${Date.now()}`;

      // Calcule l'order_index = max actuel pour ce pilier+section + 10
      const { data: existing } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .select('order_index')
        .eq('pilier_code', input.pilier_code)
        .eq('section', input.section)
        .order('order_index', { ascending: false })
        .limit(1);

      const maxOrder = existing?.[0]?.order_index ?? 0;

      const { data, error } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .insert({
          champ_id,
          pilier_code: input.pilier_code,
          section: input.section,
          sous_section: input.sous_section || null,
          label: input.label,
          type_champ: input.type,
          options: input.options && input.options.length > 0 ? input.options : null,
          note: input.note || null,
          is_builtin: false,
          is_active: true,
          order_index: maxOrder + 10,
          created_by: profile?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Champ personnalisé ajouté');
      // Invalide le cache pour tous les piliers concernés
      queryClient.invalidateQueries({ queryKey: ['questionnaire-field-defs'] });
    },
    onError: (err: any) => {
      console.error('Erreur ajout champ custom:', err);
      toast.error("Erreur lors de l'ajout du champ");
    },
  });
}
