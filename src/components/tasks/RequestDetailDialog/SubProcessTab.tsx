import { useState } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Calendar, 
  User,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  ListTodo,
  UserCheck,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SubProcessGroup, statusConfig } from './types';
import { TaskCommentsSection } from '../TaskCommentsSection';

interface SubProcessTabProps {
  group: SubProcessGroup;
  profiles: Map<string, string>;
  checklistProgress: Record<string, { completed: number; total: number; progress: number }>;
  onOpenTask: (task: Task) => void;
  requestId: string;
}

export function SubProcessTab({
  group,
  profiles,
  checklistProgress,
  onOpenTask,
  requestId,
}: SubProcessTabProps) {
  const [activeView, setActiveView] = useState<'tasks' | 'chat'>('tasks');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
      case 'validated':
        return CheckCircle2;
      case 'in-progress':
        return Clock;
      default:
        return AlertCircle;
    }
  };

  // Calculate assignment status
  const assignedTasks = group.tasks.filter(t => t.assignee_id);
  const assignmentStatus = assignedTasks.length === group.tasks.length 
    ? 'assigned' 
    : assignedTasks.length > 0 
      ? 'partial' 
      : 'unassigned';

  const getAssignmentBadge = () => {
    switch (assignmentStatus) {
      case 'assigned':
        return <Badge variant="outline" className="text-success border-success/30"><UserCheck className="h-3 w-3 mr-1" />Affecté</Badge>;
      case 'partial':
        return <Badge variant="outline" className="text-warning border-warning/30"><User className="h-3 w-3 mr-1" />Partiellement affecté</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><User className="h-3 w-3 mr-1" />Non affecté</Badge>;
    }
  };

  const getProgressBadge = () => {
    if (group.status === 'done') {
      return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Terminé</Badge>;
    }
    if (group.status === 'in-progress') {
      return <Badge className="bg-info text-info-foreground"><Clock className="h-3 w-3 mr-1" />En cours</Badge>;
    }
    return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />En attente</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Sub-process header with status info */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">{group.subProcessName}</h4>
            {group.departmentName && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3" />
                {group.departmentName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getAssignmentBadge()}
            {getProgressBadge()}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Progress value={group.progressPercent} className="flex-1 h-2" />
          <span className="text-sm font-medium w-12 text-right">{group.progressPercent}%</span>
        </div>
      </div>

      {/* Tabs for tasks and chat */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'tasks' | 'chat')}>
        <TabsList className="w-full">
          <TabsTrigger value="tasks" className="flex-1 gap-2">
            <ListTodo className="h-4 w-4" />
            Tâches ({group.tasks.length})
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 gap-2">
            <MessageSquare className="h-4 w-4" />
            Échanges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <ScrollArea className="h-[280px]">
            {group.tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucune tâche dans ce sous-processus</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {group.tasks.map((task) => {
                  const StatusIcon = getStatusIcon(task.status);
                  const isCompleted = task.status === 'done' || task.status === 'validated';
                  const taskProgress = checklistProgress[task.id];
                  
                  return (
                    <div
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50",
                        isCompleted
                          ? 'bg-success/5 border-success/30'
                          : 'bg-card border-border'
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <StatusIcon className={cn('h-5 w-5', statusConfig[task.status]?.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "font-medium text-sm truncate",
                              isCompleted && 'line-through text-muted-foreground'
                            )}>
                              {task.title}
                            </p>
                            {taskProgress && taskProgress.total > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                {taskProgress.completed}/{taskProgress.total}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {task.assignee_id ? (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {profiles.get(task.assignee_id)}
                              </span>
                            ) : (
                              <span className="text-warning flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Non assigné
                              </span>
                            )}
                            {task.due_date && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(task.due_date), 'dd MMM', { locale: fr })}
                                </span>
                              </>
                            )}
                          </div>
                          {taskProgress && taskProgress.total > 0 && (
                            <Progress value={taskProgress.progress} className="h-1 mt-1.5" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs", statusConfig[task.status]?.color)}>
                          {statusConfig[task.status]?.label}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          {/* Chat section for sub-process - using the first task of the group or the request */}
          <TaskCommentsSection 
            taskId={group.tasks.length > 0 ? group.tasks[0].id : requestId} 
            className="min-h-[280px]" 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
