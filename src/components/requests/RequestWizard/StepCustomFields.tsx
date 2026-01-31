import { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormInput, GitBranch, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CustomFieldsRenderer } from '@/components/tasks/CustomFieldsRenderer';
import { TemplateCustomField } from '@/types/customField';
import { RequestWizardData } from './types';

interface StepCustomFieldsProps {
  data: RequestWizardData;
  onDataChange: (updates: Partial<RequestWizardData>) => void;
}

interface FieldGroup {
  type: 'common' | 'process' | 'subprocess';
  label: string;
  subProcessId?: string;
  subProcessName?: string;
  fields: TemplateCustomField[];
}

export function StepCustomFields({ data, onDataChange }: StepCustomFieldsProps) {
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFields = async () => {
      if (!data.processId) return;

      setIsLoading(true);
      try {
        // Fetch process-level fields
        const { data: processFields } = await supabase
          .from('template_custom_fields')
          .select('*')
          .eq('process_template_id', data.processId)
          .is('sub_process_template_id', null)
          .order('order_index');

        // Fetch sub-process fields for selected sub-processes
        const { data: subProcessFields } = await supabase
          .from('template_custom_fields')
          .select('*, sub_process_templates!inner(id, name)')
          .in('sub_process_template_id', data.selectedSubProcesses)
          .order('order_index');

        const groups: FieldGroup[] = [];
        const commonFieldsMap = new Map<string, TemplateCustomField>();
        const processSpecificFields: TemplateCustomField[] = [];

        // Process-level fields
        if (processFields) {
          for (const field of processFields) {
            const typedField = {
              ...field,
              options: Array.isArray(field.options) ? field.options : null,
            } as unknown as TemplateCustomField;

            if (field.is_common) {
              commonFieldsMap.set(field.id, typedField);
            } else {
              processSpecificFields.push(typedField);
            }
          }
        }

        // Sub-process fields (deduplicate common ones)
        const subProcessGroups = new Map<string, { name: string; fields: TemplateCustomField[] }>();

        if (subProcessFields) {
          for (const field of subProcessFields) {
            const spId = field.sub_process_template_id;
            const spName = (field as any).sub_process_templates?.name || 'Sous-processus';
            const typedField = {
              ...field,
              options: Array.isArray(field.options) ? field.options : null,
            } as unknown as TemplateCustomField;

            if (field.is_common && !commonFieldsMap.has(field.id)) {
              commonFieldsMap.set(field.id, typedField);
            } else if (!field.is_common) {
              if (!subProcessGroups.has(spId)) {
                subProcessGroups.set(spId, { name: spName, fields: [] });
              }
              subProcessGroups.get(spId)!.fields.push(typedField);
            }
          }
        }

        // Build groups
        if (commonFieldsMap.size > 0) {
          groups.push({
            type: 'common',
            label: 'Champs communs',
            fields: Array.from(commonFieldsMap.values()),
          });
        }

        if (processSpecificFields.length > 0) {
          groups.push({
            type: 'process',
            label: 'Processus',
            fields: processSpecificFields,
          });
        }

        for (const [spId, group] of subProcessGroups) {
          if (group.fields.length > 0) {
            groups.push({
              type: 'subprocess',
              label: group.name,
              subProcessId: spId,
              subProcessName: group.name,
              fields: group.fields,
            });
          }
        }

        setFieldGroups(groups);
      } catch (error) {
        console.error('Error fetching custom fields:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFields();
  }, [data.processId, data.selectedSubProcesses]);

  const handleFieldChange = (fieldId: string, value: any) => {
    onDataChange({
      customFieldValues: {
        ...data.customFieldValues,
        [fieldId]: value,
      },
    });
  };

  const totalFieldCount = useMemo(() => {
    return fieldGroups.reduce((sum, g) => sum + g.fields.length, 0);
  }, [fieldGroups]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (totalFieldCount === 0) {
    return (
      <div className="text-center py-16">
        <FormInput className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="font-semibold text-lg mb-2">Aucun champ personnalisé</h3>
        <p className="text-muted-foreground">
          Ce processus n'a pas de champs supplémentaires à remplir.
          <br />
          Vous pouvez passer à l'étape suivante.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">Remplissez le formulaire</h2>
        <p className="text-muted-foreground">
          Complétez les informations demandées pour votre demande
        </p>
        <Badge variant="secondary" className="mt-3">
          {totalFieldCount} champ(s) à renseigner
        </Badge>
      </div>

      <ScrollArea className="h-[450px] pr-4">
        <div className="space-y-6 pb-4">
          {fieldGroups.map((group, groupIndex) => (
            <Card key={`group-${groupIndex}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {group.type === 'common' && <FormInput className="h-4 w-4" />}
                  {group.type === 'process' && <Layers className="h-4 w-4" />}
                  {group.type === 'subprocess' && <GitBranch className="h-4 w-4" />}
                  {group.label}
                  <Badge variant="outline" className="ml-auto text-xs">
                    {group.fields.length} champ(s)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CustomFieldsRenderer
                  fields={group.fields}
                  values={data.customFieldValues}
                  onChange={handleFieldChange}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
