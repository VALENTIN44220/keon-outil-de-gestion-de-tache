import { SearchableSelect } from '@/components/ui/searchable-select';
import { Label } from '@/components/ui/label';

interface TemplateFiltersProps {
  companyFilter: string;
  departmentFilter: string;
  onCompanyChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  companies: string[];
  departments: string[];
}

export function TemplateFilters({
  companyFilter,
  departmentFilter,
  onCompanyChange,
  onDepartmentChange,
  companies,
  departments,
}: TemplateFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 bg-card rounded-xl shadow-sm">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm text-muted-foreground">Société</Label>
        <SearchableSelect
          value={companyFilter}
          onValueChange={onCompanyChange}
          placeholder="Toutes les sociétés"
          searchPlaceholder="Rechercher une société..."
          triggerClassName="w-48"
          options={[
            { value: 'all', label: 'Toutes les sociétés' },
            ...companies.map(company => ({
              value: company,
              label: company,
            })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm text-muted-foreground">Service</Label>
        <SearchableSelect
          value={departmentFilter}
          onValueChange={onDepartmentChange}
          placeholder="Tous les services"
          searchPlaceholder="Rechercher un service..."
          triggerClassName="w-48"
          options={[
            { value: 'all', label: 'Tous les services' },
            ...departments.map(dept => ({
              value: dept,
              label: dept,
            })),
          ]}
        />
      </div>
    </div>
  );
}
