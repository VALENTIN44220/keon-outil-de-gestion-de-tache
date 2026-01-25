import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ListTodo,
  ListChecks,
  UserPlus
} from 'lucide-react';
import { TaskStats } from '@/types/task';
import { StatsCard } from './StatsCard';
import { ProgressRing } from './ProgressRing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardStatsProps {
  stats: TaskStats;
  globalProgress?: number;
  globalStats?: { completed: number; total: number };
  unassignedCount?: number;
  onViewUnassigned?: () => void;
  collapsed?: boolean;
}

export function DashboardStats({ 
  stats, 
  globalProgress = 0, 
  globalStats,
  unassignedCount = 0, 
  onViewUnassigned,
  collapsed = false 
}: DashboardStatsProps) {
  if (collapsed) {
    // Compact horizontal stats bar
    return (
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-sm border border-keon-300 mb-4">
        {/* Progress ring mini */}
        <div className="flex items-center gap-2">
          <ProgressRing progress={stats.completionRate} size={40} strokeWidth={4} />
          <div className="text-xs">
            <span className="font-bold text-keon-900">{stats.completionRate}%</span>
            <span className="text-keon-500 ml-1">terminé</span>
          </div>
        </div>

        <div className="h-8 w-px bg-keon-300" />

        {/* Stats chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-keon-100 rounded-sm">
            <ListTodo className="h-3.5 w-3.5 text-keon-700" />
            <span className="text-xs font-medium text-keon-900">{stats.total}</span>
            <span className="text-xs text-keon-500">total</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 bg-keon-orange/10 rounded-sm">
            <AlertCircle className="h-3.5 w-3.5 text-keon-orange" />
            <span className="text-xs font-medium text-keon-orange">{stats.todo}</span>
            <span className="text-xs text-keon-500">à faire</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 bg-keon-blue/10 rounded-sm">
            <Clock className="h-3.5 w-3.5 text-keon-blue" />
            <span className="text-xs font-medium text-keon-blue">{stats.inProgress}</span>
            <span className="text-xs text-keon-500">en cours</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-1 bg-keon-green/10 rounded-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-keon-green" />
            <span className="text-xs font-medium text-keon-green">{stats.done}</span>
            <span className="text-xs text-keon-500">terminé</span>
          </div>
        </div>

        {/* Checklist progress */}
        {globalStats && globalStats.total > 0 && (
          <>
            <div className="h-8 w-px bg-keon-300 hidden md:block" />
            <div className="flex items-center gap-1.5 px-2 py-1 bg-keon-blue/10 rounded-sm">
              <ListChecks className="h-3.5 w-3.5 text-keon-blue" />
              <span className="text-xs font-medium text-keon-blue">{globalProgress}%</span>
              <span className="text-xs text-keon-500 hidden sm:inline">sous-actions</span>
            </div>
          </>
        )}

        {/* Unassigned alert */}
        {unassignedCount > 0 && onViewUnassigned && (
          <>
            <div className="flex-1" />
            <Button 
              onClick={onViewUnassigned} 
              variant="outline" 
              size="sm"
              className="h-7 text-xs gap-1.5 border-keon-orange text-keon-orange hover:bg-keon-orange/10"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {unassignedCount} à affecter
            </Button>
          </>
        )}
      </div>
    );
  }

  // Full stats view (original cards)
  return (
    <div className="space-y-4 mb-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          variant="success"
        />
      </div>

      {/* Unassigned alert */}
      {unassignedCount > 0 && onViewUnassigned && (
        <div className="bg-keon-orange/10 border border-keon-orange/30 rounded-sm p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="h-5 w-5 text-keon-orange" />
            <div>
              <p className="font-semibold text-keon-900 text-sm">{unassignedCount} tâche(s) à affecter</p>
              <p className="text-xs text-keon-700">Des demandes attendent d'être assignées</p>
            </div>
          </div>
          <Button onClick={onViewUnassigned} variant="outline" size="sm" className="h-8">
            Voir
          </Button>
        </div>
      )}
    </div>
  );
}
