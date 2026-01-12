import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TemplateVisibility } from '@/types/template';
import { CategorySelect } from './CategorySelect';
import { VisibilitySelectExtended } from './VisibilitySelectExtended';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { saveTemplateVisibility } from '@/hooks/useTemplateVisibility';

interface AddIndependentTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProcessTemplate {
  id: string;
  name: string;
}

interface SubProcessTemplate {
  id: string;
  name: string;
  process_template_id: string | null;
}

export function AddIndependentTaskDialog({
  open,
  onClose,
  onSuccess,
}: AddIndependentTaskDialogProps) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [processTemplateId, setProcessTemplateId] = useState<string>('');
  const [subProcessTemplateId, setSubProcessTemplateId] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [defaultDurationDays, setDefaultDurationDays] = useState(7);
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');
  const [visibilityCompanyIds, setVisibilityCompanyIds] = useState<string[]>([]);
  const [visibilityDepartmentIds, setVisibilityDepartmentIds] = useState<string[]>([]);

  const [processes, setProcesses] = useState<ProcessTemplate[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcessTemplate[]>([]);
  const [filteredSubProcesses, setFilteredSubProcesses] = useState<SubProcessTemplate[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { categories, addCategory, addSubcategory } = useCategories();

  useEffect(() => {
    if (open) {
      fetchReferenceData();
    }
  }, [open]);

  useEffect(() => {
    if (processTemplateId) {
      setFilteredSubProcesses(
        subProcesses.filter((sp) => sp.process_template_id === processTemplateId)
      );
    } else {
      setFilteredSubProcesses(subProcesses.filter((sp) => !sp.process_template_id));
    }
    setSubProcessTemplateId('');
  }, [processTemplateId, subProcesses]);

  const fetchReferenceData = async () => {
    const [processRes, subProcessRes] = await Promise.all([
      supabase.from('process_templates').select('id, name').order('name'),
      supabase.from('sub_process_templates').select('id, name, process_template_id').order('name'),
    ]);

    if (processRes.data) setProcesses(processRes.data);
    if (subProcessRes.data) setSubProcesses(subProcessRes.data);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProcessTemplateId('');
    setSubProcessTemplateId('');
    setPriority('medium');
    setCategoryId(null);
    setSubcategoryId(null);
    setDefaultDurationDays(7);
    setVisibilityLevel('public');
    setVisibilityCompanyIds([]);
    setVisibilityDepartmentIds([]);
  };

  const isValidVisibility = () => {
    if (visibilityLevel === 'internal_company' && visibilityCompanyIds.length === 0) {
      return false;
    }
    if (visibilityLevel === 'internal_department' && visibilityDepartmentIds.length === 0) {
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user || !isValidVisibility()) return;

    setIsSubmitting(true);
    try {
      // Get category name for backward compatibility
      const selectedCategory = categories.find((c) => c.id === categoryId);

      // Get order index
      let orderQuery = supabase.from('task_templates').select('*', { count: 'exact', head: true });
      if (subProcessTemplateId) {
        orderQuery = orderQuery.eq('sub_process_template_id', subProcessTemplateId);
      } else if (processTemplateId) {
        orderQuery = orderQuery.eq('process_template_id', processTemplateId).is('sub_process_template_id', null);
      } else {
        orderQuery = orderQuery.is('process_template_id', null).is('sub_process_template_id', null);
      }
      const { count } = await orderQuery;

      const { data, error } = await supabase.from('task_templates').insert({
        title: title.trim(),
        description: description.trim() || null,
        process_template_id: processTemplateId || null,
        sub_process_template_id: subProcessTemplateId || null,
        priority,
        category: selectedCategory?.name || null,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        default_duration_days: defaultDurationDays,
        order_index: count || 0,
        visibility_level: visibilityLevel,
        creator_company_id: profile?.company_id || null,
        creator_department_id: profile?.department_id || null,
        user_id: user.id,
      }).select('id').single();

      if (error) throw error;

      // Save visibility associations
      if (data) {
        await saveTemplateVisibility(
          'task',
          data.id,
          visibilityCompanyIds,
          visibilityDepartmentIds
        );
      }

      toast.success('Tâche modèle créée avec succès');
      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating task template:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
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
          <DialogTitle>Nouvelle tâche modèle</DialogTitle>
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
              <Label>Processus parent (optionnel)</Label>
              <Select
                value={processTemplateId || '__none__'}
                onValueChange={(v) => setProcessTemplateId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {processes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sous-processus (optionnel)</Label>
              <Select
                value={subProcessTemplateId || '__none__'}
                onValueChange={(v) => setSubProcessTemplateId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {filteredSubProcesses.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <VisibilitySelectExtended
            value={visibilityLevel}
            onChange={setVisibilityLevel}
            selectedCompanyIds={visibilityCompanyIds}
            onCompanyIdsChange={setVisibilityCompanyIds}
            selectedDepartmentIds={visibilityDepartmentIds}
            onDepartmentIdsChange={setVisibilityDepartmentIds}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!title.trim() || isSubmitting || !isValidVisibility()}>
              {isSubmitting ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
