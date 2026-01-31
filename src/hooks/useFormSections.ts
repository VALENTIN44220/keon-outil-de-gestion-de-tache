import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FormSection, ConditionOperator } from '@/types/formBuilder';

interface UseFormSectionsOptions {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
  includeCommon?: boolean;
}

export function useFormSections(options: UseFormSectionsOptions = {}) {
  const { processTemplateId, subProcessTemplateId, includeCommon = true } = options;
  
  const [sections, setSections] = useState<FormSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSections = useCallback(async () => {
    setIsLoading(true);
    try {
      const orConditions: string[] = [];

      if (includeCommon) {
        orConditions.push('is_common.eq.true');
      }

      if (processTemplateId && !subProcessTemplateId) {
        orConditions.push(`process_template_id.eq.${processTemplateId}`);
      }

      if (subProcessTemplateId) {
        orConditions.push(`sub_process_template_id.eq.${subProcessTemplateId}`);
      }

      let query = supabase
        .from('form_sections')
        .select('*')
        .order('order_index', { ascending: true });

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedSections = (data || []).map((section: any) => ({
        ...section,
        condition_operator: section.condition_operator as ConditionOperator | null,
      }));

      setSections(typedSections);
    } catch (error) {
      console.error('Error fetching form sections:', error);
      toast.error('Erreur lors du chargement des sections');
    } finally {
      setIsLoading(false);
    }
  }, [processTemplateId, subProcessTemplateId, includeCommon]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const createSection = useCallback(
    async (sectionData: Partial<FormSection>) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        const insertData = {
          name: sectionData.name || 'section',
          label: sectionData.label || 'Nouvelle section',
          description: sectionData.description || null,
          process_template_id: sectionData.process_template_id || processTemplateId || null,
          sub_process_template_id: sectionData.sub_process_template_id || subProcessTemplateId || null,
          is_common: sectionData.is_common ?? false,
          is_collapsible: sectionData.is_collapsible ?? false,
          is_collapsed_by_default: sectionData.is_collapsed_by_default ?? false,
          order_index: sectionData.order_index ?? sections.length,
          condition_field_id: sectionData.condition_field_id || null,
          condition_operator: sectionData.condition_operator || null,
          condition_value: sectionData.condition_value || null,
          created_by: profile?.id || null,
        };

        const { data, error } = await supabase
          .from('form_sections')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        toast.success('Section créée');
        await fetchSections();
        return data as FormSection;
      } catch (error: any) {
        console.error('Error creating section:', error);
        toast.error(error.message || 'Erreur lors de la création');
        return null;
      }
    },
    [fetchSections, processTemplateId, subProcessTemplateId, sections.length]
  );

  const updateSection = useCallback(
    async (id: string, updates: Partial<FormSection>) => {
      try {
        const { error } = await supabase
          .from('form_sections')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;

        toast.success('Section mise à jour');
        await fetchSections();
        return true;
      } catch (error: any) {
        console.error('Error updating section:', error);
        toast.error(error.message || 'Erreur lors de la mise à jour');
        return false;
      }
    },
    [fetchSections]
  );

  const deleteSection = useCallback(
    async (id: string) => {
      try {
        // First, unlink all fields from this section
        await supabase
          .from('template_custom_fields')
          .update({ section_id: null })
          .eq('section_id', id);

        const { error } = await supabase
          .from('form_sections')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast.success('Section supprimée');
        await fetchSections();
        return true;
      } catch (error: any) {
        console.error('Error deleting section:', error);
        toast.error(error.message || 'Erreur lors de la suppression');
        return false;
      }
    },
    [fetchSections]
  );

  const reorderSections = useCallback(
    async (orderedIds: string[]) => {
      try {
        const updates = orderedIds.map((id, index) => ({
          id,
          order_index: index,
        }));

        for (const update of updates) {
          await supabase
            .from('form_sections')
            .update({ order_index: update.order_index })
            .eq('id', update.id);
        }

        await fetchSections();
        return true;
      } catch (error: any) {
        console.error('Error reordering sections:', error);
        toast.error('Erreur lors du réordonnancement');
        return false;
      }
    },
    [fetchSections]
  );

  return {
    sections,
    isLoading,
    refetch: fetchSections,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
  };
}
