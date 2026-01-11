import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Profile {
  id: string;
  display_name: string | null;
  job_title: string | null;
  company: string | null;
  department: string | null;
}

export interface AdvancedFiltersState {
  assigneeId: string;
  requesterId: string;
  reporterId: string;
  company: string;
  department: string;
  categoryId: string;
  subcategoryId: string;
  groupBy: string;
}

interface AdvancedFiltersProps {
  filters: AdvancedFiltersState;
  onFiltersChange: (filters: AdvancedFiltersState) => void;
}

const groupByOptions = [
  { value: 'none', label: 'Aucun' },
  { value: 'assignee', label: 'Collaborateur' },
  { value: 'requester', label: 'Demandeur' },
  { value: 'reporter', label: 'Manager' },
  { value: 'company', label: 'Société' },
  { value: 'department', label: 'Service' },
  { value: 'category', label: 'Catégorie' },
  { value: 'subcategory', label: 'Sous-catégorie' },
];

export function AdvancedFilters({ filters, onFiltersChange }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const { categories } = useCategories();

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, job_title, company, department');
      
      if (data) {
        setProfiles(data);
        const uniqueCompanies = [...new Set(data.map(p => p.company).filter(Boolean))] as string[];
        const uniqueDepartments = [...new Set(data.map(p => p.department).filter(Boolean))] as string[];
        setCompanies(uniqueCompanies);
        setDepartments(uniqueDepartments);
      }
    };

    fetchProfiles();
  }, []);

  const handleChange = (key: keyof AdvancedFiltersState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    
    // Reset subcategory if category changes
    if (key === 'categoryId') {
      newFilters.subcategoryId = 'all';
    }
    
    onFiltersChange(newFilters);
  };

  const resetFilters = () => {
    onFiltersChange({
      assigneeId: 'all',
      requesterId: 'all',
      reporterId: 'all',
      company: 'all',
      department: 'all',
      categoryId: 'all',
      subcategoryId: 'all',
      groupBy: 'none',
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'groupBy') return value !== 'none';
    return value !== 'all';
  });

  const selectedCategory = categories.find(c => c.id === filters.categoryId);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtres avancés
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                !
              </span>
            )}
          </Button>
        </CollapsibleTrigger>
        
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
            <X className="h-3 w-3" />
            Réinitialiser
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 p-4 bg-card rounded-xl shadow-sm">
          {/* Group By */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Grouper par</Label>
            <Select value={filters.groupBy} onValueChange={(v) => handleChange('groupBy', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Aucun" />
              </SelectTrigger>
              <SelectContent>
                {groupByOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Collaborateur</Label>
            <Select value={filters.assigneeId} onValueChange={(v) => handleChange('assigneeId', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || 'Sans nom'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Requester */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Demandeur</Label>
            <Select value={filters.requesterId} onValueChange={(v) => handleChange('requesterId', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || 'Sans nom'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reporter/Manager */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Manager</Label>
            <Select value={filters.reporterId} onValueChange={(v) => handleChange('reporterId', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || 'Sans nom'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Société</Label>
            <Select value={filters.company} onValueChange={(v) => handleChange('company', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Service</Label>
            <Select value={filters.department} onValueChange={(v) => handleChange('department', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Catégorie</Label>
            <Select value={filters.categoryId} onValueChange={(v) => handleChange('categoryId', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategory */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Sous-catégorie</Label>
            <Select 
              value={filters.subcategoryId} 
              onValueChange={(v) => handleChange('subcategoryId', v)}
              disabled={!selectedCategory}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {selectedCategory?.subcategories.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
