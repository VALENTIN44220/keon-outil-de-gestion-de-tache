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
  Loader2,
  History,
  Lock,
  Play,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SubProcessGroup, statusConfig } from './types';
import { TaskCommentsSection } from '../TaskCommentsSection';
import { AuditTimeline } from '@/components/execution/AuditTimeline';

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
  const [activeView, setActiveView] = useState<'tasks' | 'chat' | 'audit'>('tasks');

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

      {/* Tabs for tasks, chat, and audit */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'tasks' | 'chat' | 'audit')}>
        <TabsList className="w-full">
          <TabsTrigger value="tasks" className="flex-1 gap-2">
            <ListTodo className="h-4 w-4" />
            Tâches ({group.tasks.length})
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 gap-2">
            <MessageSquare className="h-4 w-4" />
            Échanges
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <ScrollArea className="h-[280px]">
            {group.tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucune tâche dans ce sous-processus</p>
              </div>
            ) : (() => {
              // Détermine la première étape active = première tâche non terminée.
              // Les tâches suivantes sont verrouillées (séquence implicite par l'ordre).
              const firstActiveIdx = group.tasks.findIndex(
                t => t.status !== 'done' && t.status !== 'validated'
              );

              return (
                <div className="relative pl-3 pr-4 space-y-0">
                  {/* Ligne verticale de connection entre étapes */}
                  <div className="absolute left-[22px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-300 via-violet-300 to-slate-200" />

                  {group.tasks.map((task, idx) => {
                    const isCompleted = task.status === 'done' || task.status === 'validated';
                    const isActive = idx === firstActiveIdx;
                    const isLocked = !isCompleted && !isActive;
                    const taskProgress = checklistProgress[task.id];
                    const stepNum = idx + 1;

                    return (
                      <div key={task.id} className="relative py-1.5">
                        {/* Numéro d'étape + icône d'état */}
                        <div className={cn(
                          "absolute left-0 top-3.5 z-10 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0",
                          isCompleted && "bg-emerald-500 border-emerald-600 text-white",
                          isActive && "bg-violet-500 border-violet-600 text-white ring-4 ring-violet-200 animate-pulse",
                          isLocked && "bg-slate-100 border-slate-300 text-slate-400"
                        )}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" />
                            : isLocked ? <Lock className="h-3.5 w-3.5" />
                            : stepNum}
                        </div>

                        {/* Carte de la tâche */}
                        <div
                          onClick={() => isLocked ? undefined : onOpenTask(task)}
                          className={cn(
                            "ml-12 flex items-center justify-between p-3 rounded-lg border-2 transition-all",
                            isLocked ? "cursor-not-allowed opacity-60 bg-slate-50 border-slate-200"
                              : "cursor-pointer hover:shadow-md",
                            isCompleted && "bg-emerald-50 border-emerald-200",
                            isActive && "bg-violet-50 border-violet-300 shadow-md"
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {isActive && (
                                  <Badge className="bg-violet-600 text-white text-[10px] px-1.5 py-0 shrink-0 gap-1">
                                    <Play className="h-2.5 w-2.5" />
                                    À faire maintenant
                                  </Badge>
                                )}
                                {isLocked && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 gap-1 text-slate-500 border-slate-300">
                                    <Lock className="h-2.5 w-2.5" />
                                    En attente
                                  </Badge>
                                )}
                                <p className={cn(
                                  "font-medium text-sm truncate",
                                  isCompleted && 'line-through text-muted-foreground',
                                  isLocked && 'text-slate-500'
                                )}>
                                  {task.title}
                                </p>
                                {taskProgress && taskProgress.total > 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                    {taskProgress.completed}/{taskProgress.total}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {task.assignee_id ? (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {profiles.get(task.assignee_id)}
                                  </span>
                                ) : (
                                  <span className={cn(
                                    "flex items-center gap-1",
                                    isActive ? "text-warning font-medium" : "text-muted-foreground"
                                  )}>
                                    <User className="h-3 w-3" />
                                    {isLocked ? 'Sera assigné en temps voulu' : 'Non assigné'}
                                  </span>
                                )}
                                {task.due_date && !isLocked && (
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
                          <div className="flex items-center gap-2 shrink-0">
                            {!isLocked && (
                              <Badge variant="outline" className={cn("text-xs", statusConfig[task.status]?.color)}>
                                {statusConfig[task.status]?.label}
                              </Badge>
                            )}
                            {!isLocked && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          {/* Chat section for sub-process - using the first task of the group or the request */}
          <TaskCommentsSection 
            taskId={group.tasks.length > 0 ? group.tasks[0].id : requestId} 
            className="min-h-[280px]" 
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {/* Audit timeline for this sub-process tasks */}
          <AuditTimeline 
            requestId={requestId}
            maxHeight="280px"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
