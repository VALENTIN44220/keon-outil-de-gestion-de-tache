import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { useBEProjectByCode, useBEProjectTasks } from '@/hooks/useBEProjectHub';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Search, ZoomIn, ZoomOut, Flag } from 'lucide-react';
import { format, addDays, subDays, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ZoomLevel = 'week' | 'month' | 'quarter';

const statusColors: Record<string, string> = {
  todo: 'bg-slate-400',
  'to_assign': 'bg-orange-400',
  'in-progress': 'bg-blue-500',
  done: 'bg-green-500',
  validated: 'bg-emerald-500',
  cancelled: 'bg-gray-400',
  'pending_validation_1': 'bg-amber-500',
  'pending_validation_2': 'bg-amber-500',
  refused: 'bg-red-500',
};

export default function BEProjectHubTimeline() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: tasks = [], isLoading: tasksLoading } = useBEProjectTasks(project?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoom, setZoom] = useState<ZoomLevel>('month');

  // Calculate date range
  const dateRange = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        start: subDays(today, 14),
        end: addDays(today, 30),
      };
    }

    const dates: Date[] = [];
    tasks.forEach(t => {
      if (t.created_at) dates.push(new Date(t.created_at));
      if (t.due_date) dates.push(new Date(t.due_date));
    });

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    return {
      start: subDays(startOfMonth(minDate), 7),
      end: addDays(endOfMonth(maxDate), 7),
    };
  }, [tasks]);

  // Generate days array
  const days = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (searchQuery && !t.title?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, statusFilter]);

  // Milestones from project
  const milestones = useMemo(() => {
    if (!project) return [];
    return [
      { label: 'OS Étude', date: project.date_os_etude, color: 'bg-purple-500' },
      { label: 'OS Travaux', date: project.date_os_travaux, color: 'bg-blue-500' },
      { label: 'Clôture bancaire', date: project.date_cloture_bancaire, color: 'bg-green-500' },
      { label: 'Clôture juridique', date: project.date_cloture_juridique, color: 'bg-amber-500' },
    ].filter(m => m.date);
  }, [project]);

  // Calculate day width based on zoom
  const dayWidth = zoom === 'week' ? 40 : zoom === 'month' ? 20 : 8;

  if (projectLoading || tasksLoading) {
    return (
      <BEProjectHubLayout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </BEProjectHubLayout>
    );
  }

  return (
    <BEProjectHubLayout>
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
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

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setZoom(z => z === 'week' ? 'month' : z === 'month' ? 'quarter' : 'quarter')}
                  disabled={zoom === 'quarter'}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setZoom(z => z === 'quarter' ? 'month' : z === 'month' ? 'week' : 'week')}
                  disabled={zoom === 'week'}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Badge variant="outline" className="ml-2">
                  {zoom === 'week' ? 'Semaine' : zoom === 'month' ? 'Mois' : 'Trimestre'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestones Legend */}
        {milestones.length > 0 && (
          <div className="flex items-center gap-4 flex-wrap">
            {milestones.map((m, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Flag className={cn('h-4 w-4', m.color.replace('bg-', 'text-'))} />
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <span className="text-xs text-muted-foreground">
                  ({format(new Date(m.date!), 'dd/MM/yy')})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>
              Timeline ({filteredTasks.length} tâche{filteredTasks.length > 1 ? 's' : ''})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-max">
                {/* Header - Days */}
                <div className="sticky top-0 z-10 bg-background border-b flex">
                  <div className="w-64 flex-shrink-0 p-2 border-r bg-muted/50 font-medium text-sm">
                    Tâche
                  </div>
                  <div className="flex">
                    {days.map((day, idx) => {
                      const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      const isFirstOfMonth = day.getDate() === 1;
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            'flex-shrink-0 text-center border-r text-xs',
                            isToday && 'bg-primary/10',
                            isWeekend && 'bg-muted/30',
                            isFirstOfMonth && 'border-l-2 border-l-primary'
                          )}
                          style={{ width: dayWidth }}
                        >
                          {(isFirstOfMonth || zoom === 'week') && (
                            <div className="text-[10px] text-muted-foreground truncate px-0.5">
                              {isFirstOfMonth 
                                ? format(day, 'MMM', { locale: fr })
                                : format(day, 'd')
                              }
                            </div>
                          )}
                          {zoom !== 'quarter' && (
                            <div className={cn('font-medium', isToday && 'text-primary')}>
                              {format(day, 'd')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Milestone Lines */}
                <div className="relative h-0">
                  {milestones.map((m, idx) => {
                    const mDate = new Date(m.date!);
                    const dayIndex = days.findIndex(d => 
                      format(d, 'yyyy-MM-dd') === format(mDate, 'yyyy-MM-dd')
                    );
                    if (dayIndex === -1) return null;

                    const left = 256 + (dayIndex * dayWidth) + (dayWidth / 2);

                    return (
                      <div
                        key={idx}
                        className={cn('absolute top-0 w-0.5 z-5', m.color)}
                        style={{ 
                          left: `${left}px`,
                          height: `${(filteredTasks.length + 1) * 48}px`
                        }}
                      />
                    );
                  })}
                </div>

                {/* Task Rows */}
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Aucune tâche à afficher
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const startDate = task.created_at ? new Date(task.created_at) : new Date();
                    const endDate = task.due_date ? new Date(task.due_date) : addDays(startDate, 2);
                    
                    const startIdx = Math.max(0, differenceInDays(startDate, dateRange.start));
                    const duration = Math.max(1, differenceInDays(endDate, startDate) + 1);
                    
                    const left = startIdx * dayWidth;
                    const width = duration * dayWidth - 4;

                    return (
                      <div key={task.id} className="flex border-b hover:bg-muted/30">
                        <div className="w-64 flex-shrink-0 p-2 border-r truncate">
                          <div className="flex items-center gap-2">
                            {task.task_number && (
                              <Badge variant="outline" className="text-xs font-mono">
                                {task.task_number}
                              </Badge>
                            )}
                            <span className="text-sm truncate" title={task.title}>
                              {task.title}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 relative h-12">
                          <div
                            className={cn(
                              'absolute top-2 h-8 rounded text-xs text-white flex items-center px-2 truncate shadow-sm',
                              statusColors[task.status] || 'bg-slate-400'
                            )}
                            style={{ left, width: Math.max(width, 20) }}
                            title={`${task.title} (${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')})`}
                          >
                            {width > 60 && (
                              <span className="truncate">{task.title}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </BEProjectHubLayout>
  );
}
