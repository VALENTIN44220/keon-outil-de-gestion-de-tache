import { useReducer, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  FormBuilderState,
  FormBuilderAction,
  FormSection,
  FormField,
  ConditionOperator,
  ValidationType,
} from '@/types/formBuilder';
import type { CustomFieldType, FieldOption } from '@/types/customField';

const initialState: FormBuilderState = {
  sections: [],
  fields: [],
  selectedSectionId: null,
  selectedFieldId: null,
  isDragging: false,
  previewMode: false,
  zoom: 100,
};

function formBuilderReducer(
  state: FormBuilderState,
  action: FormBuilderAction
): FormBuilderState {
  switch (action.type) {
    case 'SET_SECTIONS':
      return { ...state, sections: action.payload };

    case 'SET_FIELDS':
      return { ...state, fields: action.payload };

    case 'SELECT_SECTION':
      return {
        ...state,
        selectedSectionId: action.payload,
        selectedFieldId: null,
      };

    case 'SELECT_FIELD':
      return {
        ...state,
        selectedFieldId: action.payload,
        selectedSectionId: null,
      };

    case 'ADD_SECTION':
      return {
        ...state,
        sections: [...state.sections, action.payload],
        selectedSectionId: action.payload.id,
      };

    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };

    case 'DELETE_SECTION':
      return {
        ...state,
        sections: state.sections.filter((s) => s.id !== action.payload),
        selectedSectionId:
          state.selectedSectionId === action.payload
            ? null
            : state.selectedSectionId,
        // Move fields from deleted section to no section
        fields: state.fields.map((f) =>
          f.section_id === action.payload ? { ...f, section_id: null } : f
        ),
      };

    case 'ADD_FIELD':
      return {
        ...state,
        fields: [...state.fields, action.payload],
        selectedFieldId: action.payload.id,
      };

    case 'UPDATE_FIELD':
      return {
        ...state,
        fields: state.fields.map((f) =>
          f.id === action.payload.id ? { ...f, ...action.payload } : f
        ),
      };

    case 'DELETE_FIELD':
      return {
        ...state,
        fields: state.fields.filter((f) => f.id !== action.payload),
        selectedFieldId:
          state.selectedFieldId === action.payload
            ? null
            : state.selectedFieldId,
      };

    case 'MOVE_FIELD':
      return {
        ...state,
        fields: state.fields.map((f) =>
          f.id === action.payload.fieldId
            ? {
                ...f,
                section_id: action.payload.targetSectionId,
                order_index: action.payload.targetIndex,
              }
            : f
        ),
      };

    case 'REORDER_SECTIONS':
      const sectionOrder = action.payload;
      return {
        ...state,
        sections: state.sections
          .map((s) => ({
            ...s,
            order_index: sectionOrder.indexOf(s.id),
          }))
          .sort((a, b) => a.order_index - b.order_index),
      };

    case 'SET_DRAGGING':
      return { ...state, isDragging: action.payload };

    case 'TOGGLE_PREVIEW':
      return {
        ...state,
        previewMode: action.payload ?? !state.previewMode,
      };

    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };

    default:
      return state;
  }
}

interface UseFormBuilderOptions {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
}

