import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Briefcase, Save, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';

interface ProcessTargetsTabProps {
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

export function ProcessTargetsTab({ process, onUpdate, canManage }: ProcessTargetsTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [targetCompanyId, setTargetCompanyId] = useState<string | null>(null);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(null);
  const [isServiceSelectable, setIsServiceSelectable] = useState(false);
  const [allowedDepartments, setAllowedDepartments] = useState<string[]>([]);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  useEffect(() => {
    // Load current targets
    setTargetCompanyId(process.target_company_id || null);
    setTargetDepartmentId(process.target_department_id || null);
    
    // If no fixed department, service is selectable
    setIsServiceSelectable(!process.target_department_id);
  }, [process]);

  const fetchReferenceData = async () => {
    const [companyRes, deptRes] = await Promise.all([
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('departments').select('id, name, company_id').order('name'),
    ]);
    
    if (companyRes.data) setCompanies(companyRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
  };

  const filteredDepartments = targetCompanyId
    ? departments.filter(d => d.company_id === targetCompanyId)
    : departments;

  const handleSave = async () => {
    if (!canManage) return;
    setIsSaving(true);

    try {
      await supabase
        .from('process_templates')
        .update({
          target_company_id: targetCompanyId,
          target_department_id: isServiceSelectable ? null : targetDepartmentId,
        })
        .eq('id', process.id);

      toast.success('Cibles mises à jour');
      onUpdate();
    } catch (error) {
      console.error('Error saving targets:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAllowedDepartment = (id: string) => {
    setAllowedDepartments(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Société cible
          </CardTitle>
          <CardDescription>
            Optionnel. Si défini, toutes les demandes seront routées vers cette société.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={targetCompanyId || '__none__'}
            onValueChange={(v) => {
              setTargetCompanyId(v === '__none__' ? null : v);
              // Reset department when company changes
              setTargetDepartmentId(null);
            }}
            disabled={!canManage}
          >
            <SelectTrigger>
              <SelectValue placeholder="Aucune société cible" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Aucune société cible</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Service cible
          </CardTitle>
          <CardDescription>
            Définissez le service qui traitera les demandes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label>Service sélectionnable à la demande</Label>
              <p className="text-xs text-muted-foreground">
                Le demandeur choisira le service lors de la création
              </p>
            </div>
            <Switch
              checked={isServiceSelectable}
              onCheckedChange={(checked) => {
                setIsServiceSelectable(checked);
                if (checked) setTargetDepartmentId(null);
              }}
              disabled={!canManage}
            />
          </div>

          {!isServiceSelectable ? (
            <div className="space-y-2">
              <Label>Service fixe</Label>
              <Select
                value={targetDepartmentId || '__none__'}
                onValueChange={(v) => setTargetDepartmentId(v === '__none__' ? null : v)}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {filteredDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium">Services autorisés</p>
                  <p className="text-xs opacity-80">
                    Si aucun service n'est sélectionné, tous les services seront proposés.
                  </p>
                </div>
              </div>
              
              <ScrollArea className="h-[180px] border rounded-lg p-2">
                <div className="space-y-1">
                  {filteredDepartments.map((dept) => (
                    <div
                      key={dept.id}
                      className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`allowed-dept-${dept.id}`}
                        checked={allowedDepartments.includes(dept.id)}
                        onCheckedChange={() => canManage && toggleAllowedDepartment(dept.id)}
                        disabled={!canManage}
                      />
                      <Label htmlFor={`allowed-dept-${dept.id}`} className="cursor-pointer flex-1">
                        {dept.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {allowedDepartments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allowedDepartments.map(id => {
                    const dept = departments.find(d => d.id === id);
                    return dept ? (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {dept.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Enregistrer les cibles
          </Button>
        </div>
      )}
    </div>
  );
}
