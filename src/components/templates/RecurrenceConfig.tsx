import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';

export interface RecurrenceData {
  enabled: boolean;
  interval: number;
  unit: 'days' | 'weeks' | 'months' | 'years';
  delayDays: number;
  startDate: string;
}

const UNIT_LABELS: Record<string, string> = {
  days: 'Jour(s)',
  weeks: 'Semaine(s)',
  months: 'Mois',
  years: 'Année(s)',
};

interface RecurrenceConfigProps {
  value: RecurrenceData;
  onChange: (value: RecurrenceData) => void;
}

export function RecurrenceConfig({ value, onChange }: RecurrenceConfigProps) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <Label className="font-medium">Récurrence automatique</Label>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
        />
      </div>

      {value.enabled && (
        <div className="space-y-3 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Une demande sera créée automatiquement selon la fréquence définie.
          </p>

          {/* Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fréquence (tous les…)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={value.interval}
                onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unité</Label>
              <Select
                value={value.unit}
                onValueChange={(v) => onChange({ ...value, unit: v as RecurrenceData['unit'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Delay */}
          <div className="space-y-1">
            <Label className="text-xs">Délai de réalisation (jours entre création et échéance)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={value.delayDays}
              onChange={(e) => onChange({ ...value, delayDays: Math.max(1, Number(e.target.value)) })}
            />
          </div>

          {/* Start date */}
          <div className="space-y-1">
            <Label className="text-xs">Date de première exécution</Label>
            <Input
              type="date"
              value={value.startDate}
              onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
