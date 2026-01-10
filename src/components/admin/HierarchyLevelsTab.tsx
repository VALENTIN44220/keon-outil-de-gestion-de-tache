import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { HierarchyLevel } from '@/types/admin';

interface HierarchyLevelsTabProps {
  hierarchyLevels: HierarchyLevel[];
  onAdd: (name: string, level: number, description?: string) => Promise<HierarchyLevel>;
  onDelete: (id: string) => Promise<void>;
}

export function HierarchyLevelsTab({ hierarchyLevels, onAdd, onDelete }: HierarchyLevelsTabProps) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarchyLevels.map((hl) => (
                  <TableRow key={hl.id}>
                    <TableCell className="font-mono">{hl.level}</TableCell>
                    <TableCell className="font-medium">{hl.name}</TableCell>
                    <TableCell className="text-muted-foreground">{hl.description || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(hl.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
