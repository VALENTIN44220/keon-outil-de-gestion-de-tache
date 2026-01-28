import React, { useState } from 'react';
import { useAllCustomFields } from '@/hooks/useCustomFields';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useAllSubProcessTemplates } from '@/hooks/useAllSubProcessTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  Settings2,
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
  const { fields, isLoading, deleteField, deleteMultipleFields, updateMultipleFieldsScope, refetch } = useAllCustomFields();
  const { processes } = useProcessTemplates();
  const { subProcesses } = useAllSubProcessTemplates();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editingField, setEditingField] = useState<TemplateCustomField | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkScopeOpen, setBulkScopeOpen] = useState(false);
  const [bulkScopeType, setBulkScopeType] = useState<'common' | 'process' | 'subprocess'>('common');
  const [bulkProcessId, setBulkProcessId] = useState<string>('__none__');
  const [bulkSubProcessId, setBulkSubProcessId] = useState<string>('__none__');

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

  const handleBulkDelete = async () => {
    await deleteMultipleFields(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const handleBulkScopeChange = async () => {
    let scope: { is_common: boolean; process_template_id: string | null; sub_process_template_id: string | null };
    
    if (bulkScopeType === 'common') {
      scope = { is_common: true, process_template_id: null, sub_process_template_id: null };
    } else if (bulkScopeType === 'process') {
      scope = {
        is_common: false,
        process_template_id: bulkProcessId === '__none__' ? null : bulkProcessId,
        sub_process_template_id: null,
      };
    } else {
      scope = {
        is_common: false,
        process_template_id: null,
        sub_process_template_id: bulkSubProcessId === '__none__' ? null : bulkSubProcessId,
      };
    }
    
    await updateMultipleFieldsScope(Array.from(selectedIds), scope);
    setSelectedIds(new Set());
    setBulkScopeOpen(false);
    setBulkScopeType('common');
    setBulkProcessId('__none__');
    setBulkSubProcessId('__none__');
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFields.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFields.map((f) => f.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
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
          {selectedIds.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => setBulkScopeOpen(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Modifier portée ({selectedIds.size})
              </Button>
              <Button
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer ({selectedIds.size})
              </Button>
            </>
          )}
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
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={filteredFields.length > 0 && selectedIds.size === filteredFields.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                        <Checkbox
                          checked={selectedIds.has(field.id)}
                          onCheckedChange={() => toggleSelect(field.id)}
                        />
                      </TableCell>
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
                          <DropdownMenuContent align="end" className="bg-popover">
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

      {/* Single Delete Dialog */}
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

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.size} champ(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les valeurs associées dans les demandes
              existantes seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
              Supprimer {selectedIds.size} champ(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Scope Change Dialog */}
      <Dialog open={bulkScopeOpen} onOpenChange={setBulkScopeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la portée de {selectedIds.size} champ(s)</DialogTitle>
            <DialogDescription>
              Sélectionnez la nouvelle portée à appliquer aux champs sélectionnés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type de portée</Label>
              <Select value={bulkScopeType} onValueChange={(v) => setBulkScopeType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="common">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Commun (tous les processus)
                    </div>
                  </SelectItem>
                  <SelectItem value="process">
                    <div className="flex items-center gap-2">
                      <Workflow className="h-4 w-4" />
                      Processus spécifique
                    </div>
                  </SelectItem>
                  <SelectItem value="subprocess">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Sous-processus spécifique
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkScopeType === 'process' && (
              <div className="space-y-2">
                <Label>Processus cible</Label>
                <Select value={bulkProcessId} onValueChange={setBulkProcessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un processus" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {processes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {bulkScopeType === 'subprocess' && (
              <div className="space-y-2">
                <Label>Sous-processus cible</Label>
                <Select value={bulkSubProcessId} onValueChange={setBulkSubProcessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un sous-processus" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {subProcesses.map((sp) => (
                      <SelectItem key={sp.id} value={sp.id}>
                        {sp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkScopeOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleBulkScopeChange}>
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
