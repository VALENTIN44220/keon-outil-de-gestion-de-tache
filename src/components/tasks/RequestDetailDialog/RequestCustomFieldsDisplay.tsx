import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FieldValue {
  id: string;
  field_id: string;
  value: string | null;
  file_url: string | null;
  field_label: string;
  field_type: string;
  field_name: string;
}

interface RequestCustomFieldsDisplayProps {
  taskId: string;
  showSeparator?: boolean;
}

export function RequestCustomFieldsDisplay({ taskId, showSeparator = true }: RequestCustomFieldsDisplayProps) {
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCustomFields = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('request_field_values')
          .select('id, field_id, value, file_url, template_custom_fields!inner(label, field_type, name)')
          .eq('task_id', taskId);

        if (data) {
          setFieldValues(data.map((fv: any) => ({
            id: fv.id,
            field_id: fv.field_id,
            value: fv.value,
            file_url: fv.file_url,
            field_label: fv.template_custom_fields?.label || 'Champ',
            field_type: fv.template_custom_fields?.field_type || 'text',
            field_name: fv.template_custom_fields?.name || '',
          })));
        }
      } catch (error) {
        console.error('Error fetching custom fields:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomFields();
  }, [taskId]);

  const renderFieldValue = (fv: FieldValue) => {
    if (fv.field_type === 'checkbox') {
      return fv.value === 'true' ? (
        <Badge variant="default" className="text-xs">Oui</Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">Non</Badge>
      );
    }
    if (fv.field_type === 'file' && fv.file_url) {
      return (
        <a href={fv.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
          Voir le fichier
        </a>
      );
    }
    if (fv.field_type === 'repeatable_table' && fv.value) {
      try {
        const rows = JSON.parse(fv.value);
        if (Array.isArray(rows) && rows.length > 0) {
          return (
            <span className="text-sm text-muted-foreground">{rows.length} ligne(s)</span>
          );
        }
      } catch {
        // fallback
      }
    }
    return <span className="text-sm">{fv.value || '-'}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fieldValues.length === 0) return null;

  return (
    <>
      {showSeparator && <Separator />}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground">Détail de la demande</h4>
        <div className="grid grid-cols-2 gap-3">
          {fieldValues.map((fv) => (
            <div key={fv.id} className={fv.field_type === 'textarea' || fv.field_type === 'repeatable_table' ? 'col-span-2' : ''}>
              <label className="text-xs font-medium text-muted-foreground">{fv.field_label}</label>
              <div className="mt-1">{renderFieldValue(fv)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
