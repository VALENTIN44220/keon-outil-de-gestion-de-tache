import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort } from '@/hooks/useTableSort';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Building2, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { RefreshButton } from './RefreshButton';
import { BulkCompanyImportDialog } from './BulkCompanyImportDialog';
import type { Company } from '@/types/admin';

interface CompaniesTabProps {
  companies: Company[];
  onAdd: (name: string, description?: string) => Promise<Company>;
  onUpdate: (id: string, name: string, description?: string) => Promise<Company>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void> | void;
}

export function CompaniesTab({ companies, onAdd, onUpdate, onDelete, onRefresh }: CompaniesTabProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<Company | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const { sortedData: sortedCompanies, sortConfig, handleSort } = useTableSort(companies, 'name', 'asc');

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === companies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(companies.map(c => c.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = window.confirm(`Supprimer ${selectedIds.length} société(s) ?`);
    if (!confirmed) return;

    setIsDeleting(true);
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        await onDelete(id);
        deleted++;
      } catch (error: any) {
        toast.error(`Erreur: ${error.message}`);
      }
    }
    setSelectedIds([]);
    setIsDeleting(false);
    if (deleted > 0) {
      toast.success(`${deleted} société(s) supprimée(s)`);
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsAdding(true);
    try {
      await onAdd(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      toast.success('Société créée');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsAdding(false);
    }
  };

  const openEditDialog = (item: Company) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditDescription(item.description || '');
  };

  const handleUpdate = async () => {
    if (!editingItem || !editName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(editingItem.id, editName.trim(), editDescription.trim() || undefined);
      setEditingItem(null);
      toast.success('Société modifiée');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast.success('Société supprimée');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Ajouter une société
          </CardTitle>
          <CardDescription>Créez une nouvelle société dans le système</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Nom de la société"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={isAdding}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import en masse
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sociétés existantes</CardTitle>
            <CardDescription>{companies.length} société(s) enregistrée(s)</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer ({selectedIds.length})
              </Button>
            )}
            <RefreshButton onRefresh={onRefresh} />
          </div>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune société créée</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.length === sortedCompanies.length && sortedCompanies.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <SortableTableHead
                    sortKey="name"
                    currentSortKey={sortConfig.key as string}
                    currentDirection={sortConfig.direction}
                    onSort={handleSort}
                  >
                    Nom
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="description"
                    currentSortKey={sortConfig.key as string}
                    currentDirection={sortConfig.direction}
                    onSort={handleSort}
                  >
                    Description
                  </SortableTableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCompanies.map((company) => (
                  <TableRow key={company.id} className={selectedIds.includes(company.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(company.id)}
                        onCheckedChange={() => toggleSelection(company.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground">{company.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(company)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(company.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la société</DialogTitle>
            <DialogDescription>Modifiez les informations de la société</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BulkCompanyImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        existingCompanies={companies}
        onAdd={onAdd}
        onImportComplete={onRefresh}
      />
    </div>
  );
}
