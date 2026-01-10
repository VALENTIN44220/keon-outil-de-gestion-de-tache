import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
        <Select value={companyFilter} onValueChange={onCompanyChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Toutes les sociétés" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sociétés</SelectItem>
            {companies.map(company => (
              <SelectItem key={company} value={company}>
                {company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm text-muted-foreground">Service</Label>
        <Select value={departmentFilter} onValueChange={onDepartmentChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tous les services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les services</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
