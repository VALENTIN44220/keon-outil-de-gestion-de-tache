import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats, useITProjectMilestones } from '@/hooks/useITProjectHub';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Milestone, ListTodo } from 'lucide-react';
import { format, differenceInDays, min, max, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TimelineItem {
  id: string;
  label: string;
  start: Date;
  end: Date;
  type: 'milestone' | 'task';
  status: string;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  'a_venir': 'bg-slate-400',
  'en_cours': 'bg-blue-500',
  'termine': 'bg-emerald-500',
  'retarde': 'bg-red-500',
  'todo': 'bg-slate-400',
  'in-progress': 'bg-blue-500',
  'done': 'bg-emerald-500',
  'validated': 'bg-green-500',
  'cancelled': 'bg-gray-400',
};

export default function ITProjectHubTimeline() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const { data: milestones = [] } = useITProjectMilestones(project?.id);
  const stats = useITProjectStats(tasks, project);

  const timelineItems = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [];

    for (const m of milestones) {
      if (!m.date_prevue) continue;
      const d = new Date(m.date_prevue);
      items.push({
        id: m.id,
        label: m.titre,
        start: d,
        end: m.date_reelle ? new Date(m.date_reelle) : d,
        type: 'milestone',
        status: m.statut,
        color: STATUS_COLORS[m.statut] || 'bg-slate-400',
      });
    }

    for (const t of tasks) {
      const s = t.start_date ? new Date(t.start_date) : t.due_date ? new Date(t.due_date) : null;
      const e = t.due_date ? new Date(t.due_date) : s;
      if (!s || !e) continue;
      items.push({
        id: t.id,
        label: t.title,
        start: s,
        end: e,
        type: 'task',
        status: t.status,
        color: STATUS_COLORS[t.status] || 'bg-slate-400',
      });
    }

    items.sort((a, b) => a.start.getTime() - b.start.getTime());
    return items;
  }, [milestones, tasks]);

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (timelineItems.length === 0) {
      const now = new Date();
      return { rangeStart: now, rangeEnd: addDays(now, 30), totalDays: 30 };
    }
    const allDates = timelineItems.flatMap(i => [i.start, i.end]);
    const rStart = addDays(min(allDates), -7);
    const rEnd = addDays(max(allDates), 14);
    const total = Math.max(differenceInDays(rEnd, rStart), 30);
    return { rangeStart: rStart, rangeEnd: rEnd, totalDays: total };
  }, [timelineItems]);

  const getPosition = (date: Date) => {
    const days = differenceInDays(date, rangeStart);
    return Math.max(0, Math.min(100, (days / totalDays) * 100));
  };

  // Generate month markers
  const monthMarkers = useMemo(() => {
    const markers: { label: string; position: number }[] = [];
    const d = new Date(rangeStart);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    while (d <= rangeEnd) {
      markers.push({
        label: format(d, 'MMM yyyy', { locale: fr }),
        position: getPosition(d),
      });
      d.setMonth(d.getMonth() + 1);
    }
    return markers;
  }, [rangeStart, rangeEnd, totalDays]);

  if (isLoading || !project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Milestone className="h-3.5 w-3.5" /> Jalons</div>
            <div className="flex items-center gap-1.5"><ListTodo className="h-3.5 w-3.5" /> Tâches</div>
            <span className="ml-4">|</span>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400" /> À venir</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> En cours</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Terminé</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> Retardé</div>
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Planning
                <Badge variant="secondary" className="ml-2">{timelineItems.length} éléments</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timelineItems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted inline-block mb-4">
                    <Calendar className="h-8 w-8 opacity-50" />
                  </div>
                  <p className="font-medium">Aucun élément planifié</p>
                  <p className="text-sm mt-1">
                    Ajoutez des jalons ou des tâches avec des dates pour les voir ici
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Month axis */}
                  <div className="relative h-8 border-b mb-2">
                    {monthMarkers.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 text-[10px] font-medium text-muted-foreground"
                        style={{ left: `${m.position}%` }}
                      >
                        <div className="border-l border-border h-full absolute top-0" />
                        <span className="pl-1">{m.label}</span>
                      </div>
                    ))}
                    {/* Today marker */}
                    <div
                      className="absolute top-0 h-full w-px bg-red-500 z-10"
                      style={{ left: `${getPosition(new Date())}%` }}
                    >
                      <span className="absolute -top-0 left-1 text-[9px] text-red-500 font-medium">Aujourd'hui</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-1.5">
                    {timelineItems.map((item) => {
                      const leftPct = getPosition(item.start);
                      const widthPct = Math.max(
                        item.type === 'milestone' ? 0.5 : 1,
                        getPosition(item.end) - leftPct
                      );

                      return (
                        <div key={item.id} className="flex items-center gap-2 h-8">
                          <div className="w-[180px] shrink-0 truncate text-xs font-medium pr-2 text-right" title={item.label}>
                            {item.type === 'milestone' ? '◆ ' : ''}{item.label}
                          </div>
                          <div className="flex-1 relative h-full">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'absolute top-1 h-6 rounded-md transition-opacity hover:opacity-80 cursor-default',
                                    item.color,
                                    item.type === 'milestone' ? 'rounded-full' : ''
                                  )}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    minWidth: item.type === 'milestone' ? '10px' : '16px',
                                  }}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{item.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(item.start, 'dd/MM/yyyy', { locale: fr })}
                                  {item.start.getTime() !== item.end.getTime() && ` → ${format(item.end, 'dd/MM/yyyy', { locale: fr })}`}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
