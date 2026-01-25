import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Briefcase, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { RefreshButton } from './RefreshButton';
import { BulkDepartmentImportDialog } from './BulkDepartmentImportDialog';
import type { Department, Company } from '@/types/admin';

interface DepartmentsTabProps {
  departments: Department[];
  companies: Company[];
  onAdd: (name: string, company_id?: string, description?: string) => Promise<Department>;
  onUpdate: (id: string, name: string, company_id?: string, description?: string) => Promise<Department>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void> | void;
}

export function DepartmentsTab({ departments, companies, onAdd, onUpdate, onDelete, onRefresh }: DepartmentsTabProps) {
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<Department | null>(null);
  const [editName, setEditName] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === departments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(departments.map(d => d.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = window.confirm(`Supprimer ${selectedIds.length} service(s) ?`);
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
      toast.success(`${deleted} service(s) supprimé(s)`);
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsAdding(true);
    try {
      await onAdd(name.trim(), companyId || undefined, description.trim() || undefined);
      setName('');
      setCompanyId('');
      setDescription('');
      toast.success('Service créé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsAdding(false);
    }
  };

  const openEditDialog = (item: Department) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCompanyId(item.company_id || '');
    setEditDescription(item.description || '');
  };

  const handleUpdate = async () => {
    if (!editingItem || !editName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(editingItem.id, editName.trim(), editCompanyId || undefined, editDescription.trim() || undefined);
      setEditingItem(null);
      toast.success('Service modifié');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast.success('Service supprimé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Ajouter un service
          </CardTitle>
          <CardDescription>Créez un nouveau service/département</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              placeholder="Nom du service"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <SearchableSelect
              value={companyId}
              onValueChange={setCompanyId}
              placeholder="Société (optionnel)"
              searchPlaceholder="Rechercher une société..."
              options={companies.map((company) => ({
                value: company.id,
                label: company.name,
              }))}
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
            <CardTitle>Services existants</CardTitle>
            <CardDescription>{departments.length} service(s) enregistré(s)</CardDescription>
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
          {departments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun service créé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.length === departments.length && departments.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Société</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id} className={selectedIds.includes(dept.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(dept.id)}
                        onCheckedChange={() => toggleSelection(dept.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.company?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{dept.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(dept)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(dept.id)}
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
            <DialogTitle>Modifier le service</DialogTitle>
            <DialogDescription>Modifiez les informations du service</DialogDescription>
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
              <Label htmlFor="edit-company">Société</Label>
              <SearchableSelect
                value={editCompanyId}
                onValueChange={setEditCompanyId}
                placeholder="Sélectionner..."
                searchPlaceholder="Rechercher une société..."
                options={companies.map((company) => ({
                  value: company.id,
                  label: company.name,
                }))}
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

      <BulkDepartmentImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        existingDepartments={departments}
        companies={companies}
        onAdd={onAdd}
        onImportComplete={onRefresh}
      />
    </div>
  );
}
