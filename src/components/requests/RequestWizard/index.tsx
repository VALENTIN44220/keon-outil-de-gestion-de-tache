import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { StepTypeSelection } from './StepTypeSelection';
import { StepPersonSelection } from './StepPersonSelection';
import { StepProcessSelection } from './StepProcessSelection';
import { StepSubProcessSelection } from './StepSubProcessSelection';
import { StepDetailsForm } from './StepDetailsForm';
import { StepCustomFields } from './StepCustomFields';
import { StepSummary } from './StepSummary';
import {
  RequestType,
  RequestWizardData,
  defaultWizardData,
  WIZARD_STEPS,
  SubProcessSelection,
} from './types';

interface RequestWizardDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProcessId?: string;
}

export function RequestWizardDialog({
  open,
  onClose,
  onSuccess,
  initialProcessId,
}: RequestWizardDialogProps) {
  const { profile: currentUser } = useAuth();
  const [data, setData] = useState<RequestWizardData>(defaultWizardData);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetPersonName, setTargetPersonName] = useState<string>();

  // Get current steps based on request type
  const steps = useMemo(() => {
    if (!data.requestType) return [{ id: 'type', label: 'Type' }];
    return WIZARD_STEPS[data.requestType];
  }, [data.requestType]);

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setData(defaultWizardData);
      setCurrentStepIndex(0);

      // If initial process ID is provided, pre-select it
      if (initialProcessId) {
        setData((prev) => ({
          ...prev,
          requestType: 'process',
          processId: initialProcessId,
        }));
        // Skip to subprocess selection (index 2 for process flow)
        setCurrentStepIndex(2);

        // Fetch process name
        supabase
          .from('process_templates')
          .select('name')
          .eq('id', initialProcessId)
          .single()
          .then(({ data: processData }) => {
            if (processData) {
              setData((prev) => ({ ...prev, processName: processData.name }));
            }
          });
      }
    }
  }, [open, initialProcessId]);

  // Fetch target person name when selected
  useEffect(() => {
    if (data.targetPersonId) {
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', data.targetPersonId)
        .single()
        .then(({ data: profile }) => {
          setTargetPersonName(profile?.display_name || undefined);
        });
    }
  }, [data.targetPersonId]);

  const updateData = useCallback((updates: Partial<RequestWizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleTypeSelect = (type: RequestType) => {
    updateData({ requestType: type });
    setCurrentStepIndex(1);
  };

  const handleProcessSelect = (processId: string, processName: string) => {
    updateData({ processId, processName });
  };

  const sameStringSet = useCallback((a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    for (const x of b) if (!setA.has(x)) return false;
    return true;
  }, []);

  const handleSubProcessSelectionChange = useCallback(
    (selected: string[], available: SubProcessSelection[]) => {
      setData((prev) => {
        const sameSelected = sameStringSet(selected, prev.selectedSubProcesses);
        const prevAvailIds = prev.availableSubProcesses.map((s) => s.id).sort().join('|');
        const nextAvailIds = available.map((s) => s.id).sort().join('|');
        const sameAvailable = prevAvailIds === nextAvailIds;

        if (sameSelected && sameAvailable) return prev;
        return {
          ...prev,
          selectedSubProcesses: selected,
          availableSubProcesses: available,
        };
      });
    },
    [sameStringSet]
  );

  const canProceed = useMemo(() => {
    switch (currentStep.id) {
      case 'type':
        return !!data.requestType;
      case 'person':
        return !!data.targetPersonId;
      case 'process':
        return !!data.processId;
      case 'subprocesses':
        return data.selectedSubProcesses.length > 0;
      case 'details':
        return !!data.title.trim();
      case 'fields':
        return true; // Custom fields validation could be added here
      case 'summary':
        return true;
      default:
        return true;
    }
  }, [currentStep.id, data]);

  const goNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      toast.error('Vous devez être connecté');
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = currentUser.id;

      // Determine task/request parameters
      let taskType: 'task' | 'request' = 'task';
      let assigneeId: string | null = null;
      let status = 'todo';

      if (data.requestType === 'personal') {
        assigneeId = userId;
      } else if (data.requestType === 'person') {
        assigneeId = data.targetPersonId;
      } else if (data.requestType === 'process') {
        taskType = 'request';
        status = 'todo';
      }

      // Create the main task/request
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          status,
          type: taskType,
          user_id: userId,
          assignee_id: assigneeId,
          requester_id: userId,
          due_date: data.dueDate,
          be_project_id: data.beProjectId,
          category_id: data.categoryId,
          subcategory_id: data.subcategoryId,
          target_department_id: data.targetDepartmentId,
          source_process_template_id: data.processId,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // For process requests, save sub-process selections and start workflow
      if (data.requestType === 'process' && data.selectedSubProcesses.length > 0) {
        // Save sub-process selections to the generic table
        const subProcessInserts = data.selectedSubProcesses.map((spId, index) => ({
          request_id: taskData.id,
          sub_process_template_id: spId,
          order_index: index,
          status: 'pending',
        }));

        await supabase.from('request_sub_processes').insert(subProcessInserts);

        // Save custom field values
        const fieldEntries = Object.entries(data.customFieldValues).filter(
          ([_, value]) => value !== undefined && value !== null && value !== ''
        );

        if (fieldEntries.length > 0) {
          await supabase.from('request_field_values').insert(
            fieldEntries.map(([fieldId, value]) => ({
              task_id: taskData.id,
              field_id: fieldId,
              value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            }))
          );
        }

        // Emit workflow event for request creation
        await supabase.from('workflow_events').insert({
          event_type: 'request_created',
          entity_type: 'request',
          entity_id: taskData.id,
          triggered_by: userId,
          payload: {
            request_type: 'process',
            process_id: data.processId,
            sub_process_ids: data.selectedSubProcesses,
            requester_id: userId,
          },
        });

        toast.success(
          `Demande créée avec ${data.selectedSubProcesses.length} sous-processus`
        );
      } else {
        toast.success('Tâche créée avec succès');
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep.id) {
      case 'type':
        return (
          <StepTypeSelection
            selectedType={data.requestType}
            onSelect={handleTypeSelect}
          />
        );
      case 'person':
        return (
          <StepPersonSelection
            selectedPersonId={data.targetPersonId}
            onSelect={(id) => updateData({ targetPersonId: id })}
          />
        );
      case 'process':
        return (
          <StepProcessSelection
            selectedProcessId={data.processId}
            onSelect={handleProcessSelect}
          />
        );
      case 'subprocesses':
        return (
          <StepSubProcessSelection
            processId={data.processId}
            processName={data.processName}
            selectedSubProcesses={data.selectedSubProcesses}
            onSelectionChange={handleSubProcessSelectionChange}
          />
        );
      case 'details':
        return (
          <StepDetailsForm
            data={data}
            requestType={data.requestType!}
            onDataChange={updateData}
          />
        );
      case 'fields':
        return <StepCustomFields data={data} onDataChange={updateData} />;
      case 'summary':
        return (
          <StepSummary
            data={data}
            requestType={data.requestType!}
            targetPersonName={targetPersonName}
          />
        );
      default:
        return null;
    }
  };

  const handleDialogOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) onClose();
    },
    [onClose]
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nouvelle demande
          </DialogTitle>
          <div className="pt-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>
                Étape {currentStepIndex + 1} sur {steps.length}
              </span>
              <span>{currentStep.label}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 py-4">{renderCurrentStep()}</div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          {currentStepIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          )}

          <div className="flex-1" />

          {currentStep.id === 'summary' ? (
            <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer la demande'
              )}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canProceed}>
              Suivant
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
