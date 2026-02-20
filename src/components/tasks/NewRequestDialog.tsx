import { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority, AssignmentRule } from '@/types/task';
import { cn } from '@/lib/utils';
import { DEMANDE_MATERIEL_SP_ID } from '@/components/requests/RequestWizard/types';
import { MaterialRequestLines, MaterialLine } from '@/components/maintenance/MaterialRequestLines';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
  Calendar, AlertCircle, Folder, Package
} from 'lucide-react';
import { BEProjectSelect } from '@/components/be/BEProjectSelect';
import { toast } from 'sonner';
import { TemplateCustomField } from '@/types/customField';
import { CommonFieldsConfig, DEFAULT_COMMON_FIELDS_CONFIG, resolveTitlePattern } from '@/types/commonFieldsConfig';
import { ArticleFilterConfig } from '@/components/maintenance/ArticleSearchSelect';

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
  const [materialLines, setMaterialLines] = useState<MaterialLine[]>([]);
  const [commonFieldsConfig, setCommonFieldsConfig] = useState<CommonFieldsConfig | null>(null);
  const [articleFilterConfig, setArticleFilterConfig] = useState<ArticleFilterConfig | undefined>();

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

  // Stable key for sub-process fields fetching to avoid render loops
  const relevantIdsKey = useMemo(() => {
    const relevantSubProcessIds = hasMultipleSubProcesses
      ? selectedSubProcessIds
      : linkedSubProcessId
        ? [linkedSubProcessId]
        : [];
    const allRelevantIds = Array.from(
      new Set([...relevantSubProcessIds, ...availableSubProcesses.map((sp) => sp.id)])
    ).sort();
    return allRelevantIds.join('|');
  }, [hasMultipleSubProcesses, selectedSubProcessIds, linkedSubProcessId, availableSubProcesses]);

  // Fetch custom fields for relevant sub-processes
  useEffect(() => {
    const allRelevantIds = relevantIdsKey ? relevantIdsKey.split('|').filter(Boolean) : [];

    if (allRelevantIds.length === 0) {
      setSubProcessCustomFields((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('template_custom_fields')
        .select('*')
        .in('sub_process_template_id', allRelevantIds)
        .order('order_index');

      if (cancelled || error) return;

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
            additional_conditions: field.additional_conditions as Array<{
              field_id: string;
              operator: string;
              value: string;
            }> | null,
          } as TemplateCustomField);
        }
      }

      setSubProcessCustomFields((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(fieldsMap);
        if (
          prevKeys.length === nextKeys.length &&
          prevKeys.every((k) => fieldsMap[k]?.length === prev[k]?.length)
        ) {
          return prev;
        }
        return fieldsMap;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [relevantIdsKey]);

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

  // Load common_fields_config when process is linked
  useEffect(() => {
    if (!linkedProcessId) {
      setCommonFieldsConfig(null);
      return;
    }
    supabase
      .from('process_templates')
      .select('settings')
      .eq('id', linkedProcessId)
      .single()
      .then(({ data: ptData }) => {
        const settings = (ptData as any)?.settings;
        if (settings?.common_fields_config) {
          const cfg = { ...DEFAULT_COMMON_FIELDS_CONFIG, ...settings.common_fields_config } as CommonFieldsConfig;
          setCommonFieldsConfig(cfg);
          if (cfg.priority && !cfg.priority.editable && cfg.priority.default_value) {
            setPriority(cfg.priority.default_value as TaskPriority);
          }
          if (cfg.be_project && !cfg.be_project.editable && cfg.be_project.default_value) {
            setBeProjectId(cfg.be_project.default_value);
          }
          if (cfg.title && !cfg.title.editable && cfg.title.title_pattern) {
            const resolvedTitle = resolveTitlePattern(cfg.title.title_pattern, {
              processName: linkedProcessName || '',
              userName: currentUser?.display_name || '',
            });
            setTitle(resolvedTitle);
          }
        } else {
          setCommonFieldsConfig(null);
        }
      });
  }, [linkedProcessId]);

  // Load article filter config from sub-process form_schema
  useEffect(() => {
    const spId = linkedSubProcessId || (selectedSubProcessIds.length === 1 ? selectedSubProcessIds[0] : null);
    if (!spId) {
      setArticleFilterConfig(undefined);
      return;
    }
    supabase
      .from('sub_process_templates')
      .select('form_schema')
      .eq('id', spId)
      .single()
      .then(({ data: spData }) => {
        const schema = (spData as any)?.form_schema;
        if (schema?.article_filter) {
          setArticleFilterConfig(schema.article_filter);
        } else {
          setArticleFilterConfig(undefined);
        }
      });
  }, [linkedSubProcessId, selectedSubProcessIds]);

  // Auto-apply assignment rule
  useEffect(() => {
    const deptId =
      matchingRule && matchingRule.auto_assign ? matchingRule.target_department_id : null;

    if (deptId) {
      setTargetDepartmentId(prev => prev !== deptId ? deptId : prev);
    }
  }, [matchingRule?.id, matchingRule?.auto_assign, matchingRule?.target_department_id]);

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

    if (!dueDate && (!commonFieldsConfig || commonFieldsConfig.due_date?.visible !== false)) {
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

      // Check if process has request validation enabled
      let hasRequestValidation = false;
      let requestValidationConfig: any = null;
      let validatorType1: string | null = null;
      let validatorId1: string | null = null;
      let validatorType2: string | null = null;
      let validatorId2: string | null = null;

      if (linkedProcessId) {
        const { data: processTemplate } = await (supabase as any)
          .from('process_templates')
          .select('settings')
          .eq('id', linkedProcessId)
          .single();

        requestValidationConfig = processTemplate?.settings?.request_validation;
        hasRequestValidation = requestValidationConfig?.enabled === true;

        if (hasRequestValidation) {
          validatorType1 = requestValidationConfig.level_1?.type || null;
          if (validatorType1 === 'manager') {
            validatorId1 = currentUser?.manager_id || null;
          } else {
            validatorId1 = requestValidationConfig.level_1?.target_id || null;
          }

          if (requestValidationConfig.level_2?.enabled) {
            validatorType2 = requestValidationConfig.level_2.type || null;
            if (validatorType2 === 'manager') {
              validatorId2 = currentUser?.manager_id || null;
            } else {
              validatorId2 = requestValidationConfig.level_2.target_id || null;
            }
          }
        }
      }

      const initialStatus = hasRequestValidation ? 'todo' : 'todo';
      const requestValidationStatus = hasRequestValidation ? 'pending_level_1' : 'none';

      const { data: requestData, error: requestError } = await (supabase as any)
        .from('tasks')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status: initialStatus,
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
          // Request validation fields
          request_validation_enabled: hasRequestValidation,
          request_validation_status: requestValidationStatus,
          request_validator_type_1: validatorType1,
          request_validator_id_1: validatorId1,
          request_validator_type_2: validatorType2,
          request_validator_id_2: validatorId2,
          process_template_id: linkedProcessId,
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

        for (let i = 0; i < selectedSubProcessIds.length; i++) {
          const subProcessId = selectedSubProcessIds[i];
          const { error: linkErr } = await supabase
            .from('request_sub_processes')
            .insert({
              request_id: requestData.id,
              sub_process_template_id: subProcessId,
              order_index: i,
              status: hasRequestValidation ? 'waiting_validation' : 'pending',
            });

          if (linkErr) throw linkErr;

          const subProcess = availableSubProcesses.find(sp => sp.id === subProcessId);
          const subProcessDeptId = subProcess?.target_department_id || targetDepartmentId;
          const targetManagerId = subProcess?.target_manager_id || undefined;

          if (!hasRequestValidation && linkedProcessId && subProcessDeptId) {
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

        if (hasRequestValidation) {
          toast.success(
            `Demande créée — en attente de validation (${selectedSubProcessIds.length} sous-processus)`
          );
        } else {
          toast.success(
            `Demande créée avec ${selectedSubProcessIds.length} sous-processus sélectionné(s)`
          );
        }
      } else if (linkedSubProcessId && targetDepartmentId) {
        if (!hasRequestValidation) {
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
        }
        toast.success(hasRequestValidation ? 'Demande créée — en attente de validation' : 'Demande créée avec succès');
      } else if (linkedProcessId && targetDepartmentId) {
        if (!hasRequestValidation) {
          await generatePendingAssignments({
            parentRequestId: requestData.id,
            processTemplateId: linkedProcessId,
            targetDepartmentId,
          });
        }
        toast.success(hasRequestValidation ? 'Demande créée — en attente de validation' : 'Demande créée avec succès');
      } else {
        toast.success('Demande créée avec succès');
      }

      // Persist material request lines
      if (hasMaterialSubProcess && materialLines.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, display_name')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
          .single();

        const materialRows = materialLines
          .filter(l => l.article !== null)
          .map(l => ({
            request_id: requestData.id,
            request_number: requestData.request_number || null,
            demandeur_id: profileData?.id || null,
            demandeur_nom: profileData?.display_name || null,
            article_id: l.article!.id,
            ref: l.article!.ref,
            des: l.article!.des,
            quantite: l.quantite,
            etat_commande: 'En attente validation',
          }));

        const { error: matError } = await supabase.from('demande_materiel').insert(materialRows);
        if (matError) {
          console.error('Error saving material lines:', matError);
        }
      }

      onTasksCreated?.();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error((error as any)?.message || (error as any)?.details || 'Erreur lors de la création de la demande');
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
    setMaterialLines([]);
    setCommonFieldsConfig(null);
    setArticleFilterConfig(undefined);
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
  const hasMaterialSubProcess = selectedSubProcessIds.includes(DEMANDE_MATERIEL_SP_ID) || linkedSubProcessId === DEMANDE_MATERIEL_SP_ID;
  const showMaterialTab = hasMaterialSubProcess;

  const materialValid = !hasMaterialSubProcess || (
    materialLines.length > 0 && materialLines.every(l => l.article !== null && l.quantite > 0)
  );

  const isFormDisabled =
    !title.trim() ||
    !targetDepartmentId ||
    (!dueDate && (!commonFieldsConfig || commonFieldsConfig.due_date?.visible !== false)) ||
    isSubmitting ||
    !materialValid ||
    (hasMultipleSubProcesses && selectedSubProcessIds.length === 0);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose();
    },
    [onClose]
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent 
        className="sm:max-w-[920px] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-3xl border-2 border-primary/10 shadow-2xl shadow-primary/5 bg-gradient-to-b from-white to-muted/20"
        hideCloseButton
      >
        {/* A11y: Radix Dialog requires a DialogTitle; keep it hidden visually */}
        <DialogTitle className="sr-only">{linkedProcessName ? linkedProcessName : 'Nouvelle demande'}</DialogTitle>
        {/* Custom Header */}
        <RequestDialogHeader 
          processName={linkedProcessName} 
          onClose={onClose} 
        />
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Tabs */}
          <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-6 pt-5 pb-2 flex-shrink-0 bg-gradient-to-b from-white to-transparent">
              <TabsList className="w-full bg-muted/40 p-1.5 rounded-2xl h-auto flex-wrap gap-1 border border-border/50">
                <TabsTrigger 
                  value="general" 
                  className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-semibold transition-all duration-200 data-[state=active]:shadow-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-white/50"
                >
                  <FileText className="h-4 w-4" />
                  <span>Général</span>
                </TabsTrigger>
                {showSubProcessTab && (
                  <TabsTrigger 
                    value="subprocesses" 
                    className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-semibold transition-all duration-200 data-[state=active]:shadow-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-white/50"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Tâches</span>
                    <Badge 
                      variant={selectedSubProcessIds.length > 0 ? "default" : "secondary"} 
                      className={cn(
                        "ml-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold",
                        selectedSubProcessIds.length > 0 && "bg-primary shadow-sm"
                      )}
                    >
                      {selectedSubProcessIds.length}
                    </Badge>
                  </TabsTrigger>
                )}
                {showCustomFieldsTab && (
                  <TabsTrigger 
                    value="customfields" 
                    className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-semibold transition-all duration-200 data-[state=active]:shadow-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-white/50"
                  >
                    <FormInput className="h-4 w-4" />
                    <span>Détails de la demande</span>
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {customFieldsCount}
                    </Badge>
                  </TabsTrigger>
                )}
                {showMaterialTab && (
                  <TabsTrigger 
                    value="material" 
                    className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-semibold transition-all duration-200 data-[state=active]:shadow-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-white/50"
                  >
                    <Package className="h-4 w-4" />
                    <span>Articles</span>
                    <Badge 
                      variant={materialLines.length > 0 ? "default" : "secondary"} 
                      className={cn(
                        "ml-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold",
                        materialLines.length > 0 && "bg-primary shadow-sm"
                      )}
                    >
                      {materialLines.length}
                    </Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Scrollable Content (native scroll for reliability + visible OS scrollbar) */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-3">
              <div className="px-6 py-5">
                {/* General Tab */}
                <TabsContent value="general" className="mt-0 space-y-6">
                  {/* System Fields Card */}
                  <SystemFieldsCard
                    userName={currentUser?.display_name}
                    company={currentUser?.company}
                    department={currentUser?.department}
                  />

                  {/* Title Field */}
                  {(!commonFieldsConfig || commonFieldsConfig.title?.visible !== false) && (
                    <div className="space-y-2.5">
                      <Label htmlFor="title" className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        Titre de la demande
                        <span className="text-destructive text-lg leading-none">*</span>
                        {commonFieldsConfig?.title && !commonFieldsConfig.title.editable && (
                          <span className="text-xs text-muted-foreground ml-1">(imposé)</span>
                        )}
                      </Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Décrivez brièvement votre demande..."
                        className="h-12 text-base rounded-xl border-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                        required
                        readOnly={commonFieldsConfig?.title?.editable === false}
                        disabled={commonFieldsConfig?.title?.editable === false}
                      />
                      {commonFieldsConfig?.title?.editable === false && commonFieldsConfig.title.title_pattern ? (
                        <p className="text-xs text-muted-foreground pl-1">
                          Le titre sera géré automatiquement à la création de la demande
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground pl-1">
                          Un titre clair aide à identifier rapidement votre demande
                        </p>
                      )}
                    </div>
                  )}

                  {/* Description Field */}
                  {(!commonFieldsConfig || commonFieldsConfig.description?.visible !== false) && (
                    <div className="space-y-2.5">
                      <Label htmlFor="description" className="text-sm font-semibold text-foreground">
                        Description
                        {commonFieldsConfig?.description && !commonFieldsConfig.description.editable && (
                          <span className="text-xs text-muted-foreground ml-1">(imposé)</span>
                        )}
                      </Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Donnez plus de détails sur votre demande..."
                        rows={3}
                        className="resize-none rounded-xl border-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                        readOnly={commonFieldsConfig?.description?.editable === false}
                        disabled={commonFieldsConfig?.description?.editable === false}
                      />
                    </div>
                  )}

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
                  {(!commonFieldsConfig || commonFieldsConfig.be_project?.visible !== false) && (
                    <div className="space-y-2.5">
                      <Label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <div className="p-1.5 rounded-lg bg-accent/10">
                          <Folder className="h-4 w-4 text-accent" />
                        </div>
                        Projet associé
                        {commonFieldsConfig?.be_project && !commonFieldsConfig.be_project.editable && (
                          <span className="text-xs text-muted-foreground">(imposé)</span>
                        )}
                      </Label>
                      <BEProjectSelect
                        value={beProjectId}
                        onChange={setBeProjectId}
                        disabled={commonFieldsConfig?.be_project?.editable === false}
                      />
                    </div>
                  )}

                  {/* Process Info Banner */}
                  {(linkedProcessId || linkedSubProcessId) && !hasMultipleSubProcesses && (
                    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/5 p-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="flex items-start gap-4 relative">
                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                          <Workflow className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-bold text-primary font-display tracking-wide">
                            {linkedSubProcessName 
                              ? `${linkedProcessName} → ${linkedSubProcessName}`
                              : linkedProcessName
                            }
                          </p>
                          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                            Cette demande déclenchera automatiquement la création des tâches du {linkedSubProcessId ? 'sous-processus' : 'processus'}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assignment Rule Info */}
                  {matchingRule && (
                    <div className="rounded-2xl border-2 border-info/30 bg-gradient-to-r from-info/5 to-transparent p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-info/10">
                          <Info className="h-5 w-5 text-info" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">Règle d'affectation: {matchingRule.name}</p>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap">
                            {matchingRule.auto_assign ? (
                              <>
                                <span>Affectation automatique</span>
                                <ArrowRight className="h-3 w-3" />
                                <Badge variant="outline" className="rounded-lg border-primary/30 text-primary bg-primary/5">
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
                              <Badge variant="secondary" className="ml-2 rounded-lg">Validation requise</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Priority and Service */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {!linkedProcessId && (
                      <div className="space-y-2.5">
                        <Label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                          Service cible
                          <span className="text-destructive text-lg leading-none">*</span>
                        </Label>
                        <Select 
                          value={targetDepartmentId || ''} 
                          onValueChange={(v) => setTargetDepartmentId(v || null)}
                          disabled={matchingRule?.auto_assign && matchingRule?.target_department_id ? true : false}
                        >
                          <SelectTrigger className="h-12 rounded-xl border-2 focus:ring-primary/20 focus:border-primary transition-all">
                            <SelectValue placeholder="Sélectionner un service" />
                          </SelectTrigger>
                          <SelectContent className="bg-white z-50 rounded-xl border-2">
                            {departments.map(dept => (
                              <SelectItem key={dept.id} value={dept.id} className="rounded-lg">
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(!commonFieldsConfig || commonFieldsConfig.priority?.visible !== false) && (
                    <div className="space-y-2.5">
                      <Label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        Priorité
                        <span className="text-destructive text-lg leading-none">*</span>
                        {commonFieldsConfig?.priority && !commonFieldsConfig.priority.editable && (
                          <span className="text-xs text-muted-foreground ml-1">(imposé)</span>
                        )}
                      </Label>
                      <Select 
                        value={priority} 
                        onValueChange={(v) => setPriority(v as TaskPriority)}
                        disabled={commonFieldsConfig?.priority?.editable === false}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-2 focus:ring-primary/20 focus:border-primary transition-all">
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={priority} size="sm" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50 rounded-xl border-2">
                          <SelectItem value="low" className="rounded-lg">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority="low" size="sm" />
                            </div>
                          </SelectItem>
                          <SelectItem value="medium" className="rounded-lg">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority="medium" size="sm" />
                            </div>
                          </SelectItem>
                          <SelectItem value="high" className="rounded-lg">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority="high" size="sm" />
                            </div>
                          </SelectItem>
                          <SelectItem value="urgent" className="rounded-lg">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority="urgent" size="sm" />
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                  </div>

                  {/* Due Date */}
                  {(!commonFieldsConfig || commonFieldsConfig.due_date?.visible !== false) && (
                  <div className="space-y-2.5">
                    <Label htmlFor="dueDate" className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <div className="p-1.5 rounded-lg bg-warning/10">
                        <Calendar className="h-4 w-4 text-warning" />
                      </div>
                      Échéance
                      <span className="text-destructive text-lg leading-none">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                        disabled={commonFieldsConfig?.due_date?.editable === false}
                        className={cn(
                          "h-12 rounded-xl border-2 transition-all",
                          !dueDate 
                            ? "border-warning/50 bg-warning/5 focus-visible:ring-warning/20 focus-visible:border-warning" 
                            : "focus-visible:ring-primary/20 focus-visible:border-primary"
                        )}
                      />
                    </div>
                    {!dueDate && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/20">
                        <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
                        <p className="text-xs font-medium text-warning">L'échéance est obligatoire pour soumettre la demande</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground pl-1">
                      Format : JJ/MM/AAAA • Date limite pour la réalisation
                    </p>
                  </div>
                  )}
                </TabsContent>

                {/* Sub-processes/Tasks Tab */}
                {showSubProcessTab && (
                  <TabsContent value="subprocesses" className="mt-0 space-y-5">
                    {/* Info banner */}
                    <div className="rounded-2xl border-2 border-info/30 bg-gradient-to-r from-info/10 via-info/5 to-transparent p-5">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-info/20">
                          <Info className="h-5 w-5 text-info" />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Sélectionnez les tâches à réaliser pour cette demande. Chaque tâche cochée déclenchera la création des actions correspondantes.
                        </p>
                      </div>
                    </div>

                    {availableSubProcesses.length === 0 ? (
                      <TasksEmptyState />
                    ) : (
                      <>
                        <div className="max-h-[280px] overflow-y-auto pr-2 border rounded-xl bg-muted/20 p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                        </div>

                        {selectedSubProcessIds.length > 0 && (
                          <div className="pt-5 border-t-2 border-dashed border-primary/20">
                            <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                              <CheckSquare className="h-4 w-4 text-primary" />
                              Tâches sélectionnées ({selectedSubProcessIds.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selectedSubProcessIds.map(spId => {
                                const sp = availableSubProcesses.find(s => s.id === spId);
                                return sp ? (
                                  <Badge 
                                    key={spId} 
                                    variant="default"
                                    className="cursor-pointer hover:bg-primary/80 transition-all rounded-lg px-3 py-1.5 gap-1.5 font-medium shadow-sm"
                                    onClick={() => toggleSubProcess(spId)}
                                  >
                                    {sp.name}
                                    <span className="ml-1 opacity-70 hover:opacity-100">×</span>
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
                  <TabsContent value="customfields" className="mt-0 space-y-5">
                    {loadingProcessFields ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                        <p className="text-sm font-medium">Chargement des champs...</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border-2 border-border/50 p-5 shadow-sm">
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

                {/* Material Lines Tab */}
                {showMaterialTab && (
                  <TabsContent value="material" className="mt-0 space-y-5">
                    <div className="bg-white rounded-2xl border-2 border-border/50 p-5 shadow-sm">
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Package className="h-4 w-4 text-warning" />
                          Articles à commander
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sélectionnez les articles de maintenance et indiquez les quantités souhaitées
                        </p>
                      </div>
                      {materialLines.length === 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 mb-4">
                          <Package className="h-4 w-4 shrink-0" />
                          <span className="text-sm">Ajoutez au moins un article pour pouvoir soumettre la demande</span>
                        </div>
                      )}
                      <MaterialRequestLines
                        lines={materialLines}
                        onChange={setMaterialLines}
                        disabled={isSubmitting}
                        articleFilterConfig={articleFilterConfig}
                      />
                    </div>
                  </TabsContent>
                )}
              </div>
            </div>
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
