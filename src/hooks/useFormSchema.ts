import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  FormSchema,
  FormSchemaSection,
  FormSchemaPlacement,
} from '@/types/formSchema';
import {
  DEFAULT_FORM_SCHEMA,
  validateFormSchema,
  mergeWithDefaults,
} from '@/types/formSchema';

interface UseFormSchemaProps {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
}

interface UseFormSchemaResult {
  schema: FormSchema;
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  loadSchema: () => Promise<void>;
  saveSchema: () => Promise<boolean>;
  updateSchema: (updates: Partial<FormSchema>) => void;
  updateSection: (sectionId: string, updates: Partial<FormSchemaSection>) => void;
  addSection: (section: Omit<FormSchemaSection, 'order_index'>) => void;
  removeSection: (sectionId: string) => void;
  updatePlacement: (fieldId: string, updates: Partial<FormSchemaPlacement>) => void;
  addPlacement: (placement: FormSchemaPlacement) => void;
  removePlacement: (fieldId: string) => void;
  movePlacement: (fieldId: string, targetSectionId: string, targetIndex: number) => void;
  toggleCommonField: (fieldKey: string, enabled: boolean) => void;
  resetToDefault: () => void;
}

export function useFormSchema({
  processTemplateId,
  subProcessTemplateId,
}: UseFormSchemaProps): UseFormSchemaResult {
  const [schema, setSchema] = useState<FormSchema>(DEFAULT_FORM_SCHEMA);
  const [originalSchema, setOriginalSchema] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = originalSchema
    ? JSON.stringify(schema) !== JSON.stringify(originalSchema)
    : false;

  // Load schema from database
  const loadSchema = useCallback(async () => {
    if (!processTemplateId && !subProcessTemplateId) return;

    setIsLoading(true);
    try {
      let data: any;

      if (processTemplateId) {
        const { data: processData, error } = await supabase
          .from('process_templates')
          .select('form_schema')
          .eq('id', processTemplateId)
          .single();

        if (error) throw error;
        data = processData?.form_schema;
      } else if (subProcessTemplateId) {
        const { data: subProcessData, error } = await supabase
          .from('sub_process_templates')
          .select('form_schema')
          .eq('id', subProcessTemplateId)
          .single();

        if (error) throw error;
        data = subProcessData?.form_schema;
      }

      if (data && validateFormSchema(data)) {
        const loadedSchema = mergeWithDefaults(data);
        setSchema(loadedSchema);
        setOriginalSchema(loadedSchema);
      } else {
        // Use default schema
        setSchema(DEFAULT_FORM_SCHEMA);
        setOriginalSchema(DEFAULT_FORM_SCHEMA);
      }
    } catch (error: any) {
      console.error('Error loading form schema:', error);
      toast.error('Erreur lors du chargement du schéma');
    } finally {
      setIsLoading(false);
    }
  }, [processTemplateId, subProcessTemplateId]);

  // Save schema to database
  const saveSchema = useCallback(async (): Promise<boolean> => {
    if (!processTemplateId && !subProcessTemplateId) return false;

    setIsSaving(true);
    try {
      if (processTemplateId) {
        const { error } = await supabase
          .from('process_templates')
          .update({ form_schema: schema as any })
          .eq('id', processTemplateId);

        if (error) throw error;
      } else if (subProcessTemplateId) {
        const { error } = await supabase
          .from('sub_process_templates')
          .update({ form_schema: schema as any })
          .eq('id', subProcessTemplateId);

        if (error) throw error;
      }

      setOriginalSchema(schema);
      toast.success('Schéma enregistré');
      return true;
    } catch (error: any) {
      console.error('Error saving form schema:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [processTemplateId, subProcessTemplateId, schema]);

  // Update entire schema
  const updateSchema = useCallback((updates: Partial<FormSchema>) => {
    setSchema((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update a section
  const updateSection = useCallback(
    (sectionId: string, updates: Partial<FormSchemaSection>) => {
      setSchema((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, ...updates } : s
        ),
      }));
    },
    []
  );

  // Add a section
  const addSection = useCallback(
    (section: Omit<FormSchemaSection, 'order_index'>) => {
      setSchema((prev) => {
        const maxOrder = Math.max(...prev.sections.map((s) => s.order_index), -1);
        const newSection: FormSchemaSection = {
          ...section,
          order_index: maxOrder + 1,
        };
        return { ...prev, sections: [...prev.sections, newSection] };
      });
    },
    []
  );

  // Remove a section
  const removeSection = useCallback((sectionId: string) => {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
      placements: prev.placements.map((p) =>
        p.section_id === sectionId
          ? { ...p, section_id: prev.sections[0]?.id || 'default_section' }
          : p
      ),
    }));
  }, []);

  // Update a placement
  const updatePlacement = useCallback(
    (fieldId: string, updates: Partial<FormSchemaPlacement>) => {
      setSchema((prev) => ({
        ...prev,
        placements: prev.placements.map((p) =>
          p.field_id === fieldId ? { ...p, ...updates } : p
        ),
      }));
    },
    []
  );

  // Add a placement
  const addPlacement = useCallback((placement: FormSchemaPlacement) => {
    setSchema((prev) => ({
      ...prev,
      placements: [...prev.placements, placement],
    }));
  }, []);

  // Remove a placement
  const removePlacement = useCallback((fieldId: string) => {
    setSchema((prev) => ({
      ...prev,
      placements: prev.placements.filter((p) => p.field_id !== fieldId),
    }));
  }, []);

  // Move a placement to another section
  const movePlacement = useCallback(
    (fieldId: string, targetSectionId: string, targetIndex: number) => {
      setSchema((prev) => {
        const placement = prev.placements.find((p) => p.field_id === fieldId);
        if (!placement) return prev;

        // Update section and reindex
        const otherPlacements = prev.placements.filter((p) => p.field_id !== fieldId);
        const sectionPlacements = otherPlacements
          .filter((p) => p.section_id === targetSectionId)
          .sort((a, b) => a.order_index - b.order_index);

        // Insert at target index
        const updatedPlacement: FormSchemaPlacement = {
          ...placement,
          section_id: targetSectionId,
          order_index: targetIndex,
        };

        // Reindex section placements
        sectionPlacements.splice(targetIndex, 0, updatedPlacement);
        const reindexedPlacements = sectionPlacements.map((p, i) => ({
          ...p,
          order_index: i,
        }));

        // Combine with placements from other sections
        const otherSectionPlacements = otherPlacements.filter(
          (p) => p.section_id !== targetSectionId
        );

        return {
          ...prev,
          placements: [...otherSectionPlacements, ...reindexedPlacements],
        };
      });
    },
    []
  );

  // Toggle common field
  const toggleCommonField = useCallback((fieldKey: string, enabled: boolean) => {
    setSchema((prev) => ({
      ...prev,
      common_fields: {
        ...prev.common_fields,
        [fieldKey]: enabled,
      },
    }));
  }, []);

  // Reset to default
  const resetToDefault = useCallback(() => {
    setSchema(DEFAULT_FORM_SCHEMA);
  }, []);

  // Load on mount
  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  return {
    schema,
    isLoading,
    isSaving,
    hasChanges,
    loadSchema,
    saveSchema,
    updateSchema,
    updateSection,
    addSection,
    removeSection,
    updatePlacement,
    addPlacement,
    removePlacement,
    movePlacement,
    toggleCommonField,
    resetToDefault,
  };
}
