import { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority, AssignmentRule } from '@/types/task';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
import { useCustomFields } from '@/hooks/useCustomFields';
import { supabase } from '@/integrations/supabase/client';
import { validateCustomFields } from './CustomFieldsRenderer';
import { SectionedCustomFieldsRenderer } from './SectionedCustomFieldsRenderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { 
  Info, ArrowRight, Workflow, FormInput, CheckSquare, FileText, 
  Calendar, AlertCircle, Folder
} from 'lucide-react';
import { BEProjectSelect } from '@/components/be/BEProjectSelect';
import { toast } from 'sonner';
import { TemplateCustomField } from '@/types/customField';

import {
  RequestDialogHeader,
  RequestDialogFooter,
  SystemFieldsCard,
  PriorityBadge,
  TasksEmptyState,
  TaskSelectionCard,
} from './request-dialog';

interface Department {
  id: string;
  name: string;
}

interface SubProcessTemplate {
  id: string;
  name: string;
  process_template_id: string;
  description: string | null;
  target_manager_id: string | null;
  target_department_id: string | null;
  assignment_type: string;
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

  // Fetch custom fields for relevant sub-processes
  useEffect(() => {
    const fetchSubProcessFields = async () => {
      const relevantSubProcessIds = hasMultipleSubProcesses 
        ? selectedSubProcessIds 
        : (linkedSubProcessId ? [linkedSubProcessId] : []);
      
      const allRelevantIds = [...new Set([
        ...relevantSubProcessIds,
        ...availableSubProcesses.map(sp => sp.id)
      ])];
      
      if (allRelevantIds.length === 0) {
        setSubProcessCustomFields({});
        return;
      }
      
      const { data, error } = await supabase
        .from('template_custom_fields')
        .select('*')
        .in('sub_process_template_id', allRelevantIds)
        .order('order_index');
      
      if (error) {
        console.error('Error fetching sub-process fields:', error);
        return;
      }
      
      const fieldsMap: Record<string, TemplateCustomField[]> = {};
      for (const field of data || []) {
        const spId = field.sub_process_template_id;
        if (spId) {
          if (!fieldsMap[spId]) {
            fieldsMap[spId] = [];
          }
          fieldsMap[spId].push({
            ...field,
            field_type: field.field_type,
            options: (field.options || null) as unknown as TemplateCustomField['options'],
            condition_operator: field.condition_operator as TemplateCustomField['condition_operator'],
            conditions_logic: (field.conditions_logic || 'AND') as 'AND' | 'OR',
            validation_params: field.validation_params as Record<string, any> | null,
            additional_conditions: field.additional_conditions as Array<{ field_id: string; operator: string; value: string }> | null,
          } as TemplateCustomField);
        }
      }
      
      setSubProcessCustomFields(fieldsMap);
    };

    fetchSubProcessFields();
  }, [hasMultipleSubProcesses, selectedSubProcessIds, linkedSubProcessId, availableSubProcesses]);

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

