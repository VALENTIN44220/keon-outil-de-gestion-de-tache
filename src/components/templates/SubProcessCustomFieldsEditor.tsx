import { useState } from 'react';
import { useCustomFields } from '@/hooks/useCustomFields';
import { TemplateCustomField, FIELD_TYPE_LABELS, CustomFieldType } from '@/types/customField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Pencil, 
  GripVertical,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  Mail,
  Phone,
  Link,
  CheckSquare,
  ChevronDown,
  ListChecks,
  UserSearch,
  Building2,
  Paperclip,
  Loader2,
  Database,
} from 'lucide-react';
import { AddCustomFieldDialog } from './AddCustomFieldDialog';
import { EditCustomFieldDialog } from './EditCustomFieldDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SubProcessCustomFieldsEditorProps {
  subProcessTemplateId: string;
  canManage?: boolean;
}

const FIELD_TYPE_ICON_MAP: Record<CustomFieldType, React.ElementType> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  datetime: Clock,
  email: Mail,
  phone: Phone,
  url: Link,
  checkbox: CheckSquare,
  select: ChevronDown,
  multiselect: ListChecks,
  user_search: UserSearch,
  department_search: Building2,
  file: Paperclip,
  table_lookup: Database,
  repeatable_table: Database,
};

export function SubProcessCustomFieldsEditor({ 
  subProcessTemplateId,
  canManage = false,
}: SubProcessCustomFieldsEditorProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<TemplateCustomField | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  const { fields, isLoading, deleteField, refetch } = useCustomFields({
    subProcessTemplateId,
    includeCommon: false,
  });

  const handleDelete = async () => {
    if (!deletingFieldId) return;
    await deleteField(deletingFieldId);
    setDeletingFieldId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Champs personnalisés ({fields.length})
        </p>
        {canManage && (
          <Button size="sm" variant="ghost" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-4 bg-muted/20 rounded">
          <p className="text-xs text-muted-foreground">
            Aucun champ personnalisé
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {fields.map((field) => {
            const Icon = FIELD_TYPE_ICON_MAP[field.field_type] || Hash;
            return (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2 bg-muted/20 rounded text-sm group"
              >
                <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{field.label}</span>
                {field.is_required && (
                  <Badge variant="destructive" className="text-[10px] px-1 py-0">*</Badge>
                )}
                {canManage && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setEditingField(field)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => setDeletingFieldId(field.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <AddCustomFieldDialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => {
          setIsAddOpen(false);
          refetch();
        }}
        defaultSubProcessId={subProcessTemplateId}
      />

      {/* Edit Dialog */}
      <EditCustomFieldDialog
        field={editingField}
        open={!!editingField}
        onClose={() => setEditingField(null)}
        onSuccess={() => {
          setEditingField(null);
          refetch();
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingFieldId} onOpenChange={() => setDeletingFieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce champ ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
