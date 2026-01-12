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
import { useRequestWorkflow } from '@/hooks/useRequestWorkflow';
import { supabase } from '@/integrations/supabase/client';
import { InlineChecklistEditor } from './InlineChecklistEditor';
import { TaskLinksEditor } from './TaskLinksEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Info, ArrowRight, Building2, Workflow } from 'lucide-react';

interface Department {
  id: string;
  name: string;
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

interface NewRequestDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (
    task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>, 
    checklistItems?: ChecklistItem[],
    links?: LinkItem[]
  ) => Promise<void>;
  onTasksCreated?: () => void;
  initialProcessTemplateId?: string;
}

export function NewRequestDialog({ open, onClose, onAdd, onTasksCreated, initialProcessTemplateId }: NewRequestDialogProps) {
  const { profile: currentUser } = useAuth();
  const { generateTasksFromProcess, getProcessTemplateForSubcategory } = useRequestWorkflow();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [linkedProcessId, setLinkedProcessId] = useState<string | null>(null);
  const [linkedProcessName, setLinkedProcessName] = useState<string | null>(null);

  const { categories, addCategory, addSubcategory } = useCategories();
  const { findMatchingRule } = useAssignmentRules();

  // Find matching assignment rule
  const matchingRule: AssignmentRule | null = findMatchingRule(categoryId, subcategoryId);
  const requiresValidation = matchingRule?.requires_validation || false;

  // Check if subcategory has a linked process template
  useEffect(() => {
    const checkLinkedProcess = async () => {
      if (!subcategoryId) {
        setLinkedProcessId(null);
        setLinkedProcessName(null);
        return;
      }

      const processId = await getProcessTemplateForSubcategory(subcategoryId);
      setLinkedProcessId(processId);

      if (processId) {
        const { data } = await supabase
          .from('process_templates')
          .select('name')
          .eq('id', processId)
          .single();
        setLinkedProcessName(data?.name || null);
      }
    };

    checkLinkedProcess();
  }, [subcategoryId, getProcessTemplateForSubcategory]);

  // Load initial process template if provided
  useEffect(() => {
    const loadInitialProcess = async () => {
      if (initialProcessTemplateId && open) {
        const { data } = await supabase
          .from('process_templates')
          .select('id, name, department')
          .eq('id', initialProcessTemplateId)
          .single();
        
        if (data) {
          setLinkedProcessId(data.id);
          setLinkedProcessName(data.name);
          
          // Auto-select target department based on process
          if (data.department) {
            const { data: deptData } = await supabase
              .from('departments')
              .select('id')
              .eq('name', data.department)
              .single();
            if (deptData) {
              setTargetDepartmentId(deptData.id);
            }
          }
        }
      }
    };

    if (open) {
      fetchDepartments();
      loadInitialProcess();
    }
  }, [open, initialProcessTemplateId]);

  // Auto-apply assignment rule
  useEffect(() => {
    if (matchingRule && matchingRule.auto_assign && matchingRule.target_department_id) {
      setTargetDepartmentId(matchingRule.target_department_id);
    }
  }, [matchingRule]);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    if (data) setDepartments(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !targetDepartmentId) return;

    setIsSubmitting(true);
    
    try {
      const selectedCategory = categories.find(c => c.id === categoryId);

      // Create the request task
      const { data: requestData, error: requestError } = await supabase
        .from('tasks')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status: 'todo',
          type: 'request',
          category: selectedCategory?.name || null,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          due_date: dueDate || null,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          assignee_id: matchingRule?.target_assignee_id || null,
          requester_id: currentUser?.id || null,
          reporter_id: null,
          target_department_id: targetDepartmentId,
          validator_id: null,
          validation_requested_at: null,
          validated_at: null,
          validation_comment: null,
          requires_validation: requiresValidation,
          current_validation_level: 0,
          source_process_template_id: linkedProcessId,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create checklist items
      if (checklistItems.length > 0) {
        await supabase.from('task_checklists').insert(
          checklistItems.map(item => ({
            task_id: requestData.id,
            title: item.title,
            order_index: item.order_index,
          }))
        );
      }

      // Create links/attachments
      if (links.length > 0) {
        await supabase.from('task_attachments').insert(
          links.map(link => ({
            task_id: requestData.id,
            name: link.name,
            url: link.url,
            type: link.type,
            uploaded_by: currentUser?.id || null,
          }))
        );
      }

      // If there's a linked process, generate tasks from it
      if (linkedProcessId && targetDepartmentId) {
        await generateTasksFromProcess({
          parentRequestId: requestData.id,
          processTemplateId: linkedProcessId,
          targetDepartmentId,
        });
      }

      onTasksCreated?.();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategoryId(null);
    setSubcategoryId(null);
    setDueDate('');
    setTargetDepartmentId(null);
    setChecklistItems([]);
    setLinks([]);
    setLinkedProcessId(null);
    setLinkedProcessName(null);
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
            <Building2 className="h-5 w-5" />
            Nouvelle demande à un service de KEON
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Décrivez brièvement votre demande"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Donnez plus de détails sur votre demande..."
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

          {/* Linked process info */}
          {linkedProcessId && linkedProcessName && (
            <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <Workflow className="h-4 w-4 mt-0.5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">Processus associé: {linkedProcessName}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cette demande déclenchera automatiquement la création des tâches du processus.
                    Elles seront assignées par le responsable du service cible.
                  </p>
                </div>
              </div>
            </div>
          )}

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
                      <span>Veuillez sélectionner le service cible ci-dessous</span>
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
              <Label>Service cible *</Label>
              <Select 
                value={targetDepartmentId || ''} 
                onValueChange={(v) => setTargetDepartmentId(v || null)}
                disabled={matchingRule?.auto_assign && matchingRule?.target_department_id ? true : false}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

          {/* Additional tabs */}
          <Tabs defaultValue="links" className="border-t pt-4 mt-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="links">Liens & PJ</TabsTrigger>
              <TabsTrigger value="checklist">Sous-actions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="links" className="mt-4">
              <TaskLinksEditor 
                items={links} 
                onChange={setLinks} 
              />
            </TabsContent>

            <TabsContent value="checklist" className="mt-4">
              <InlineChecklistEditor 
                items={checklistItems} 
                onChange={setChecklistItems} 
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!title.trim() || !targetDepartmentId || isSubmitting}>
              {isSubmitting ? 'Création en cours...' : 'Soumettre la demande'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
