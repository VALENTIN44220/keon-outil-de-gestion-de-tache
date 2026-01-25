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
import { Plus, Trash2, Users, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { RefreshButton } from './RefreshButton';
import { BulkJobTitleImportDialog } from './BulkJobTitleImportDialog';
import type { JobTitle, Department, Company } from '@/types/admin';

interface JobTitlesTabProps {
  jobTitles: JobTitle[];
  departments: Department[];
  companies: Company[];
  onAdd: (name: string, department_id?: string, description?: string) => Promise<JobTitle>;
  onUpdate: (id: string, name: string, department_id?: string, description?: string) => Promise<JobTitle>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void> | void;
}

export function JobTitlesTab({ jobTitles, departments, companies, onAdd, onUpdate, onDelete, onRefresh }: JobTitlesTabProps) {
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<JobTitle | null>(null);
  const [editName, setEditName] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
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
    if (selectedIds.length === jobTitles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(jobTitles.map(j => j.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = window.confirm(`Supprimer ${selectedIds.length} poste(s) ?`);
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
      toast.success(`${deleted} poste(s) supprimé(s)`);
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsAdding(true);
    try {
      await onAdd(name.trim(), departmentId || undefined, description.trim() || undefined);
      setName('');
      setDepartmentId('');
      setDescription('');
      toast.success('Poste créé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsAdding(false);
    }
  };

  const openEditDialog = (item: JobTitle) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditDepartmentId(item.department_id || '');
    setEditDescription(item.description || '');
  };

  const handleUpdate = async () => {
    if (!editingItem || !editName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(editingItem.id, editName.trim(), editDepartmentId || undefined, editDescription.trim() || undefined);
      setEditingItem(null);
      toast.success('Poste modifié');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast.success('Poste supprimé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ajouter un poste
          </CardTitle>
          <CardDescription>Créez un nouveau poste/fonction</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              placeholder="Nom du poste"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <SearchableSelect
              value={departmentId}
              onValueChange={setDepartmentId}
              placeholder="Service (optionnel)"
              searchPlaceholder="Rechercher un service..."
              options={departments.map((dept) => ({
                value: dept.id,
                label: `${dept.name}${dept.company?.name ? ` (${dept.company.name})` : ''}`,
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
            <CardTitle>Postes existants</CardTitle>
            <CardDescription>{jobTitles.length} poste(s) enregistré(s)</CardDescription>
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
          {jobTitles.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun poste créé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.length === jobTitles.length && jobTitles.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Société</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobTitles.map((job) => (
                  <TableRow key={job.id} className={selectedIds.includes(job.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(job.id)}
                        onCheckedChange={() => toggleSelection(job.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell>{job.department?.name || '-'}</TableCell>
                    <TableCell>{job.department?.company?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{job.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(job)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(job.id)}
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
            <DialogTitle>Modifier le poste</DialogTitle>
            <DialogDescription>Modifiez les informations du poste</DialogDescription>
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
              <Label htmlFor="edit-department">Service</Label>
              <SearchableSelect
                value={editDepartmentId}
                onValueChange={setEditDepartmentId}
                placeholder="Sélectionner..."
                searchPlaceholder="Rechercher un service..."
                options={departments.map((dept) => ({
                  value: dept.id,
                  label: `${dept.name}${dept.company?.name ? ` (${dept.company.name})` : ''}`,
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

      <BulkJobTitleImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        existingJobTitles={jobTitles}
        departments={departments}
        companies={companies}
        onAdd={onAdd}
        onImportComplete={onRefresh}
      />
    </div>
  );
}
