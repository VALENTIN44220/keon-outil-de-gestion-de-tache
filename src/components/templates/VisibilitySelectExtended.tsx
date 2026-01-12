import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { TemplateVisibility, VISIBILITY_LABELS, VISIBILITY_DESCRIPTIONS } from '@/types/template';
import { Lock, Users, Building2, Globe, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  company_id: string | null;
}

interface VisibilitySelectExtendedProps {
  value: TemplateVisibility;
  onChange: (value: TemplateVisibility) => void;
  selectedCompanyIds: string[];
  onCompanyIdsChange: (ids: string[]) => void;
  selectedDepartmentIds: string[];
  onDepartmentIdsChange: (ids: string[]) => void;
  label?: string;
}

const VISIBILITY_ICONS: Record<TemplateVisibility, typeof Lock> = {
  private: Lock,
  internal_department: Users,
  internal_company: Building2,
  public: Globe,
};

export function VisibilitySelectExtended({
  value,
  onChange,
  selectedCompanyIds,
  onCompanyIdsChange,
  selectedDepartmentIds,
  onDepartmentIdsChange,
  label = 'Visibilité',
}: VisibilitySelectExtendedProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [companiesRes, departmentsRes] = await Promise.all([
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('departments').select('id, name, company_id').order('name'),
    ]);

    if (companiesRes.data) setCompanies(companiesRes.data);
    if (departmentsRes.data) setDepartments(departmentsRes.data);
    setIsLoading(false);
  };

  const handleCompanyToggle = (companyId: string, checked: boolean) => {
    if (checked) {
      onCompanyIdsChange([...selectedCompanyIds, companyId]);
    } else {
      onCompanyIdsChange(selectedCompanyIds.filter(id => id !== companyId));
    }
  };

  const handleDepartmentToggle = (departmentId: string, checked: boolean) => {
    if (checked) {
      onDepartmentIdsChange([...selectedDepartmentIds, departmentId]);
    } else {
      onDepartmentIdsChange(selectedDepartmentIds.filter(id => id !== departmentId));
    }
  };

  const removeCompany = (companyId: string) => {
    onCompanyIdsChange(selectedCompanyIds.filter(id => id !== companyId));
  };

  const removeDepartment = (departmentId: string) => {
    onDepartmentIdsChange(selectedDepartmentIds.filter(id => id !== departmentId));
  };

  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || 'Inconnu';
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || 'Inconnu';

  const showCompanySelector = value === 'internal_company';
  const showDepartmentSelector = value === 'internal_department';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select value={value} onValueChange={(v) => onChange(v as TemplateVisibility)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(VISIBILITY_LABELS) as TemplateVisibility[]).map((vis) => {
              const Icon = VISIBILITY_ICONS[vis];
              return (
                <SelectItem key={vis} value={vis}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{VISIBILITY_LABELS[vis]}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {VISIBILITY_DESCRIPTIONS[value]}
        </p>
      </div>

      {/* Company selector for internal_company visibility */}
      {showCompanySelector && (
        <div className="space-y-2 p-3 border rounded-md bg-muted/30">
          <Label className="text-sm font-medium">Sociétés autorisées *</Label>
          
          {selectedCompanyIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedCompanyIds.map(id => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {getCompanyName(id)}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => removeCompany(id)} 
                  />
                </Badge>
              ))}
            </div>
          )}

          <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2 bg-background">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : companies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune société disponible</p>
            ) : (
              companies.map(company => (
                <div key={company.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`company-${company.id}`}
                    checked={selectedCompanyIds.includes(company.id)}
                    onCheckedChange={(checked) => handleCompanyToggle(company.id, checked as boolean)}
                  />
                  <label 
                    htmlFor={`company-${company.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {company.name}
                  </label>
                </div>
              ))
            )}
          </div>
          
          {selectedCompanyIds.length === 0 && (
            <p className="text-xs text-amber-600">
              Sélectionnez au moins une société
            </p>
          )}
        </div>
      )}

      {/* Department selector for internal_department visibility */}
      {showDepartmentSelector && (
        <div className="space-y-2 p-3 border rounded-md bg-muted/30">
          <Label className="text-sm font-medium">Services autorisés *</Label>
          
          {selectedDepartmentIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedDepartmentIds.map(id => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {getDepartmentName(id)}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => removeDepartment(id)} 
                  />
                </Badge>
              ))}
            </div>
          )}

          <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2 bg-background">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun service disponible</p>
            ) : (
              departments.map(department => (
                <div key={department.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`department-${department.id}`}
                    checked={selectedDepartmentIds.includes(department.id)}
                    onCheckedChange={(checked) => handleDepartmentToggle(department.id, checked as boolean)}
                  />
                  <label 
                    htmlFor={`department-${department.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {department.name}
                  </label>
                </div>
              ))
            )}
          </div>
          
          {selectedDepartmentIds.length === 0 && (
            <p className="text-xs text-amber-600">
              Sélectionnez au moins un service
            </p>
          )}
        </div>
      )}
    </div>
  );
}