      if (initialSubProcessTemplateId) {
        const { data: subProcess } = await supabase
          .from('sub_process_templates')
          .select('id, name, process_template_id, target_department_id, target_manager_id, assignment_type')
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

          const { data: subProcessData } = await supabase
            .from('sub_process_templates')
            .select('id, name, process_template_id, description, target_manager_id, target_department_id, assignment_type')
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

  // Auto-apply assignment rule
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

  // Memoized visible custom fields
  const visibleCustomFields = useMemo(() => {
    const commonFieldsSet = new Map<string, TemplateCustomField>();
    const processSpecificFields: TemplateCustomField[] = [];
    const subProcessFieldGroups: { subProcessId: string; subProcessName: string; fields: TemplateCustomField[] }[] = [];

    for (const field of processFields) {
      if (field.is_common) {
        commonFieldsSet.set(field.id, field);
      } else {
        processSpecificFields.push(field);
      }
    }

    const relevantSubProcessIds = hasMultipleSubProcesses 
      ? selectedSubProcessIds 
      : (linkedSubProcessId ? [linkedSubProcessId] : []);

    for (const spId of relevantSubProcessIds) {
      const spFields = subProcessCustomFields[spId] || [];
      const spSpecificFields: TemplateCustomField[] = [];
      
      for (const field of spFields) {
        if (field.is_common) {
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

    if (!priority) {
      toast.error('La priorité est obligatoire');
      return;
    }

    if (!dueDate) {
      toast.error("L'échéance est obligatoire");
      return;
    }

    if (hasMultipleSubProcesses && selectedSubProcessIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un sous-processus');
      return;
    }

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
        })
        .select()
        .single();

      if (requestError) throw requestError;

      if (checklistItems.length > 0) {
        await supabase.from('task_checklists').insert(
          checklistItems.map(item => ({
            task_id: requestData.id,
            title: item.title,
            order_index: item.order_index,
          }))
        );
      }

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

      if (hasMultipleSubProcesses && selectedSubProcessIds.length > 0) {
        let totalAssignments = 0;

        for (const subProcessId of selectedSubProcessIds) {
          await supabase.from('be_request_sub_processes').insert({
            task_id: requestData.id,
            sub_process_template_id: subProcessId,
          });

          const subProcess = availableSubProcesses.find(sp => sp.id === subProcessId);
          const subProcessDeptId = subProcess?.target_department_id || targetDepartmentId;
          const targetManagerId = subProcess?.target_manager_id || undefined;

          if (linkedProcessId && subProcessDeptId) {
            const count = await generatePendingAssignments({
              parentRequestId: requestData.id,
              processTemplateId: linkedProcessId,
              targetDepartmentId: subProcessDeptId,
              subProcessTemplateId: subProcessId,
              targetManagerId,
            });
            totalAssignments += count;
          }
        }

        toast.success(
          `Demande créée avec ${selectedSubProcessIds.length} sous-processus sélectionné(s)`
        );
      } else if (linkedSubProcessId && targetDepartmentId) {
        const { data: subProcess } = await supabase
          .from('sub_process_templates')
          .select('target_manager_id, target_department_id')
          .eq('id', linkedSubProcessId)
          .single();

        const subProcessDeptId = subProcess?.target_department_id || targetDepartmentId;
        const targetManagerId = subProcess?.target_manager_id || undefined;

        await generatePendingAssignments({
          parentRequestId: requestData.id,
          processTemplateId: linkedProcessId || '',
          targetDepartmentId: subProcessDeptId,
          subProcessTemplateId: linkedSubProcessId,
          targetManagerId,
        });
        toast.success('Demande créée avec succès');
      } else if (linkedProcessId && targetDepartmentId) {
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

  const isFormDisabled = !title.trim() || !targetDepartmentId || !dueDate || isSubmitting ||
    (hasMultipleSubProcesses && selectedSubProcessIds.length === 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-2xl border-border shadow-premium-xl">
        {/* Custom Header */}
        <RequestDialogHeader 
          processName={linkedProcessName} 
          onClose={onClose} 
        />
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Tabs */}
          <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-6 pt-4 flex-shrink-0">
              <TabsList className="w-full bg-muted/30 p-1 rounded-xl h-auto flex-wrap">
                <TabsTrigger 
                  value="general" 
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 data-[state=active]:shadow-md"
                >
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Général</span>
                </TabsTrigger>
                {showSubProcessTab && (
                  <TabsTrigger 
                    value="subprocesses" 
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 data-[state=active]:shadow-md"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span className="font-medium">Tâches</span>
                    <Badge variant={selectedSubProcessIds.length > 0 ? "default" : "secondary"} className="ml-1 text-[10px] px-1.5 py-0">
                      {selectedSubProcessIds.length}
                    </Badge>
                  </TabsTrigger>
                )}
                {showCustomFieldsTab && (
                  <TabsTrigger 
                    value="customfields" 
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 data-[state=active]:shadow-md"
                  >
                    <FormInput className="h-4 w-4" />
                    <span className="font-medium">Détails de la demande</span>
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                      {customFieldsCount}
                    </Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 py-4">
                {/* General Tab */}
                <TabsContent value="general" className="mt-0 space-y-5">
                  {/* System Fields Card */}
                  <SystemFieldsCard
                    userName={currentUser?.display_name}
                    company={currentUser?.company}
                    department={currentUser?.department}
                  />

                  {/* Title Field */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium flex items-center gap-1">
                      Titre de la demande
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Décrivez brièvement votre demande..."
                      className="h-11"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Un titre clair aide à identifier rapidement votre demande
                    </p>
                  </div>

                  {/* Description Field */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Donnez plus de détails sur votre demande..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Category Selection (when no process) */}
                  {!linkedProcessId && (
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
                  )}

                  {/* BE Project Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      Projet associé
                    </Label>
                    <BEProjectSelect
                      value={beProjectId}
                      onChange={setBeProjectId}
                    />
                  </div>

                  {/* Process Info Banner */}
                  {(linkedProcessId || linkedSubProcessId) && !hasMultipleSubProcesses && (
                    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Workflow className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-primary">
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

                  {/* Assignment Rule Info */}
                  {matchingRule && (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Règle d'affectation: {matchingRule.name}</p>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap">
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

                  {/* Priority and Service */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {!linkedProcessId && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-1">
                          Service cible
                          <span className="text-destructive">*</span>
                        </Label>
                        <Select 
                          value={targetDepartmentId || ''} 
                          onValueChange={(v) => setTargetDepartmentId(v || null)}
                          disabled={matchingRule?.auto_assign && matchingRule?.target_department_id ? true : false}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Sélectionner un service" />
                          </SelectTrigger>
                          <SelectContent className="bg-white z-50">
                            {departments.map(dept => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        Priorité
                        <span className="text-destructive">*</span>
                      </Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                        <SelectTrigger className="h-11">
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={priority} size="sm" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          <SelectItem value="low">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority="low" size="sm" />
                            </div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority="medium" size="sm" />
                            </div>
                          </SelectItem>
                          <SelectItem value="high">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority="high" size="sm" />
                            </div>
                          </SelectItem>
                          <SelectItem value="urgent">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority="urgent" size="sm" />
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2">
                    <Label htmlFor="dueDate" className="text-sm font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Échéance
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                        className={cn(
                          "h-11",
                          !dueDate && "border-destructive/50 focus-visible:ring-destructive/20"
                        )}
                      />
                    </div>
                    {!dueDate && (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <p className="text-xs">L'échéance est obligatoire</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Date limite pour la réalisation de cette demande
                    </p>
                  </div>
                </TabsContent>

                {/* Sub-processes/Tasks Tab */}
                {showSubProcessTab && (
                  <TabsContent value="subprocesses" className="mt-0 space-y-4">
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                      <p className="text-sm text-muted-foreground">
                        Sélectionnez les tâches à réaliser pour cette demande. Chaque tâche cochée déclenchera la création des actions correspondantes.
                      </p>
                    </div>

                    {availableSubProcesses.length === 0 ? (
                      <TasksEmptyState />
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {availableSubProcesses.map((subProcess) => {
                            const isSelected = selectedSubProcessIds.includes(subProcess.id);
                            const hasCustomFields = subProcessCustomFields[subProcess.id]?.length > 0;
                            
                            return (
                              <TaskSelectionCard
                                key={subProcess.id}
                                id={subProcess.id}
                                name={subProcess.name}
                                description={subProcess.description}
                                isSelected={isSelected}
                                hasCustomFields={hasCustomFields}
                                onToggle={() => toggleSubProcess(subProcess.id)}
                              />
                            );
                          })}
                        </div>

                        {selectedSubProcessIds.length > 0 && (
                          <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-foreground mb-3">
                              Tâches sélectionnées ({selectedSubProcessIds.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selectedSubProcessIds.map(spId => {
                                const sp = availableSubProcesses.find(s => s.id === spId);
                                return sp ? (
                                  <Badge 
                                    key={spId} 
                                    variant="default"
                                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                                    onClick={() => toggleSubProcess(spId)}
                                  >
                                    {sp.name}
                                    <span className="ml-1.5 opacity-70">×</span>
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                )}

                {/* Custom Fields Tab */}
                {showCustomFieldsTab && (
                  <TabsContent value="customfields" className="mt-0 space-y-4">

                    {loadingProcessFields ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                        <p className="text-sm">Chargement des champs...</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-border p-4">
                        <SectionedCustomFieldsRenderer
                          processTemplateId={linkedProcessId}
                          subProcessTemplateId={linkedSubProcessId}
                          fields={allFieldsFlat}
                          values={customFieldValues}
                          onChange={handleCustomFieldChange}
                          errors={fieldErrors}
                          disabled={isSubmitting}
                        />
                      </div>
                    )}
                  </TabsContent>
                )}
              </div>
            </ScrollArea>
          </Tabs>

          {/* Fixed Footer */}
          <RequestDialogFooter
            onClose={onClose}
            isSubmitting={isSubmitting}
            isDisabled={isFormDisabled}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
