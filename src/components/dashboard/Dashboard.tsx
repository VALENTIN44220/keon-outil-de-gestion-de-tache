import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  ListTodo,
  ListChecks,
  UserPlus
} from 'lucide-react';
import { TaskStats, Task } from '@/types/task';
import { StatsCard } from './StatsCard';
import { ProgressRing } from './ProgressRing';
import { TaskCard } from '../tasks/TaskCard';
import { TaskStatus } from '@/types/task';
import { Button } from '@/components/ui/button';

interface DashboardProps {
  stats: TaskStats;
  recentTasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  globalProgress?: number;
  globalStats?: { completed: number; total: number };
  progressMap?: Record<string, { completed: number; total: number; progress: number }>;
  unassignedCount?: number;
  onViewUnassigned?: () => void;
}

export function Dashboard({ stats, recentTasks, onStatusChange, onDelete, globalProgress = 0, globalStats, progressMap, unassignedCount = 0, onViewUnassigned }: DashboardProps) {
  const urgentTasks = recentTasks
    .filter(t => (t.priority === 'high' || t.priority === 'urgent') && t.status !== 'done')
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total des tâches"
          value={stats.total}
          icon={ListTodo}
          variant="primary"
        />
        <StatsCard
          title="À faire"
          value={stats.todo}
          icon={AlertCircle}
          trend={{ value: 5, positive: false }}
          variant="warning"
        />
        <StatsCard
          title="En cours"
          value={stats.inProgress}
          icon={Clock}
          variant="info"
        />
        <StatsCard
          title="Terminées"
          value={stats.done}
          icon={CheckCircle2}
          trend={{ value: 12, positive: true }}
          variant="success"
        />
      </div>

      {/* Unassigned tasks alert for managers */}
      {unassignedCount > 0 && onViewUnassigned && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="h-6 w-6 text-warning" />
            <div>
              <p className="font-semibold">{unassignedCount} tâche(s) à affecter</p>
              <p className="text-sm text-muted-foreground">Des demandes attendent d'être assignées dans votre service</p>
            </div>
          </div>
          <Button onClick={onViewUnassigned} variant="outline">
            Voir les tâches
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress section */}
        <div className="bg-card rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Progression globale
          </h2>
          <div className="flex flex-col items-center">
            <ProgressRing progress={stats.completionRate} size={140} />
            <p className="text-sm text-muted-foreground mt-4 text-center">
              {stats.done} tâches terminées sur {stats.total}
            </p>
          </div>
          
          {/* Checklist progress */}
          {globalStats && globalStats.total > 0 && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Sous-actions</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Avancement global</span>
                <span className="font-medium">{globalProgress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${globalProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {globalStats.completed}/{globalStats.total} sous-actions terminées
              </p>
            </div>
          )}
          
          {/* Progress bars by status */}
          <div className="mt-6 space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">À faire</span>
                <span className="font-medium">{stats.todo}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-warning rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.todo / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">En cours</span>
                <span className="font-medium">{stats.inProgress}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-info rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Terminées</span>
                <span className="font-medium">{stats.done}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Urgent tasks */}
        <div className="lg:col-span-2 bg-card rounded-xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Tâches prioritaires
            </h2>
            <TrendingUp className="w-5 h-5 text-destructive" />
          </div>
          
          {urgentTasks.length > 0 ? (
            <div className="space-y-3">
              {urgentTasks.map((task) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  taskProgress={progressMap?.[task.id]}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-success mb-3" />
              <p className="text-muted-foreground">
                Aucune tâche urgente en attente
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
