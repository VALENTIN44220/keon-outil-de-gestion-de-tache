import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskTemplate, TemplateVisibility, ValidationLevelType, VALIDATION_TYPE_LABELS } from '@/types/template';
import { CategorySelect } from './CategorySelect';
import { VisibilitySelect } from './VisibilitySelect';
import { VariableInputField } from './VariableInputField';
import { useCategories } from '@/hooks/useCategories';
import { useCustomFields } from '@/hooks/useCustomFields';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  display_name: string | null;
}

interface EditTaskTemplateDialogProps {
  task: TaskTemplate | null;
  open: boolean;
  onClose: () => void;
  onSave: (task: TaskTemplate) => void;
}

export function EditTaskTemplateDialog({ task, open, onClose, onSave }: EditTaskTemplateDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [defaultDurationDays, setDefaultDurationDays] = useState(1);
  const [defaultDurationUnit, setDefaultDurationUnit] = useState<'days' | 'hours'>('days');
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');
  
  const [validationLevel1, setValidationLevel1] = useState<ValidationLevelType>('none');
  const [validationLevel2, setValidationLevel2] = useState<ValidationLevelType>('none');
  const [validatorLevel1Id, setValidatorLevel1Id] = useState<string | null>(null);
  const [validatorLevel2Id, setValidatorLevel2Id] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { categories, addCategory, addSubcategory } = useCategories();
  
  // Get custom fields - include common + parent process + sub-process fields
  const { fields: customFields } = useCustomFields({ 
    processTemplateId: task?.process_template_id || undefined,
    subProcessTemplateId: task?.sub_process_template_id || undefined,
    includeCommon: true,
    includeParentProcessFields: true,
  });

  useEffect(() => {
    if (open && task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setCategoryId(task.category_id);
      setSubcategoryId(task.subcategory_id);
      setDefaultDurationDays(task.default_duration_days);
      setDefaultDurationUnit(task.default_duration_unit || 'days');
      setVisibilityLevel(task.visibility_level);
      setValidationLevel1(task.validation_level_1);
      setValidationLevel2(task.validation_level_2);
      setValidatorLevel1Id(task.validator_level_1_id);
      setValidatorLevel2Id(task.validator_level_2_id);
      fetchProfiles();
    }
  }, [open, task]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('status', 'active')
      .order('display_name');
    if (data) setProfiles(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !task) return;

    setIsSaving(true);
    try {
      const selectedCategory = categories.find(c => c.id === categoryId);

      const updates = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        category: selectedCategory?.name || null,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        default_duration_days: defaultDurationDays,
        default_duration_unit: defaultDurationUnit,
        visibility_level: visibilityLevel,
        validation_level_1: validationLevel1,
        validation_level_2: validationLevel2,
        validator_level_1_id: validationLevel1 === 'free' ? validatorLevel1Id : null,
        validator_level_2_id: validationLevel2 === 'free' ? validatorLevel2Id : null,
      };

      const { error } = await supabase
        .from('task_templates')
        .update(updates)
        .eq('id', task.id);

      if (error) throw error;

      onSave({ ...task, ...updates });
      toast.success('Tâche modèle mise à jour');
      onClose();
    } catch (error) {
      console.error('Error updating task template:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
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
          <DialogTitle>Modifier la tâche modèle</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <VariableInputField
            id="title"
            label="Titre de la tâche"
            value={title}
            onChange={setTitle}
            customFields={customFields}
            type="input"
            placeholder="Ex: Préparer le poste - {demandeur}"
            required
            maxLength={200}
          />

          <VariableInputField
            id="description"
            label="Description / Instructions"
            value={description}
            onChange={setDescription}
            customFields={customFields}
            type="textarea"
            placeholder="Instructions détaillées... Vous pouvez insérer des variables comme {champ:code_projet}"
            rows={4}
            maxLength={2000}
          />

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
              <Label htmlFor="duration">Durée par défaut</Label>
              <div className="flex gap-2">
                <Input
                  id="duration"
                  type="number"
                  min={0}
                  max={defaultDurationUnit === 'days' ? 365 : 2920}
                  value={defaultDurationDays}
                  onChange={(e) => setDefaultDurationDays(Number(e.target.value))}
                  className="flex-1"
                />
                <Select value={defaultDurationUnit} onValueChange={(v) => setDefaultDurationUnit(v as 'days' | 'hours')}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Jours</SelectItem>
                    <SelectItem value="hours">Heures</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {defaultDurationDays === 0 && (
                <p className="text-xs text-muted-foreground">⚡ Durée 0 : la tâche n'impacte pas la charge</p>
              )}
              {defaultDurationUnit === 'hours' && defaultDurationDays > 0 && (
                <p className="text-xs text-muted-foreground">💡 Plusieurs tâches en heures par jour (max 8h/jour)</p>
              )}
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

          {/* Note: Les champs de validation N1/N2 sont maintenant gérés via le workflow graphique */}
          <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              💡 La validation est maintenant configurée via l'onglet <strong>Workflow</strong> du processus parent.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!title.trim() || isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
