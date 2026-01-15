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

interface ProcessCustomFieldsEditorProps {
  processTemplateId: string;
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
};

export function ProcessCustomFieldsEditor({ 
  processTemplateId,
  canManage = false,
}: ProcessCustomFieldsEditorProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<TemplateCustomField | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  const { fields, isLoading, deleteField, refetch } = useCustomFields({
    processTemplateId,
    includeCommon: false, // Only show process-specific fields in the editor
  });

  const handleDelete = async () => {
    if (!deletingFieldId) return;
    await deleteField(deletingFieldId);
    setDeletingFieldId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Champs personnalisés spécifiques à ce processus
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-6 bg-muted/30 rounded-lg">
          <Hash className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucun champ personnalisé pour ce processus
          </p>
          {canManage && (
            <Button 
              variant="link" 
              size="sm" 
              className="mt-2"
              onClick={() => setIsAddOpen(true)}
            >
              Ajouter un champ
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => {
            const Icon = FIELD_TYPE_ICON_MAP[field.field_type] || Hash;
            return (
              <div
                key={field.id}
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg group"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {field.label}
                    </span>
                    {field.is_required && (
                      <Badge variant="destructive" className="text-xs">
                        Requis
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {FIELD_TYPE_LABELS[field.field_type]}
                    {field.description && ` • ${field.description}`}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingField(field)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeletingFieldId(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
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
        defaultProcessId={processTemplateId}
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
              Cette action est irréversible. Les données saisies dans ce champ seront perdues.
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
