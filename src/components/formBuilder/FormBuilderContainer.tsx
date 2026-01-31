import { useState, useCallback } from 'react';
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
import { FormBuilderCanvas } from './FormBuilderCanvas';
import { FormBuilderPalette } from './FormBuilderPalette';
import { FormBuilderPropertiesPanel } from './FormBuilderPropertiesPanel';
import type { FieldTypeConfig, FormField } from '@/types/formBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FormBuilderContainerProps {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
  canManage?: boolean;
}

export function FormBuilderContainer({
  processTemplateId,
  subProcessTemplateId,
  canManage = false,
}: FormBuilderContainerProps) {
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

  const [isCreatingField, setIsCreatingField] = useState(false);

  const handleAddField = useCallback(
    async (config: FieldTypeConfig) => {
      if (!canManage) return;
      
      setIsCreatingField(true);
      try {
        // Get current profile
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        const fieldData: any = {
          name: `${config.type}_${Date.now()}`,
          label: config.label,
          field_type: config.type,
          description: config.description,
          is_required: false,
          is_common: false,
          process_template_id: processTemplateId || null,
          sub_process_template_id: subProcessTemplateId || null,
          section_id: selectedSectionId || null,
          column_span: 2,
          column_index: 0,
          row_index: fields.length,
          order_index: fields.length,
          created_by: profile?.id || null,
          validation_type: config.defaultProps?.validation_type || null,
        };

        // Merge default props (avoiding spread type issues)
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
    [
      canManage,
      processTemplateId,
      subProcessTemplateId,
      selectedSectionId,
      fields.length,
      loadData,
      selectField,
    ]
  );

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

          {/* Preview toggle */}
          <Button
            variant={previewMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => togglePreview()}
          >
            {previewMode ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Édition
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Aperçu
              </>
            )}
          </Button>

          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={loadData}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left palette */}
        {canManage && !previewMode && (
          <FormBuilderPalette onAddField={handleAddField} />
        )}

        {/* Center canvas */}
        <FormBuilderCanvas
          sections={sections}
          fields={fields as FormField[]}
          selectedSectionId={selectedSectionId}
          selectedFieldId={selectedFieldId}
          previewMode={previewMode}
          zoom={zoom}
          onSelectSection={selectSection}
          onSelectField={selectField}
          onAddSection={handleAddSection}
          onDeleteSection={deleteSection}
        />

        {/* Right properties panel */}
        {canManage && !previewMode && (
          <FormBuilderPropertiesPanel
            selectedSection={selectedSection}
            selectedField={selectedField as FormField | null}
            allFields={fields as FormField[]}
            allSections={sections}
            onUpdateSection={updateSection}
            onUpdateField={updateField}
            onDeleteSection={deleteSection}
            onDeleteField={handleDeleteField}
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
