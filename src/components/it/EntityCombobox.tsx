import { useMemo } from 'react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCompanies } from '@/hooks/useCompanies';

interface EntityComboboxProps {
  /** Valeur stockée = companies.name (pas l'id, pour compat avec colonne text existante) */
  value: string;
  onValueChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  /** Si true, ajoute une option "— Aucune —" qui renvoie '' */
  allowEmpty?: boolean;
  /** Si true, ajoute une option "Toutes" qui renvoie 'all' (pour les filtres) */
  allowAll?: boolean;
}

export function EntityCombobox({
  value,
  onValueChange,
  placeholder = 'Sélectionner une entité',
  disabled,
  triggerClassName,
  allowEmpty = false,
  allowAll = false,
}: EntityComboboxProps) {
  const { data: companies = [], isLoading } = useCompanies();

  const options = useMemo(() => {
    const base = companies.map((c) => ({ value: c.name, label: c.name }));
    if (allowAll) return [{ value: 'all', label: 'Toutes les entités' }, ...base];
    if (allowEmpty) return [{ value: '__none__', label: '— Aucune —' }, ...base];
    return base;
  }, [companies, allowAll, allowEmpty]);

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
      searchPlaceholder="Rechercher une entité..."
      disabled={disabled || isLoading}
      triggerClassName={triggerClassName}
    />
  );
}

