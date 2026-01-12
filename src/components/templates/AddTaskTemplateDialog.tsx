import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskTemplate } from '@/types/template';
import { CategorySelect } from './CategorySelect';
import { useCategories } from '@/hooks/useCategories';

interface AddTaskTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>) => void;
  orderIndex: number;
}

export function AddTaskTemplateDialog({ open, onClose, onAdd, orderIndex }: AddTaskTemplateDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [defaultDurationDays, setDefaultDurationDays] = useState(7);

  const { categories, addCategory, addSubcategory } = useCategories();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    // Get category name for backward compatibility
    const selectedCategory = categories.find(c => c.id === categoryId);

    onAdd({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      category: selectedCategory?.name || null,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      sub_process_template_id: null,
      default_duration_days: defaultDurationDays,
      order_index: orderIndex,
    });

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategoryId(null);
    setSubcategoryId(null);
    setDefaultDurationDays(7);
  };

  const handleAddCategory = async (name: string) => {
    const newCategory = await addCategory(name);
    if (newCategory) {
      setCategoryId(newCategory.id);
    }
  };

  const handleAddSubcategory = async (catId: string, name: string) => {
    const newSubcategory = await addSubcategory(catId, name);
    if (newSubcategory) {
      setSubcategoryId(newSubcategory.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter une tâche modèle</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre de la tâche *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Préparer le poste de travail"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions détaillées..."
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Durée par défaut (jours)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={365}
                value={defaultDurationDays}
                onChange={(e) => setDefaultDurationDays(Number(e.target.value))}
              />
            </div>
          </div>

          <CategorySelect
            categories={categories}
            selectedCategoryId={categoryId}
            selectedSubcategoryId={subcategoryId}
            onCategoryChange={setCategoryId}
            onSubcategoryChange={setSubcategoryId}
            onAddCategory={handleAddCategory}
            onAddSubcategory={handleAddSubcategory}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Ajouter la tâche
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
