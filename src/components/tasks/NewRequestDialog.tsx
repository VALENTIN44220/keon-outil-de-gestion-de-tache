import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { CategorySelect } from '@/components/templates/CategorySelect';
import { useCategories } from '@/hooks/useCategories';
import { useAssignmentRules } from '@/hooks/useAssignmentRules';
import { useRequestWorkflow } from '@/hooks/useRequestWorkflow';
import { useCustomFields } from '@/hooks/useCustomFields';
import { supabase } from '@/integrations/supabase/client';
import { InlineChecklistEditor } from './InlineChecklistEditor';
import { TaskLinksEditor } from './TaskLinksEditor';
import { CustomFieldsRenderer, validateCustomFields } from './CustomFieldsRenderer';
import { GroupedCustomFieldsRenderer } from './GroupedCustomFieldsRenderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Info, ArrowRight, Building2, Workflow, FormInput, CheckSquare, FileText, Paperclip } from 'lucide-react';
import { BEProjectSelect } from '@/components/be/BEProjectSelect';
import { BELabelSelect } from '@/components/be/BELabelSelect';
import { toast } from 'sonner';
import { TemplateCustomField } from '@/types/customField';

interface Department {
  id: string;
  name: string;
}

interface SubProcessTemplate {
  id: string;
  name: string;
  process_template_id: string;
  description: string | null;
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
  initialSubProcessTemplateId?: string;
}

