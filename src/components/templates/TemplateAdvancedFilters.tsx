import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Building2, Briefcase, User, Calendar, Eye, Grid3X3, List, X, Layers, GitBranch } from 'lucide-react';
import { TemplateVisibility, VISIBILITY_LABELS } from '@/types/template';
import { supabase } from '@/integrations/supabase/client';

export interface TemplateFiltersState {
  companyId: string;
  departmentId: string;
  creatorId: string;
  visibility: string;
  dateFrom: string;
  dateTo: string;
  processId: string;
  subProcessId: string;
}

interface Company {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  display_name: string | null;
}

interface ProcessTemplate {
  id: string;
  name: string;
}

interface SubProcessTemplate {
  id: string;
  name: string;
  process_template_id: string;
}

interface TemplateAdvancedFiltersProps {
  filters: TemplateFiltersState;
  onFiltersChange: (filters: TemplateFiltersState) => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  activeTab?: 'processes' | 'subprocesses' | 'tasks' | 'fields';
}

export function TemplateAdvancedFilters({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  activeTab = 'processes',
}: TemplateAdvancedFiltersProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [processes, setProcesses] = useState<ProcessTemplate[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcessTemplate[]>([]);

  useEffect(() => {
    const fetchReferenceData = async () => {
      const [compRes, deptRes, profileRes, processRes, subProcessRes] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('profiles').select('id, display_name').order('display_name'),
        supabase.from('process_templates').select('id, name').order('name'),
        supabase.from('sub_process_templates').select('id, name, process_template_id').order('name'),
      ]);

      if (compRes.data) setCompanies(compRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (profileRes.data) setProfiles(profileRes.data);
      if (processRes.data) setProcesses(processRes.data);
      if (subProcessRes.data) setSubProcesses(subProcessRes.data);
    };

    fetchReferenceData();
  }, []);

  // Filter sub-processes based on selected process
  const filteredSubProcesses = filters.processId
    ? subProcesses.filter((sp) => sp.process_template_id === filters.processId)
    : subProcesses;

  const handleChange = (key: keyof TemplateFiltersState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    // Reset sub-process filter when process changes
    if (key === 'processId') {
      newFilters.subProcessId = '';
    }
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    onFiltersChange({
      companyId: '',
      departmentId: '',
      creatorId: '',
      visibility: '',
      dateFrom: '',
      dateTo: '',
      processId: '',
      subProcessId: '',
    });
  };

  const hasActiveFilters =
    filters.companyId ||
    filters.departmentId ||
    filters.creatorId ||
    filters.visibility ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.processId ||
    filters.subProcessId;

  // Show process filter for sub-processes and tasks tabs
  const showProcessFilter = activeTab === 'subprocesses' || activeTab === 'tasks';
  // Show sub-process filter only for tasks tab
  const showSubProcessFilter = activeTab === 'tasks';

  return (
    <div className="flex flex-col gap-4 mb-6 p-4 bg-card rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-end gap-3">
          {/* Process Filter - for subprocesses and tasks tabs */}
          {showProcessFilter && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Processus
              </Label>
              <Select
                value={filters.processId || '__all__'}
                onValueChange={(v) => handleChange('processId', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les processus</SelectItem>
                  {processes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sub-Process Filter - only for tasks tab */}
          {showSubProcessFilter && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                Sous-processus
              </Label>
              <Select
                value={filters.subProcessId || '__all__'}
                onValueChange={(v) => handleChange('subProcessId', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les sous-processus</SelectItem>
                  {filteredSubProcesses.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Company Filter */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Société
            </Label>
            <Select
              value={filters.companyId || '__all__'}
              onValueChange={(v) => handleChange('companyId', v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department Filter */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Service
            </Label>
            <Select
              value={filters.departmentId || '__all__'}
              onValueChange={(v) => handleChange('departmentId', v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Creator Filter */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Créateur
            </Label>
            <Select
              value={filters.creatorId || '__all__'}
              onValueChange={(v) => handleChange('creatorId', v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || 'Sans nom'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visibility Filter */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Visibilité
            </Label>
            <Select
              value={filters.visibility || '__all__'}
              onValueChange={(v) => handleChange('visibility', v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes</SelectItem>
                {(Object.keys(VISIBILITY_LABELS) as TemplateVisibility[]).map((v) => (
                  <SelectItem key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Du
            </Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleChange('dateFrom', e.target.value)}
              className="w-36 h-8 text-sm"
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Au</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleChange('dateTo', e.target.value)}
              className="w-36 h-8 text-sm"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Effacer
            </Button>
          )}
        </div>

        {/* View Mode Toggle */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && onViewModeChange(v as 'list' | 'grid')}
          className="border rounded-lg"
        >
          <ToggleGroupItem value="list" aria-label="Vue liste" className="h-8 w-8">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Vue grille" className="h-8 w-8">
            <Grid3X3 className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}

export const defaultFilters: TemplateFiltersState = {
  companyId: '',
  departmentId: '',
  creatorId: '',
  visibility: '',
  dateFrom: '',
  dateTo: '',
  processId: '',
  subProcessId: '',
};
