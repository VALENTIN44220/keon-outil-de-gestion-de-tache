import React, { useState } from 'react';
import { useTableLookupConfigs, TableLookupConfig } from '@/hooks/useTableLookupConfigs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Database,
  Columns,
  Filter,
  Loader2,
} from 'lucide-react';

// Available tables that can be configured
const AVAILABLE_TABLES = [
  { name: 'profiles', label: 'Utilisateurs (profiles)', columns: ['id', 'display_name', 'email', 'job_title', 'department', 'company'] },
  { name: 'departments', label: 'Services (departments)', columns: ['id', 'name', 'description'] },
  { name: 'companies', label: 'Sociétés (companies)', columns: ['id', 'name', 'description'] },
  { name: 'job_titles', label: 'Postes (job_titles)', columns: ['id', 'name', 'description'] },
  { name: 'be_projects', label: 'Projets BE (be_projects)', columns: ['id', 'code_projet', 'nom_projet', 'status', 'region', 'departement'] },
  { name: 'categories', label: 'Catégories (categories)', columns: ['id', 'name', 'description'] },
  { name: 'subcategories', label: 'Sous-catégories (subcategories)', columns: ['id', 'name', 'description'] },
  { name: 'collaborator_groups', label: 'Groupes (collaborator_groups)', columns: ['id', 'name', 'description'] },
  { name: 'hierarchy_levels', label: 'Niveaux hiérarchiques', columns: ['id', 'name', 'level', 'description'] },
  { name: 'process_templates', label: 'Modèles de processus', columns: ['id', 'name', 'description'] },
  { name: 'sub_process_templates', label: 'Modèles de sous-processus', columns: ['id', 'name', 'description'] },
];

export function TableLookupConfigTab() {
  const { configs, isLoading, addConfig, updateConfig, deleteConfig, deleteMultiple, refetch } = useTableLookupConfigs();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TableLookupConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    table_name: '',
    display_column: '',
    value_column: 'id',
    label: '',
    description: '',
    filter_column: '',
    filter_value: '',
    is_active: true,
    order_index: 0,
  });

  const filteredConfigs = configs.filter(
    (c) =>
      c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.table_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTable = AVAILABLE_TABLES.find((t) => t.name === formData.table_name);

  const resetForm = () => {
    setFormData({
      table_name: '',
      display_column: '',
      value_column: 'id',
      label: '',
      description: '',
      filter_column: '',
      filter_value: '',
      is_active: true,
      order_index: configs.length,
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setAddDialogOpen(true);
  };

  const handleOpenEdit = (config: TableLookupConfig) => {
    setFormData({
      table_name: config.table_name,
      display_column: config.display_column,
      value_column: config.value_column,
      label: config.label,
      description: config.description || '',
      filter_column: config.filter_column || '',
      filter_value: config.filter_value || '',
      is_active: config.is_active,
      order_index: config.order_index,
    });
    setEditingConfig(config);
  };

  const handleSave = async () => {
    if (!formData.table_name || !formData.display_column || !formData.label) {
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        table_name: formData.table_name,
        display_column: formData.display_column,
        value_column: formData.value_column || 'id',
        label: formData.label,
        description: formData.description || null,
        filter_column: formData.filter_column || null,
        filter_value: formData.filter_value || null,
        is_active: formData.is_active,
        order_index: formData.order_index,
      };

      if (editingConfig) {
        await updateConfig(editingConfig.id, payload);
        setEditingConfig(null);
      } else {
        await addConfig(payload);
        setAddDialogOpen(false);
      }
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deletingId) {
      await deleteConfig(deletingId);
      setDeletingId(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleBulkDelete = async () => {
    await deleteMultiple(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredConfigs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConfigs.map((c) => c.id)));
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

  const handleToggleActive = async (config: TableLookupConfig) => {
    await updateConfig(config.id, { is_active: !config.is_active });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const formDialog = (
    <Dialog open={addDialogOpen || !!editingConfig} onOpenChange={(open) => {
      if (!open) {
        setAddDialogOpen(false);
        setEditingConfig(null);
        resetForm();
      }
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? 'Modifier la configuration' : 'Nouvelle configuration'}
          </DialogTitle>
          <DialogDescription>
            Configurez une table accessible pour les champs de type "Liste depuis table"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Table source *</Label>
            <select
              value={formData.table_name}
              onChange={(e) => setFormData({ ...formData, table_name: e.target.value, display_column: '', filter_column: '' })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Sélectionner une table</option>
              {AVAILABLE_TABLES.map((t) => (
                <option key={t.name} value={t.name}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Colonne d'affichage *</Label>
              <select
                value={formData.display_column}
                onChange={(e) => setFormData({ ...formData, display_column: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={!selectedTable}
              >
                <option value="">Sélectionner</option>
                {selectedTable?.columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Colonne de valeur</Label>
              <select
                value={formData.value_column}
                onChange={(e) => setFormData({ ...formData, value_column: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={!selectedTable}
              >
                {selectedTable?.columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Libellé affiché *</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Ex: Liste des utilisateurs"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description optionnelle"
            />
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4" />
              Filtre optionnel
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Colonne de filtre</Label>
                <select
                  value={formData.filter_column}
                  onChange={(e) => setFormData({ ...formData, filter_column: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={!selectedTable}
                >
                  <option value="">Aucun filtre</option>
                  {selectedTable?.columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Valeur du filtre</Label>
                <Input
                  value={formData.filter_value}
                  onChange={(e) => setFormData({ ...formData, filter_value: e.target.value })}
                  placeholder="Valeur attendue"
                  disabled={!formData.filter_column}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Configuration active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label>Ordre</Label>
              <Input
                type="number"
                value={formData.order_index}
                onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                className="w-20"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setAddDialogOpen(false);
            setEditingConfig(null);
            resetForm();
          }}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!formData.table_name || !formData.display_column || !formData.label || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingConfig ? 'Mettre à jour' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Configuration des listes depuis table
          </CardTitle>
          <CardDescription>
            Définissez quelles tables et colonnes sont accessibles pour les champs personnalisés de type "Liste depuis table"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer ({selectedIds.size})
                </Button>
              )}
              <Button onClick={handleOpenAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle configuration
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={filteredConfigs.length > 0 && selectedIds.size === filteredConfigs.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Colonnes</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfigs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune configuration définie
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConfigs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(config.id)}
                          onCheckedChange={() => toggleSelect(config.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{config.label}</div>
                          {config.description && (
                            <div className="text-sm text-muted-foreground">{config.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Database className="h-3 w-3" />
                          {config.table_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Columns className="h-4 w-4 text-muted-foreground" />
                          <span>{config.display_column}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-muted-foreground">{config.value_column}</span>
                        </div>
                        {config.filter_column && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Filter className="h-3 w-3" />
                            {config.filter_column} = {config.filter_value}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={config.is_active}
                          onCheckedChange={() => handleToggleActive(config)}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleOpenEdit(config)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDeletingId(config.id);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {formDialog}

      {/* Single Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette configuration ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les champs utilisant cette configuration ne pourront plus récupérer les données.
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
            <AlertDialogTitle>Supprimer {selectedIds.size} configuration(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les champs utilisant ces configurations ne pourront plus récupérer les données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
