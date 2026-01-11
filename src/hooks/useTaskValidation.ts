import { useState, useCallback, useEffect } from 'react';
import { TaskValidationLevel } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function useTaskValidation(taskId: string | null) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [validationLevels, setValidationLevels] = useState<TaskValidationLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchValidationLevels = useCallback(async () => {
    if (!taskId) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('task_validation_levels')
      .select('*')
      .eq('task_id', taskId)
      .order('level', { ascending: true });

    if (error) {
      console.error('Error fetching validation levels:', error);
    } else {
      setValidationLevels((data || []) as TaskValidationLevel[]);
    }
    setIsLoading(false);
  }, [taskId]);

  useEffect(() => {
    if (taskId) {
      fetchValidationLevels();
    }
  }, [taskId, fetchValidationLevels]);

  const requestValidation = async (taskId: string) => {
    // Update task status to pending-validation
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'pending-validation',
        validation_requested_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de demander la validation',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Validation demandée',
      description: 'La demande de validation a été envoyée',
    });
    return true;
  };

  const validateLevel = async (levelId: string, comment?: string) => {
    const { error } = await supabase
      .from('task_validation_levels')
      .update({
        status: 'validated',
        validated_at: new Date().toISOString(),
        comment,
      })
      .eq('id', levelId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de valider',
        variant: 'destructive',
      });
      return false;
    }

    await fetchValidationLevels();
    return true;
  };

  const refuseLevel = async (levelId: string, comment: string) => {
    const { error } = await supabase
      .from('task_validation_levels')
      .update({
        status: 'refused',
        validated_at: new Date().toISOString(),
        comment,
      })
      .eq('id', levelId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de refuser',
        variant: 'destructive',
      });
      return false;
    }

    // Update task status to refused
    if (taskId) {
      await supabase
        .from('tasks')
        .update({ status: 'refused' })
        .eq('id', taskId);
    }

    await fetchValidationLevels();
    return true;
  };

  const markTaskAsValidated = async (taskId: string, comment?: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'validated',
        validated_at: new Date().toISOString(),
        validation_comment: comment,
        validator_id: profile?.id,
      })
      .eq('id', taskId);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de valider la tâche',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Tâche validée',
      description: 'La tâche a été validée avec succès',
    });
    return true;
  };

  // Check if current user can validate this task
  const canValidate = useCallback((validatorId: string | null, validatorDeptId: string | null) => {
    if (!profile) return false;
    
    // Check if user is the validator
    if (validatorId && validatorId === profile.id) return true;
    
    // Check if user is in the validator department
    if (validatorDeptId && validatorDeptId === profile.department_id) return true;
    
    return false;
  }, [profile]);

  const getCurrentPendingLevel = useCallback(() => {
    return validationLevels.find(level => level.status === 'pending') || null;
  }, [validationLevels]);

  return {
    validationLevels,
    isLoading,
    requestValidation,
    validateLevel,
    refuseLevel,
    markTaskAsValidated,
    canValidate,
    getCurrentPendingLevel,
    refetch: fetchValidationLevels,
  };
}
