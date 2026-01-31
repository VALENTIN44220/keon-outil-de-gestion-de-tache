import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubProcessWithTasks } from '@/types/template';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Users,
  User,
  UserCog,
  Workflow,
  Layers,
  ListTodo,
  Lock,
  Building2,
  Globe,
  Loader2,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { SubProcessConfigView } from './SubProcessConfigView';
import { VISIBILITY_LABELS } from '@/types/template';
import { useSubProcessWorkflowStatuses } from '@/hooks/useWorkflowStatus';

interface SubProcessTemplatesListProps {
  subProcesses: (SubProcessWithTasks & { process_name?: string | null })[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  viewMode?: 'list' | 'grid';
}

const assignmentTypeLabels: Record<string, { label: string; icon: any }> = {
  manager: { label: 'Par manager', icon: Users },
  role: { label: 'Par poste', icon: UserCog },
  user: { label: 'Utilisateur', icon: User },
  group: { label: 'Groupe', icon: Users },
};

const visibilityIcons: Record<string, any> = {
  private: Lock,
  internal_department: Users,
  internal_company: Building2,
  public: Globe,
};

export function SubProcessTemplatesList({
  subProcesses,
  isLoading,
  onDelete,
  onRefresh,
  viewMode = 'list',
}: SubProcessTemplatesListProps) {
  const navigate = useNavigate();
  const [configSubProcessId, setConfigSubProcessId] = useState<string | null>(null);

  // Get all sub-process IDs for workflow status lookup
  const subProcessIds = useMemo(() => subProcesses.map(sp => sp.id), [subProcesses]);
  const { data: workflowStatuses } = useSubProcessWorkflowStatuses(subProcessIds);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (subProcesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-card rounded-xl shadow-sm">
        <Layers className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-lg mb-2">Aucun sous-processus</p>
        <p className="text-sm text-muted-foreground">
          Créez un sous-processus depuis l'onglet ou un processus parent
        </p>
      </div>
    );
  }

  const getWorkflowBadge = (subProcessId: string) => {
    const status = workflowStatuses?.[subProcessId];
    if (!status?.hasWorkflow) {
      return null;
    }
    if (status.status === 'active' || (status.status !== 'draft' && status.status !== 'archived' && status.status !== 'inactive')) {
      return <Badge className="bg-success/20 text-success border-success/30 text-[10px] px-1.5 py-0">Actif</Badge>;
    }
    if (status.status === 'draft') {
      return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0">Brouillon</Badge>;
    }
    return null;
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subProcesses.map((sp) => {
          const AssignmentIcon = assignmentTypeLabels[sp.assignment_type]?.icon || Users;
          const VisibilityIcon = visibilityIcons[sp.visibility_level] || Globe;
          const hasValidation = workflowStatuses?.[sp.id]?.hasValidation;

          return (
            <Card 
              key={sp.id} 
              className="flex flex-col cursor-pointer hover:shadow-md transition-all hover:border-primary/30 bg-card"
              onClick={() => setConfigSubProcessId(sp.id)}
            >
              <CardContent className="p-3 space-y-2">
                {/* Header: Name + Workflow Badge + Process Name */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate">{sp.name}</h3>
                      {getWorkflowBadge(sp.id)}
                      {sp.process_name && (
                        <Badge variant="secondary" className="bg-info/20 text-info border-info/30 text-[10px] px-1.5 py-0 shrink-0">
                          <Layers className="h-3 w-3 mr-0.5" />
                          {sp.process_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meta info row */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <AssignmentIcon className="h-3 w-3" />
                    {assignmentTypeLabels[sp.assignment_type]?.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <ListTodo className="h-3 w-3" />
                    {sp.task_templates.length} tâche(s)
                  </span>
                  <span className="flex items-center gap-1">
                    <VisibilityIcon className="h-3 w-3" />
                    {sp.visibility_level === 'public' ? 'Public' : 'Privé'}
                  </span>
                  {sp.is_mandatory && (
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Obligatoire
                    </span>
                  )}
                  {hasValidation && (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle className="h-3 w-3" />
                      Validation
                    </span>
                  )}
                </div>

                {/* Action buttons - MAX 3 buttons like ProcessCard */}
                <div className="flex items-center gap-1.5 pt-1">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-7 px-2.5 text-xs"
                    onClick={(e) => { e.stopPropagation(); setConfigSubProcessId(sp.id); }}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {sp.can_manage ? 'Gérer' : 'Voir'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2.5 text-xs bg-success/10 border-success/30 text-success hover:bg-success/20"
                    onClick={(e) => { e.stopPropagation(); navigate(`/templates/workflow/subprocess/${sp.id}`); }}
                  >
                    <Workflow className="h-3 w-3 mr-1" />
                    Workflow
                  </Button>
                  {sp.can_manage && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); onDelete(sp.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {configSubProcessId && (
        <SubProcessConfigView
          subProcessId={configSubProcessId}
          open={!!configSubProcessId}
          onClose={() => setConfigSubProcessId(null)}
          onUpdate={onRefresh}
          canManage={subProcesses.find(sp => sp.id === configSubProcessId)?.can_manage ?? false}
        />
      )}
    </>
  );
}
