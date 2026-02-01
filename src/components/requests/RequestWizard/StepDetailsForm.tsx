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

interface StepDetailsFormProps {
  data: RequestWizardData;
  requestType: RequestType;
  onDataChange: (updates: Partial<RequestWizardData>) => void;
}

export function StepDetailsForm({ data, requestType, onDataChange }: StepDetailsFormProps) {
  const isPersonal = requestType === 'personal';
  const isPerson = requestType === 'person';

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
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={data.description}
              onChange={(e) => onDataChange({ description: e.target.value })}
              placeholder="Décrivez les détails de votre demande..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priorité</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Échéance *</Label>
              <Input
                id="dueDate"
                type="date"
                value={data.dueDate || ''}
                onChange={(e) => onDataChange({ dueDate: e.target.value || null })}
                required
                className={!data.dueDate ? 'border-destructive/50' : ''}
              />
              {!data.dueDate && (
                <p className="text-xs text-destructive">L'échéance est obligatoire</p>
              )}
            </div>
          </div>

          {/* BE Project selection for process requests */}
          {requestType === 'process' && (
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
