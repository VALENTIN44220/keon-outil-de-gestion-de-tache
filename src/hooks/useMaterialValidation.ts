import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SERVICE_MAINTENANCE_PROCESS_ID } from '@/components/requests/RequestWizard/types';

export function useMaterialValidation() {
  const { profile } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const validateMaterialRequest = async (requestId: string) => {
    if (!profile) return false;
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-material-request', {
        body: {
          request_id: requestId,
          action: 'validate',
          validator_id: profile.id,
        },
      });

      if (error) throw error;
      toast.success('Demande validée — tâche de commande créée');
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      toast.error(`Erreur: ${(error as Error).message}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const refuseMaterialRequest = async (requestId: string) => {
    if (!profile) return false;
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-material-request', {
        body: {
          request_id: requestId,
          action: 'refuse',
          validator_id: profile.id,
        },
      });

      if (error) throw error;
      toast.success('Demande refusée');
      return true;
    } catch (error) {
      console.error('Refusal error:', error);
      toast.error(`Erreur: ${(error as Error).message}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const isMaterialRequest = (processTemplateId: string | null) => {
    return processTemplateId === SERVICE_MAINTENANCE_PROCESS_ID;
  };

  return {
    validateMaterialRequest,
    refuseMaterialRequest,
    isMaterialRequest,
    isProcessing,
  };
}
