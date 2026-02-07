import { useParams } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { 
  useBEProjectByCode, 
  useBEProjectTasks, 
  useBEProjectStats,
  useBEProjectRecentActivity 
} from '@/hooks/useBEProjectHub';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MapPin, 
  Building, 
  Calendar, 
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  FileText,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function BEProjectHubOverview() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: tasks = [], isLoading: tasksLoading } = useBEProjectTasks(project?.id);
  
  const stats = useBEProjectStats(project?.id, tasks);
  const taskIds = tasks.map(t => t.id);
  const { data: activities = [], isLoading: activitiesLoading } = useBEProjectRecentActivity(project?.id, taskIds);

  const milestones = project ? [
    { label: 'OS Étude', date: project.date_os_etude, icon: Calendar },
    { label: 'OS Travaux', date: project.date_os_travaux, icon: Calendar },
    { label: 'Clôture bancaire', date: project.date_cloture_bancaire, icon: Building },
    { label: 'Clôture juridique', date: project.date_cloture_juridique, icon: FileText },
  ].filter(m => m.date) : [];

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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Résumé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.description && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{project.description}</p>
                  </div>
                )}
                {project.typologie && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Typologie</p>
                    <Badge variant="outline">{project.typologie}</Badge>
                  </div>
                )}
                {project.actionnariat && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Actionnariat</p>
                    <Badge variant="outline">{project.actionnariat}</Badge>
                  </div>
                )}
                {project.regime_icpe && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Régime ICPE</p>
                    <Badge variant="outline">{project.regime_icpe}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Localisation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.adresse_site && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Adresse site</p>
                    <p className="text-sm">{project.adresse_site}</p>
                  </div>
                )}
                {project.pays_site && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pays site</p>
                    <p className="text-sm">{project.pays_site}</p>
                  </div>
                )}
                {project.region && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Région</p>
                    <p className="text-sm">{project.region}</p>
                  </div>
                )}
                {project.departement && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Département</p>
                    <p className="text-sm">{project.departement}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Company Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Société
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.adresse_societe && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Adresse société</p>
                    <p className="text-sm">{project.adresse_societe}</p>
                  </div>
                )}
                {project.pays && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pays</p>
                    <p className="text-sm">{project.pays}</p>
                  </div>
                )}
                {project.siret && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">SIRET</p>
                    <p className="text-sm font-mono">{project.siret}</p>
                  </div>
                )}
                {project.code_divalto && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Code Divalto</p>
                    <p className="text-sm font-mono">{project.code_divalto}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Indicateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Skeleton className="h-24" />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalTasks}</p>
                      <p className="text-xs text-muted-foreground">Tâches total</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.openTasks}</p>
                      <p className="text-xs text-muted-foreground">En cours</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.doneTasks}</p>
                      <p className="text-xs text-muted-foreground">Terminées</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.overdueTasks}</p>
                      <p className="text-xs text-muted-foreground">En retard</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">{stats.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${stats.progress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Milestones Card */}
          {milestones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Jalons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {milestones.map((milestone, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <milestone.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{milestone.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(milestone.date!), 'dd MMMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune activité récente
                </p>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {activity.author_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {activity.author_name}
                            </span>
                            {activity.type === 'comment' && (
                              <Badge variant="outline" className="text-xs">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {activity.entity_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {activity.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
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
