import { useEffect, useState } from 'react';
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
import { ITProjectSelect } from '@/components/it/ITProjectSelect';
import { RequestWizardData, RequestType } from './types';
import { CommonFieldsConfig, DEFAULT_COMMON_FIELDS_CONFIG, resolveTitlePattern } from '@/types/commonFieldsConfig';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

function BEProjectReadOnly({ projectId }: { projectId: string }) {
  const [name, setName] = useState<string>('...');
  useEffect(() => {
    supabase.from('be_projects').select('nom_projet, code_projet').eq('id', projectId).single()
      .then(({ data }) => {
        if (data) setName(`${data.code_projet} — ${data.nom_projet}`);
        else setName('Projet inconnu');
      });
  }, [projectId]);
  return <span>{name}</span>;
}

function ITProjectReadOnly({ projectId }: { projectId: string }) {
  const [name, setName] = useState<string>('...');
  useEffect(() => {
    supabase.from('it_projects').select('nom_projet, code_projet_digital').eq('id', projectId).single()
      .then(({ data }) => {
        if (data) setName(`${data.code_projet_digital} — ${data.nom_projet}`);
        else setName('Projet IT inconnu');
      });
  }, [projectId]);
  return <span>{name}</span>;
}

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
  const rawCfg = requestType === 'process' && commonFieldsConfig
    ? commonFieldsConfig
    : DEFAULT_COMMON_FIELDS_CONFIG;

  // Title is ALWAYS auto-generated — force non-editable with default pattern
  const cfg = {
    ...rawCfg,
    title: { ...rawCfg.title, editable: false, title_pattern: rawCfg.title.title_pattern || '{process} - {date}' },
  };

  // Auto-generate title
  useEffect(() => {
    if (cfg.title.visible && cfg.title.title_pattern) {
      const generated = resolveTitlePattern(cfg.title.title_pattern, {
        processName: data.processName || '',
        userName: profile?.display_name || '',
      });
      if (generated && generated !== data.title) {
        onDataChange({ title: generated });
      }
    }
  }, [cfg.title.title_pattern, data.processName, profile?.display_name]);

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
          {/* Title — always auto-generated */}
          {cfg.title.visible && (
            <div className="space-y-2">
              <Label htmlFor="title">
                Titre
                <span className="text-xs text-muted-foreground ml-2">(généré automatiquement)</span>
              </Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                {data.title || 'Titre auto-généré à la création'}
              </div>
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
          {requestType === 'process' && cfg.be_project.visible && (
            cfg.be_project.editable ? (
              <BEProjectSelect
                value={data.beProjectId}
                onChange={(value) => onDataChange({ beProjectId: value })}
              />
            ) : (
              <div className="space-y-2">
                <Label>Projet associé <span className="text-xs text-muted-foreground ml-1">(imposé)</span></Label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                  {data.beProjectId ? <BEProjectReadOnly projectId={data.beProjectId} /> : '—'}
                </div>
              </div>
            )
          )}

          {/* IT Project selection for process requests */}
          {requestType === 'process' && cfg.it_project?.visible && (
            cfg.it_project.editable ? (
              <ITProjectSelect
                value={data.itProjectId}
                onChange={(value) => onDataChange({ itProjectId: value })}
              />
            ) : (
              <div className="space-y-2">
                <Label>Projet IT associé <span className="text-xs text-muted-foreground ml-1">(imposé)</span></Label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                  {data.itProjectId ? <ITProjectReadOnly projectId={data.itProjectId} /> : '—'}
                </div>
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
