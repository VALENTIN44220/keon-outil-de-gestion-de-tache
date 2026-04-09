import { useMemo, useState } from 'react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats, useITProjectMilestones } from '@/hooks/useITProjectHub';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Milestone, ListTodo, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, differenceInDays, min, max, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ITMilestoneDialog } from '@/components/it/ITMilestoneDialog';
import type { ITProjectMilestone, MilestoneStatus } from '@/types/itProject';

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

const MILESTONE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  'a_venir': { label: 'À venir', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  'en_cours': { label: 'En cours', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  'termine': { label: 'Terminé', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  'retarde': { label: 'Retardé', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const MILESTONE_STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: 'a_venir', label: 'À venir' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'retarde', label: 'Retardé' },
];

export default function ITProjectHubTimeline() {
  const code = useITProjectHubCode();
  const { data: project, isLoading } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const { data: milestones = [], addMilestone, updateMilestone, deleteMilestone } = useITProjectMilestones(project?.id);
  const stats = useITProjectStats(tasks, project);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ITProjectMilestone | null>(null);

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

  const handleSaveMilestone = async (data: any) => {
    try {
      if (editingMilestone) {
        await updateMilestone(editingMilestone.id, data);
        toast.success('Jalon mis à jour');
      } else {
        await addMilestone(data);
        toast.success('Jalon créé');
      }
    } catch (e: any) {
      toast.error('Erreur : ' + e.message);
      throw e;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMilestone(id);
      toast.success('Jalon supprimé');
    } catch (e: any) {
      toast.error('Erreur : ' + e.message);
    }
  };

  const handleInlineStatusChange = async (m: ITProjectMilestone, newStatus: MilestoneStatus) => {
    try {
      await updateMilestone(m.id, { statut: newStatus });
      toast.success('Statut mis à jour');
    } catch (e: any) {
      toast.error('Erreur : ' + e.message);
    }
  };

  if (isLoading || !project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  const nextOrdre = milestones.length > 0 ? Math.max(...milestones.map(m => m.ordre)) + 1 : 1;

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

          {/* Milestones Section */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Milestone className="h-5 w-5 text-muted-foreground" />
                  Jalons
                  <Badge variant="secondary" className="ml-2">{milestones.length}</Badge>
                </CardTitle>
                <Button size="sm" onClick={() => { setEditingMilestone(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Ajouter un jalon
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun jalon défini</p>
              ) : (
                <div className="space-y-2">
                  {milestones.map(m => {
                    const stConf = MILESTONE_STATUS_LABELS[m.statut] || { label: m.statut, className: '' };
                    return (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors group">
                        {/* Diamond icon */}
                        <span className="text-violet-500 text-lg flex-shrink-0">◆</span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.titre}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {m.phase && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {m.phase}
                              </span>
                            )}
                            {m.date_prevue && (
                              <span className="text-[11px] text-muted-foreground">
                                {format(new Date(m.date_prevue), 'dd MMM yyyy', { locale: fr })}
                              </span>
                            )}
                            {!m.date_prevue && (
                              <span className="text-[11px] text-muted-foreground italic">Pas de date</span>
                            )}
                          </div>
                        </div>

                        {/* Inline status select */}
                        <Select value={m.statut} onValueChange={v => handleInlineStatusChange(m, v as MilestoneStatus)}>
                          <SelectTrigger className="h-7 w-28 text-xs border-none bg-transparent">
                            <Badge className={cn(stConf.className, 'border text-[10px]')}>{stConf.label}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {MILESTONE_STATUSES.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingMilestone(m); setDialogOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce jalon ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Le jalon « {m.titre} » sera définitivement supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(m.id)}>Supprimer</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gantt Chart */}
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
                                {item.type === 'milestone' ? (
                                  <div
                                    className="absolute top-1 w-4 h-4 rotate-45 bg-violet-500 border-2 border-violet-300 cursor-default hover:opacity-80 transition-opacity"
                                    style={{ left: `${leftPct}%`, marginLeft: '-8px' }}
                                  />
                                ) : (
                                  <div
                                    className={cn(
                                      'absolute top-1 h-6 rounded-md transition-opacity hover:opacity-80 cursor-default',
                                      item.color,
                                    )}
                                    style={{
                                      left: `${leftPct}%`,
                                      width: `${widthPct}%`,
                                      minWidth: '16px',
                                    }}
                                  />
                                )}
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

        {/* Milestone Dialog */}
        {dialogOpen && (
          <ITMilestoneDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            projectId={project.id}
            milestone={editingMilestone}
            nextOrdre={nextOrdre}
            onSave={handleSaveMilestone}
          />
        )}
      </div>
    </Layout>
  );
}
