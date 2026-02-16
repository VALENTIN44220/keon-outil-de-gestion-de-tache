import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, Pencil, Tags, FolderTree } from 'lucide-react';
import { toast } from 'sonner';
import { useCategories } from '@/hooks/useCategories';
import { RefreshButton } from './RefreshButton';
import type { Category, Subcategory } from '@/types/category';

export function CategoriesManagementTab() {
  const {
    categories, isLoading,
    addCategory, updateCategory, deleteCategory,
    addSubcategory, updateSubcategory, deleteSubcategory,
    refetch,
  } = useCategories();

  // Add category
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Edit category
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  // Add subcategory
  const [addSubCatId, setAddSubCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');

  // Edit subcategory
  const [editSub, setEditSub] = useState<(Subcategory & { category_id: string }) | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubDesc, setEditSubDesc] = useState('');

  const handleAddCategory = async () => {
    if (!newCatName.trim()) { toast.error('Le nom est requis'); return; }
    setIsAddingCat(true);
    await addCategory(newCatName.trim(), newCatDesc.trim() || undefined);
    setNewCatName(''); setNewCatDesc('');
    setIsAddingCat(false);
  };

  const handleUpdateCategory = async () => {
    if (!editCat || !editCatName.trim()) return;
    await updateCategory(editCat.id, editCatName.trim(), editCatDesc.trim() || undefined);
    setEditCat(null);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Supprimer cette catégorie et toutes ses sous-catégories ?')) return;
    await deleteCategory(id);
  };

  const handleAddSubcategory = async () => {
    if (!addSubCatId || !newSubName.trim()) { toast.error('Le nom est requis'); return; }
    await addSubcategory(addSubCatId, newSubName.trim(), newSubDesc.trim() || undefined);
    setNewSubName(''); setNewSubDesc(''); setAddSubCatId(null);
  };

  const handleUpdateSubcategory = async () => {
    if (!editSub || !editSubName.trim()) return;
    await updateSubcategory(editSub.id, editSub.category_id, editSubName.trim(), editSubDesc.trim() || undefined);
    setEditSub(null);
  };

  const handleDeleteSubcategory = async (id: string, categoryId: string) => {
    if (!window.confirm('Supprimer cette sous-catégorie ?')) return;
    await deleteSubcategory(id, categoryId);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Add category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Ajouter une catégorie
          </CardTitle>
          <CardDescription>Créez une nouvelle catégorie de demandes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Nom de la catégorie" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
            <Textarea placeholder="Description (optionnel)" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} rows={1} />
          </div>
          <Button onClick={handleAddCategory} disabled={isAddingCat}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Catégories et sous-catégories
            </CardTitle>
            <CardDescription>{categories.length} catégorie(s)</CardDescription>
          </div>
          <RefreshButton onRefresh={refetch} />
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune catégorie créée</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {categories.map(cat => (
                <AccordionItem key={cat.id} value={cat.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 mr-2">
                      <span className="font-semibold">{cat.name}</span>
                      {cat.description && <span className="text-xs text-muted-foreground">{cat.description}</span>}
                      <span className="text-xs text-muted-foreground ml-auto mr-2">
                        {cat.subcategories.length} sous-cat.
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-4 space-y-3">
                      {/* Category actions */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditCat(cat); setEditCatName(cat.name); setEditCatDesc(cat.description || ''); }}>
                          <Pencil className="h-3 w-3 mr-1" /> Modifier
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setAddSubCatId(cat.id); setNewSubName(''); setNewSubDesc(''); }}>
                          <Plus className="h-3 w-3 mr-1" /> Sous-catégorie
                        </Button>
                      </div>

                      {/* Subcategories table */}
                      {cat.subcategories.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Sous-catégorie</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="w-[120px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cat.subcategories.map(sub => (
                              <TableRow key={sub.id}>
                                <TableCell className="font-medium">{sub.name}</TableCell>
                                <TableCell className="text-muted-foreground">{sub.description || '-'}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditSub({ ...sub, category_id: cat.id }); setEditSubName(sub.name); setEditSubDesc(sub.description || ''); }}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteSubcategory(sub.id, cat.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Edit category dialog */}
      <Dialog open={!!editCat} onOpenChange={open => !open && setEditCat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la catégorie</DialogTitle>
            <DialogDescription>Modifiez le nom ou la description</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={editCatName} onChange={e => setEditCatName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editCatDesc} onChange={e => setEditCatDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditCat(null)}>Annuler</Button>
            <Button onClick={handleUpdateCategory}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add subcategory dialog */}
      <Dialog open={!!addSubCatId} onOpenChange={open => !open && setAddSubCatId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une sous-catégorie</DialogTitle>
            <DialogDescription>
              Dans : {categories.find(c => c.id === addSubCatId)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={newSubName} onChange={e => setNewSubName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={newSubDesc} onChange={e => setNewSubDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddSubCatId(null)}>Annuler</Button>
            <Button onClick={handleAddSubcategory}>Ajouter</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit subcategory dialog */}
      <Dialog open={!!editSub} onOpenChange={open => !open && setEditSub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la sous-catégorie</DialogTitle>
            <DialogDescription>Modifiez le nom ou la description</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={editSubName} onChange={e => setEditSubName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editSubDesc} onChange={e => setEditSubDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditSub(null)}>Annuler</Button>
            <Button onClick={handleUpdateSubcategory}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
