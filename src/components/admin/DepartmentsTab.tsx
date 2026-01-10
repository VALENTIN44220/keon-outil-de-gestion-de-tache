import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Briefcase, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { Department, Company } from '@/types/admin';

interface DepartmentsTabProps {
  departments: Department[];
  companies: Company[];
  onAdd: (name: string, company_id?: string, description?: string) => Promise<Department>;
  onUpdate: (id: string, name: string, company_id?: string, description?: string) => Promise<Department>;
  onDelete: (id: string) => Promise<void>;
}

export function DepartmentsTab({ departments, companies, onAdd, onUpdate, onDelete }: DepartmentsTabProps) {
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<Department | null>(null);
  const [editName, setEditName] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

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
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Société (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
            />
          </div>
          <Button onClick={handleAdd} disabled={isAdding}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services existants</CardTitle>
          <CardDescription>{departments.length} service(s) enregistré(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun service créé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Société</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
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
              <Select value={editCompanyId} onValueChange={setEditCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </div>
  );
}
