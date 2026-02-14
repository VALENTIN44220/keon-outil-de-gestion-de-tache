import { useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { BEProjectSelect } from '@/components/be/BEProjectSelect';
import { RequestWizardData, RequestType } from './types';
import { CommonFieldsConfig, DEFAULT_COMMON_FIELDS_CONFIG, resolveTitlePattern } from '@/types/commonFieldsConfig';
import { useAuth } from '@/contexts/AuthContext';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

interface StepDetailsFormProps {
  data: RequestWizardData;
  requestType: RequestType;
  onDataChange: (updates: Partial<RequestWizardData>) => void;
  commonFieldsConfig?: CommonFieldsConfig;
}

export function StepDetailsForm({ data, requestType, onDataChange, commonFieldsConfig }: StepDetailsFormProps) {
  const { profile } = useAuth();
  const isPersonal = requestType === 'personal';
  const isPerson = requestType === 'person';

  // Only apply config for process requests
  const cfg = requestType === 'process' && commonFieldsConfig
    ? commonFieldsConfig
    : DEFAULT_COMMON_FIELDS_CONFIG;

  // Auto-generate title when pattern is set and title is not editable
  useEffect(() => {
    if (cfg.title.visible && !cfg.title.editable && cfg.title.title_pattern) {
      const generated = resolveTitlePattern(cfg.title.title_pattern, {
        processName: data.processName || '',
        userName: profile?.display_name || '',
      });
      if (generated && generated !== data.title) {
        onDataChange({ title: generated });
      }
    }
  }, [cfg.title.editable, cfg.title.title_pattern, data.processName, profile?.display_name]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">
          {isPersonal
            ? 'Décrivez votre tâche'
            : isPerson
            ? 'Décrivez la tâche à assigner'
            : 'Informations de la demande'}
        </h2>
        <p className="text-muted-foreground">
          {isPersonal
            ? 'Renseignez les détails de votre tâche personnelle'
            : 'Renseignez les informations nécessaires'}
        </p>
      </div>

      <ScrollArea className="h-[450px] pr-4">
        <div className="space-y-5 pb-4">
          {/* Title */}
          {cfg.title.visible && (
            <div className="space-y-2">
              <Label htmlFor="title">
                Titre {cfg.title.editable ? '*' : ''}
                {!cfg.title.editable && (
                  <span className="text-xs text-muted-foreground ml-2">(généré automatiquement)</span>
                )}
              </Label>
              {cfg.title.editable ? (
                <Input
                  id="title"
                  value={data.title}
                  onChange={(e) => onDataChange({ title: e.target.value })}
                  placeholder={
                    isPersonal
                      ? 'Ex: Préparer la présentation trimestrielle'
                      : 'Ex: Demande de matériel informatique'
                  }
                />
              ) : (
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                  {data.title || 'Titre auto-généré à la création'}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {cfg.description.visible && (
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={data.description}
                onChange={(e) => onDataChange({ description: e.target.value })}
                placeholder="Décrivez les détails de votre demande..."
                rows={4}
                disabled={!cfg.description.editable}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            {cfg.priority.visible && (
              <div className="space-y-2">
                <Label>Priorité</Label>
                {cfg.priority.editable ? (
                  <Select
                    value={data.priority}
                    onValueChange={(v) =>
                      onDataChange({ priority: v as 'low' | 'medium' | 'high' | 'urgent' })
                    }
                  >
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
                ) : (
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                    {PRIORITY_LABELS[cfg.priority.default_value || data.priority] || data.priority}
                  </div>
                )}
              </div>
            )}

            {/* Due date */}
            {cfg.due_date.visible && (
              <div className="space-y-2">
                <Label htmlFor="dueDate">Échéance *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={data.dueDate || ''}
                  onChange={(e) => onDataChange({ dueDate: e.target.value || null })}
                  required
                  className={!data.dueDate ? 'border-destructive/50' : ''}
                  disabled={!cfg.due_date.editable}
                />
                {!data.dueDate && (
                  <p className="text-xs text-destructive">L'échéance est obligatoire</p>
                )}
              </div>
            )}
          </div>

          {/* BE Project selection for process requests */}
          {requestType === 'process' && cfg.be_project.visible && cfg.be_project.editable && (
            <BEProjectSelect
              value={data.beProjectId}
              onChange={(value) => onDataChange({ beProjectId: value })}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
