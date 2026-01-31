import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ValidatedCustomFieldsRenderer, triggerFieldValidation } from './ValidatedCustomFieldsRenderer';
import type { TemplateCustomField } from '@/types/customField';
import { cn } from '@/lib/utils';

export interface FormWithValidationHandle {
  validate: () => Promise<{ valid: boolean; errors: Record<string, string> }>;
  getValues: () => Record<string, any>;
}

interface FormWithValidationProps {
  fields: TemplateCustomField[];
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  onValuesChange?: (values: Record<string, any>) => void;
  submitLabel?: string;
  disabled?: boolean;
  showSubmitButton?: boolean;
  className?: string;
}

export const FormWithValidation = forwardRef<FormWithValidationHandle, FormWithValidationProps>(
  function FormWithValidation(
    {
      fields,
      initialValues = {},
      onSubmit,
      onValuesChange,
      submitLabel = 'Envoyer',
      disabled = false,
      showSubmitButton = true,
      className,
    },
    ref
  ) {
    const [values, setValues] = useState<Record<string, any>>(initialValues);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isValid, setIsValid] = useState(true);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const handleChange = useCallback(
      (fieldId: string, value: any) => {
        setValues((prev) => {
          const newValues = { ...prev, [fieldId]: value };
          onValuesChange?.(newValues);
          return newValues;
        });
      },
      [onValuesChange]
    );

    const handleValidationChange = useCallback(
      (valid: boolean, newErrors: Record<string, string>) => {
        setIsValid(valid);
        setErrors(newErrors);
      },
      []
    );

    const validate = useCallback(async () => {
      const result = await triggerFieldValidation();
      setHasSubmitted(true);
      return result;
    }, []);

    const handleSubmit = useCallback(
      async (e?: React.FormEvent) => {
        e?.preventDefault();
        
        setIsSubmitting(true);
        setHasSubmitted(true);

        try {
          // Trigger validation
          const result = await triggerFieldValidation();
          
          if (!result.valid) {
            setErrors(result.errors);
            setIsValid(false);
            return;
          }

          // Submit if valid
          await onSubmit(values);
        } finally {
          setIsSubmitting(false);
        }
      },
      [values, onSubmit]
    );

    // Expose methods to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        validate,
        getValues: () => values,
      }),
      [validate, values]
    );

    const errorCount = Object.keys(errors).length;

    return (
      <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
        <ValidatedCustomFieldsRenderer
          fields={fields}
          values={values}
          onChange={handleChange}
          disabled={disabled || isSubmitting}
          onValidationChange={handleValidationChange}
          validateOnChange={true}
          showValidationHints={true}
        />

        {showSubmitButton && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {hasSubmitted && errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorCount} erreur{errorCount > 1 ? 's' : ''}
                </Badge>
              )}
              {hasSubmitted && errorCount === 0 && isValid && (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Formulaire valide
                </Badge>
              )}
            </div>

            <Button
              type="submit"
              disabled={disabled || isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        )}
      </form>
    );
  }
);
