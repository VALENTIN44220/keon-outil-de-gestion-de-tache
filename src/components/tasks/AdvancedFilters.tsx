import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useTeamHierarchy } from '@/hooks/useTeamHierarchy';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  display_name: string | null;
  job_title: string | null;
  company: string | null;
  department: string | null;
  department_id: string | null;
  company_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  company_id: string | null;
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
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const { effectivePermissions } = useEffectivePermissions();
  const { subordinates } = useTeamHierarchy();
  
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const { categories } = useCategories();

  useEffect(() => {
    const fetchData = async () => {
      const [profilesRes, companiesRes, departmentsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, job_title, company, department, department_id, company_id'),
        supabase.from('companies').select('id, name'),
        supabase.from('departments').select('id, name, company_id'),
      ]);
      
      if (profilesRes.data) setAllProfiles(profilesRes.data);
      if (companiesRes.data) setAllCompanies(companiesRes.data);
      if (departmentsRes.data) setAllDepartments(departmentsRes.data);
    };

    fetchData();
  }, []);

  // Get team member IDs (self + subordinates)
  const myTeamIds = new Set<string>();
  if (profile?.id) {
    myTeamIds.add(profile.id);
    subordinates.forEach(sub => myTeamIds.add(sub.id));
  }

  // Filter profiles based on permissions
  const filteredProfiles = allProfiles.filter(p => {
    if (!profile?.id) return false;
    
    // Admin/Director: can see all
    if (effectivePermissions.can_view_all_tasks) {
      return true;
    }
    
    // Manager: can see self + subordinates
    if (effectivePermissions.can_view_subordinates_tasks) {
      return myTeamIds.has(p.id);
    }
    
    // Regular user: only self
    return p.id === profile.id;
  });

  // Filter companies based on permissions
  const filteredCompanies = allCompanies.filter(c => {
    if (!profile) return false;
    
    // Admin/Director: can see all
    if (effectivePermissions.can_view_all_tasks) {
      return true;
    }
    
    // Others: only their company
    return profile.company_id === c.id;
  });

  // Filter departments based on permissions
  const filteredDepartments = allDepartments.filter(d => {
    if (!profile) return false;
    
    // Admin/Director: can see all
    if (effectivePermissions.can_view_all_tasks) {
      return true;
    }
    
    // Manager: their department only
    return profile.department_id === d.id;
  });

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

        {/* Assignee - filtered by permissions */}
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
              {filteredProfiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || 'Sans nom'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Requester - filtered by permissions */}
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
              {filteredProfiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || 'Sans nom'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reporter/Manager - filtered by permissions */}
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
              {filteredProfiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || 'Sans nom'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Company - filtered by permissions */}
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
              {filteredCompanies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Department - filtered by permissions */}
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
              {filteredDepartments.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
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
