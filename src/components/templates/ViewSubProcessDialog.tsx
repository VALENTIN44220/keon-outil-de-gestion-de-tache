import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubProcessTemplate, ASSIGNMENT_TYPE_LABELS } from '@/types/template';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Users, 
  Building2, 
  Briefcase, 
  Eye, 
  EyeOff, 
  Lock, 
  Globe,
  Workflow,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface ViewSubProcessDialogProps {
  subProcess: SubProcessTemplate | null;
  open: boolean;
  onClose: () => void;
}

interface Department {
  id: string;
  name: string;
  companies?: { name: string } | null;
}

interface Profile {
  id: string;
  display_name: string | null;
}

interface CollaboratorGroup {
  id: string;
  name: string;
}

interface JobTitle {
  id: string;
  name: string;
}

export function ViewSubProcessDialog({ subProcess, open, onClose }: ViewSubProcessDialogProps) {
  const navigate = useNavigate();
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [jobTitleName, setJobTitleName] = useState<string | null>(null);
  const [hasWorkflow, setHasWorkflow] = useState(false);

  useEffect(() => {
    if (open && subProcess) {
      fetchReferenceData();
      checkWorkflow();
    }
  }, [open, subProcess]);

  const fetchReferenceData = async () => {
    if (!subProcess) return;

    if (subProcess.target_department_id) {
      const { data } = await supabase
        .from('departments')
        .select('id, name, companies(name)')
        .eq('id', subProcess.target_department_id)
        .single();
      
      if (data) {
        const dept = data as Department;
        setDepartmentName(`${dept.name}${dept.companies?.name ? ` (${dept.companies.name})` : ''}`);
      }
    } else {
      setDepartmentName(null);
    }

    if (subProcess.target_manager_id) {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', subProcess.target_manager_id)
        .single();
      
      if (data) setManagerName((data as Profile).display_name || 'Sans nom');
    } else {
      setManagerName(null);
    }

    if (subProcess.target_group_id) {
      const { data } = await supabase
        .from('collaborator_groups')
        .select('id, name')
        .eq('id', subProcess.target_group_id)
        .single();
      
      if (data) setGroupName((data as CollaboratorGroup).name);
    } else {
      setGroupName(null);
    }

    if (subProcess.target_assignee_id) {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', subProcess.target_assignee_id)
        .single();
      
      if (data) setAssigneeName((data as Profile).display_name || 'Sans nom');
    } else {
      setAssigneeName(null);
    }

    if (subProcess.target_job_title_id) {
      const { data } = await supabase
        .from('job_titles')
        .select('id, name')
        .eq('id', subProcess.target_job_title_id)
        .single();
      
      if (data) setJobTitleName((data as JobTitle).name);
    } else {
      setJobTitleName(null);
    }
  };

  const checkWorkflow = async () => {
    if (!subProcess) return;
    
    const { data } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('sub_process_template_id', subProcess.id)
      .eq('is_default', true)
      .maybeSingle();

    setHasWorkflow(!!data);
  };

  const handleOpenWorkflow = () => {
    if (subProcess) {
      navigate(`/templates/workflow/subprocess/${subProcess.id}`);
      onClose();
    }
  };

  if (!subProcess) return null;

  const getVisibilityIcon = () => {
    switch (subProcess.visibility_level) {
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'internal_department':
        return <Building2 className="h-4 w-4" />;
      case 'internal_company':
        return <EyeOff className="h-4 w-4" />;
      case 'public':
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getVisibilityLabel = () => {
    switch (subProcess.visibility_level) {
      case 'private':
        return 'Privé';
      case 'internal_department':
        return 'Service uniquement';
      case 'internal_company':
        return 'Société uniquement';
      case 'public':
      default:
        return 'Public';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            Paramètres du sous-processus
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Nom</p>
            <p className="text-base font-semibold">{subProcess.name}</p>
          </div>

          {/* Description */}
          {subProcess.description && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm">{subProcess.description}</p>
            </div>
          )}

          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={subProcess.is_mandatory ? 'default' : 'secondary'} className="gap-1">
              {subProcess.is_mandatory ? (
                <><CheckCircle2 className="h-3 w-3" /> Obligatoire</>
              ) : (
                <><XCircle className="h-3 w-3" /> Optionnel</>
              )}
            </Badge>
            <Badge variant="outline" className="gap-1">
              {getVisibilityIcon()}
              {getVisibilityLabel()}
            </Badge>
          </div>

          {/* Assignment Type */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Affectation</p>
            </div>
            
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{ASSIGNMENT_TYPE_LABELS[subProcess.assignment_type]}</span>
              </div>

              {departmentName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Service cible
                  </span>
                  <span className="font-medium">{departmentName}</span>
                </div>
              )}

              {subProcess.assignment_type === 'manager' && managerName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Manager cible
                  </span>
                  <span className="font-medium">{managerName}</span>
                </div>
              )}

              {subProcess.assignment_type === 'user' && assigneeName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Utilisateur cible
                  </span>
                  <span className="font-medium">{assigneeName}</span>
                </div>
              )}

              {subProcess.assignment_type === 'role' && jobTitleName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> Poste cible
                  </span>
                  <span className="font-medium">{jobTitleName}</span>
                </div>
              )}

              {subProcess.assignment_type === 'group' && groupName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Groupe cible
                  </span>
                  <span className="font-medium">{groupName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Workflow status */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Workflow</p>
              </div>
              <Badge variant={hasWorkflow ? 'default' : 'destructive'}>
                {hasWorkflow ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Les paramètres d'affectation, tâches et validations sont définis dans le workflow.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button type="button" onClick={handleOpenWorkflow} className="gap-2">
            <Workflow className="h-4 w-4" />
            Configurer le workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