export function useFormBuilder(options: UseFormBuilderOptions = {}) {
  const { processTemplateId, subProcessTemplateId } = options;
  const [state, dispatch] = useReducer(formBuilderReducer, initialState);

  // Load sections and fields
  const loadData = useCallback(async () => {
    try {
      // Build OR conditions for sections
      const sectionConditions: string[] = ['is_common.eq.true'];
      if (processTemplateId) {
        sectionConditions.push(`process_template_id.eq.${processTemplateId}`);
      }
      if (subProcessTemplateId) {
        sectionConditions.push(`sub_process_template_id.eq.${subProcessTemplateId}`);
      }

      // Fetch sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('form_sections')
        .select('*')
        .or(sectionConditions.join(','))
        .order('order_index');

      if (sectionsError) throw sectionsError;

      // Build OR conditions for fields
      const fieldConditions: string[] = ['is_common.eq.true'];
      if (processTemplateId) {
        fieldConditions.push(`process_template_id.eq.${processTemplateId}`);
      }
      if (subProcessTemplateId) {
        fieldConditions.push(`sub_process_template_id.eq.${subProcessTemplateId}`);
      }

      // Fetch fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('template_custom_fields')
        .select('*')
        .or(fieldConditions.join(','))
        .order('order_index');

      if (fieldsError) throw fieldsError;

      // Cast types
      const sections = (sectionsData || []).map((s: any) => ({
        ...s,
        condition_operator: s.condition_operator as ConditionOperator | null,
      })) as FormSection[];

      const fields = (fieldsData || []).map((f: any) => ({
        ...f,
        field_type: f.field_type as CustomFieldType,
        options: f.options as FieldOption[] | null,
        condition_operator: f.condition_operator as ConditionOperator | null,
        validation_type: f.validation_type as ValidationType | null,
        conditions_logic: (f.conditions_logic || 'AND') as 'AND' | 'OR',
        additional_conditions: f.additional_conditions || null,
      })) as FormField[];

      dispatch({ type: 'SET_SECTIONS', payload: sections });
      dispatch({ type: 'SET_FIELDS', payload: fields });
    } catch (error) {
      console.error('Error loading form builder data:', error);
      toast.error('Erreur lors du chargement du formulaire');
    }
  }, [processTemplateId, subProcessTemplateId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
  const selectSection = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_SECTION', payload: id });
  }, []);

  const selectField = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_FIELD', payload: id });
  }, []);

  const addSection = useCallback(
    async (sectionData: Partial<FormSection>) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        const insertData = {
          name: sectionData.name || `section_${Date.now()}`,
          label: sectionData.label || 'Nouvelle section',
          description: sectionData.description || null,
          process_template_id: processTemplateId || null,
          sub_process_template_id: subProcessTemplateId || null,
          is_common: sectionData.is_common ?? false,
          is_collapsible: sectionData.is_collapsible ?? false,
          is_collapsed_by_default: sectionData.is_collapsed_by_default ?? false,
          order_index: state.sections.length,
          created_by: profile?.id || null,
        };

        const { data, error } = await supabase
          .from('form_sections')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        dispatch({
          type: 'ADD_SECTION',
          payload: data as FormSection,
        });

        toast.success('Section créée');
        return data as FormSection;
      } catch (error: any) {
        console.error('Error creating section:', error);
        toast.error(error.message || 'Erreur lors de la création');
        return null;
      }
    },
    [processTemplateId, subProcessTemplateId, state.sections.length]
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

        dispatch({
          type: 'UPDATE_SECTION',
          payload: { id, ...updates },
        });

        return true;
      } catch (error: any) {
        console.error('Error updating section:', error);
        toast.error(error.message || 'Erreur lors de la mise à jour');
        return false;
      }
    },
    []
  );

  const deleteSection = useCallback(async (id: string) => {
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

      dispatch({ type: 'DELETE_SECTION', payload: id });
      toast.success('Section supprimée');
      return true;
    } catch (error: any) {
      console.error('Error deleting section:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
  }, []);

  const updateField = useCallback(
    async (id: string, updates: Partial<FormField>) => {
      try {
        // Clean up the updates object to match DB schema
        const dbUpdates: Record<string, any> = {};
        
        const allowedKeys = [
          'name', 'label', 'field_type', 'description', 'is_required',
          'options', 'default_value', 'placeholder', 'validation_regex',
          'min_value', 'max_value', 'condition_field_id', 'condition_operator',
          'condition_value', 'order_index', 'section_id', 'column_span',
          'row_index', 'column_index', 'width_ratio', 'validation_type',
          'validation_message', 'validation_params', 'conditions_logic',
          'additional_conditions', 'lookup_table', 'lookup_value_column',
          'lookup_label_column',
        ];

        for (const key of allowedKeys) {
          if (key in updates) {
            dbUpdates[key] = (updates as any)[key];
          }
        }

        dbUpdates.updated_at = new Date().toISOString();

        const { error } = await supabase
          .from('template_custom_fields')
          .update(dbUpdates)
          .eq('id', id);

        if (error) throw error;

        dispatch({
          type: 'UPDATE_FIELD',
          payload: { id, ...updates },
        });

        return true;
      } catch (error: any) {
        console.error('Error updating field:', error);
        toast.error(error.message || 'Erreur lors de la mise à jour');
        return false;
      }
    },
    []
  );

  const moveField = useCallback(
    async (
      fieldId: string,
      targetSectionId: string | null,
      targetIndex: number
    ) => {
      try {
        // Optimistically update local state first
        dispatch({
          type: 'MOVE_FIELD',
          payload: { fieldId, targetSectionId, targetIndex },
        });

        const { error } = await supabase
          .from('template_custom_fields')
          .update({
            section_id: targetSectionId,
            order_index: targetIndex,
            updated_at: new Date().toISOString(),
          })
          .eq('id', fieldId);

        if (error) throw error;

        toast.success('Champ déplacé');
        return true;
      } catch (error: any) {
        console.error('Error moving field:', error);
        toast.error(error.message || 'Erreur lors du déplacement');
        // Reload data to revert optimistic update
        await loadData();
        return false;
      }
    },
    [loadData]
  );

  const reorderSections = useCallback(async (orderedIds: string[]) => {
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase
          .from('form_sections')
          .update({ order_index: i })
          .eq('id', orderedIds[i]);
      }

      dispatch({ type: 'REORDER_SECTIONS', payload: orderedIds });
      return true;
    } catch (error: any) {
      console.error('Error reordering sections:', error);
      toast.error('Erreur lors du réordonnancement');
      return false;
    }
  }, []);

  const togglePreview = useCallback((value?: boolean) => {
    dispatch({ type: 'TOGGLE_PREVIEW', payload: value });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: 'SET_ZOOM', payload: zoom });
  }, []);

  const setDragging = useCallback((isDragging: boolean) => {
    dispatch({ type: 'SET_DRAGGING', payload: isDragging });
  }, []);

  // Get the currently selected section or field
  const selectedSection = state.selectedSectionId
    ? state.sections.find((s) => s.id === state.selectedSectionId) || null
    : null;

  const selectedField = state.selectedFieldId
    ? state.fields.find((f) => f.id === state.selectedFieldId) || null
    : null;

  return {
    // State
    sections: state.sections,
    fields: state.fields,
    selectedSectionId: state.selectedSectionId,
    selectedFieldId: state.selectedFieldId,
    selectedSection,
    selectedField,
    isDragging: state.isDragging,
    previewMode: state.previewMode,
    zoom: state.zoom,

    // Actions
    loadData,
    selectSection,
    selectField,
    addSection,
    updateSection,
    deleteSection,
    updateField,
    moveField,
    reorderSections,
    togglePreview,
    setZoom,
    setDragging,
  };
}
