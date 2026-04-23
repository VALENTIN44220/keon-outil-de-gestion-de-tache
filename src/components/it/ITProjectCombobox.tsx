import { useMemo } from 'react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useITProjects } from '@/hooks/useITProjects';

interface ITProjectComboboxProps {
  /** Valeur stockée = it_projects.id (UUID). '' signifie aucun projet sélectionné. */
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  /** Ajoute une option "— Aucun —" qui renvoie ''. */
  allowEmpty?: boolean;
  /** Ajoute une option "Tous les projets" qui renvoie 'all' (filtres). */
  allowAll?: boolean;
}

export function ITProjectCombobox({
  value,
  onValueChange,
  placeholder = 'Sélectionner un projet IT',
  disabled,
  triggerClassName,
  allowEmpty = false,
  allowAll = false,
}: ITProjectComboboxProps) {
  const { projects, isLoading } = useITProjects();

  const options = useMemo(() => {
    const base = projects.map((p) => ({
      value: p.id,
      label: p.code_projet_digital
        ? `${p.code_projet_digital} — ${p.nom_projet}`
        : p.nom_projet,
    }));
    if (allowAll) return [{ value: 'all', label: 'Tous les projets' }, ...base];
    if (allowEmpty) return [{ value: '__none__', label: '— Aucun —' }, ...base];
    return base;
  }, [projects, allowAll, allowEmpty]);

  const display = allowEmpty && (value === '' || value == null) ? '__none__' : value;

  const handleChange = (v: string) => {
    if (allowEmpty && v === '__none__') onValueChange('');
    else onValueChange(v);
  };

  return (
    <SearchableSelect
      value={display}
      onValueChange={handleChange}
      options={options}
      placeholder={isLoading ? 'Chargement…' : placeholder}
      searchPlaceholder="Rechercher par code ou nom..."
      disabled={disabled || isLoading}
      triggerClassName={triggerClassName}
    />
  );
}
