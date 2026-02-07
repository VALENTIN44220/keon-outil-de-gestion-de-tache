import { useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  
  const stats = useBEProjectStats(project?.id, tasks);
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { data: activities = [], isLoading: activitiesLoading } = useBEProjectRecentActivity(project?.id, taskIds);

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
                </div>
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
