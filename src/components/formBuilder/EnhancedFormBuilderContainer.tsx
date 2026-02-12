import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Loader2,
} from 'lucide-react';
import { useFormBuilder } from '@/hooks/useFormBuilder';
import { useFormSchema } from '@/hooks/useFormSchema';
import { useCustomFields } from '@/hooks/useCustomFields';
import { CommonFieldsLibrary } from './CommonFieldsLibrary';
import { EnhancedFormBuilderCanvas } from './EnhancedFormBuilderCanvas';
import { EnhancedPropertiesPanel } from './EnhancedPropertiesPanel';
import { FormPreviewDrawer } from './FormPreviewDrawer';
import type { FieldTypeConfig, FormField } from '@/types/formBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnhancedFormBuilderContainerProps {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
  canManage?: boolean;
}

export function EnhancedFormBuilderContainer({
  processTemplateId,
  subProcessTemplateId,
  canManage = false,
}: EnhancedFormBuilderContainerProps) {
  const {
    sections,
    fields,
    selectedSectionId,
    selectedFieldId,
    selectedSection,
    selectedField,
    previewMode,
    zoom,
    loadData,
    selectSection,
    selectField,
    addSection,
    updateSection,
    deleteSection,
    updateField,
    moveField,
    togglePreview,
    setZoom,
  } = useFormBuilder({
    processTemplateId,
    subProcessTemplateId,
  });

  // Form schema for JSONB storage
  const {
    schema,
    isLoading: isSchemaLoading,
    isSaving: isSchemaSaving,
    hasChanges: hasSchemaChanges,
    saveSchema,
    toggleCommonField: toggleSchemaCommonField,
  } = useFormSchema({
    processTemplateId,
    subProcessTemplateId,
  });

  // Custom fields for preview - include parent process fields when in sub-process context
  const { fields: templateFields } = useCustomFields({
    processTemplateId,
    subProcessTemplateId,
    includeCommon: true,
    includeParentProcessFields: true,
  });

  const [isCreatingField, setIsCreatingField] = useState(false);
  const [gridColumns, setGridColumns] = useState<1 | 2 | 3 | 4>(2);
  const [activeCommonFields, setActiveCommonFields] = useState<string[]>([
    'requester',
    'company',
    'department',
  ]);

  // Sync active common fields with schema
  useEffect(() => {
    if (schema.common_fields) {
      const enabled = Object.entries(schema.common_fields)
        .filter(([_, v]) => v)
        .map(([k]) => k);
      setActiveCommonFields(enabled);
    }
  }, [schema.common_fields]);

  // Handle adding a new field from the palette (click or drop)
  const handleAddField = useCallback(
    async (config: FieldTypeConfig, targetSectionId?: string | null) => {
      if (!canManage) return;

      setIsCreatingField(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        const sectionId = targetSectionId !== undefined ? targetSectionId : (selectedSectionId || null);

        const fieldData: any = {
          name: `${config.type}_${Date.now()}`,
          label: config.label,
          field_type: config.type,
          description: config.description,
          is_required: false,
          is_common: false,
          process_template_id: processTemplateId || null,
          sub_process_template_id: subProcessTemplateId || null,
          section_id: sectionId,
          column_span: 2,
          column_index: 0,
          row_index: fields.length,
          order_index: fields.length,
          created_by: profile?.id || null,
          validation_type: config.defaultProps?.validation_type || null,
        };

        // Merge default props
        if (config.defaultProps) {
          Object.entries(config.defaultProps).forEach(([key, value]) => {
            if (value !== undefined) {
              fieldData[key] = value;
            }
          });
        }

        const { data, error } = await supabase
          .from('template_custom_fields')
          .insert(fieldData)
          .select()
          .single();

        if (error) throw error;

        toast.success('Champ créé');
        await loadData();
        selectField(data.id);
      } catch (error: any) {
        console.error('Error creating field:', error);
        toast.error(error.message || 'Erreur lors de la création');
      } finally {
        setIsCreatingField(false);
      }
    },
    [canManage, processTemplateId, subProcessTemplateId, selectedSectionId, fields.length, loadData, selectField]
  );

  // Handle drop from palette into a specific section
  const handleDropNewField = useCallback(
    (config: FieldTypeConfig, targetSectionId: string | null) => {
      handleAddField(config, targetSectionId);
    },
    [handleAddField]
  );

  // Handle deleting a field
  const handleDeleteField = useCallback(
    async (fieldId: string) => {
      try {
        const { error } = await supabase
          .from('template_custom_fields')
          .delete()
          .eq('id', fieldId);

        if (error) throw error;

        toast.success('Champ supprimé');
        await loadData();
      } catch (error: any) {
        console.error('Error deleting field:', error);
        toast.error(error.message || 'Erreur lors de la suppression');
      }
    },
    [loadData]
  );

  // Handle duplicating a field
  const handleDuplicateField = useCallback(
    async (fieldId: string) => {
      const fieldToDuplicate = fields.find((f) => f.id === fieldId);
      if (!fieldToDuplicate) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        const duplicateData: any = {
          name: `${fieldToDuplicate.name}_copy_${Date.now()}`,
          label: `${fieldToDuplicate.label} (copie)`,
          field_type: fieldToDuplicate.field_type,
          description: fieldToDuplicate.description,
          is_required: fieldToDuplicate.is_required,
          is_common: fieldToDuplicate.is_common,
          process_template_id: fieldToDuplicate.process_template_id,
          sub_process_template_id: fieldToDuplicate.sub_process_template_id,
          section_id: fieldToDuplicate.section_id,
          column_span: fieldToDuplicate.column_span,
          column_index: fieldToDuplicate.column_index,
          row_index: (fieldToDuplicate.row_index ?? 0) + 1,
          order_index: fieldToDuplicate.order_index + 1,
          default_value: fieldToDuplicate.default_value,
          placeholder: fieldToDuplicate.placeholder,
          options: fieldToDuplicate.options,
          validation_type: fieldToDuplicate.validation_type,
          validation_regex: fieldToDuplicate.validation_regex,
          validation_message: fieldToDuplicate.validation_message,
          min_value: fieldToDuplicate.min_value,
          max_value: fieldToDuplicate.max_value,
          created_by: profile?.id || null,
        };

        const { data, error } = await supabase
          .from('template_custom_fields')
          .insert(duplicateData)
          .select()
          .single();

        if (error) throw error;

        toast.success('Champ dupliqué');
        await loadData();
        selectField(data.id);
      } catch (error: any) {
        console.error('Error duplicating field:', error);
        toast.error(error.message || 'Erreur lors de la duplication');
      }
    },
    [fields, loadData, selectField]
  );

  // Toggle common field - persist to schema
  const handleToggleCommonField = useCallback((fieldId: string, active: boolean) => {
    setActiveCommonFields((prev) =>
      active ? [...prev, fieldId] : prev.filter((id) => id !== fieldId)
    );
    // Persist to schema
    toggleSchemaCommonField(fieldId, active);
  }, [toggleSchemaCommonField]);

  // Handle selecting an existing field
  const handleSelectExistingField = useCallback(
    (field: FormField) => {
      selectField(field.id);
    },
    [selectField]
  );

  // Add section
  const handleAddSection = useCallback(async () => {
    if (!canManage) return;
    await addSection({
      label: 'Nouvelle section',
      name: `section_${Date.now()}`,
    });
  }, [addSection, canManage]);

  return (
    <div className="h-[calc(100vh-16rem)] flex flex-col border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {sections.length} section(s)
          </Badge>
          <Badge variant="outline" className="text-xs">
            {fields.length} champ(s)
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border rounded-md px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs w-10 text-center">{zoom}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(Math.min(150, zoom + 10))}
              disabled={zoom >= 150}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(100)}
              disabled={zoom === 100}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Preview drawer */}
          <FormPreviewDrawer
            schema={schema}
            fields={templateFields}
            trigger={
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Aperçu
              </Button>
            }
          />

          {/* Save schema button */}
          {canManage && hasSchemaChanges && (
            <Button
              size="sm"
              onClick={saveSchema}
              disabled={isSchemaSaving}
            >
              {isSchemaSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauver schéma
            </Button>
          )}

          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={loadData}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Field library */}
        {canManage && !previewMode && (
          <CommonFieldsLibrary
            existingFields={fields as FormField[]}
            activeCommonFields={activeCommonFields}
            onToggleCommonField={handleToggleCommonField}
            onAddField={handleAddField}
            onSelectExistingField={handleSelectExistingField}
            canManage={canManage}
          />
        )}

        {/* Center: Canvas */}
        <EnhancedFormBuilderCanvas
          sections={sections}
          fields={fields as FormField[]}
          selectedSectionId={selectedSectionId}
          selectedFieldId={selectedFieldId}
          previewMode={previewMode}
          zoom={zoom}
          gridColumns={gridColumns}
          onSelectSection={selectSection}
          onSelectField={selectField}
          onAddSection={handleAddSection}
          onDeleteSection={deleteSection}
          onUpdateSection={updateSection}
          onMoveField={moveField}
          onDeleteField={handleDeleteField}
          onDuplicateField={handleDuplicateField}
          onSetGridColumns={setGridColumns}
          onDropNewField={handleDropNewField}
          canManage={canManage}
        />

        {/* Right: Properties panel */}
        {canManage && !previewMode && (
          <EnhancedPropertiesPanel
            selectedSection={selectedSection}
            selectedField={selectedField as FormField | null}
            allFields={fields as FormField[]}
            allSections={sections}
            onUpdateSection={updateSection}
            onUpdateField={updateField}
            onDeleteSection={deleteSection}
            onDeleteField={handleDeleteField}
            canManage={canManage}
          />
        )}
      </div>

      {/* Creating field indicator */}
      {isCreatingField && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Création du champ...</span>
          </div>
        </div>
      )}
    </div>
  );
}
