import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, SendHorizonal, Clock, CheckCircle } from 'lucide-react';
import { useManualValidation } from '@/hooks/useManualValidation';
import type { PendingManualValidation } from '@/types/workflow';
import { cn } from '@/lib/utils';

interface RequestValidationButtonProps {
  taskId: string;
  taskStatus: string;
  className?: string;
  onValidationTriggered?: () => void;
}

export function RequestValidationButton({ 
  taskId, 
  taskStatus, 
  className,
  onValidationTriggered 
}: RequestValidationButtonProps) {
  const [pendingValidation, setPendingValidation] = useState<PendingManualValidation | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const { isLoading, checkPendingManualValidation, triggerManualValidation } = useManualValidation();

  useEffect(() => {
    const check = async () => {
      setIsChecking(true);
      const result = await checkPendingManualValidation(taskId);
      setPendingValidation(result);
      setIsChecking(false);
    };
    check();
  }, [taskId, checkPendingManualValidation]);

  // Don't show if no pending manual validation
  if (isChecking) {
    return null;
  }

  if (!pendingValidation) {
    return null;
  }

  // If task is already in pending-validation status
  if (taskStatus === 'pending-validation') {
    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <Clock className="h-3 w-3" />
        En attente de validation
      </Badge>
    );
  }

  // If task is validated
  if (taskStatus === 'validated') {
    return (
      <Badge variant="default" className={cn("gap-1 bg-success text-success-foreground", className)}>
        <CheckCircle className="h-3 w-3" />
        Validé
      </Badge>
    );
  }

  const handleTrigger = async () => {
    const success = await triggerManualValidation(pendingValidation);
    if (success) {
      onValidationTriggered?.();
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        onClick={handleTrigger}
        disabled={!pendingValidation.can_trigger || isLoading}
        variant={pendingValidation.can_trigger ? "default" : "outline"}
        size="sm"
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SendHorizonal className="h-4 w-4" />
        )}
        Demander validation
      </Button>
      {!pendingValidation.can_trigger && pendingValidation.reason && (
        <span className="text-xs text-muted-foreground">{pendingValidation.reason}</span>
      )}
    </div>
  );
}
