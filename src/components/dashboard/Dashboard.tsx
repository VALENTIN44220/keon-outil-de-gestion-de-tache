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
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid with colorful cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
        {/* Progress section - colorful modern style */}
        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-cyan-400 rounded-full" />
            Progression globale
          </h2>
          <div className="flex flex-col items-center">
            <ProgressRing progress={stats.completionRate} size={160} />
            <p className="text-sm text-muted-foreground mt-4 text-center">
              <span className="font-semibold text-foreground">{stats.done}</span> tâches terminées sur <span className="font-semibold text-foreground">{stats.total}</span>
            </p>
          </div>
          
          {/* Checklist progress - gradient style */}
          {globalStats && globalStats.total > 0 && (
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Sous-actions</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Avancement global</span>
                <span className="font-bold text-blue-600">{globalProgress}%</span>
              </div>
              <div className="h-3 bg-white dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${globalProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {globalStats.completed}/{globalStats.total} sous-actions terminées
              </p>
            </div>
          )}
          
          {/* Progress bars by status - colorful pills */}
          <div className="mt-6 space-y-4">
            {/* TODO */}
            <div className="group">
              <div className="flex justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-sm" />
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">À faire</span>
                </div>
                <span className="font-bold text-amber-600">{stats.todo}</span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${stats.total > 0 ? (stats.todo / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* IN PROGRESS */}
            <div className="group">
              <div className="flex justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 shadow-sm" />
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">En cours</span>
                </div>
                <span className="font-bold text-purple-600">{stats.inProgress}</span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-pink-400 to-purple-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* DONE */}
            <div className="group">
              <div className="flex justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 shadow-sm" />
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">Terminées</span>
                </div>
                <span className="font-bold text-emerald-600">{stats.done}</span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Urgent tasks - modern card style */}
        <div className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-6 bg-gradient-to-b from-red-500 to-orange-400 rounded-full" />
              Tâches prioritaires
            </h2>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-full">
              <TrendingUp className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400">Urgent</span>
            </div>
          </div>
          
          {urgentTasks.length > 0 ? (
            <div className="space-y-3">
              {urgentTasks.map((task, index) => (
                <div key={task.id} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <TaskCard 
                    task={task} 
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    taskProgress={progressMap?.[task.id]}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <p className="text-muted-foreground font-medium">
                Aucune tâche urgente en attente
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Vous êtes à jour ! 🎉
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
