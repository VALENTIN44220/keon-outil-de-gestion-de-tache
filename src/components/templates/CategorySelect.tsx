import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { CategoryWithSubcategories, Subcategory } from '@/types/category';

interface CategorySelectProps {
  categories: CategoryWithSubcategories[];
  selectedCategoryId: string | null;
  selectedSubcategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  onSubcategoryChange: (subcategoryId: string | null) => void;
  onAddCategory?: (name: string) => Promise<void>;
  onAddSubcategory?: (categoryId: string, name: string) => Promise<void>;
  disabled?: boolean;
}

export function CategorySelect({
  categories,
  selectedCategoryId,
  selectedSubcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  onAddCategory,
  onAddSubcategory,
  disabled = false,
}: CategorySelectProps) {
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddSubcategoryOpen, setIsAddSubcategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const subcategories: Subcategory[] = selectedCategory?.subcategories || [];

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return;
    await onAddCategory(newCategoryName.trim());
    setNewCategoryName('');
    setIsAddCategoryOpen(false);
  };

  const handleAddSubcategory = async () => {
    if (!newSubcategoryName.trim() || !selectedCategoryId || !onAddSubcategory) return;
    await onAddSubcategory(selectedCategoryId, newSubcategoryName.trim());
    setNewSubcategoryName('');
    setIsAddSubcategoryOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Category Select */}
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <div className="flex gap-2">
          <SearchableSelect
            value={selectedCategoryId || 'none'}
            onValueChange={(value) => {
              const newCategoryId = value === 'none' ? null : value;
              onCategoryChange(newCategoryId);
              onSubcategoryChange(null);
            }}
            disabled={disabled}
            placeholder="Sélectionner une catégorie"
            searchPlaceholder="Rechercher une catégorie..."
            triggerClassName="flex-1"
            options={[
              { value: 'none', label: 'Aucune catégorie' },
              ...categories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
          />
          {onAddCategory && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsAddCategoryOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Subcategory Select */}
      {selectedCategoryId && (
        <div className="space-y-2">
          <Label>Sous-catégorie</Label>
          <div className="flex gap-2">
            <SearchableSelect
              value={selectedSubcategoryId || 'none'}
              onValueChange={(value) => onSubcategoryChange(value === 'none' ? null : value)}
              disabled={disabled}
              placeholder="Sélectionner une sous-catégorie"
              searchPlaceholder="Rechercher une sous-catégorie..."
              triggerClassName="flex-1"
              options={[
                { value: 'none', label: 'Aucune sous-catégorie' },
                ...subcategories.map((subcategory) => ({
                  value: subcategory.id,
                  label: subcategory.name,
                })),
              ]}
            />
            {onAddSubcategory && !disabled && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsAddSubcategoryOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newCategory">Nom de la catégorie</Label>
              <Input
                id="newCategory"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Ressources Humaines"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subcategory Dialog */}
      <Dialog open={isAddSubcategoryOpen} onOpenChange={setIsAddSubcategoryOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nouvelle sous-catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Catégorie parente</Label>
              <Input value={selectedCategory?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newSubcategory">Nom de la sous-catégorie</Label>
              <Input
                id="newSubcategory"
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                placeholder="Ex: Recrutement"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSubcategoryOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddSubcategory} disabled={!newSubcategoryName.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
