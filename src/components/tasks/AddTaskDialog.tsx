import { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
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
import { supabase } from '@/integrations/supabase/client';
import { InlineChecklistEditor } from './InlineChecklistEditor';

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

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>, checklistItems?: ChecklistItem[]) => void;
}

export function AddTaskDialog({ open, onClose, onAdd }: AddTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [requesterId, setRequesterId] = useState<string | null>(null);
  const [reporterId, setReporterId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  const { categories, addCategory, addSubcategory } = useCategories();

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, job_title')
      .order('display_name');

    if (!error && data) {
      setProfiles(data);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    const selectedCategory = categories.find(c => c.id === categoryId);

    onAdd({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      type: 'task',
      category: selectedCategory?.name || null,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      due_date: dueDate || null,
      assignee_id: assigneeId,
      requester_id: requesterId,
      reporter_id: reporterId,
      target_department_id: null,
      validator_id: null,
      validation_requested_at: null,
      validated_at: null,
      validation_comment: null,
      requires_validation: false,
      current_validation_level: 0,
      parent_request_id: null,
      is_assignment_task: false,
      source_process_template_id: null,
      source_sub_process_template_id: null,
      be_project_id: null,
      be_label_id: null,
      rbe_validator_id: null,
      rbe_validated_at: null,
      rbe_validation_status: null,
      rbe_validation_comment: null,
      requester_validated_at: null,
      requester_validation_status: null,
      requester_validation_comment: null,
      // New validation fields
      validation_level_1: 'none',
      validation_level_2: 'none',
      validator_level_1_id: null,
      validator_level_2_id: null,
      validation_1_status: 'pending',
      validation_1_at: null,
      validation_1_by: null,
      validation_1_comment: null,
      validation_2_status: 'pending',
      validation_2_at: null,
      validation_2_by: null,
      validation_2_comment: null,
      original_assignee_id: null,
      is_locked_for_validation: false,
    }, checklistItems.length > 0 ? checklistItems : undefined);

    // Reset form
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStatus('todo');
    setCategoryId(null);
    setSubcategoryId(null);
    setDueDate('');
    setAssigneeId(null);
    setRequesterId(null);
    setReporterId(null);
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de la tâche"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez la tâche..."
              rows={3}
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
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in-progress">En cours</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Date d'échéance</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
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

          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-medium mb-3 block">Responsabilités</Label>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Demandeur (qui crée l'action)</Label>
                <Select 
                  value={requesterId || 'none'} 
                  onValueChange={(v) => setRequesterId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le demandeur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.display_name || 'Sans nom'} 
                        {profile.job_title && ` - ${profile.job_title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Exécutant (qui fait l'action)</Label>
                <Select 
                  value={assigneeId || 'none'} 
                  onValueChange={(v) => setAssigneeId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner l'exécutant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.display_name || 'Sans nom'} 
                        {profile.job_title && ` - ${profile.job_title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rapporteur (à qui rapporter l'action)</Label>
                <Select 
                  value={reporterId || 'none'} 
                  onValueChange={(v) => setReporterId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le rapporteur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.display_name || 'Sans nom'} 
                        {profile.job_title && ` - ${profile.job_title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

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
              Créer la tâche
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
