import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskTemplate, TemplateVisibility, ValidationLevelType, VALIDATION_TYPE_LABELS } from '@/types/template';
import { CategorySelect } from './CategorySelect';
import { VisibilitySelect } from './VisibilitySelect';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  display_name: string | null;
}

interface AddTaskTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Omit<TaskTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>) => void;
  orderIndex: number;
}

export function AddTaskTemplateDialog({ open, onClose, onAdd, orderIndex }: AddTaskTemplateDialogProps) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [defaultDurationDays, setDefaultDurationDays] = useState(1);
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');
  
  // Validation fields
  const [validationLevel1, setValidationLevel1] = useState<ValidationLevelType>('none');
  const [validationLevel2, setValidationLevel2] = useState<ValidationLevelType>('none');
  const [validatorLevel1Id, setValidatorLevel1Id] = useState<string | null>(null);
  const [validatorLevel2Id, setValidatorLevel2Id] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const { categories, addCategory, addSubcategory } = useCategories();

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .order('display_name');
    if (data) setProfiles(data);
  };

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
      visibility_level: visibilityLevel,
      creator_company_id: profile?.company_id || null,
      creator_department_id: profile?.department_id || null,
      validation_level_1: validationLevel1,
      validation_level_2: validationLevel2,
      validator_level_1_id: validationLevel1 === 'free' ? validatorLevel1Id : null,
      validator_level_2_id: validationLevel2 === 'free' ? validatorLevel2Id : null,
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
    setVisibilityLevel('public');
    setValidationLevel1('none');
    setValidationLevel2('none');
    setValidatorLevel1Id(null);
    setValidatorLevel2Id(null);
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

          <VisibilitySelect
            value={visibilityLevel}
            onChange={setVisibilityLevel}
          />

          {/* Validation Level 1 */}
          <div className="space-y-2">
            <Label>Validation Niveau 1</Label>
            <Select value={validationLevel1} onValueChange={(v) => setValidationLevel1(v as ValidationLevelType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VALIDATION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {validationLevel1 === 'free' && (
            <div className="space-y-2">
              <Label>Validateur Niveau 1</Label>
              <Select value={validatorLevel1Id || '__none__'} onValueChange={(v) => setValidatorLevel1Id(v === '__none__' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un validateur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Non défini</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || 'Sans nom'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Validation Level 2 */}
          <div className="space-y-2">
            <Label>Validation Niveau 2</Label>
            <Select value={validationLevel2} onValueChange={(v) => setValidationLevel2(v as ValidationLevelType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VALIDATION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {validationLevel2 === 'free' && (
            <div className="space-y-2">
              <Label>Validateur Niveau 2</Label>
              <Select value={validatorLevel2Id || '__none__'} onValueChange={(v) => setValidatorLevel2Id(v === '__none__' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un validateur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Non défini</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || 'Sans nom'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
