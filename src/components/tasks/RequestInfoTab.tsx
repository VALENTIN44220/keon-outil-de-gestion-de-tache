import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Calendar, User, Building2, Flag, Hash, FileText, Workflow } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FieldValue {
  id: string;
  field_id: string;
  value: string | null;
  file_url: string | null;
  field_label: string;
  field_type: string;
  field_name: string;
}

interface RequestInfoTabProps {
  task: Task;
  profiles: Map<string, string>;
  departments: Map<string, string>;
}

const priorityLabels: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

export function RequestInfoTab({ task, profiles, departments }: RequestInfoTabProps) {
  const [parentRequest, setParentRequest] = useState<Task | null>(null);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [processName, setProcessName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (task.parent_request_id) {
      fetchRequestDetails();
    }
  }, [task.parent_request_id, task.source_sub_process_template_id]);

  const fetchRequestDetails = async () => {
    if (!task.parent_request_id) return;
    setIsLoading(true);

    try {
      // Fetch parent request, custom field values, and hidden fields config in parallel
      const [requestRes, fieldsRes, spConfigRes, processRes] = await Promise.all([
        // Parent request
        supabase
          .from('tasks')
          .select('*')
          .eq('id', task.parent_request_id)
          .single(),
        // Custom field values with field metadata
        supabase
          .from('request_field_values')
          .select('id, field_id, value, file_url, template_custom_fields!inner(label, field_type, name)')
          .eq('task_id', task.parent_request_id),
        // Sub-process config for hidden fields
        task.source_sub_process_template_id
          ? supabase
              .from('sub_process_templates')
              .select('form_schema')
              .eq('id', task.source_sub_process_template_id)
              .single()
          : Promise.resolve({ data: null }),
        // Process name
        task.source_process_template_id
          ? supabase
              .from('process_templates')
              .select('name')
              .eq('id', task.source_process_template_id)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      if (requestRes.data) {
        setParentRequest(requestRes.data as Task);
      }

      if (fieldsRes.data) {
        const mapped = fieldsRes.data.map((fv: any) => ({
          id: fv.id,
          field_id: fv.field_id,
          value: fv.value,
          file_url: fv.file_url,
          field_label: fv.template_custom_fields?.label || 'Champ',
          field_type: fv.template_custom_fields?.field_type || 'text',
          field_name: fv.template_custom_fields?.name || '',
        }));
        setFieldValues(mapped);
      }

      // Extract hidden fields from sub-process config
      if (spConfigRes.data) {
        const formSchema = (spConfigRes.data as any).form_schema;
        if (formSchema && typeof formSchema === 'object') {
          const hidden = (formSchema as any).hidden_request_fields;
          if (Array.isArray(hidden)) {
            setHiddenFields(hidden);
          }
        }
      }

      if (processRes.data) {
        setProcessName((processRes.data as any).name);
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!parentRequest) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Aucune demande associée</p>
      </div>
    );
  }

  // Filter out hidden standard fields
  const isStandardFieldVisible = (fieldKey: string) => !hiddenFields.includes(`standard:${fieldKey}`);
  // Filter out hidden custom fields
  const visibleFieldValues = fieldValues.filter(fv => !hiddenFields.includes(`custom:${fv.field_id}`));

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
    return <span className="text-sm">{fv.value || '-'}</span>;
  };

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-5">
        {/* Request Header */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-base">Demande associée</h4>
          </div>
          
          {isStandardFieldVisible('title') && (
            <p className="font-medium">{parentRequest.title}</p>
          )}

          {isStandardFieldVisible('request_number') && parentRequest.request_number && (
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">{parentRequest.request_number}</span>
            </div>
          )}
        </div>

        {/* Standard Fields */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {isStandardFieldVisible('description') && parentRequest.description && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <p className="text-sm whitespace-pre-wrap mt-1">{parentRequest.description}</p>
            </div>
          )}

          {isStandardFieldVisible('priority') && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Priorité</label>
              <div className="flex items-center gap-1 mt-1">
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{priorityLabels[parentRequest.priority] || parentRequest.priority}</span>
              </div>
            </div>
          )}

          {isStandardFieldVisible('due_date') && parentRequest.due_date && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Échéance</label>
              <div className="flex items-center gap-1 mt-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{format(new Date(parentRequest.due_date), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
            </div>
          )}

          {isStandardFieldVisible('requester') && parentRequest.requester_id && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Demandeur</label>
              <div className="flex items-center gap-1 mt-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{profiles.get(parentRequest.requester_id) || 'N/A'}</span>
              </div>
            </div>
          )}

          {isStandardFieldVisible('department') && parentRequest.target_department_id && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Service cible</label>
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{departments.get(parentRequest.target_department_id) || 'N/A'}</span>
              </div>
            </div>
          )}

          {isStandardFieldVisible('category') && parentRequest.category && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
              <Badge variant="outline" className="mt-1">{parentRequest.category}</Badge>
            </div>
          )}
        </div>

        {/* Process info */}
        {isStandardFieldVisible('process') && processName && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Processus: {processName}</span>
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {visibleFieldValues.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Champs personnalisés</h4>
              <div className="grid grid-cols-2 gap-3">
                {visibleFieldValues.map((fv) => (
                  <div key={fv.id} className={fv.field_type === 'textarea' ? 'col-span-2' : ''}>
                    <label className="text-xs font-medium text-muted-foreground">{fv.field_label}</label>
                    <div className="mt-1">{renderFieldValue(fv)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
