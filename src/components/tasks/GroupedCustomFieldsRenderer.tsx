import { TemplateCustomField } from '@/types/customField';
import { ValidatedCustomFieldsRenderer } from './ValidatedCustomFieldsRenderer';
import { Badge } from '@/components/ui/badge';
import { Workflow, FormInput } from 'lucide-react';

interface GroupedCustomFieldsRendererProps {
  commonFields: TemplateCustomField[];
  processFields: TemplateCustomField[];
  subProcessFieldGroups: {
    subProcessId: string;
    subProcessName: string;
    fields: TemplateCustomField[];
  }[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function GroupedCustomFieldsRenderer({
  commonFields,
  processFields,
  subProcessFieldGroups,
  values,
  onChange,
  errors = {},
  disabled = false,
}: GroupedCustomFieldsRendererProps) {
  const hasCommonFields = commonFields.length > 0;
  const hasProcessFields = processFields.length > 0;
  const hasSubProcessGroups = subProcessFieldGroups.length > 0;

  if (!hasCommonFields && !hasProcessFields && !hasSubProcessGroups) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun champ personnalisé pour cette demande.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Common fields - appear once for all */}
      {hasCommonFields && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FormInput className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Champs communs</span>
            <Badge variant="secondary" className="text-xs">
              Partagés
            </Badge>
          </div>
          <div className="pl-6 border-l-2 border-primary/20">
            <ValidatedCustomFieldsRenderer
              fields={commonFields}
              values={values}
              onChange={onChange}
              disabled={disabled}
              validateOnChange={true}
            />
          </div>
        </div>
      )}

      {/* Process-level specific fields */}
      {hasProcessFields && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Champs du processus</span>
          </div>
          <div className="pl-6 border-l-2 border-muted">
            <ValidatedCustomFieldsRenderer
              fields={processFields}
              values={values}
              onChange={onChange}
              disabled={disabled}
              validateOnChange={true}
            />
          </div>
        </div>
      )}

      {/* Sub-process specific fields - grouped by sub-process */}
      {hasSubProcessGroups && subProcessFieldGroups.map((group) => (
        <div key={group.subProcessId} className="space-y-4">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-accent-foreground" />
            <span className="text-sm font-medium text-foreground">{group.subProcessName}</span>
            <Badge variant="outline" className="text-xs">
              Spécifique
            </Badge>
          </div>
          <div className="pl-6 border-l-2 border-accent/30">
            <ValidatedCustomFieldsRenderer
              fields={group.fields}
              values={values}
              onChange={onChange}
              disabled={disabled}
              validateOnChange={true}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
