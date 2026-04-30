import { useState } from 'react';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { useBEProjectByCode, useBEProjectTasks } from '@/hooks/useBEProjectHub';
import { useBEProjectHubCode } from '@/hooks/useBEProjectHubCode';
import { BEProjectGantt } from '@/components/be/gantt/BEProjectGantt';
import { BEAffairesTimeline } from '@/components/be/timeline/BEAffairesTimeline';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Layers, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

type ZoomLevelTasks = 'week' | 'month' | 'quarter' | 'year';
type ZoomLevelAffaires = 'month' | 'quarter' | 'year';
type PeriodMode = 'all' | 'current_year' | 'custom';
type TimelineMode = 'affaires' | 'tasks';

export default function BEProjectHubTimeline() {
  const code = useBEProjectHubCode();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: tasks = [], isLoading: tasksLoading } = useBEProjectTasks(project?.id);

  const [mode, setMode] = useState<TimelineMode>('affaires');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoomTasks, setZoomTasks] = useState<ZoomLevelTasks>('month');
  const [zoomAffaires, setZoomAffaires] = useState<ZoomLevelAffaires>('month');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  if (projectLoading || tasksLoading) {
    return (
      <BEProjectHubLayout>
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </BEProjectHubLayout>
    );
  }

  if (!project) {
    return (
      <BEProjectHubLayout>
        <div className="text-center py-12 text-muted-foreground">Projet non trouvé</div>
      </BEProjectHubLayout>
    );
  }

  return (
    <BEProjectHubLayout>
      <div className="space-y-4">
        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Mode toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                <Button
                  variant={mode === 'affaires' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('h-8 px-3 gap-1.5', mode === 'affaires' && 'shadow-sm')}
                  onClick={() => setMode('affaires')}
                >
                  <Layers className="h-4 w-4" />
                  Affaires
                </Button>
                <Button
                  variant={mode === 'tasks' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn('h-8 px-3 gap-1.5', mode === 'tasks' && 'shadow-sm')}
                  onClick={() => setMode('tasks')}
                >
                  <ListTodo className="h-4 w-4" />
                  Tâches
                </Button>
              </div>

              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    mode === 'affaires'
                      ? 'Rechercher une affaire (code, libellé)…'
                      : 'Rechercher une tâche…'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {mode === 'tasks' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="todo">À faire</SelectItem>
                    <SelectItem value="in-progress">En cours</SelectItem>
                    <SelectItem value="done">Terminé</SelectItem>
                    <SelectItem value="validated">Validé</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {mode === 'affaires' ? (
          <BEAffairesTimeline
            projectId={project.id}
            zoom={zoomAffaires}
            onZoomChange={setZoomAffaires}
            periodMode={periodMode}
            onPeriodModeChange={setPeriodMode}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            searchQuery={searchQuery}
          />
        ) : (
          <BEProjectGantt
            tasks={tasks}
            project={project}
            zoom={zoomTasks}
            onZoomChange={setZoomTasks}
            periodMode={periodMode}
            onPeriodModeChange={setPeriodMode}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
          />
        )}
      </div>
    </BEProjectHubLayout>
  );
}
