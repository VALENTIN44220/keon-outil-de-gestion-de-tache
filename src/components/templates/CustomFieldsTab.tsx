import React, { useState } from 'react';
import { useAllCustomFields } from '@/hooks/useCustomFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  Globe,
  Workflow,
  GitBranch,
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
  Database,
} from 'lucide-react';
import { FIELD_TYPE_LABELS, TemplateCustomField, CustomFieldType } from '@/types/customField';
import { AddCustomFieldDialog } from './AddCustomFieldDialog';
import { EditCustomFieldDialog } from './EditCustomFieldDialog';
import { BulkCustomFieldImportDialog } from './BulkCustomFieldImportDialog';

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
};

export function CustomFieldsTab() {
  const { fields, isLoading, deleteField, refetch } = useAllCustomFields();
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editingField, setEditingField] = useState<TemplateCustomField | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  const filteredFields = fields.filter(
    (field) =>
      field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (deletingFieldId) {
      await deleteField(deletingFieldId);
      setDeletingFieldId(null);
    }
  };

  const getScopeInfo = (field: TemplateCustomField & { process_template?: { name: string }; sub_process_template?: { name: string } }) => {
    if (field.is_common) {
      return { label: 'Commun', icon: Globe, variant: 'default' as const };
    }
    if (field.sub_process_template_id) {
      return {
        label: (field as any).sub_process_template?.name || 'Sous-processus',
        icon: GitBranch,
        variant: 'secondary' as const,
      };
    }
    if (field.process_template_id) {
      return {
        label: (field as any).process_template?.name || 'Processus',
        icon: Workflow,
        variant: 'outline' as const,
      };
    }
    return { label: 'Non défini', icon: Globe, variant: 'destructive' as const };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un champ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import en masse
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau champ
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Champs communs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fields.filter((f) => f.is_common).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Liés à un processus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fields.filter((f) => f.process_template_id && !f.sub_process_template_id).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Liés à un sous-processus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fields.filter((f) => f.sub_process_template_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fields Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Portée</TableHead>
                <TableHead>Requis</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'Aucun champ trouvé' : 'Aucun champ personnalisé défini'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredFields.map((field) => {
                  const FieldIcon = FIELD_TYPE_ICON_MAP[field.field_type];
                  const scopeInfo = getScopeInfo(field as any);
                  const ScopeIcon = scopeInfo.icon;

                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{field.label}</div>
                          <div className="text-sm text-muted-foreground">{field.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FieldIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{FIELD_TYPE_LABELS[field.field_type]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={scopeInfo.variant} className="gap-1">
                          <ScopeIcon className="h-3 w-3" />
                          {scopeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {field.is_required ? (
                          <Badge variant="destructive">Oui</Badge>
                        ) : (
                          <Badge variant="secondary">Non</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingField(field)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingFieldId(field.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddCustomFieldDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={() => {
          setAddDialogOpen(false);
          refetch();
        }}
      />

      <EditCustomFieldDialog
        field={editingField}
        open={!!editingField}
        onClose={() => setEditingField(null)}
        onSuccess={() => {
          setEditingField(null);
          refetch();
        }}
      />

      <BulkCustomFieldImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onSuccess={() => {
          setBulkImportOpen(false);
          refetch();
        }}
      />

      <AlertDialog open={!!deletingFieldId} onOpenChange={() => setDeletingFieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce champ ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les valeurs saisies dans les demandes existantes
              seront également supprimées.
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
