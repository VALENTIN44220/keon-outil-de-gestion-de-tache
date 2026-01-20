import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

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
  { value: 'none', label: 'Aucun', color: 'bg-muted' },
  { value: 'assignee', label: 'Collaborateur', color: 'bg-blue-500' },
  { value: 'requester', label: 'Demandeur', color: 'bg-green-500' },
  { value: 'reporter', label: 'Manager', color: 'bg-purple-500' },
  { value: 'company', label: 'Société', color: 'bg-orange-500' },
  { value: 'department', label: 'Service', color: 'bg-teal-500' },
  { value: 'category', label: 'Catégorie', color: 'bg-pink-500' },
  { value: 'subcategory', label: 'Sous-catégorie', color: 'bg-indigo-500' },
];

// Color palette for filters
const FILTER_COLORS = {
  groupBy: 'border-l-purple-500',
  assignee: 'border-l-blue-500',
  requester: 'border-l-green-500',
  reporter: 'border-l-amber-500',
  company: 'border-l-orange-500',
  department: 'border-l-teal-500',
  category: 'border-l-pink-500',
  subcategory: 'border-l-indigo-500',
};

export function AdvancedFilters({ filters, onFiltersChange }: AdvancedFiltersProps) {
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

  const filterCardClass = (colorClass: string, isActive: boolean) => cn(
    "flex flex-col gap-1.5 p-2 rounded-lg border-l-4 transition-all",
    colorClass,
    isActive ? "bg-accent/50 shadow-sm" : "bg-card/50"
  );

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Filtres & Regroupement</h3>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              Actif
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground h-7">
            <X className="h-3 w-3" />
            Réinitialiser
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {/* Group By */}
        <div className={filterCardClass(FILTER_COLORS.groupBy, filters.groupBy !== 'none')}>
          <Label className="text-xs text-muted-foreground font-medium">Grouper par</Label>
          <Select value={filters.groupBy} onValueChange={(v) => handleChange('groupBy', v)}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Aucun" />
            </SelectTrigger>
            <SelectContent>
              {groupByOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", opt.color)} />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assignee */}
        <div className={filterCardClass(FILTER_COLORS.assignee, filters.assigneeId !== 'all')}>
          <Label className="text-xs text-muted-foreground font-medium">Collaborateur</Label>
          <Select value={filters.assigneeId} onValueChange={(v) => handleChange('assigneeId', v)}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="text-muted-foreground">Tous</span>
              </SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || 'Sans nom'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Requester */}
        <div className={filterCardClass(FILTER_COLORS.requester, filters.requesterId !== 'all')}>
          <Label className="text-xs text-muted-foreground font-medium">Demandeur</Label>
          <Select value={filters.requesterId} onValueChange={(v) => handleChange('requesterId', v)}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="text-muted-foreground">Tous</span>
              </SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || 'Sans nom'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reporter/Manager */}
        <div className={filterCardClass(FILTER_COLORS.reporter, filters.reporterId !== 'all')}>
          <Label className="text-xs text-muted-foreground font-medium">Manager</Label>
          <Select value={filters.reporterId} onValueChange={(v) => handleChange('reporterId', v)}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="text-muted-foreground">Tous</span>
              </SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || 'Sans nom'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Company */}
        <div className={filterCardClass(FILTER_COLORS.company, filters.company !== 'all')}>
          <Label className="text-xs text-muted-foreground font-medium">Société</Label>
          <Select value={filters.company} onValueChange={(v) => handleChange('company', v)}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="text-muted-foreground">Toutes</span>
              </SelectItem>
              {companies.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Department */}
        <div className={filterCardClass(FILTER_COLORS.department, filters.department !== 'all')}>
          <Label className="text-xs text-muted-foreground font-medium">Service</Label>
          <Select value={filters.department} onValueChange={(v) => handleChange('department', v)}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="text-muted-foreground">Tous</span>
              </SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className={filterCardClass(FILTER_COLORS.category, filters.categoryId !== 'all')}>
          <Label className="text-xs text-muted-foreground font-medium">Catégorie</Label>
          <Select value={filters.categoryId} onValueChange={(v) => handleChange('categoryId', v)}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="text-muted-foreground">Toutes</span>
              </SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subcategory */}
        <div className={filterCardClass(FILTER_COLORS.subcategory, filters.subcategoryId !== 'all')}>
          <Label className="text-xs text-muted-foreground font-medium">Sous-catégorie</Label>
          <Select 
            value={filters.subcategoryId} 
            onValueChange={(v) => handleChange('subcategoryId', v)}
            disabled={!selectedCategory}
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="text-muted-foreground">Toutes</span>
              </SelectItem>
              {selectedCategory?.subcategories.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
