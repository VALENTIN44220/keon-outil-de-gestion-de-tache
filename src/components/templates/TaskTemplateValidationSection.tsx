import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ValidationLevelType } from '@/types/template';
import { VALIDATION_TYPE_LABELS } from '@/types/template';

export interface TaskTemplateValidationProfileOption {
  id: string;
  display_name: string | null;
}

interface TaskTemplateValidationSectionProps {
  validationLevel1: ValidationLevelType;
  validationLevel2: ValidationLevelType;
  onValidationLevel1Change: (value: ValidationLevelType) => void;
  onValidationLevel2Change: (value: ValidationLevelType) => void;
  validatorLevel1Id: string | null;
  validatorLevel2Id: string | null;
  onValidatorLevel1Change: (id: string | null) => void;
  onValidatorLevel2Change: (id: string | null) => void;
  profiles: TaskTemplateValidationProfileOption[];
}

/**
 * Bloc unique et lisible pour activer la validation sur une tâche modèle (sous-processus ou processus).
 * Sans ce réglage, l’exécutant voit seulement « Marquer terminé ».
 */
export function TaskTemplateValidationSection({
  validationLevel1,
  validationLevel2,
  onValidationLevel1Change,
  onValidationLevel2Change,
  validatorLevel1Id,
  validatorLevel2Id,
  onValidatorLevel1Change,
  onValidatorLevel2Change,
  profiles,
}: TaskTemplateValidationSectionProps) {
  const level2Disabled = validationLevel1 === 'none';

  return (
    <div className="space-y-4 rounded-lg border border-amber-200/90 bg-amber-50/50 dark:bg-amber-950/20 p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">Qui valide avant la clôture ?</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choisissez ici si une personne doit valider le travail une fois l’exécutant prêt. Dans ce cas, il verra le bouton
          <span className="font-medium text-foreground"> « Envoyer pour validation » </span>
          à la place de « Marquer terminé ». Sinon, la tâche pourra être clôturée directement par l’exécutant.
        </p>
       
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Premier niveau de validation</Label>
          <Select
            value={validationLevel1}
            onValueChange={(v) => onValidationLevel1Change(v as ValidationLevelType)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VALIDATION_TYPE_LABELS) as ValidationLevelType[]).map((key) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {VALIDATION_TYPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            « Manager » = le manager de l’exécutant. « Demandeur » = la personne qui a porté la demande parente.
          </p>
          {validationLevel1 === 'free' && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">Validateur précis (obligatoire si « Libre »)</Label>
              <Select
                value={validatorLevel1Id || '__none__'}
                onValueChange={(v) => onValidatorLevel1Change(v === '__none__' ? null : v)}
              >
                <SelectTrigger className="bg-background h-9 text-xs">
                  <SelectValue placeholder="Choisir une personne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">—</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.display_name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Deuxième niveau (optionnel)</Label>
          <Select
            value={validationLevel2}
            onValueChange={(v) => onValidationLevel2Change(v as ValidationLevelType)}
            disabled={level2Disabled}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VALIDATION_TYPE_LABELS) as ValidationLevelType[]).map((key) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {VALIDATION_TYPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Activé seulement si le premier niveau n’est pas « Non ». Utile pour une double validation (ex. manager puis demandeur).
          </p>
          {!level2Disabled && validationLevel2 === 'free' && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">Validateur niveau 2</Label>
              <Select
                value={validatorLevel2Id || '__none__'}
                onValueChange={(v) => onValidatorLevel2Change(v === '__none__' ? null : v)}
              >
                <SelectTrigger className="bg-background h-9 text-xs">
                  <SelectValue placeholder="Choisir une personne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">—</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.display_name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
