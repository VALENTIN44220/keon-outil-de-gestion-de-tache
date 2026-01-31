import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TemplateCustomField, CustomFieldType, FieldOption } from '@/types/customField';
import { toast } from 'sonner';

interface UseCustomFieldsOptions {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
  includeCommon?: boolean;
  /**
   * When true and subProcessTemplateId is provided, also fetches fields
   * from the parent process template
   */
  includeParentProcessFields?: boolean;
}

export function useCustomFields(options: UseCustomFieldsOptions = {}) {
  const { 
    processTemplateId, 
    subProcessTemplateId, 
    includeCommon = true,
    includeParentProcessFields = false 
  } = options;
  
  const [fields, setFields] = useState<TemplateCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [parentProcessId, setParentProcessId] = useState<string | null>(null);

  // Fetch parent process ID if we have a sub-process and need parent fields
  useEffect(() => {
    async function fetchParentProcessId() {
      if (subProcessTemplateId && includeParentProcessFields) {
        const { data } = await supabase
          .from('sub_process_templates')
          .select('process_template_id')
          .eq('id', subProcessTemplateId)
          .single();
        
        if (data?.process_template_id) {
          setParentProcessId(data.process_template_id);
        }
      } else {
        setParentProcessId(null);
      }
    }
    fetchParentProcessId();
  }, [subProcessTemplateId, includeParentProcessFields]);

  const fetchFields = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build OR conditions for the query
      const orConditions: string[] = [];

      // Always include common fields if requested
      if (includeCommon) {
        orConditions.push('is_common.eq.true');
      }

      // Include process-level fields
      if (processTemplateId && !subProcessTemplateId) {
        orConditions.push(`process_template_id.eq.${processTemplateId}`);
      }

      // Include sub-process fields
      if (subProcessTemplateId) {
        orConditions.push(`sub_process_template_id.eq.${subProcessTemplateId}`);
        
        // Also include parent process fields if requested
        if (includeParentProcessFields && parentProcessId) {
          orConditions.push(`process_template_id.eq.${parentProcessId}`);
        }
      }

      let query = supabase
        .from('template_custom_fields')
        .select('*')
        .order('order_index', { ascending: true });

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      } else if (!includeCommon) {
        // No conditions and no common - return empty
        setFields([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;

      // Cast the data to our type
      const typedFields = (data || []).map((field: any) => ({
        ...field,
        field_type: field.field_type as CustomFieldType,
        options: field.options as FieldOption[] | null,
        condition_operator: field.condition_operator as TemplateCustomField['condition_operator'],
        conditions_logic: (field.conditions_logic || 'AND') as 'AND' | 'OR',
        validation_params: field.validation_params as Record<string, any> | null,
        additional_conditions: field.additional_conditions as Array<{ field_id: string; operator: string; value: string }> | null,
      }));

      setFields(typedFields);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      toast.error('Erreur lors du chargement des champs personnalisés');
    } finally {
      setIsLoading(false);
    }
  }, [processTemplateId, subProcessTemplateId, includeCommon, includeParentProcessFields, parentProcessId]);

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
        conditions_logic: (data.conditions_logic || 'AND') as 'AND' | 'OR',
        validation_params: data.validation_params as Record<string, any> | null,
        additional_conditions: data.additional_conditions as Array<{ field_id: string; operator: string; value: string }> | null,
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

  const deleteMultipleFields = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('template_custom_fields')
        .delete()
        .in('id', ids);
      if (error) throw error;
      setFields((prev) => prev.filter((f) => !ids.includes(f.id)));
      toast.success(`${ids.length} champ(s) supprimé(s)`);
    } catch (error) {
      console.error('Error deleting fields:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const updateMultipleFieldsScope = async (
    ids: string[],
    scope: {
      is_common: boolean;
      process_template_id: string | null;
      sub_process_template_id: string | null;
    }
  ) => {
    try {
      const { error } = await supabase
        .from('template_custom_fields')
        .update({
          is_common: scope.is_common,
          process_template_id: scope.process_template_id,
          sub_process_template_id: scope.sub_process_template_id,
        })
        .in('id', ids);
      if (error) throw error;
      toast.success(`Portée mise à jour pour ${ids.length} champ(s)`);
      await fetchAllFields();
    } catch (error) {
      console.error('Error updating fields scope:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  return {
    fields,
    isLoading,
    deleteField,
    deleteMultipleFields,
    updateMultipleFieldsScope,
    refetch: fetchAllFields,
  };
}
