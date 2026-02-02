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
  GitBranch,
  Workflow,
  Calendar,
  Building2,
  XCircle,
  ChevronRight,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SubProcessProgressCard } from './request-dialog/SubProcessProgressCard';

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

  // Priority color mapping
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { bg: 'bg-red-500', text: 'text-white', label: 'Urgente', icon: Zap };
      case 'high':
        return { bg: 'bg-orange-500', text: 'text-white', label: 'Haute', icon: null };
      case 'medium':
        return { bg: 'bg-blue-500', text: 'text-white', label: 'Moyenne', icon: null };
      default:
        return { bg: 'bg-slate-400', text: 'text-white', label: 'Basse', icon: null };
    }
  };

  const priorityStyle = getPriorityStyle(request.priority);

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-card overflow-hidden border-2",
        workflowInfo?.status === 'completed' && "border-success/40",
        workflowInfo?.status === 'running' && "border-primary/40",
        !workflowInfo && "border-border hover:border-primary/40"
      )}
      onClick={onClick}
    >
      {/* Top accent bar with gradient based on status */}
      <div className={cn(
        "h-1.5 w-full",
        workflowInfo?.status === 'completed' && "bg-gradient-to-r from-success via-success/80 to-emerald-400",
        workflowInfo?.status === 'running' && "bg-gradient-to-r from-primary via-primary/80 to-blue-400",
        workflowInfo?.status === 'failed' && "bg-gradient-to-r from-destructive via-destructive/80 to-red-400",
        !workflowInfo && "bg-gradient-to-r from-muted-foreground/30 via-muted-foreground/20 to-muted-foreground/10"
      )} />

      <CardContent className="p-4 space-y-4">
        {/* Header: Title + Status + Priority */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn(
                "p-1.5 rounded-lg",
                workflowInfo?.status === 'completed' && "bg-success/10",
                workflowInfo?.status === 'running' && "bg-primary/10",
                !workflowInfo && "bg-muted"
              )}>
                {getStatusIcon(request.status)}
              </div>
              <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {request.title}
              </h4>
            </div>
            {request.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 pl-9">
                {request.description}
              </p>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge className={cn("text-[10px] px-2 py-0.5 gap-1", getStatusBadgeVariant(request.status))}>
              {getStatusLabel(request.status)}
            </Badge>
            <Badge className={cn("text-[10px] px-2 py-0.5 gap-1", priorityStyle.bg, priorityStyle.text)}>
              {priorityStyle.icon && <Zap className="h-3 w-3" />}
              {priorityStyle.label}
            </Badge>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-2 px-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Avancement global</span>
            <span className={cn(
              "font-bold tabular-nums",
              globalProgress === 100 ? "text-success" : 
              globalProgress > 50 ? "text-primary" : 
              "text-muted-foreground"
            )}>
              {Math.round(globalProgress)}%
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                globalProgress === 100 
                  ? "bg-gradient-to-r from-success to-emerald-400" 
                  : "bg-gradient-to-r from-primary to-blue-400"
              )}
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>

        {/* Sub-processes Progress with new card design */}
        {subProcesses.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-dashed">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-violet-500/10">
                  <GitBranch className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <span className="text-xs font-semibold text-foreground">
                  Sous-processus
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-700 border-violet-500/20">
                  {subProcesses.length}
                </Badge>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {subProcesses.slice(0, 4).map((sp, index) => (
                <SubProcessProgressCard
                  key={sp.id}
                  name={sp.name}
                  status={sp.status}
                  progress={sp.progress}
                  completedTasks={sp.completedTasks}
                  taskCount={sp.taskCount}
                  assigneeName={sp.assigneeName}
                  assigneeAvatar={sp.assigneeAvatar}
                  colorIndex={index}
                />
              ))}
            </div>
            
            {subProcesses.length > 4 && (
              <div className="flex items-center justify-center">
                <Badge variant="outline" className="text-[10px] gap-1 hover:bg-muted transition-colors">
                  <span>+{subProcesses.length - 4} autres</span>
                  <ChevronRight className="h-3 w-3" />
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Footer: Assignment + Workflow + Dates + Cancel */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t">
          <div className="flex items-center gap-4">
            {/* Assignment */}
            {assigneeInfo ? (
              <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50">
                <Avatar className="h-5 w-5 ring-2 ring-background">
                  <AvatarImage src={assigneeInfo.avatar} />
                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                    {getInitials(assigneeInfo.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-muted-foreground truncate max-w-20">
                  {assigneeInfo.name}
                </span>
              </div>
            ) : targetDepartment ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate max-w-20">{targetDepartment}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/10 border border-warning/20">
                <Users className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-medium text-warning">Non affecté</span>
              </div>
            )}

            {/* Workflow status */}
            {workflowInfo && (
              <div className="flex items-center gap-1.5">
                <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                {getWorkflowStatusBadge()}
              </div>
            )}
          </div>

          {/* Dates + Cancel button */}
          <div className="flex items-center gap-3 shrink-0">
            {request.due_date && (
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                new Date(request.due_date) < new Date() 
                  ? "bg-destructive/10 text-destructive border border-destructive/20" 
                  : "bg-muted/50 text-muted-foreground"
              )}>
                <Calendar className="h-3 w-3" />
                <span className="font-medium">{format(new Date(request.due_date), 'dd MMM', { locale: fr })}</span>
              </div>
            )}
            
            {/* Cancel button */}
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
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
