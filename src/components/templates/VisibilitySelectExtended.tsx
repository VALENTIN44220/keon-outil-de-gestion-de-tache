import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { TemplateVisibility, VISIBILITY_LABELS, VISIBILITY_DESCRIPTIONS } from '@/types/template';
import { Lock, Users, Building2, Globe, UsersRound, UserCheck, X } from 'lucide-react';
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

interface CollaboratorGroup {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  display_name: string | null;
}

interface VisibilitySelectExtendedProps {
  value: TemplateVisibility;
  onChange: (value: TemplateVisibility) => void;
  selectedCompanyIds: string[];
  onCompanyIdsChange: (ids: string[]) => void;
  selectedDepartmentIds: string[];
  onDepartmentIdsChange: (ids: string[]) => void;
  selectedGroupIds?: string[];
  onGroupIdsChange?: (ids: string[]) => void;
  selectedUserIds?: string[];
  onUserIdsChange?: (ids: string[]) => void;
  label?: string;
}

const VISIBILITY_ICONS: Record<TemplateVisibility, typeof Lock> = {
  private: Lock,
  internal_department: Users,
  internal_company: Building2,
  internal_group: UsersRound,
  internal_users: UserCheck,
  public: Globe,
};

export function VisibilitySelectExtended({
  value,
  onChange,
  selectedCompanyIds,
  onCompanyIdsChange,
  selectedDepartmentIds,
  onDepartmentIdsChange,
  selectedGroupIds = [],
  onGroupIdsChange,
  selectedUserIds = [],
  onUserIdsChange,
  label = 'Visibilité',
}: VisibilitySelectExtendedProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<CollaboratorGroup[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [companiesRes, departmentsRes, groupsRes, usersRes] = await Promise.all([
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('departments').select('id, name, company_id').order('name'),
      supabase.from('collaborator_groups').select('id, name').order('name'),
      supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name'),
    ]);

    if (companiesRes.data) setCompanies(companiesRes.data);
    if (departmentsRes.data) setDepartments(departmentsRes.data);
    if (groupsRes.data) setGroups(groupsRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    setIsLoading(false);
  };

  const handleToggle = (id: string, checked: boolean, selected: string[], setter: (ids: string[]) => void) => {
    setter(checked ? [...selected, id] : selected.filter(x => x !== id));
  };

  const getName = (id: string, list: { id: string; name?: string; display_name?: string | null }[]) => {
    const item = list.find(x => x.id === id);
    return item?.name || item?.display_name || 'Inconnu';
  };

  const filteredUsers = userSearch
    ? users.filter(u => u.display_name?.toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  const renderSelector = (
    selectorLabel: string,
    items: { id: string; name?: string; display_name?: string | null }[],
    selectedIds: string[],
    onIdsChange: (ids: string[]) => void,
    idPrefix: string,
    showSearch?: boolean,
  ) => (
    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
      <Label className="text-sm font-medium">{selectorLabel} *</Label>
      
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map(id => (
            <Badge key={id} variant="secondary" className="gap-1">
              {getName(id, items)}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onIdsChange(selectedIds.filter(x => x !== id))} 
              />
            </Badge>
          ))}
        </div>
      )}

      {showSearch && (
        <input
          type="text"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          placeholder="Rechercher..."
          className="w-full h-8 px-2 text-sm border rounded-md bg-background"
        />
      )}

      <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2 bg-background">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : (showSearch ? filteredUsers : items).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun élément disponible</p>
        ) : (
          (showSearch ? filteredUsers : items).map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-${item.id}`}
                checked={selectedIds.includes(item.id)}
                onCheckedChange={(checked) => handleToggle(item.id, checked as boolean, selectedIds, onIdsChange)}
              />
              <label 
                htmlFor={`${idPrefix}-${item.id}`}
                className="text-sm cursor-pointer flex-1"
              >
                {item.name || item.display_name || 'Sans nom'}
              </label>
            </div>
          ))
        )}
      </div>
      
      {selectedIds.length === 0 && (
        <p className="text-xs text-amber-600">
          Sélectionnez au moins un élément
        </p>
      )}
    </div>
  );

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

      {value === 'internal_company' && renderSelector(
        'Sociétés autorisées', companies, selectedCompanyIds, onCompanyIdsChange, 'company'
      )}

      {value === 'internal_department' && renderSelector(
        'Services autorisés', departments, selectedDepartmentIds, onDepartmentIdsChange, 'department'
      )}

      {value === 'internal_group' && onGroupIdsChange && renderSelector(
        'Groupes autorisés', groups, selectedGroupIds, onGroupIdsChange, 'group'
      )}

      {value === 'internal_users' && onUserIdsChange && renderSelector(
        'Utilisateurs autorisés', users, selectedUserIds, onUserIdsChange, 'user', true
      )}
    </div>
  );
}
