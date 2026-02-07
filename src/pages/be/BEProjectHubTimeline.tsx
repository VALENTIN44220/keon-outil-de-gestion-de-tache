import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { useBEProjectByCode, useBEProjectTasks } from '@/hooks/useBEProjectHub';
import { BEProjectGantt } from '@/components/be/gantt/BEProjectGantt';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

type ZoomLevel = 'week' | 'month' | 'quarter';

export default function BEProjectHubTimeline() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: tasks = [], isLoading: tasksLoading } = useBEProjectTasks(project?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoom, setZoom] = useState<ZoomLevel>('month');

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
        <div className="text-center py-12 text-muted-foreground">
          Projet non trouvé
        </div>
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
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une tâche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
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
            </div>
          </CardContent>
        </Card>

        {/* Gantt Chart */}
        <BEProjectGantt
          tasks={tasks}
          project={project}
          zoom={zoom}
          onZoomChange={setZoom}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
        />
      </div>
    </BEProjectHubLayout>
  );
}
