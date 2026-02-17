import { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, AssignmentRule } from '@/types/task';
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
import { TaskLinksEditor } from './TaskLinksEditor';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Info, Ticket, CheckSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

interface LinkItem {
  id: string;
  name: string;
  url: string;
  type: 'link' | 'file';
}

interface UnifiedTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (
    task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>, 
    checklistItems?: ChecklistItem[],
    links?: LinkItem[]
  ) => void;
}

export function UnifiedTaskDialog({ open, onClose, onAdd }: UnifiedTaskDialogProps) {
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
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);

  const { categories, addCategory, addSubcategory } = useCategories();
  const { findMatchingRule } = useAssignmentRules();

  // Find matching assignment rule
  const matchingRule: AssignmentRule | null = findMatchingRule(categoryId, subcategoryId);

  // Determine if this should be a request (based on assignment rule or manual department selection)
  const isRequest = Boolean(matchingRule || targetDepartmentId);
  const requiresManualAssignment = matchingRule && !matchingRule.auto_assign;
  const requiresValidation = matchingRule?.requires_validation || false;

  useEffect(() => {
    if (open) {
      fetchProfiles();
      fetchDepartments();
    }
  }, [open]);

  // Auto-apply assignment rule
  useEffect(() => {
    if (matchingRule) {
      if (matchingRule.auto_assign) {
        if (matchingRule.target_assignee_id) {
          setAssigneeId(matchingRule.target_assignee_id);
        }
        if (matchingRule.target_department_id) {
          setTargetDepartmentId(matchingRule.target_department_id);
        }
      }
    }
  }, [matchingRule]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, job_title')
      .order('display_name');

    if (!error && data) {
      setProfiles(data);
    }
  };

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
    const taskType = isRequest ? 'request' : 'task';

    onAdd({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      type: taskType,
      category: selectedCategory?.name || null,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      start_date: null,
      due_date: dueDate || null,
      assignee_id: assigneeId,
      requester_id: requesterId,
      reporter_id: reporterId,
      target_department_id: targetDepartmentId,
      validator_id: null,
      validation_requested_at: null,
      validated_at: null,
      validation_comment: null,
      requires_validation: requiresValidation,
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
      // New validation workflow fields
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
      // Numbering fields (auto-generated by DB trigger)
      request_number: null,
      task_number: null,
    }, checklistItems.length > 0 ? checklistItems : undefined, links.length > 0 ? links : undefined);

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
    setTargetDepartmentId(null);
    setChecklistItems([]);
    setLinks([]);
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRequest ? (
              <>
                <Ticket className="h-5 w-5" />
                Nouvelle demande
                <Badge variant="secondary">Ticket</Badge>
              </>
            ) : (
              <>
                <CheckSquare className="h-5 w-5" />
                Nouvelle tâche
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Décrivez brièvement votre demande ou tâche"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Donnez plus de détails..."
              rows={3}
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

          {/* Assignment info based on rule */}
          {matchingRule && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Règle d'affectation: {matchingRule.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                    {matchingRule.auto_assign ? (
                      <>
                        <span>Affectation automatique</span>
                        <ArrowRight className="h-3 w-3" />
                        <Badge variant="outline">
                          {matchingRule.target_department_id 
                            ? `Service: ${getDepartmentName(matchingRule.target_department_id)}`
                            : 'Personne assignée'
                          }
                        </Badge>
                      </>
                    ) : (
                      <span>Vous devez choisir l'affectation ci-dessous</span>
                    )}
                    {matchingRule.requires_validation && (
                      <Badge variant="secondary" className="ml-2">Validation requise</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <Label htmlFor="dueDate">Date d'échéance</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Manual assignment - show if no rule or rule requires manual assignment */}
          {(!matchingRule || requiresManualAssignment) && (
            <div className="border-t pt-4 mt-4">
              <Label className="text-base font-medium mb-3 block">Affectation</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service cible</Label>
                  <Select 
                    value={targetDepartmentId || 'none'} 
                    onValueChange={(v) => setTargetDepartmentId(v === 'none' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun (tâche personnelle)</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Exécutant</Label>
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
              </div>
            </div>
          )}

          {/* Additional roles section */}
          <Tabs defaultValue="checklist" className="border-t pt-4 mt-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="checklist">Sous-actions</TabsTrigger>
              <TabsTrigger value="links">Liens & PJ</TabsTrigger>
              <TabsTrigger value="roles">Responsabilités</TabsTrigger>
            </TabsList>
            
            <TabsContent value="checklist" className="mt-4">
              <InlineChecklistEditor 
                items={checklistItems} 
                onChange={setChecklistItems} 
              />
            </TabsContent>

            <TabsContent value="links" className="mt-4">
              <TaskLinksEditor 
                items={links} 
                onChange={setLinks} 
              />
            </TabsContent>

            <TabsContent value="roles" className="mt-4 space-y-4">
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
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {isRequest ? 'Soumettre la demande' : 'Créer la tâche'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
