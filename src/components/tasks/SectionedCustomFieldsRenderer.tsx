import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ValidatedCustomFieldsRenderer } from './ValidatedCustomFieldsRenderer';
import { Badge } from '@/components/ui/badge';
import { Layers, FormInput } from 'lucide-react';
import { TemplateCustomField } from '@/types/customField';
import type { FormSection } from '@/types/formBuilder';
import { supabase } from '@/integrations/supabase/client';

interface SectionedCustomFieldsRendererProps {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
  fields: TemplateCustomField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

interface FieldSection {
  id: string;
  label: string;
  fields: TemplateCustomField[];
  isDefault?: boolean;
}

export function SectionedCustomFieldsRenderer({
  processTemplateId,
  subProcessTemplateId,
  fields,
  values,
  onChange,
  errors = {},
  disabled = false,
}: SectionedCustomFieldsRendererProps) {
  const [sections, setSections] = useState<FormSection[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');

  // Load sections from database
  useEffect(() => {
    const fetchSections = async () => {
      const orConditions: string[] = ['is_common.eq.true'];
      
      if (processTemplateId) {
        orConditions.push(`process_template_id.eq.${processTemplateId}`);
      }
      if (subProcessTemplateId) {
        orConditions.push(`sub_process_template_id.eq.${subProcessTemplateId}`);
      }

      const { data, error } = await supabase
        .from('form_sections')
        .select('*')
        .or(orConditions.join(','))
        .order('order_index');

      if (!error && data) {
        setSections(data as FormSection[]);
      }
    };

    fetchSections();
  }, [processTemplateId, subProcessTemplateId]);

  // Organize fields by sections
  const fieldSections = useMemo((): FieldSection[] => {
    const result: FieldSection[] = [];
    const fieldsInSections = new Set<string>();

    // First, group fields by their assigned sections
    for (const section of sections) {
      const sectionFields = fields.filter(f => f.section_id === section.id);
      if (sectionFields.length > 0) {
        sectionFields.forEach(f => fieldsInSections.add(f.id));
        result.push({
          id: section.id,
          label: section.label,
          fields: sectionFields.sort((a, b) => a.order_index - b.order_index),
        });
      }
    }

    // Create a default section for fields without a section
    const unsectionedFields = fields.filter(f => !fieldsInSections.has(f.id));
    if (unsectionedFields.length > 0) {
      // If there are no other sections, don't show "Général" tab
      if (result.length === 0) {
        result.push({
          id: 'default',
          label: 'Champs',
          fields: unsectionedFields.sort((a, b) => a.order_index - b.order_index),
          isDefault: true,
        });
      } else {
        // Insert at beginning
        result.unshift({
          id: 'default',
          label: 'Général',
          fields: unsectionedFields.sort((a, b) => a.order_index - b.order_index),
          isDefault: true,
        });
      }
    }

    return result;
  }, [fields, sections]);

  // Set initial active tab
  useEffect(() => {
    if (fieldSections.length > 0 && !activeTab) {
      setActiveTab(fieldSections[0].id);
    }
  }, [fieldSections, activeTab]);

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FormInput className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Aucun champ personnalisé pour cette demande.</p>
      </div>
    );
  }

  // If only one section, render directly without tabs
  if (fieldSections.length === 1) {
    return (
      <div className="space-y-4">
        <ValidatedCustomFieldsRenderer
          fields={fieldSections[0].fields}
          values={values}
          onChange={onChange}
          disabled={disabled}
          validateOnChange={true}
        />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
        {fieldSections.map((section) => (
          <TabsTrigger
            key={section.id}
            value={section.id}
            className="flex items-center gap-1.5 px-3 py-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{section.label}</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {section.fields.length}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>

      {fieldSections.map((section) => (
        <TabsContent key={section.id} value={section.id} className="mt-4">
          <ValidatedCustomFieldsRenderer
            fields={section.fields}
            values={values}
            onChange={onChange}
            disabled={disabled}
            validateOnChange={true}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
