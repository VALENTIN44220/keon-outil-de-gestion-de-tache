import { memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Phone,
  Globe,
  Building2,
  Building,
  Mail,
  Link,
  CreditCard,
  MapPin,
  Regex,
  ArrowDown,
  ArrowUp,
  Calendar,
  Shield,
  Info,
} from 'lucide-react';
import type { FormField, ValidationType } from '@/types/formBuilder';
import { getValidationTypesForFieldType, formatValidationHint } from '@/hooks/useFieldValidation';

interface ValidationPropertiesPanelProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}

const VALIDATION_TYPE_OPTIONS: {
  value: ValidationType;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  { value: 'email', label: 'Email', icon: Mail, description: 'Format email valide' },
  { value: 'phone_fr', label: 'Téléphone FR', icon: Phone, description: '06 12 34 56 78 ou +33...' },
  { value: 'phone_intl', label: 'Téléphone International', icon: Globe, description: 'Format E.164' },
  { value: 'siret', label: 'SIRET', icon: Building2, description: '14 chiffres + contrôle Luhn' },
  { value: 'siren', label: 'SIREN', icon: Building, description: '9 chiffres + contrôle Luhn' },
  { value: 'iban', label: 'IBAN', icon: CreditCard, description: 'Format IBAN valide' },
  { value: 'postal_code_fr', label: 'Code Postal FR', icon: MapPin, description: '5 chiffres' },
  { value: 'url', label: 'URL', icon: Link, description: 'http:// ou https://' },
  { value: 'regex', label: 'Expression régulière', icon: Regex, description: 'Regex personnalisée' },
];

export const ValidationPropertiesPanel = memo(function ValidationPropertiesPanel({
  field,
  onUpdate,
}: ValidationPropertiesPanelProps) {
  const allowedValidations = getValidationTypesForFieldType(field.field_type);
  const validationParams = field.validation_params || {};

  const handleValidationTypeChange = (value: string) => {
    const newType = value === '__none__' ? null : (value as ValidationType);
    onUpdate({ validation_type: newType });
  };

  const handleParamsChange = (key: string, value: any) => {
    onUpdate({
      validation_params: {
        ...validationParams,
        [key]: value,
      },
    });
  };

  const availableOptions = VALIDATION_TYPE_OPTIONS.filter(
    (opt) => allowedValidations.includes(opt.value) || opt.value === 'regex'
  );

  return (
    <div className="space-y-4">
      {/* Validation Type Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Type de validation
        </Label>
        <Select
          value={field.validation_type || '__none__'}
          onValueChange={handleValidationTypeChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Aucune validation" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="__none__">Aucune</SelectItem>
            {availableOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {field.validation_type && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            {formatValidationHint(field.validation_type)}
          </p>
        )}
      </div>

      {/* Regex Configuration */}
      {field.validation_type === 'regex' && (
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
          <Label htmlFor="validation-regex">Expression régulière</Label>
          <Input
            id="validation-regex"
            value={field.validation_regex || ''}
            onChange={(e) => onUpdate({ validation_regex: e.target.value })}
            placeholder="^[A-Z]{2}\d{4}$"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Exemple: ^[A-Z]{'{2}'}[0-9]{'{4}'}$ pour 2 lettres + 4 chiffres
          </p>
        </div>
      )}

      <Separator />

      {/* Number-specific validation */}
      {field.field_type === 'number' && (
        <Accordion type="single" collapsible defaultValue="minmax">
          <AccordionItem value="minmax">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <ArrowDown className="h-4 w-4" />
                Limites numériques
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="min-value" className="text-xs">
                    Valeur minimum
                  </Label>
                  <Input
                    id="min-value"
                    type="number"
                    value={field.min_value ?? ''}
                    onChange={(e) =>
                      onUpdate({
                        min_value: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder="Min"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-value" className="text-xs">
                    Valeur maximum
                  </Label>
                  <Input
                    id="max-value"
                    type="number"
                    value={field.max_value ?? ''}
                    onChange={(e) =>
                      onUpdate({
                        max_value: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder="Max"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Text-specific validation */}
      {(field.field_type === 'text' || field.field_type === 'textarea') && (
        <Accordion type="single" collapsible>
          <AccordionItem value="length">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4" />
                Limites de longueur
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="min-length" className="text-xs">
                    Minimum caractères
                  </Label>
                  <Input
                    id="min-length"
                    type="number"
                    min={0}
                    value={validationParams.min_length ?? ''}
                    onChange={(e) =>
                      handleParamsChange(
                        'min_length',
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    placeholder="Min"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-length" className="text-xs">
                    Maximum caractères
                  </Label>
                  <Input
                    id="max-length"
                    type="number"
                    min={0}
                    value={validationParams.max_length ?? ''}
                    onChange={(e) =>
                      handleParamsChange(
                        'max_length',
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    placeholder="Max"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Date-specific validation */}
      {(field.field_type === 'date' || field.field_type === 'datetime') && (
        <Accordion type="single" collapsible>
          <AccordionItem value="daterange">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Plage de dates
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="min-date" className="text-xs">
                    Date minimum
                  </Label>
                  <Input
                    id="min-date"
                    type="date"
                    value={validationParams.min_date ?? ''}
                    onChange={(e) =>
                      handleParamsChange('min_date', e.target.value || null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-date" className="text-xs">
                    Date maximum
                  </Label>
                  <Input
                    id="max-date"
                    type="date"
                    value={validationParams.max_date ?? ''}
                    onChange={(e) =>
                      handleParamsChange('max_date', e.target.value || null)
                    }
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Label htmlFor="allow-today" className="text-xs">
                  Permettre la date du jour
                </Label>
                <Switch
                  id="allow-today"
                  checked={validationParams.allow_today !== false}
                  onCheckedChange={(v) => handleParamsChange('allow_today', v)}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <Separator />

      {/* Custom Error Message */}
      <div className="space-y-2">
        <Label htmlFor="validation-message">Message d'erreur personnalisé</Label>
        <Textarea
          id="validation-message"
          value={field.validation_message || ''}
          onChange={(e) => onUpdate({ validation_message: e.target.value })}
          placeholder="Message affiché en cas d'erreur..."
          rows={2}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Laissez vide pour utiliser le message par défaut
        </p>
      </div>

      {/* Preview */}
      {field.validation_type && (
        <div className="p-3 bg-muted/30 rounded-lg space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Aperçu validation
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {VALIDATION_TYPE_OPTIONS.find((o) => o.value === field.validation_type)?.label ||
                field.validation_type}
            </Badge>
            {field.is_required && (
              <Badge variant="destructive" className="text-xs">
                Obligatoire
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {field.validation_message ||
              `Format ${VALIDATION_TYPE_OPTIONS.find((o) => o.value === field.validation_type)?.description || 'standard'} requis`}
          </p>
        </div>
      )}
    </div>
  );
});
