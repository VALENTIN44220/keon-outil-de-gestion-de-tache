import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { 
  useBEProjectByCode, 
  useBEProjectTasks, 
  useBEProjectStats,
  useBEProjectRecentActivity 
} from '@/hooks/useBEProjectHub';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MapPin, 
  Building, 
  Calendar, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  FileText,
  Activity,
  TrendingUp,
  Flag,
  Check,
  ChevronDown,
  ChevronRight,
  ListTodo,
  ClipboardList
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Task } from '@/types/task';
import { getStatusLabel, getStatusColor } from '@/services/taskStatusService';

interface DescriptionItemProps {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

function DescriptionItem({ label, value, mono }: DescriptionItemProps) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-sm text-right', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

export default function BEProjectHubOverview() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: tasks = [], isLoading: tasksLoading } = useBEProjectTasks(project?.id);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  
  const stats = useBEProjectStats(project?.id, tasks);
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { data: activities = [], isLoading: activitiesLoading } = useBEProjectRecentActivity(project?.id, taskIds);

  // Separate requests and standalone tasks
  const { requests, standaloneTasks } = useMemo(() => {
    const reqs = tasks.filter(t => t.type === 'request');
    const childTaskIds = new Set(tasks.filter(t => t.parent_request_id).map(t => t.id));
    const standalone = tasks.filter(t => t.type === 'task' && !t.parent_request_id);
    return { requests: reqs, standaloneTasks: standalone };
  }, [tasks]);

  // Get child tasks for a request
  const getChildTasks = (requestId: string) => {
    return tasks.filter(t => t.parent_request_id === requestId);
  };

  // Calculate request progress
  const getRequestProgress = (requestId: string) => {
    const children = getChildTasks(requestId);
    if (children.length === 0) return 0;
    const done = children.filter(t => ['done', 'validated'].includes(t.status)).length;
    return Math.round((done / children.length) * 100);
  };

  const toggleRequest = (id: string) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const milestones = useMemo(() => {
    if (!project) return [];
    return [
      { label: 'OS Étude', date: project.date_os_etude, icon: Calendar },
      { label: 'OS Travaux', date: project.date_os_travaux, icon: Calendar },
      { label: 'Clôture bancaire', date: project.date_cloture_bancaire, icon: Building },
      { label: 'Clôture juridique', date: project.date_cloture_juridique, icon: FileText },
    ].filter(m => m.date);
  }, [project]);

  if (projectLoading) {
    return (
      <BEProjectHubLayout>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </BEProjectHubLayout>
    );
  }

  if (!project) {
    return <BEProjectHubLayout><div>Projet non trouvé</div></BEProjectHubLayout>;
  }

  return (
    <BEProjectHubLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5 text-muted-foreground" />
                Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Résumé
                </h4>
                <div className="space-y-0">
                  <DescriptionItem label="Description" value={project.description} />
                  <DescriptionItem label="Typologie" value={project.typologie} />
                  <DescriptionItem label="Actionnariat" value={project.actionnariat} />
                  <DescriptionItem label="Régime ICPE" value={project.regime_icpe} />
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Localisation
                </h4>
                <div className="space-y-0">
                  <DescriptionItem label="Adresse site" value={project.adresse_site} />
                  <DescriptionItem label="Pays site" value={project.pays_site} />
                  <DescriptionItem label="Région" value={project.region} />
                  <DescriptionItem label="Département" value={project.departement} />
                  <DescriptionItem label="Coordonnées GPS" value={project.gps_coordinates} mono />
                </div>

                {/* Map embed */}
                {project.gps_coordinates && (() => {
                  const parts = project.gps_coordinates.split(',').map(s => s.trim());
                  const lat = parseFloat(parts[0]);
                  const lon = parseFloat(parts[1]);
                  if (isNaN(lat) || isNaN(lon)) return null;
                  return (
                    <div className="mt-3 rounded-lg overflow-hidden border border-border">
                      <iframe
                        title="Localisation du projet"
                        width="100%"
                        height="200"
                        style={{ border: 0 }}
                        loading="lazy"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lon}`}
                      />
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Company Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5 text-muted-foreground" />
                Société
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DescriptionItem label="Adresse" value={project.adresse_societe} />
                <DescriptionItem label="Pays" value={project.pays} />
                <DescriptionItem label="SIRET" value={project.siret} mono />
                <DescriptionItem label="Code Divalto" value={project.code_divalto} mono />
              </div>
            </CardContent>
          </Card>

          {/* Milestones Timeline */}
          {milestones.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flag className="h-5 w-5 text-muted-foreground" />
                  Jalons du projet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[18px] top-3 bottom-3 w-0.5 bg-border" />
                  
                  <div className="space-y-4">
                    {milestones.map((milestone, idx) => {
                      const date = new Date(milestone.date!);
                      const past = isPast(date);
                      const today = isToday(date);
                      
                      return (
                        <div key={idx} className="flex items-start gap-4 relative">
                          <div className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10',
                            past ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted',
                            today && 'ring-2 ring-primary ring-offset-2'
                          )}>
                            {past ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <milestone.icon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 pt-1.5">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                'font-medium',
                                past && 'text-emerald-600'
                              )}>
                                {milestone.label}
                              </span>
                              <Badge variant={past ? 'default' : 'outline'} className={cn(
                                past && 'bg-emerald-500'
                              )}>
                                {format(date, 'dd MMMM yyyy', { locale: fr })}
                              </Badge>
                            </div>
                            {today && (
                              <span className="text-xs text-primary font-medium">Aujourd'hui</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Requests & Tasks Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  Demandes & Tâches
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {requests.length} demande{requests.length > 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {tasks.filter(t => t.type === 'task').length} tâche{tasks.filter(t => t.type === 'task').length > 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {tasksLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : (requests.length === 0 && standaloneTasks.length === 0) ? (
                <div className="p-8 text-center text-muted-foreground">
                  <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune demande ou tâche</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="divide-y">
                    {/* Requests with child tasks */}
                    {requests.map(request => {
                      const childTasks = getChildTasks(request.id);
                      const progress = getRequestProgress(request.id);
                      const isExpanded = expandedRequests.has(request.id);
                      const statusColor = getStatusColor(request.status);
                      const assignee = (request as any).assignee;
                      const requester = (request as any).requester;

                      return (
                        <Collapsible key={request.id} open={isExpanded}>
                          <CollapsibleTrigger asChild>
                            <button
                              onClick={() => toggleRequest(request.id)}
                              className="w-full text-left hover:bg-muted/30 transition-colors"
                            >
                              <div className="p-3">
                                <div className="flex items-start gap-3">
                                  <div className="mt-1">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      {request.request_number && (
                                        <span className="text-xs font-mono text-primary font-medium">
                                          {request.request_number}
                                        </span>
                                      )}
                                      <span className="text-sm font-medium truncate">
                                        {request.title?.replace(/^[A-Z]+-[A-Z_]+-\d+\s*—\s*/, '')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <Badge 
                                        variant="outline" 
                                        className="text-[10px] px-1.5 py-0"
                                        style={{ 
                                          backgroundColor: `${statusColor.bg}20`,
                                          borderColor: statusColor.bg,
                                          color: statusColor.bg,
                                        }}
                                      >
                                        {getStatusLabel(request.status)}
                                      </Badge>
                                      {requester?.display_name && (
                                        <span>Demandeur: {requester.display_name}</span>
                                      )}
                                      {request.due_date && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {format(new Date(request.due_date), 'dd/MM/yy')}
                                        </span>
                                      )}
                                      <span>{childTasks.length} tâche{childTasks.length > 1 ? 's' : ''}</span>
                                    </div>
                                    {/* Progress bar */}
                                    {childTasks.length > 0 && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <Progress value={progress} className="h-1.5 flex-1" />
                                        <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                                          {progress}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-10 border-l-2 border-muted">
                              {childTasks.length === 0 ? (
                                <div className="px-4 py-2 text-xs text-muted-foreground italic">
                                  Aucune tâche enfant
                                </div>
                              ) : (
                                childTasks.map(child => {
                                  const childStatus = getStatusColor(child.status);
                                  const childAssignee = (child as any).assignee;
                                  return (
                                    <div key={child.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 transition-colors border-b last:border-0">
                                      <div
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: childStatus.bg }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          {child.task_number && (
                                            <span className="text-[10px] font-mono text-muted-foreground">
                                              {child.task_number}
                                            </span>
                                          )}
                                          <span className="text-xs truncate">{child.title?.replace(/^[A-Z]+-[A-Z_]+-\d+\s*—\s*/, '')}</span>
                                        </div>
                                      </div>
                                      <Badge 
                                        variant="outline" 
                                        className="text-[9px] px-1 py-0 shrink-0"
                                        style={{ 
                                          backgroundColor: `${childStatus.bg}15`,
                                          borderColor: childStatus.bg,
                                          color: childStatus.bg,
                                        }}
                                      >
                                        {getStatusLabel(child.status)}
                                      </Badge>
                                      {childAssignee?.display_name && (
                                        <Avatar className="h-5 w-5 shrink-0">
                                          <AvatarFallback className="text-[8px] bg-primary/10">
                                            {childAssignee.display_name.slice(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                      {child.due_date && (
                                        <span className={cn(
                                          'text-[10px] shrink-0',
                                          isPast(new Date(child.due_date)) && !['done', 'validated'].includes(child.status)
                                            ? 'text-destructive font-medium'
                                            : 'text-muted-foreground'
                                        )}>
                                          {format(new Date(child.due_date), 'dd/MM')}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}

                    {/* Standalone Tasks */}
                    {standaloneTasks.length > 0 && requests.length > 0 && (
                      <div className="px-3 py-2 bg-muted/30 text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <ListTodo className="h-3.5 w-3.5" />
                        Tâches indépendantes ({standaloneTasks.length})
                      </div>
                    )}
                    {standaloneTasks.map(task => {
                      const statusColor = getStatusColor(task.status);
                      const assignee = (task as any).assignee;
                      return (
                        <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: statusColor.bg }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {task.task_number && (
                                <span className="text-xs font-mono text-muted-foreground">
                                  {task.task_number}
                                </span>
                              )}
                              <span className="text-sm truncate">{task.title?.replace(/^[A-Z]+-[A-Z_]+-\d+\s*—\s*/, '')}</span>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5 py-0 shrink-0"
                            style={{ 
                              backgroundColor: `${statusColor.bg}15`,
                              borderColor: statusColor.bg,
                              color: statusColor.bg,
                            }}
                          >
                            {getStatusLabel(task.status)}
                          </Badge>
                          {assignee?.display_name && (
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarFallback className="text-[9px] bg-primary/10">
                                {assignee.display_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {task.due_date && (
                            <span className={cn(
                              'text-xs shrink-0',
                              isPast(new Date(task.due_date)) && !['done', 'validated'].includes(task.status)
                                ? 'text-destructive font-medium'
                                : 'text-muted-foreground'
                            )}>
                              {format(new Date(task.due_date), 'dd/MM/yy')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Progress Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Avancement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Skeleton className="h-24" />
              ) : (
                <>
                  {/* Progress Ring */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          className="text-muted/30"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 56}
                          strokeDashoffset={2 * Math.PI * 56 * (1 - stats.progress / 100)}
                          className="text-primary transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-3xl font-bold">{stats.progress}%</span>
                        <span className="text-xs text-muted-foreground">Complété</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xl font-bold">{stats.totalTasks}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xl font-bold">{stats.openTasks}</p>
                        <p className="text-xs text-muted-foreground">En cours</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xl font-bold">{stats.doneTasks}</p>
                        <p className="text-xs text-muted-foreground">Terminées</p>
                      </div>
                    </div>
                    
                    <div className={cn(
                      'flex items-center gap-3 p-3 rounded-xl',
                      stats.overdueTasks > 0 
                        ? 'bg-red-50 dark:bg-red-950/30' 
                        : 'bg-slate-50 dark:bg-slate-900/30'
                    )}>
                      <div className={cn(
                        'p-2 rounded-lg',
                        stats.overdueTasks > 0 ? 'bg-red-500/10' : 'bg-slate-500/10'
                      )}>
                        <AlertTriangle className={cn(
                          'h-4 w-4',
                          stats.overdueTasks > 0 ? 'text-red-600' : 'text-slate-400'
                        )} />
                      </div>
                      <div>
                        <p className="text-xl font-bold">{stats.overdueTasks}</p>
                        <p className="text-xs text-muted-foreground">En retard</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activitiesLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune activité récente</p>
                </div>
              ) : (
                <ScrollArea className="h-72">
                  <div className="divide-y">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3 p-4 hover:bg-muted/30 transition-colors">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {activity.author_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium truncate">
                              {activity.author_name}
                            </span>
                            {activity.type === 'comment' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                                <MessageSquare className="h-2.5 w-2.5" />
                                {activity.entity_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {activity.content}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {format(new Date(activity.created_at), 'dd MMM à HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </BEProjectHubLayout>
  );
}
