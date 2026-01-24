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
        <div className="bg-keon-orange/10 border border-keon-orange/30 rounded-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="h-6 w-6 text-keon-orange" />
            <div>
              <p className="font-semibold text-keon-900">{unassignedCount} tâche(s) à affecter</p>
              <p className="text-sm text-keon-700">Des demandes attendent d'être assignées dans votre service</p>
            </div>
          </div>
          <Button onClick={onViewUnassigned} variant="outline">
            Voir les tâches
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress section - KEON style */}
        <div className="card-keon p-6">
          <h3 className="text-lg mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-keon-blue rounded-full" />
            Progression Globale
          </h3>
          <div className="flex flex-col items-center">
            <ProgressRing progress={stats.completionRate} size={160} />
            <p className="text-sm text-keon-700 mt-4 text-center">
              <span className="font-semibold text-keon-900">{stats.done}</span> tâches terminées sur <span className="font-semibold text-keon-900">{stats.total}</span>
            </p>
          </div>
          
          {/* Checklist progress - KEON style */}
          {globalStats && globalStats.total > 0 && (
            <div className="mt-6 p-4 bg-keon-blue/10 rounded-sm border border-keon-blue/30">
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="w-5 h-5 text-keon-blue" />
                <span className="text-sm font-semibold text-keon-900">Sous-actions</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-keon-700">Avancement global</span>
                <span className="font-bold text-keon-blue">{globalProgress}%</span>
              </div>
              <div className="h-2.5 bg-keon-100 rounded-sm overflow-hidden">
                <div 
                  className="h-full bg-keon-blue rounded-sm transition-all duration-700 ease-out"
                  style={{ width: `${globalProgress}%` }}
                />
              </div>
              <p className="text-xs text-keon-500 mt-2">
                {globalStats.completed}/{globalStats.total} sous-actions terminées
              </p>
            </div>
          )}
          
          {/* Progress bars by status - KEON style */}
          <div className="mt-6 space-y-4">
            {/* TODO */}
            <div className="group">
              <div className="flex justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-keon-orange" />
                  <span className="text-keon-700 group-hover:text-keon-900 transition-colors">À faire</span>
                </div>
                <span className="font-bold text-keon-orange">{stats.todo}</span>
              </div>
              <div className="h-2 bg-keon-100 rounded-sm overflow-hidden">
                <div 
                  className="h-full bg-keon-orange rounded-sm transition-all duration-700 ease-out"
                  style={{ width: `${stats.total > 0 ? (stats.todo / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* IN PROGRESS */}
            <div className="group">
              <div className="flex justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-keon-blue" />
                  <span className="text-keon-700 group-hover:text-keon-900 transition-colors">En cours</span>
                </div>
                <span className="font-bold text-keon-blue">{stats.inProgress}</span>
              </div>
              <div className="h-2 bg-keon-100 rounded-sm overflow-hidden">
                <div 
                  className="h-full bg-keon-blue rounded-sm transition-all duration-700 ease-out"
                  style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* DONE */}
            <div className="group">
              <div className="flex justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-keon-green" />
                  <span className="text-keon-700 group-hover:text-keon-900 transition-colors">Terminées</span>
                </div>
                <span className="font-bold text-keon-green">{stats.done}</span>
              </div>
              <div className="h-2 bg-keon-100 rounded-sm overflow-hidden">
                <div 
                  className="h-full bg-keon-green rounded-sm transition-all duration-700 ease-out"
                  style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Urgent tasks - KEON style */}
        <div className="lg:col-span-2 card-keon p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg flex items-center gap-2">
              <div className="w-1 h-5 bg-keon-terose rounded-full" />
              Tâches Prioritaires
            </h3>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-keon-terose/10 rounded-sm border border-keon-terose/30">
              <TrendingUp className="w-4 h-4 text-keon-terose" />
              <span className="text-xs font-medium text-keon-terose">Urgent</span>
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
              <div className="w-16 h-16 bg-keon-green/20 rounded-sm flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-keon-green" />
              </div>
              <p className="text-keon-700 font-medium">
                Aucune tâche urgente en attente
              </p>
              <p className="text-sm text-keon-500 mt-1">
                Vous êtes à jour ! 🎉
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