export function NewRequestDialog({ open, onClose, onAdd, onTasksCreated, initialProcessTemplateId, initialSubProcessTemplateId }: NewRequestDialogProps) {
  const { profile: currentUser } = useAuth();
  const { generatePendingAssignments, getProcessTemplateForSubcategory } = useRequestWorkflow();
  
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
  const [beProjectId, setBeProjectId] = useState<string | null>(null);
  const [beLabelId, setBeLabelId] = useState<string | null>(null);
  
  // Process/sub-process state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [linkedProcessId, setLinkedProcessId] = useState<string | null>(null);
  const [linkedProcessName, setLinkedProcessName] = useState<string | null>(null);
  const [availableSubProcesses, setAvailableSubProcesses] = useState<SubProcessTemplate[]>([]);
  const [selectedSubProcessIds, setSelectedSubProcessIds] = useState<string[]>([]);
  const [linkedSubProcessId, setLinkedSubProcessId] = useState<string | null>(null);
  const [linkedSubProcessName, setLinkedSubProcessName] = useState<string | null>(null);
  const [hasMultipleSubProcesses, setHasMultipleSubProcesses] = useState(false);

  // Custom fields state
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [subProcessCustomFields, setSubProcessCustomFields] = useState<Record<string, TemplateCustomField[]>>({});

  // Fetch custom fields for the process
  const { fields: processFields, isLoading: loadingProcessFields } = useCustomFields({
    processTemplateId: linkedProcessId,
    includeCommon: true,
  });

  // Track if process imposes values (they should be locked)
  const [processImposedValues, setProcessImposedValues] = useState(false);

  const { categories, addCategory, addSubcategory } = useCategories();
  const { findMatchingRule } = useAssignmentRules();

  // Find matching assignment rule (memoized)
  const matchingRule: AssignmentRule | null = useMemo(
    () => findMatchingRule(categoryId, subcategoryId),
    [findMatchingRule, categoryId, subcategoryId]
  );
  const requiresValidation = matchingRule?.requires_validation || false;

  // Fetch custom fields for each available sub-process
  useEffect(() => {
    const fetchSubProcessFields = async () => {
      const fieldsMap: Record<string, TemplateCustomField[]> = {};
      
      for (const subProcess of availableSubProcesses) {
        const { data } = await supabase
          .from('template_custom_fields')
          .select('*')
          .eq('sub_process_template_id', subProcess.id)
          .order('order_index');
        
        if (data && data.length > 0) {
          fieldsMap[subProcess.id] = data.map((field: any) => ({
            ...field,
            options: field.options || null,
          }));
        }
      }
      
      setSubProcessCustomFields(fieldsMap);
    };

    if (availableSubProcesses.length > 0) {
      fetchSubProcessFields();
    }
  }, [availableSubProcesses]);

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

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

  // Load initial process/sub-process template if provided
  useEffect(() => {
    const loadInitialTemplates = async () => {
      if (!open) return;

      // Load sub-process template first if provided (single selection mode)
      if (initialSubProcessTemplateId) {
        const { data: subProcess } = await supabase
          .from('sub_process_templates')
          .select('id, name, process_template_id, target_department_id')
          .eq('id', initialSubProcessTemplateId)
          .single();
        
        if (subProcess) {
          setLinkedSubProcessId(subProcess.id);
          setLinkedSubProcessName(subProcess.name);
          setSelectedSubProcessIds([subProcess.id]);
          setHasMultipleSubProcesses(false);
          
          if (subProcess.target_department_id) {
            setTargetDepartmentId(subProcess.target_department_id);
          }

          const { data: process } = await supabase
            .from('process_templates')
            .select('id, name, department, category_id, subcategory_id, target_department_id')
            .eq('id', subProcess.process_template_id)
            .single();
          
          if (process) {
            setLinkedProcessId(process.id);
            setLinkedProcessName(process.name);
            
            if (process.category_id) {
              setCategoryId(process.category_id);
              setProcessImposedValues(true);
            }
            if (process.subcategory_id) {
              setSubcategoryId(process.subcategory_id);
              setProcessImposedValues(true);
            }
            
            if (subProcess.target_department_id) {
              setTargetDepartmentId(subProcess.target_department_id);
              setProcessImposedValues(true);
            } else if (process.target_department_id) {
              setTargetDepartmentId(process.target_department_id);
              setProcessImposedValues(true);
            } else if (process.department) {
              const { data: deptData } = await supabase
                .from('departments')
                .select('id')
                .eq('name', process.department)
                .single();
              if (deptData) {
                setTargetDepartmentId(deptData.id);
                setProcessImposedValues(true);
              }
            }
          }
        }
      } else if (initialProcessTemplateId) {
        // Process template selected - enable multiple sub-process selection
        const { data } = await supabase
          .from('process_templates')
          .select('id, name, department, category_id, subcategory_id, target_department_id')
          .eq('id', initialProcessTemplateId)
          .single();
        
        if (data) {
          setLinkedProcessId(data.id);
          setLinkedProcessName(data.name);
          
          if (data.category_id) {
            setCategoryId(data.category_id);
            setProcessImposedValues(true);
          }
          if (data.subcategory_id) {
            setSubcategoryId(data.subcategory_id);
            setProcessImposedValues(true);
          }
          
          if (data.target_department_id) {
            setTargetDepartmentId(data.target_department_id);
            setProcessImposedValues(true);
          } else if (data.department) {
            const { data: deptData } = await supabase
              .from('departments')
              .select('id')
              .eq('name', data.department)
              .single();
            if (deptData) {
              setTargetDepartmentId(deptData.id);
              setProcessImposedValues(true);
            }
          }

          // Fetch sub-processes for this process
          const { data: subProcessData } = await supabase
            .from('sub_process_templates')
            .select('id, name, process_template_id, description')
            .eq('process_template_id', data.id)
            .order('order_index', { ascending: true });
          
          if (subProcessData && subProcessData.length > 0) {
            setAvailableSubProcesses(subProcessData);
            setHasMultipleSubProcesses(true);
          }
        }
      }
    };

    if (open) {
      fetchDepartments();
      loadInitialTemplates();
    }
  }, [open, initialProcessTemplateId, initialSubProcessTemplateId]);

  // Auto-apply assignment rule (guarded to avoid render loops)
  useEffect(() => {
    const deptId =
      matchingRule && matchingRule.auto_assign ? matchingRule.target_department_id : null;

    if (deptId && deptId !== targetDepartmentId) {
      setTargetDepartmentId(deptId);
    }
  }, [matchingRule?.id, matchingRule?.auto_assign, matchingRule?.target_department_id, targetDepartmentId]);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    if (data) setDepartments(data);
  };

  const toggleSubProcess = (subProcessId: string) => {
    setSelectedSubProcessIds(prev => {
      if (prev.includes(subProcessId)) {
        return prev.filter(id => id !== subProcessId);
      } else {
        return [...prev, subProcessId];
      }
    });
  };

  // Memoized visible custom fields to prevent infinite re-renders
  const visibleCustomFields = useMemo(() => {
    const commonFieldsSet = new Map<string, TemplateCustomField>();
    const processSpecificFields: TemplateCustomField[] = [];
    const subProcessFieldGroups: { subProcessId: string; subProcessName: string; fields: TemplateCustomField[] }[] = [];

    // Process-level fields (common + specific)
    for (const field of processFields) {
      if (field.is_common) {
        commonFieldsSet.set(field.id, field);
      } else {
        processSpecificFields.push(field);
      }
    }

    // Get relevant sub-process IDs
    const relevantSubProcessIds = hasMultipleSubProcesses 
      ? selectedSubProcessIds 
      : (linkedSubProcessId ? [linkedSubProcessId] : []);

    // Sub-process fields, with common fields deduplicated
    for (const spId of relevantSubProcessIds) {
      const spFields = subProcessCustomFields[spId] || [];
      const spSpecificFields: TemplateCustomField[] = [];
      
      for (const field of spFields) {
        if (field.is_common) {
          // Only add to common if not already present
          if (!commonFieldsSet.has(field.id)) {
            commonFieldsSet.set(field.id, field);
          }
        } else {
          spSpecificFields.push(field);
        }
      }

      if (spSpecificFields.length > 0) {
        const sp = availableSubProcesses.find(s => s.id === spId);
        subProcessFieldGroups.push({
          subProcessId: spId,
          subProcessName: sp?.name || 'Sous-processus',
          fields: spSpecificFields,
        });
      }
    }
    
    return {
      commonFields: Array.from(commonFieldsSet.values()),
      processFields: processSpecificFields,
      subProcessFieldGroups,
    };
  }, [processFields, hasMultipleSubProcesses, selectedSubProcessIds, linkedSubProcessId, subProcessCustomFields, availableSubProcesses]);

  const customFieldsCount = useMemo(() => {
    const { commonFields, processFields: pFields, subProcessFieldGroups } = visibleCustomFields;
    let total = commonFields.length + pFields.length;
    for (const group of subProcessFieldGroups) {
      total += group.fields.length;
    }
    return total;
  }, [visibleCustomFields]);

  // Get fields that should be saved for a specific sub-process
  const getFieldsForSubProcess = useCallback((subProcessId: string): string[] => {
    const fieldIds: string[] = [];
    
    // Common fields go to all
    for (const field of visibleCustomFields.commonFields) {
      fieldIds.push(field.id);
    }
    
    // Process-level specific fields go to all
    for (const field of processFields) {
      if (!field.is_common) {
        fieldIds.push(field.id);
      }
    }
    
    // Sub-process specific fields only for matching sub-process
    const spFields = subProcessCustomFields[subProcessId] || [];
    for (const field of spFields) {
      if (!field.is_common) {
        fieldIds.push(field.id);
      }
    }
    
    return fieldIds;
  }, [visibleCustomFields.commonFields, processFields, subProcessCustomFields]);

  // Get all fields as a flat array for validation
  const allFieldsFlat = useMemo((): TemplateCustomField[] => {
    const { commonFields, processFields: pFields, subProcessFieldGroups } = visibleCustomFields;
    const allFields: TemplateCustomField[] = [...commonFields, ...pFields];
    for (const group of subProcessFieldGroups) {
      allFields.push(...group.fields);
    }
    return allFields;
  }, [visibleCustomFields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Le titre est obligatoire');
      return;
    }

    if (!targetDepartmentId) {
      toast.error('Veuillez sélectionner un service cible');
      return;
    }

    // If multi-select mode and no sub-process selected
    if (hasMultipleSubProcesses && selectedSubProcessIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un sous-processus');
      return;
    }

    // Validate custom fields
    const { isValid, errors } = validateCustomFields(allFieldsFlat, customFieldValues);
    if (!isValid) {
      setFieldErrors(errors);
      toast.error('Veuillez corriger les erreurs dans les champs personnalisés');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Utilisateur non connecté');

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
          user_id: userId,
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
          source_sub_process_template_id: linkedSubProcessId,
          be_project_id: beProjectId,
          be_label_id: beLabelId,
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

      // Save custom field values
      const fieldValuesToInsert = Object.entries(customFieldValues)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .map(([fieldId, value]) => ({
          task_id: requestData.id,
          field_id: fieldId,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        }));

      if (fieldValuesToInsert.length > 0) {
        const { error: fieldError } = await supabase
          .from('request_field_values')
          .insert(fieldValuesToInsert);
        
        if (fieldError) {
          console.error('Error saving custom field values:', fieldError);
        }
      }

      // Generate pending assignments based on selection mode
      if (hasMultipleSubProcesses && selectedSubProcessIds.length > 0) {
        // Multiple sub-processes selected
        let totalAssignments = 0;

        for (const subProcessId of selectedSubProcessIds) {
          // Save sub-process selection (for tracking)
          await supabase.from('be_request_sub_processes').insert({
            task_id: requestData.id,
            sub_process_template_id: subProcessId,
          });

          // Generate pending assignments for this sub-process
          if (linkedProcessId && targetDepartmentId) {
            const count = await generatePendingAssignments({
              parentRequestId: requestData.id,
              processTemplateId: linkedProcessId,
              targetDepartmentId,
              subProcessTemplateId: subProcessId,
            });
            totalAssignments += count;
          }
        }

        toast.success(
          `Demande créée avec ${selectedSubProcessIds.length} sous-processus sélectionné(s)`
        );
      } else if (linkedSubProcessId && targetDepartmentId) {
        // Single sub-process mode
        await generatePendingAssignments({
          parentRequestId: requestData.id,
          processTemplateId: linkedProcessId || '',
          targetDepartmentId,
          subProcessTemplateId: linkedSubProcessId,
        });
        toast.success('Demande créée avec succès');
      } else if (linkedProcessId && targetDepartmentId) {
        // Fallback to process level if no sub-process
        await generatePendingAssignments({
          parentRequestId: requestData.id,
          processTemplateId: linkedProcessId,
          targetDepartmentId,
        });
        toast.success('Demande créée avec succès');
      } else {
        toast.success('Demande créée avec succès');
      }

      onTasksCreated?.();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error('Erreur lors de la création de la demande');
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
    setLinkedSubProcessId(null);
    setLinkedSubProcessName(null);
    setAvailableSubProcesses([]);
    setSelectedSubProcessIds([]);
    setHasMultipleSubProcesses(false);
    setBeProjectId(null);
    setBeLabelId(null);
    setProcessImposedValues(false);
    setCustomFieldValues({});
    setFieldErrors({});
    setSubProcessCustomFields({});
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

  const showSubProcessTab = hasMultipleSubProcesses && availableSubProcesses.length > 0;
  const showCustomFieldsTab = customFieldsCount > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {linkedProcessName ? `Demande: ${linkedProcessName}` : 'Nouvelle demande à un service'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className={`grid w-full ${showSubProcessTab && showCustomFieldsTab ? 'grid-cols-4' : showSubProcessTab || showCustomFieldsTab ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="general" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Général
              </TabsTrigger>
              {showSubProcessTab && (
                <TabsTrigger value="subprocesses" className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Tâches ({selectedSubProcessIds.length})
                </TabsTrigger>
              )}
              {showCustomFieldsTab && (
                <TabsTrigger value="customfields" className="flex items-center gap-2">
                  <FormInput className="h-4 w-4" />
                  Champs ({customFieldsCount})
                </TabsTrigger>
              )}
              <TabsTrigger value="extras" className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Compléments
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4 pr-4">
              <TabsContent value="general" className="space-y-4">
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

                {processImposedValues && linkedProcessId && (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3">
                    <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <Info className="h-4 w-4 shrink-0" />
                      Les champs catégorie, sous-catégorie et service cible sont définis par le processus sélectionné.
                    </p>
                  </div>
                )}

                <CategorySelect
                  categories={categories}
                  selectedCategoryId={categoryId}
                  selectedSubcategoryId={subcategoryId}
                  onCategoryChange={setCategoryId}
                  onSubcategoryChange={setSubcategoryId}
                  onAddCategory={handleAddCategory}
                  onAddSubcategory={handleAddSubcategory}
                  disabled={processImposedValues}
                />

                {/* BE Project Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <BEProjectSelect
                    value={beProjectId}
                    onChange={setBeProjectId}
                  />
                  <BELabelSelect
                    value={beLabelId}
                    onChange={setBeLabelId}
                  />
                </div>

                {(linkedProcessId || linkedSubProcessId) && !hasMultipleSubProcesses && (
                  <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
                    <div className="flex items-start gap-2">
                      <Workflow className="h-4 w-4 mt-0.5 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-primary">
                          {linkedSubProcessName 
                            ? `${linkedProcessName} → ${linkedSubProcessName}`
                            : `Processus: ${linkedProcessName}`
                          }
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Cette demande déclenchera automatiquement la création des tâches du {linkedSubProcessId ? 'sous-processus' : 'processus'}.
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
                      disabled={processImposedValues || (matchingRule?.auto_assign && matchingRule?.target_department_id ? true : false)}
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
              </TabsContent>

              {/* Sub-processes Tab */}
              {showSubProcessTab && (
                <TabsContent value="subprocesses" className="space-y-4">
                  <div className="rounded-lg border border-primary/50 bg-primary/5 p-3">
                    <p className="text-sm text-muted-foreground">
                      Sélectionnez les tâches à réaliser pour cette demande. Chaque tâche cochée déclenchera la création des actions correspondantes.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableSubProcesses.map((subProcess) => {
                      const isSelected = selectedSubProcessIds.includes(subProcess.id);
                      const hasCustomFields = subProcessCustomFields[subProcess.id]?.length > 0;
                      
                      return (
                        <div
                          key={subProcess.id}
                          className={`
                            flex items-center space-x-3 p-3 rounded-lg border cursor-pointer
                            transition-colors
                            ${isSelected 
                              ? 'bg-primary/10 border-primary' 
                              : 'bg-muted/30 border-border hover:bg-muted/50'
                            }
                          `}
                          onClick={() => toggleSubProcess(subProcess.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSubProcess(subProcess.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                              {subProcess.name}
                            </span>
                            {hasCustomFields && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Champs
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedSubProcessIds.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">
                        Sous-processus sélectionnés ({selectedSubProcessIds.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSubProcessIds.map(spId => {
                          const sp = availableSubProcesses.find(s => s.id === spId);
                          return sp ? (
                            <Badge 
                              key={spId} 
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() => toggleSubProcess(spId)}
                            >
                              {sp.name} ×
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Custom Fields Tab */}
              {showCustomFieldsTab && (
                <TabsContent value="customfields" className="space-y-4">
                  <div className="rounded-lg border border-primary/50 bg-primary/5 p-3">
                    <p className="text-sm text-muted-foreground">
                      Remplissez les champs personnalisés ci-dessous. Les champs marqués d'un * sont obligatoires.
                    </p>
                  </div>

                  {loadingProcessFields ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Chargement des champs...
                    </div>
                  ) : (
                    <GroupedCustomFieldsRenderer
                      commonFields={visibleCustomFields.commonFields}
                      processFields={visibleCustomFields.processFields}
                      subProcessFieldGroups={visibleCustomFields.subProcessFieldGroups}
                      values={customFieldValues}
                      onChange={handleCustomFieldChange}
                      errors={fieldErrors}
                      disabled={isSubmitting}
                    />
                  )}
                </TabsContent>
              )}

              {/* Extras Tab */}
              <TabsContent value="extras" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Liens & Pièces jointes</h4>
                    <TaskLinksEditor 
                      items={links} 
                      onChange={setLinks} 
                    />
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Sous-actions</h4>
                    <InlineChecklistEditor 
                      items={checklistItems} 
                      onChange={setChecklistItems} 
                    />
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={
                !title.trim() || 
                !targetDepartmentId || 
                isSubmitting ||
                (hasMultipleSubProcesses && selectedSubProcessIds.length === 0)
              }
            >
              {isSubmitting ? 'Création en cours...' : 'Soumettre la demande'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
