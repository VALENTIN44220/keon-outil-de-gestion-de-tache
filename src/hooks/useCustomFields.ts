import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TemplateCustomField, CustomFieldType, FieldOption } from '@/types/customField';
import { toast } from 'sonner';

interface UseCustomFieldsOptions {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
  includeCommon?: boolean;
}

export function useCustomFields(options: UseCustomFieldsOptions = {}) {
  const { processTemplateId, subProcessTemplateId, includeCommon = true } = options;
  
  const [fields, setFields] = useState<TemplateCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('template_custom_fields')
        .select('*')
        .order('order_index', { ascending: true });

      // Build filter conditions
      if (processTemplateId && !subProcessTemplateId) {
        // Fetch fields for this process + common fields
        if (includeCommon) {
          query = query.or(`process_template_id.eq.${processTemplateId},is_common.eq.true`);
        } else {
          query = query.eq('process_template_id', processTemplateId);
        }
      } else if (subProcessTemplateId) {
        // Fetch fields for this sub-process + common fields
        if (includeCommon) {
          query = query.or(`sub_process_template_id.eq.${subProcessTemplateId},is_common.eq.true`);
        } else {
          query = query.eq('sub_process_template_id', subProcessTemplateId);
        }
      } else if (includeCommon) {
        // Fetch only common fields
        query = query.eq('is_common', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Cast the data to our type
      const typedFields = (data || []).map((field: any) => ({
        ...field,
        field_type: field.field_type as CustomFieldType,
        options: field.options as FieldOption[] | null,
        condition_operator: field.condition_operator as TemplateCustomField['condition_operator'],
      }));

      setFields(typedFields);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      toast.error('Erreur lors du chargement des champs personnalisés');
    } finally {
      setIsLoading(false);
    }
  }, [processTemplateId, subProcessTemplateId, includeCommon]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const addField = async (field: Omit<TemplateCustomField, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('template_custom_fields')
        .insert({
          name: field.name,
          label: field.label,
          field_type: field.field_type,
          description: field.description,
          process_template_id: field.process_template_id,
          sub_process_template_id: field.sub_process_template_id,
          is_common: field.is_common,
          is_required: field.is_required,
          options: field.options as any,
          default_value: field.default_value,
          placeholder: field.placeholder,
          validation_regex: field.validation_regex,
          min_value: field.min_value,
          max_value: field.max_value,
          condition_field_id: field.condition_field_id,
          condition_operator: field.condition_operator,
          condition_value: field.condition_value,
          order_index: field.order_index,
          created_by: field.created_by,
        })
        .select()
        .single();

      if (error) throw error;

      const typedField: TemplateCustomField = {
        ...data,
        field_type: data.field_type as CustomFieldType,
        options: data.options as unknown as FieldOption[] | null,
        condition_operator: data.condition_operator as TemplateCustomField['condition_operator'],
      };

      setFields((prev) => [...prev, typedField].sort((a, b) => a.order_index - b.order_index));
      toast.success('Champ ajouté avec succès');
      return typedField;
    } catch (error) {
      console.error('Error adding custom field:', error);
      toast.error("Erreur lors de l'ajout du champ");
      throw error;
    }
  };

  const updateField = async (id: string, updates: Partial<TemplateCustomField>) => {
    try {
      const { error } = await supabase
        .from('template_custom_fields')
        .update({
          name: updates.name,
          label: updates.label,
          field_type: updates.field_type,
          description: updates.description,
          is_required: updates.is_required,
          options: updates.options as any,
          default_value: updates.default_value,
          placeholder: updates.placeholder,
          validation_regex: updates.validation_regex,
          min_value: updates.min_value,
          max_value: updates.max_value,
          condition_field_id: updates.condition_field_id,
          condition_operator: updates.condition_operator,
          condition_value: updates.condition_value,
          order_index: updates.order_index,
        })
        .eq('id', id);

      if (error) throw error;

      setFields((prev) =>
        prev
          .map((f) => (f.id === id ? { ...f, ...updates } : f))
          .sort((a, b) => a.order_index - b.order_index)
      );
      toast.success('Champ mis à jour');
    } catch (error) {
      console.error('Error updating custom field:', error);
      toast.error('Erreur lors de la mise à jour du champ');
      throw error;
    }
  };

  const deleteField = async (id: string) => {
    try {
      const { error } = await supabase.from('template_custom_fields').delete().eq('id', id);

      if (error) throw error;

      setFields((prev) => prev.filter((f) => f.id !== id));
      toast.success('Champ supprimé');
    } catch (error) {
      console.error('Error deleting custom field:', error);
      toast.error('Erreur lors de la suppression du champ');
      throw error;
    }
  };

  const reorderFields = async (reorderedFields: TemplateCustomField[]) => {
    try {
      const updates = reorderedFields.map((field, index) => ({
        id: field.id,
        order_index: index,
      }));

      for (const update of updates) {
        await supabase
          .from('template_custom_fields')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
      }

      setFields(reorderedFields.map((f, i) => ({ ...f, order_index: i })));
    } catch (error) {
      console.error('Error reordering fields:', error);
      toast.error('Erreur lors du réordonnancement');
      throw error;
    }
  };

  return {
    fields,
    isLoading,
    addField,
    updateField,
    deleteField,
    reorderFields,
    refetch: fetchFields,
  };
}

// Hook for fetching all custom fields (for the global tab)
export function useAllCustomFields() {
  const [fields, setFields] = useState<TemplateCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllFields = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('template_custom_fields')
        .select(`
          *,
          process_template:process_templates(id, name),
          sub_process_template:sub_process_templates(id, name)
        `)
        .order('is_common', { ascending: false })
        .order('order_index', { ascending: true });

      if (error) throw error;

      const typedFields = (data || []).map((field: any) => ({
        ...field,
        field_type: field.field_type as CustomFieldType,
        options: field.options as FieldOption[] | null,
        condition_operator: field.condition_operator as TemplateCustomField['condition_operator'],
      }));

      setFields(typedFields);
    } catch (error) {
      console.error('Error fetching all custom fields:', error);
      toast.error('Erreur lors du chargement des champs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllFields();
  }, [fetchAllFields]);

  const deleteField = async (id: string) => {
    try {
      const { error } = await supabase.from('template_custom_fields').delete().eq('id', id);
      if (error) throw error;
      setFields((prev) => prev.filter((f) => f.id !== id));
      toast.success('Champ supprimé');
    } catch (error) {
      console.error('Error deleting field:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return {
    fields,
    isLoading,
    deleteField,
    refetch: fetchAllFields,
  };
}
