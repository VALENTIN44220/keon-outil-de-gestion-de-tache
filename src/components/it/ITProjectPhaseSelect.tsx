import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IT_PROJECT_PHASES } from '@/types/itProject';

const NONE_SENTINEL = '__none__';

interface ITProjectPhaseSelectProps {
  value: string | null;
  onChange: (phase: string | null) => void;
  disabled?: boolean;
}

export function ITProjectPhaseSelect({ value, onChange, disabled }: ITProjectPhaseSelectProps) {
  return (
    <Select
      value={value || NONE_SENTINEL}
      onValueChange={(v) => onChange(v === NONE_SENTINEL ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Sélectionner une phase..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_SENTINEL}>— Aucune phase —</SelectItem>
        {IT_PROJECT_PHASES.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
