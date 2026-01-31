import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  User,
  GitBranch,
  Workflow,
  ArrowRight,
  Calendar,
  Building2,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SubProcessProgress {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'done';
  progress: number;
  assigneeName?: string;
  assigneeAvatar?: string;
  taskCount: number;
  completedTasks: number;
}

interface WorkflowInfo {
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentNode?: string;
  progress: number;
}

interface RequestCardProps {
  request: Task;
  onClick: () => void;
  progressData?: { completed: number; total: number };
  onRequestUpdated?: () => void;
}

export function RequestCard({ request, onClick, progressData, onRequestUpdated }: RequestCardProps) {
  const [subProcesses, setSubProcesses] = useState<SubProcessProgress[]>([]);
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo | null>(null);
  const [assigneeInfo, setAssigneeInfo] = useState<{ name: string; avatar?: string } | null>(null);
  const [targetDepartment, setTargetDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRequestDetails = async () => {
      setIsLoading(true);
      try {
        // Fetch sub-processes linked to this request
        const { data: subProcessLinks } = await supabase
          .from('be_request_sub_processes')
          .select('id, sub_process_template_id')
          .eq('task_id', request.id);

        // Fetch sub-process template names
        const subProcessTemplateIds = subProcessLinks?.map(l => l.sub_process_template_id) || [];
        let subProcessTemplates: { id: string; name: string }[] = [];
        
        if (subProcessTemplateIds.length > 0) {
          const { data: templates } = await supabase
            .from('sub_process_templates')
            .select('id, name')
            .in('id', subProcessTemplateIds);
          subProcessTemplates = (templates || []) as { id: string; name: string }[];
        }

        // Fetch child tasks for this request
        const { data: childTasks } = await supabase
          .from('tasks')
          .select('id, status, source_sub_process_template_id, assignee_id')
          .eq('parent_request_id', request.id);

        // Calculate progress per sub-process
        if (subProcessTemplates.length > 0) {
          const spProgress: SubProcessProgress[] = [];
          
          for (const spTemplate of subProcessTemplates) {
            const spTasks = childTasks?.filter(t => t.source_sub_process_template_id === spTemplate.id) || [];
            const completedTasks = spTasks.filter(t => t.status === 'done' || t.status === 'validated').length;
            const totalTasks = spTasks.length;
            
            // Get first assignee if any
            const firstAssignee = spTasks.find(t => t.assignee_id)?.assignee_id;
            let assigneeName = undefined;
            let assigneeAvatar = undefined;
            
            if (firstAssignee) {
              const { data: assigneeData } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', firstAssignee)
                .single();
              if (assigneeData) {
                assigneeName = assigneeData.display_name || undefined;
                assigneeAvatar = assigneeData.avatar_url || undefined;
              }
            }
            
            spProgress.push({
              id: spTemplate.id,
              name: spTemplate.name,
              status: totalTasks === 0 ? 'pending' : completedTasks === totalTasks ? 'done' : completedTasks > 0 ? 'in_progress' : 'pending',
              progress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
              assigneeName,
              assigneeAvatar,
              taskCount: totalTasks,
              completedTasks
            });
          }
          
          setSubProcesses(spProgress);
        }

        // Calculate workflow status based on child tasks status
        if (childTasks && childTasks.length > 0) {
          const completedCount = childTasks.filter(t => t.status === 'done' || t.status === 'validated').length;
          const inProgressCount = childTasks.filter(t => t.status === 'in_progress' || t.status === 'in-progress').length;
          const totalCount = childTasks.length;
          
          let wfStatus: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
          if (completedCount === totalCount) {
            wfStatus = 'completed';
          } else if (inProgressCount > 0 || completedCount > 0) {
            wfStatus = 'running';
          }
          
          setWorkflowInfo({
            status: wfStatus,
            currentNode: undefined,
            progress: (completedCount / totalCount) * 100
          });
        }

        // Fetch assignee info
        if (request.assignee_id) {
          const { data: assignee } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', request.assignee_id)
            .single();
          
          if (assignee) {
            setAssigneeInfo({
              name: assignee.display_name || 'Non défini',
              avatar: assignee.avatar_url || undefined
            });
          }
        }

        // Fetch target department
        if (request.target_department_id) {
          const { data: dept } = await supabase
            .from('departments')
            .select('name')
            .eq('id', request.target_department_id)
            .single();
          
          if (dept) {
            setTargetDepartment(dept.name);
          }
        }

      } catch (error) {
        console.error('Error fetching request details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequestDetails();
  }, [request.id, request.assignee_id, request.target_department_id]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
      case 'validated':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'in_progress':
      case 'in-progress':
        return <Clock className="h-4 w-4 text-primary" />;
      case 'review':
      case 'pending-validation':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'to_assign':
        return <Users className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      to_assign: 'À affecter',
      todo: 'À faire',
      in_progress: 'En cours',
      'in-progress': 'En cours',
      review: 'En révision',
      'pending-validation': 'En validation',
      done: 'Terminé',
      validated: 'Validé',
      refused: 'Refusé',
    };
    return labels[status] || status;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'done':
      case 'validated':
        return 'bg-success/20 text-success border-success/30';
      case 'in_progress':
      case 'in-progress':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'review':
      case 'pending-validation':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'to_assign':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'refused':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getWorkflowStatusBadge = () => {
    if (!workflowInfo) return null;
    
    switch (workflowInfo.status) {
      case 'completed':
        return <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Workflow terminé</Badge>;
      case 'running':
        return <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">En cours</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Échec</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground text-[10px]">En attente</Badge>;
    }
  };

  const globalProgress = progressData 
    ? (progressData.completed / progressData.total) * 100 
    : workflowInfo?.progress || 0;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Check if cancellation is allowed
  const canCancel = !['done', 'validated', 'cancelled'].includes(request.status);

  const handleCancelRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // 1. Cancel the main request
      const updateMainRequest = supabase
        .from('tasks')
        .update({ status: 'cancelled' })
        .eq('id', request.id);
      await updateMainRequest;

      // 2. Cancel all child tasks
      const updateChildTasks = supabase
        .from('tasks')
        .update({ status: 'cancelled' })
        .eq('parent_request_id', request.id);
      await updateChildTasks;

      // 3. Cancel request_sub_processes
      const updateSubProcesses = supabase
        .from('request_sub_processes')
        .update({ status: 'cancelled' })
        .eq('request_id', request.id);
      await updateSubProcesses;

      // 4. Cancel active workflow runs - fetch all then filter in JS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wfTable = supabase.from('workflow_runs') as any;
      const workflowResult = await wfTable.select('id, status').eq('request_id', request.id);
      
      if (workflowResult.data) {
        for (const run of workflowResult.data as Array<{ id: string; status: string }>) {
          if (run.status === 'running' || run.status === 'paused') {
            await wfTable.update({ status: 'cancelled' }).eq('id', run.id);
          }
        }
      }

      toast.success('Demande annulée avec succès');
      onRequestUpdated?.();
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error("Erreur lors de l'annulation de la demande");
    }
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 bg-card"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: Title + Status + Priority */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(request.status)}
              <h4 className="font-semibold text-sm truncate">{request.title}</h4>
            </div>
            {request.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {request.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={cn("text-[10px] px-1.5 py-0", getStatusBadgeVariant(request.status))}>
              {getStatusLabel(request.status)}
            </Badge>
            <Badge 
              variant={request.priority === 'high' ? 'destructive' : 'secondary'}
              className="text-[10px] px-1.5 py-0"
            >
              {request.priority === 'high' ? 'Haute' : request.priority === 'medium' ? 'Moy.' : 'Basse'}
            </Badge>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Avancement global</span>
            <span className="font-medium">{Math.round(globalProgress)}%</span>
          </div>
          <Progress value={globalProgress} className="h-2" />
        </div>

        {/* Sub-processes Progress */}
        {subProcesses.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              <span>Sous-processus ({subProcesses.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {subProcesses.slice(0, 4).map(sp => (
                <div 
                  key={sp.id} 
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    sp.status === 'done' ? 'bg-success' : 
                    sp.status === 'in_progress' ? 'bg-primary animate-pulse' : 
                    'bg-muted-foreground'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{sp.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Progress value={sp.progress} className="h-1 flex-1" />
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {sp.completedTasks}/{sp.taskCount}
                      </span>
                    </div>
                  </div>
                  {sp.assigneeName && (
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={sp.assigneeAvatar} />
                      <AvatarFallback className="text-[8px] bg-primary/20">
                        {getInitials(sp.assigneeName)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
            {subProcesses.length > 4 && (
              <p className="text-[10px] text-muted-foreground text-center">
                +{subProcesses.length - 4} autres sous-processus
              </p>
            )}
          </div>
        )}

        {/* Footer: Assignment + Workflow + Dates + Cancel */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-3">
            {/* Assignment */}
            {assigneeInfo ? (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={assigneeInfo.avatar} />
                  <AvatarFallback className="text-[8px] bg-primary/20">
                    {getInitials(assigneeInfo.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground truncate max-w-24">{assigneeInfo.name}</span>
              </div>
            ) : targetDepartment ? (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate max-w-24">{targetDepartment}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-warning">
                <Users className="h-3 w-3" />
                <span>Non affecté</span>
              </div>
            )}

            {/* Workflow status */}
            {workflowInfo && (
              <div className="flex items-center gap-1">
                <Workflow className="h-3 w-3 text-muted-foreground" />
                {getWorkflowStatusBadge()}
              </div>
            )}
          </div>

          {/* Dates + Cancel button */}
          <div className="flex items-center gap-2 shrink-0">
            {request.due_date && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(request.due_date), 'dd MMM', { locale: fr })}</span>
              </div>
            )}
            
            {/* Cancel button */}
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Annuler
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Annuler la demande ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action annulera la demande ainsi que tous les sous-processus et tâches associés. 
                      Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                      Non, garder
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelRequest}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Oui, annuler la demande
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
