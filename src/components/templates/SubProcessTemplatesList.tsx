import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubProcessWithTasks } from '@/types/template';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
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
  CheckCircle2,
  AlertCircle,
  Circle,
  ShieldCheck,
} from 'lucide-react';
import { ViewSubProcessDialog } from './ViewSubProcessDialog';
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

const workflowStatusConfig = {
  active: { label: 'Actif', color: 'bg-green-500/15 text-green-700 border-green-500/30', icon: CheckCircle2 },
  draft: { label: 'Brouillon', color: 'bg-amber-500/15 text-amber-700 border-amber-500/30', icon: Circle },
  inactive: { label: 'Inactif', color: 'bg-muted text-muted-foreground', icon: Circle },
  archived: { label: 'Archivé', color: 'bg-muted text-muted-foreground', icon: Circle },
  none: { label: 'Non configuré', color: 'bg-red-500/15 text-red-700 border-red-500/30', icon: AlertCircle },
};

export function SubProcessTemplatesList({
  subProcesses,
  isLoading,
  onDelete,
  onRefresh,
  viewMode = 'list',
}: SubProcessTemplatesListProps) {
  const navigate = useNavigate();
  const [viewingSubProcess, setViewingSubProcess] = useState<SubProcessWithTasks | null>(null);

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

  const isGridView = viewMode === 'grid';

  const getWorkflowStatusBadge = (subProcessId: string) => {
    const status = workflowStatuses?.[subProcessId];
    if (!status?.hasWorkflow) {
      const config = workflowStatusConfig.none;
      return (
        <Badge variant="outline" className={`text-xs ${config.color}`}>
          <config.icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      );
    }
    const config = workflowStatusConfig[status.status || 'draft'];
    return (
      <Badge variant="outline" className={`text-xs ${config.color}`}>
        <config.icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getWorkflowDetailsBadges = (subProcessId: string) => {
    const status = workflowStatuses?.[subProcessId];
    if (!status?.hasWorkflow) return null;
    
    return (
      <>
        <Badge variant="secondary" className="text-xs">
          <Workflow className="h-3 w-3 mr-1" />
          {status.nodeCount} nœuds
        </Badge>
        {status.hasValidation && (
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Validation
          </Badge>
        )}
      </>
    );
  };

  return (
    <>
      <div className={isGridView ? 'space-y-1' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
        {subProcesses.map((sp) => {
          const AssignmentIcon = assignmentTypeLabels[sp.assignment_type]?.icon || Users;
          const VisibilityIcon = visibilityIcons[sp.visibility_level] || Globe;

          if (isGridView) {
            // Compact/grid view
            return (
              <Card key={sp.id} className="flex items-center gap-3 p-3 hover:shadow-md transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{sp.name}</span>
                    {getWorkflowStatusBadge(sp.id)}
                    {sp.process_name && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        <Layers className="h-3 w-3 mr-1" />
                        {sp.process_name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <AssignmentIcon className="h-3 w-3" />
                      {assignmentTypeLabels[sp.assignment_type]?.label}
                    </span>
                    <span>{sp.task_templates.length} tâche(s)</span>
                    <span className="flex items-center gap-1">
                      <VisibilityIcon className="h-3 w-3" />
                      {VISIBILITY_LABELS[sp.visibility_level]}
                    </span>
                    {workflowStatuses?.[sp.id]?.hasValidation && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <ShieldCheck className="h-3 w-3" />
                        Validation
                      </span>
                    )}
                  </div>
                </div>
                {sp.can_manage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setViewingSubProcess(sp)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => navigate(`/templates/workflow/subprocess/${sp.id}`)}
                    >
                      <Workflow className="h-3.5 w-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onDelete(sp.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </Card>
            );
          }

          // Card view (like ProcessCard)
          return (
            <Card key={sp.id} className="flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg line-clamp-1">{sp.name}</CardTitle>
                    {sp.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {sp.description}
                      </CardDescription>
                    )}
                  </div>
                  {sp.can_manage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingSubProcess(sp)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Voir les paramètres
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/templates/workflow/subprocess/${sp.id}`)}>
                          <Workflow className="h-4 w-4 mr-2" />
                          Éditer le workflow
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(sp.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Workflow Status Section */}
                <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-muted/50">
                  <Workflow className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Workflow:</span>
                  {getWorkflowStatusBadge(sp.id)}
                  {getWorkflowDetailsBadges(sp.id)}
                </div>

                <div className="flex flex-wrap gap-2">
                  {sp.process_name && (
                    <Badge variant="outline" className="text-xs">
                      <Layers className="h-3 w-3 mr-1" />
                      {sp.process_name}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <AssignmentIcon className="h-3 w-3 mr-1" />
                    {assignmentTypeLabels[sp.assignment_type]?.label}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <ListTodo className="h-3 w-3 mr-1" />
                    {sp.task_templates.length} tâche(s)
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <VisibilityIcon className="h-3 w-3 mr-1" />
                    {VISIBILITY_LABELS[sp.visibility_level]}
                  </Badge>
                  {sp.is_mandatory && (
                    <Badge variant="default" className="text-xs bg-primary/80">
                      <Lock className="h-3 w-3 mr-1" />
                      Obligatoire
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setViewingSubProcess(sp)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Paramètres
                  </Button>
                  {sp.can_manage && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => navigate(`/templates/workflow/subprocess/${sp.id}`)}
                    >
                      <Workflow className="h-4 w-4 mr-2" />
                      Workflow
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ViewSubProcessDialog
        subProcess={viewingSubProcess}
        open={!!viewingSubProcess}
        onClose={() => setViewingSubProcess(null)}
      />
    </>
  );
}
