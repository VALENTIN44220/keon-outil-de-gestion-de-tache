import { useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormInput, Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ValidatedCustomFieldsRenderer } from "@/components/tasks/ValidatedCustomFieldsRenderer";
import { TemplateCustomField } from "@/types/customField";
import { RequestWizardData } from "./types";
import type { FormSection } from "@/types/formBuilder";

interface StepCustomFieldsProps {
  data: RequestWizardData;
  onDataChange: (updates: Partial<RequestWizardData>) => void;
}

interface FieldSectionGroup {
  id: string;
  label: string;
  fields: TemplateCustomField[];
  isDefault?: boolean;
}

const DEBUG_REACT_185 =
  import.meta.env.DEV && typeof window !== "undefined" && window.localStorage?.getItem("debug-react185") === "1";

export function StepCustomFields({ data, onDataChange }: StepCustomFieldsProps) {
  const [allFields, setAllFields] = useState<TemplateCustomField[]>([]);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFieldsAndSections = async () => {
      if (!data.processId) return;

      setIsLoading(true);
      try {
        // Build OR conditions for sections
        const sectionConditions: string[] = ["is_common.eq.true"];
        sectionConditions.push(`process_template_id.eq.${data.processId}`);

        if (data.selectedSubProcesses.length > 0) {
          const spConditions = data.selectedSubProcesses.map((id) => `sub_process_template_id.eq.${id}`);
          sectionConditions.push(...spConditions);
        }

        // Fetch sections
        const { data: sectionsData } = await supabase
          .from("form_sections")
          .select("*")
          .or(sectionConditions.join(","))
          .order("order_index");

        if (sectionsData) {
          setSections(sectionsData as FormSection[]);
        }

        // Fetch process-level fields
        const { data: processFields } = await supabase
          .from("template_custom_fields")
          .select("*")
          .eq("process_template_id", data.processId)
          .is("sub_process_template_id", null)
          .order("order_index");

        // Fetch sub-process fields for selected sub-processes
        let subProcessFields: any[] = [];
        if (data.selectedSubProcesses.length > 0) {
          const { data: spFields } = await supabase
            .from("template_custom_fields")
            .select("*")
            .in("sub_process_template_id", data.selectedSubProcesses)
            .order("order_index");
          subProcessFields = spFields || [];
        }

        // Combine and deduplicate by ID
        const fieldsMap = new Map<string, TemplateCustomField>();

        for (const field of processFields || []) {
          const typedField = {
            ...field,
            options: Array.isArray(field.options) ? field.options : null,
          } as unknown as TemplateCustomField;
          fieldsMap.set(field.id, typedField);
        }

        for (const field of subProcessFields) {
          const typedField = {
            ...field,
            options: Array.isArray(field.options) ? field.options : null,
          } as unknown as TemplateCustomField;
          if (!fieldsMap.has(field.id)) {
            fieldsMap.set(field.id, typedField);
          }
        }

        setAllFields(Array.from(fieldsMap.values()));
      } catch (error) {
        console.error("Error fetching custom fields:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFieldsAndSections();
  }, [data.processId, data.selectedSubProcesses]);

  // Organize fields by sections
  const fieldSections = useMemo((): FieldSectionGroup[] => {
    const result: FieldSectionGroup[] = [];
    const fieldsInSections = new Set<string>();

    // Group fields by their assigned sections
    for (const section of sections) {
      const sectionFields = allFields.filter((f) => f.section_id === section.id);
      if (sectionFields.length > 0) {
        sectionFields.forEach((f) => fieldsInSections.add(f.id));
        result.push({
          id: section.id,
          label: section.label,
          fields: sectionFields.sort((a, b) => a.order_index - b.order_index),
        });
      }
    }

    // Create a default section for fields without a section
    const unsectionedFields = allFields.filter((f) => !fieldsInSections.has(f.id));
    if (unsectionedFields.length > 0) {
      if (result.length === 0) {
        result.push({
          id: "default",
          label: "Champs",
          fields: unsectionedFields.sort((a, b) => a.order_index - b.order_index),
          isDefault: true,
        });
      } else {
        result.unshift({
          id: "default",
          label: "Général",
          fields: unsectionedFields.sort((a, b) => a.order_index - b.order_index),
          isDefault: true,
        });
      }
    }

    return result;
  }, [allFields, sections]);

  // Tabs: keep uncontrolled to avoid Radix controlled-value edge cases (can trigger ref/update loops)
  const sectionIdsKey = useMemo(() => fieldSections.map((s) => s.id).join("|"), [fieldSections]);
  const defaultTab = fieldSections[0]?.id || "default";

  const handleFieldChange = (fieldId: string, value: any) => {
    onDataChange({
      customFieldValues: {
        ...data.customFieldValues,
        [fieldId]: value,
      },
    });
  };

  const totalFieldCount = allFields.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <p className="text-muted-foreground">Complétez les informations demandées pour votre demande</p>
        <Badge variant="secondary" className="mt-3">
          {totalFieldCount} champ(s) à renseigner
        </Badge>
      </div>

      <ScrollArea className="h-[450px] pr-4">
        {fieldSections.length === 1 ? (
          // Single section - render directly
          <div className="pb-4">
            <ValidatedCustomFieldsRenderer
              fields={fieldSections[0].fields}
              values={data.customFieldValues}
              onChange={handleFieldChange}
              validateOnChange={true}
            />
          </div>
        ) : (
          // Multiple sections - render as tabs
          <Tabs key={sectionIdsKey} defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1 mb-4">
              {fieldSections.map((section) => (
                <TabsTrigger key={section.id} value={section.id} className="flex items-center gap-1.5 px-3 py-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  <span>{section.label}</span>
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {section.fields.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {fieldSections.map((section) => (
              <TabsContent key={section.id} value={section.id} className="mt-0 pb-4">
                <ValidatedCustomFieldsRenderer
                  fields={section.fields}
                  values={data.customFieldValues}
                  onChange={handleFieldChange}
                  validateOnChange={true}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </ScrollArea>
    </div>
  );
}
