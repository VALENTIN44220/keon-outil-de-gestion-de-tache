import React, { useState } from 'react';
import { useAllCustomFields } from '@/hooks/useCustomFields';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useAllSubProcessTemplates } from '@/hooks/useAllSubProcessTemplates';
import { useTableSort } from '@/hooks/useTableSort';
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
import { SortableTableHead } from '@/components/ui/sortable-table-head';
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
  repeatable_table: Database,
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

  const { sortedData: sortedFields, sortConfig, handleSort } = useTableSort(filteredFields, 'label', 'asc');

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
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const commonCount = fields.filter((f) => f.is_common).length;
  const processCount = fields.filter((f) => f.process_template_id && !f.sub_process_template_id).length;
  const subProcessCount = fields.filter((f) => f.sub_process_template_id).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards - Modern colorful design */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Common Fields Card */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-5 transition-all hover:shadow-lg hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Globe className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Champs communs</span>
            </div>
            <div className="text-4xl font-bold text-emerald-700 dark:text-emerald-300">
              {commonCount}
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">Partagés entre tous les processus</p>
          </div>
        </div>

        {/* Process Fields Card */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 transition-all hover:shadow-lg hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Workflow className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Liés à un processus</span>
            </div>
            <div className="text-4xl font-bold text-blue-700 dark:text-blue-300">
              {processCount}
            </div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Spécifiques à un processus</p>
          </div>
        </div>

        {/* Sub-process Fields Card */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 p-5 transition-all hover:shadow-lg hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-400">
                <GitBranch className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Liés à un sous-processus</span>
            </div>
            <div className="text-4xl font-bold text-violet-700 dark:text-violet-300">
              {subProcessCount}
            </div>
            <p className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-1">Spécifiques à un sous-processus</p>
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un champ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 rounded-lg border-muted-foreground/20 focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => setBulkScopeOpen(true)}
                className="gap-2 border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
              >
                <Settings2 className="h-4 w-4" />
                Modifier portée
                <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  {selectedIds.size}
                </Badge>
              </Button>
              <Button
                variant="outline"
                onClick={() => setBulkDeleteOpen(true)}
                className="gap-2 border-red-500/50 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
                <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                  {selectedIds.size}
                </Badge>
              </Button>
            </>
          )}
          <Button 
            variant="outline" 
            onClick={() => setBulkImportOpen(true)}
            className="gap-2 hover:bg-muted/50"
          >
            <Upload className="h-4 w-4" />
            Import en masse
          </Button>
          <Button 
            onClick={() => setAddDialogOpen(true)}
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="h-4 w-4" />
            Nouveau champ
          </Button>
        </div>
      </div>

      {/* Fields Table */}
      <Card className="overflow-hidden rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={sortedFields.length > 0 && selectedIds.size === sortedFields.length}
                    onCheckedChange={toggleSelectAll}
                    className="border-muted-foreground/30"
                  />
                </TableHead>
                <SortableTableHead
                  sortKey="label"
                  currentSortKey={sortConfig.key as string}
                  currentDirection={sortConfig.direction}
                  onSort={handleSort}
                  className="font-semibold"
                >
                  Nom
                </SortableTableHead>
                <SortableTableHead
                  sortKey="field_type"
                  currentSortKey={sortConfig.key as string}
                  currentDirection={sortConfig.direction}
                  onSort={handleSort}
                  className="font-semibold"
                >
                  Type
                </SortableTableHead>
                <SortableTableHead
                  sortKey="is_common"
                  currentSortKey={sortConfig.key as string}
                  currentDirection={sortConfig.direction}
                  onSort={handleSort}
                  className="font-semibold"
                >
                  Portée
                </SortableTableHead>
                <SortableTableHead
                  sortKey="is_required"
                  currentSortKey={sortConfig.key as string}
                  currentDirection={sortConfig.direction}
                  onSort={handleSort}
                  className="font-semibold"
                >
                  Requis
                </SortableTableHead>
                <TableHead className="w-[100px] font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50">
                        <Database className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <div className="text-muted-foreground">
                        {searchQuery ? 'Aucun champ trouvé' : 'Aucun champ personnalisé défini'}
                      </div>
                      {!searchQuery && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAddDialogOpen(true)}
                          className="mt-2"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Créer votre premier champ
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedFields.map((field, index) => {
                  const FieldIcon = FIELD_TYPE_ICON_MAP[field.field_type];
                  const scopeInfo = getScopeInfo(field as any);
                  const ScopeIcon = scopeInfo.icon;
                  const isSelected = selectedIds.has(field.id);

                  // Colored icon backgrounds based on field type
                  const getTypeColor = (type: CustomFieldType) => {
                    const colors: Partial<Record<CustomFieldType, string>> = {
                      text: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
                      textarea: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
                      number: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
                      date: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
                      datetime: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
                      email: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
                      phone: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
                      url: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                      checkbox: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
                      select: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
                      multiselect: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
                      user_search: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
                      department_search: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
                      file: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400',
                      table_lookup: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
                    };
                    return colors[type] || 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
                  };

                  const getScopeBadgeStyle = () => {
                    if (field.is_common) {
                      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
                    }
                    if (field.sub_process_template_id) {
                      return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800';
                    }
                    if (field.process_template_id) {
                      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
                    }
                    return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800';
                  };

                  return (
                    <TableRow 
                      key={field.id}
                      className={`transition-colors ${isSelected ? 'bg-primary/5' : index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-muted/40`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(field.id)}
                          className="border-muted-foreground/30"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{field.label}</span>
                          <code className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                            {field.name}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${getTypeColor(field.field_type)}`}>
                            <FieldIcon className="h-4 w-4" />
                          </div>
                          <span className="text-sm">{FIELD_TYPE_LABELS[field.field_type]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1.5 font-medium ${getScopeBadgeStyle()}`}>
                          <ScopeIcon className="h-3 w-3" />
                          <span className="max-w-[120px] truncate">{scopeInfo.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {field.is_required ? (
                          <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                            Oui
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                            Non
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover w-44">
                            <DropdownMenuItem onClick={() => setEditingField(field)} className="gap-2">
                              <Pencil className="h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingFieldId(field.id)}
                              className="text-destructive gap-2 focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
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
        {sortedFields.length > 0 && (
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            {selectedIds.size > 0 ? (
              <span className="font-medium text-primary">{selectedIds.size} champ(s) sélectionné(s)</span>
            ) : (
              <span>{sortedFields.length} champ(s) au total</span>
            )}
          </div>
        )}
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
