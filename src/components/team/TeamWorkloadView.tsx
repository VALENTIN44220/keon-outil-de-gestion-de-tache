import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTeamWorkload, MemberWorkload } from '@/hooks/useTeamWorkload';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Loader2,
  ListTodo,
  Target,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const getInitials = (name: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

interface WorkloadCardProps {
  member: MemberWorkload;
}

function WorkloadCard({ member }: WorkloadCardProps) {
  const getWorkloadStatus = (percent: number) => {
    if (percent <= 50) return { label: 'Faible', color: 'text-emerald-600', bg: 'bg-emerald-500' };
    if (percent <= 80) return { label: 'Optimal', color: 'text-blue-600', bg: 'bg-blue-500' };
    if (percent <= 100) return { label: 'Élevé', color: 'text-amber-600', bg: 'bg-amber-500' };
    return { label: 'Surchargé', color: 'text-destructive', bg: 'bg-destructive' };
  };

  const status = getWorkloadStatus(member.workloadPercent);

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      member.workloadPercent > 100 && "border-destructive/50"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={member.avatarUrl || undefined} />
            <AvatarFallback className="text-sm font-medium bg-primary/10">
              {getInitials(member.memberName)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium truncate">{member.memberName}</h4>
                <p className="text-sm text-muted-foreground truncate">
                  {member.jobTitle || 'Poste non défini'}
                </p>
              </div>
              <Badge variant={member.workloadPercent > 100 ? 'destructive' : 'secondary'} className={status.color}>
                {status.label}
              </Badge>
            </div>

            {/* Workload progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Charge de travail</span>
                <span className={cn("font-medium", status.color)}>{member.workloadPercent}%</span>
              </div>
              <Progress 
                value={Math.min(member.workloadPercent, 100)} 
                className={cn("h-2", member.workloadPercent > 100 && "[&>div]:bg-destructive")}
              />
            </div>

            {/* Checklist progress */}
            {member.totalTasks > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progression checklist</span>
                  <span className="font-medium">{member.checklistProgress}%</span>
                </div>
                <Progress value={member.checklistProgress} className="h-1.5" />
              </div>
            )}

            {/* Task breakdown */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{member.todoTasks}</p>
                <p className="text-[10px] text-muted-foreground">À faire</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-500/10">
                <p className="text-lg font-bold text-blue-600">{member.inProgressTasks}</p>
                <p className="text-[10px] text-muted-foreground">En cours</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-emerald-500/10">
                <p className="text-lg font-bold text-emerald-600">{member.doneTasks}</p>
                <p className="text-[10px] text-muted-foreground">Terminées</p>
              </div>
              <div className={cn(
                "text-center p-2 rounded-lg",
                member.overdueTasks > 0 ? "bg-destructive/10" : "bg-muted/50"
              )}>
                <p className={cn(
                  "text-lg font-bold",
                  member.overdueTasks > 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {member.overdueTasks}
                </p>
                <p className="text-[10px] text-muted-foreground">En retard</p>
              </div>
            </div>

            {/* Alerts */}
            {(member.overdueTasks > 0 || member.tasksDueThisWeek > 0) && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                {member.overdueTasks > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {member.overdueTasks} en retard
                  </span>
                )}
                {member.tasksDueThisWeek > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Clock className="h-3 w-3" />
                    {member.tasksDueThisWeek} cette semaine
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TeamWorkloadView() {
  const { workloads, stats, isLoading } = useTeamWorkload();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.teamSize}</p>
                  <p className="text-xs text-muted-foreground">Membres</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <ListTodo className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalTasks}</p>
                  <p className="text-xs text-muted-foreground">Tâches totales</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgWorkload}%</p>
                  <p className="text-xs text-muted-foreground">Charge moyenne</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn(stats.overloadedMembers > 0 && "border-destructive/50")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  stats.overloadedMembers > 0 ? "bg-destructive/10" : "bg-emerald-500/10"
                )}>
                  {stats.overloadedMembers > 0 
                    ? <AlertTriangle className="h-5 w-5 text-destructive" />
                    : <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  }
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.overloadedMembers}</p>
                  <p className="text-xs text-muted-foreground">Surchargés</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workload cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Charge de travail par collaborateur
          </CardTitle>
          <CardDescription>
            Vue détaillée de la charge et de l'avancement de chaque membre de l'équipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workloads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun membre d'équipe trouvé</p>
              <p className="text-sm">Les collaborateurs rattachés à vous apparaîtront ici</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workloads
                .sort((a, b) => b.workloadPercent - a.workloadPercent)
                .map((member) => (
                  <WorkloadCard key={member.memberId} member={member} />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
