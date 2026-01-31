import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff, Building2, Briefcase, Users, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessWithTasks, TemplateVisibility } from '@/types/template';
import { toast } from 'sonner';

interface ProcessAccessTabProps {
  process: ProcessWithTasks;
  onUpdate: () => void;
  canManage: boolean;
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

interface Profile {
  id: string;
  display_name: string | null;
}

type AccessMode = 'public' | 'companies' | 'departments' | 'users';

export function ProcessAccessTab({ process, onUpdate, canManage }: ProcessAccessTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode>('public');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    fetchReferenceData();
    loadCurrentAccess();
  }, [process.id]);

  const fetchReferenceData = async () => {
    const [companyRes, deptRes, profileRes] = await Promise.all([
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('departments').select('id, name, company_id').order('name'),
      supabase.from('profiles').select('id, display_name').order('display_name'),
    ]);
    
    if (companyRes.data) setCompanies(companyRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (profileRes.data) setProfiles(profileRes.data);
  };

  const loadCurrentAccess = async () => {
    // Load visibility associations
    const [companyVis, deptVis] = await Promise.all([
      supabase
        .from('process_template_visible_companies')
        .select('company_id')
        .eq('process_template_id', process.id),
      supabase
        .from('process_template_visible_departments')
        .select('department_id')
        .eq('process_template_id', process.id),
    ]);

    if (companyVis.data?.length) {
      setAccessMode('companies');
      setSelectedCompanies(companyVis.data.map(v => v.company_id));
    } else if (deptVis.data?.length) {
      setAccessMode('departments');
      setSelectedDepartments(deptVis.data.map(v => v.department_id));
    } else {
      // Determine from visibility_level
      switch (process.visibility_level) {
        case 'private':
          setAccessMode('users');
          break;
        case 'internal_department':
          setAccessMode('departments');
          break;
        case 'internal_company':
          setAccessMode('companies');
          break;
        default:
          setAccessMode('public');
      }
    }
  };

  const handleSave = async () => {
    if (!canManage) return;
    setIsSaving(true);

    try {
      // Update visibility level
      let visibility_level: TemplateVisibility = 'public';
      if (accessMode === 'companies') visibility_level = 'internal_company';
      else if (accessMode === 'departments') visibility_level = 'internal_department';
      else if (accessMode === 'users') visibility_level = 'private';

      await supabase
        .from('process_templates')
        .update({ visibility_level })
        .eq('id', process.id);

      // Clear existing associations
      await Promise.all([
        supabase
          .from('process_template_visible_companies')
          .delete()
          .eq('process_template_id', process.id),
        supabase
          .from('process_template_visible_departments')
          .delete()
          .eq('process_template_id', process.id),
      ]);

      // Insert new associations
      if (accessMode === 'companies' && selectedCompanies.length > 0) {
        await supabase
          .from('process_template_visible_companies')
          .insert(selectedCompanies.map(company_id => ({
            process_template_id: process.id,
            company_id,
          })));
      }

      if (accessMode === 'departments' && selectedDepartments.length > 0) {
        await supabase
          .from('process_template_visible_departments')
          .insert(selectedDepartments.map(department_id => ({
            process_template_id: process.id,
            department_id,
          })));
      }

      toast.success('Accès mis à jour');
      onUpdate();
    } catch (error) {
      console.error('Error saving access:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCompany = (id: string) => {
    setSelectedCompanies(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleDepartment = (id: string) => {
    setSelectedDepartments(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const accessModes = [
    { value: 'public', label: 'Public', icon: Eye, description: 'Accessible à tous les utilisateurs' },
    { value: 'companies', label: 'Réservé société(s)', icon: Building2, description: 'Limité aux sociétés sélectionnées' },
    { value: 'departments', label: 'Réservé service(s)', icon: Briefcase, description: 'Limité aux services sélectionnés' },
    { value: 'users', label: 'Liste d\'utilisateurs', icon: Users, description: 'Accès nominatif' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mode d'accès</CardTitle>
          <CardDescription>
            Définissez qui peut voir et utiliser ce processus
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {accessModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = accessMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => canManage && setAccessMode(mode.value as AccessMode)}
                  disabled={!canManage}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  } ${!canManage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                      {mode.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{mode.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {accessMode === 'companies' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sociétés autorisées</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`company-${company.id}`}
                      checked={selectedCompanies.includes(company.id)}
                      onCheckedChange={() => canManage && toggleCompany(company.id)}
                      disabled={!canManage}
                    />
                    <Label htmlFor={`company-${company.id}`} className="cursor-pointer flex-1">
                      {company.name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {accessMode === 'departments' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Services autorisés</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`dept-${dept.id}`}
                      checked={selectedDepartments.includes(dept.id)}
                      onCheckedChange={() => canManage && toggleDepartment(dept.id)}
                      disabled={!canManage}
                    />
                    <Label htmlFor={`dept-${dept.id}`} className="cursor-pointer flex-1">
                      {dept.name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {accessMode === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Utilisateurs autorisés</CardTitle>
            <CardDescription>
              Cette fonctionnalité sera disponible prochainement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              La gestion nominative des accès utilisateur est en cours de développement.
            </p>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Enregistrer les accès
          </Button>
        </div>
      )}
    </div>
  );
}
