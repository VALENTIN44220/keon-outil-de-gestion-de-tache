import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Layers, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { HierarchyLevel } from '@/types/admin';

interface HierarchyLevelsTabProps {
  hierarchyLevels: HierarchyLevel[];
  onAdd: (name: string, level: number, description?: string) => Promise<HierarchyLevel>;
  onUpdate: (id: string, name: string, level: number, description?: string) => Promise<HierarchyLevel>;
  onDelete: (id: string) => Promise<void>;
}

export function HierarchyLevelsTab({ hierarchyLevels, onAdd, onUpdate, onDelete }: HierarchyLevelsTabProps) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<HierarchyLevel | null>(null);
  const [editName, setEditName] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    
    const levelNum = parseInt(level, 10);
    if (isNaN(levelNum) || levelNum < 0) {
      toast.error('Le niveau doit être un nombre positif');
      return;
    }

    setIsAdding(true);
    try {
      await onAdd(name.trim(), levelNum, description.trim() || undefined);
      setName('');
      setLevel('');
      setDescription('');
      toast.success('Niveau hiérarchique créé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsAdding(false);
    }
  };

  const openEditDialog = (item: HierarchyLevel) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditLevel(item.level.toString());
    setEditDescription(item.description || '');
  };

  const handleUpdate = async () => {
    if (!editingItem || !editName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    const levelNum = parseInt(editLevel, 10);
    if (isNaN(levelNum) || levelNum < 0) {
      toast.error('Le niveau doit être un nombre positif');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(editingItem.id, editName.trim(), levelNum, editDescription.trim() || undefined);
      setEditingItem(null);
      toast.success('Niveau modifié');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast.success('Niveau supprimé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Ajouter un niveau hiérarchique
          </CardTitle>
          <CardDescription>Définissez les niveaux de hiérarchie (0 = plus élevé)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              placeholder="Nom du niveau (ex: Directeur)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Niveau (0, 1, 2...)"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              min={0}
            />
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
          <CardTitle>Niveaux hiérarchiques</CardTitle>
          <CardDescription>{hierarchyLevels.length} niveau(x) défini(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {hierarchyLevels.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun niveau créé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Niveau</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarchyLevels.map((hl) => (
                  <TableRow key={hl.id}>
                    <TableCell className="font-mono">{hl.level}</TableCell>
                    <TableCell className="font-medium">{hl.name}</TableCell>
                    <TableCell className="text-muted-foreground">{hl.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(hl)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(hl.id)}
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
            <DialogTitle>Modifier le niveau hiérarchique</DialogTitle>
            <DialogDescription>Modifiez les informations du niveau</DialogDescription>
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
              <Label htmlFor="edit-level">Niveau</Label>
              <Input
                id="edit-level"
                type="number"
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value)}
                min={0}
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
    </div>
  );
}
