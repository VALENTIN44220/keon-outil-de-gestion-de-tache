/**
 * RequestCustomFieldsSection — Section "Champs personnalisés" pour les pages
 * de création de demande non-génériques (NewITRequest, NewMaintenanceRequest,
 * NewLogistiqueRequest, etc.).
 *
 * Avant ce composant, ces pages avaient des formulaires hardcodés et IGNORAIENT
 * complètement les champs définis dans CONFIGURATION:MODELE > onglet « Champs ».
 *
 * Usage :
 *   1) <RequestCustomFieldsSection processTemplateId={id} values={vals} onChange={...} />
 *   2) Après création de la tâche-demande, appeler insertRequestFieldValues(taskId, vals)
 *      pour persister les valeurs dans request_field_values.
 */
import { useMemo } from 'react';
import { useCustomFields } from '@/hooks/useCustomFields';
import { SectionedCustomFieldsRenderer } from '@/components/tasks/SectionedCustomFieldsRenderer';
import { supabase } from '@/integrations/supabase/client';
import { FormInput } from 'lucide-react';

interface Props {
  /** Process_template du flux (ex: IT prestation id, Maintenance id, …). */
  processTemplateId: string | null | undefined;
  /** Optionnel : un sous-processus précis (sinon on remonte uniquement le niveau process). */
  subProcessTemplateId?: string | null;
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  /** Titre affiché au-dessus de la section. Par défaut « Informations complémentaires ». */
  title?: string;
}

export function RequestCustomFieldsSection({
  processTemplateId,
  subProcessTemplateId,
  values,
  onChange,
  errors,
  disabled,
  title = 'Informations complémentaires',
}: Props) {
  const { fields, isLoading } = useCustomFields({
    processTemplateId: processTemplateId ?? null,
    subProcessTemplateId: subProcessTemplateId ?? null,
    includeCommon: true,
    includeParentProcessFields: !!subProcessTemplateId,
  });

  const visibleFields = useMemo(
    () => fields.filter((f) => !(f as any).is_agent_field),
    [fields],
  );

  if (isLoading) return null;
  if (visibleFields.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <FormInput className="h-4 w-4 text-primary" />
        {title}
      </div>
      <SectionedCustomFieldsRenderer
        processTemplateId={processTemplateId ?? null}
        subProcessTemplateId={subProcessTemplateId ?? null}
        fields={visibleFields}
        values={values}
        onChange={onChange}
        errors={errors}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Persiste les valeurs des custom fields dans request_field_values après création
 * de la demande. Appelle après l'INSERT sur tasks.
 */
export async function insertRequestFieldValues(
  taskId: string,
  values: Record<string, any>,
): Promise<{ error: Error | null }> {
  const fieldIds = Object.keys(values || {}).filter(
    (k) => values[k] !== undefined && values[k] !== null && values[k] !== '',
  );
  if (fieldIds.length === 0) return { error: null };

  const inserts = fieldIds.map((fieldId) => ({
    task_id: taskId,
    field_id: fieldId,
    value: typeof values[fieldId] === 'string' ? values[fieldId] : JSON.stringify(values[fieldId]),
  }));

  const { error } = await supabase.from('request_field_values').insert(inserts);
  return { error: error as Error | null };
}
