import { useState, useEffect } from 'react';
import { Task, TaskPriority } from '@/types/task';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategorySelect } from '@/components/templates/CategorySelect';
import { useCategories } from '@/hooks/useCategories';
import { useAssignmentRules } from '@/hooks/useAssignmentRules';
import { supabase } from '@/integrations/supabase/client';
import { InlineChecklistEditor } from './InlineChecklistEditor';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Info } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  job_title: string | null;
}

interface ChecklistItem {
  id: string;
  title: string;
  order_index: number;
}

interface AddRequestDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>, checklistItems?: ChecklistItem[]) => void;
}

export function AddRequestDialog({ open, onClose, onAdd }: AddRequestDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const { categories, addCategory, addSubcategory } = useCategories();
  const { findMatchingRule } = useAssignmentRules();

  // Find matching assignment rule
  const matchingRule = findMatchingRule(categoryId, subcategoryId);

  useEffect(() => {
    if (open) {
      fetchDepartments();
    }
  }, [open]);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    if (data) setDepartments(data);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    const selectedCategory = categories.find(c => c.id === categoryId);

    onAdd({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: 'todo',
      type: 'request',
      category: selectedCategory?.name || null,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      due_date: dueDate || null,
      // Apply assignment rule
      assignee_id: matchingRule?.target_assignee_id || null,
      target_department_id: matchingRule?.target_department_id || null,
      requester_id: null, // Will be set by the hook to current user's profile
      reporter_id: null,
    }, checklistItems.length > 0 ? checklistItems : undefined);

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategoryId(null);
    setSubcategoryId(null);
    setDueDate('');
    setChecklistItems([]);
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

  const getDepartmentName = (depId: string | null) => {
    if (!depId) return null;
    return departments.find(d => d.id === depId)?.name || null;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nouvelle demande
            <Badge variant="secondary">Ticket</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre de la demande *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Décrivez brièvement votre demande"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description détaillée</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Donnez plus de détails sur votre demande..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
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
              <Label htmlFor="dueDate">Date souhaitée</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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

          {/* Assignment info based on rule */}
          {categoryId && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Affectation automatique</p>
                  {matchingRule ? (
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>Cette demande sera envoyée à</span>
                      <ArrowRight className="h-3 w-3" />
                      <Badge variant="outline">
                        {matchingRule.target_department_id 
                          ? `Service: ${getDepartmentName(matchingRule.target_department_id)}`
                          : 'Personne assignée'
                        }
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      Aucune règle d'affectation trouvée pour cette catégorie. 
                      La demande sera créée sans affectation.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-4 mt-4">
            <InlineChecklistEditor 
              items={checklistItems} 
              onChange={setChecklistItems} 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              Soumettre la demande
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
