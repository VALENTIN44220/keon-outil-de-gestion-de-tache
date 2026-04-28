import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IT_PROJECT_PHASES, ITProjectPhase, getActivePhases } from '@/types/itProject';

const NONE_SENTINEL = '__none__';

interface ITProjectPhaseSelectProps {
  value: string | null;
  onChange: (phase: string | null) => void;
  disabled?: boolean;
  /**
   * Sous-ensemble des phases du projet à afficher. Si non fourni, les 5 phases standard sont listées.
   */
  activePhases?: ITProjectPhase[] | null;
}

export function ITProjectPhaseSelect({ value, onChange, disabled, activePhases }: ITProjectPhaseSelectProps) {
  const phases = activePhases ? getActivePhases(activePhases) : IT_PROJECT_PHASES;
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
        {phases.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
