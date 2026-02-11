import { useState, useMemo, useRef, useCallback } from 'react';
import { Task } from '@/types/task';
import { BEProject } from '@/types/beProject';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  ChevronDown, 
  ChevronRight, 
  Diamond,
  User
} from 'lucide-react';
import { 
  format, 
  addDays, 
  subDays, 
  differenceInDays, 
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWeekend,
  isSameDay,
  getWeek,
  differenceInMonths
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ZoomLevel = 'week' | 'month' | 'quarter' | 'year';
type PeriodMode = 'all' | 'current_year' | 'custom';

interface Milestone {
  label: string;
  date: string;
  color: string;
}

interface BEProjectGanttProps {
  tasks: Task[];
  project: BEProject;
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  periodMode: PeriodMode;
  onPeriodModeChange: (mode: PeriodMode) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
  searchQuery?: string;
  statusFilter?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'À faire', color: 'bg-slate-500', bgColor: 'bg-slate-100' },
  'to_assign': { label: 'À assigner', color: 'bg-orange-500', bgColor: 'bg-orange-100' },
  'in-progress': { label: 'En cours', color: 'bg-blue-500', bgColor: 'bg-blue-100' },
  done: { label: 'Terminé', color: 'bg-emerald-500', bgColor: 'bg-emerald-100' },
  validated: { label: 'Validé', color: 'bg-green-600', bgColor: 'bg-green-100' },
  cancelled: { label: 'Annulé', color: 'bg-gray-400', bgColor: 'bg-gray-100' },
  'pending_validation_1': { label: 'En validation', color: 'bg-amber-500', bgColor: 'bg-amber-100' },
  'pending_validation_2': { label: 'En validation', color: 'bg-amber-500', bgColor: 'bg-amber-100' },
  refused: { label: 'Refusé', color: 'bg-red-500', bgColor: 'bg-red-100' },
};

export function BEProjectGantt({ 
  tasks, 
  project, 
  zoom, 
  onZoomChange,
  periodMode,
  onPeriodModeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  searchQuery = '',
  statusFilter = 'all'
}: BEProjectGanttProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Milestones from project
  const milestones = useMemo<Milestone[]>(() => {
    return [
      { label: 'OS Étude', date: project.date_os_etude || '', color: 'text-purple-500' },
      { label: 'OS Travaux', date: project.date_os_travaux || '', color: 'text-blue-500' },
      { label: 'Clôture bancaire', date: project.date_cloture_bancaire || '', color: 'text-green-500' },
      { label: 'Clôture juridique', date: project.date_cloture_juridique || '', color: 'text-amber-500' },
    ].filter(m => m.date);
  }, [project]);

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

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    
    filteredTasks.forEach(task => {
      const status = task.status || 'todo';
      if (!groups[status]) groups[status] = [];
      groups[status].push(task);
    });

    // Sort groups by status order
    const statusOrder = ['in-progress', 'todo', 'to_assign', 'pending_validation_1', 'pending_validation_2', 'done', 'validated', 'refused', 'cancelled'];
    const sortedGroups: { status: string; tasks: Task[] }[] = [];
    
    statusOrder.forEach(status => {
      if (groups[status]?.length) {
        sortedGroups.push({ status, tasks: groups[status] });
      }
    });

    return sortedGroups;
  }, [filteredTasks]);

  // Calculate date range based on period mode
  const dateRange = useMemo(() => {
    const today = new Date();

    if (periodMode === 'current_year') {
      return {
        start: startOfYear(today),
        end: endOfYear(today),
      };
    }

    if (periodMode === 'custom' && customStart && customEnd) {
      try {
        return {
          start: new Date(customStart),
          end: new Date(customEnd),
        };
      } catch { /* fall through */ }
    }

    // 'all' mode: fit all tasks + milestones
    if (filteredTasks.length === 0) {
      return {
        start: subDays(startOfWeek(today, { locale: fr }), 7),
        end: addDays(endOfWeek(today, { locale: fr }), 30),
      };
    }

    const dates: Date[] = [today];
    filteredTasks.forEach(t => {
      if (t.created_at) dates.push(new Date(t.created_at));
      if (t.due_date) dates.push(new Date(t.due_date));
    });

    milestones.forEach(m => {
      if (m.date) dates.push(new Date(m.date));
    });

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    return {
      start: subDays(startOfMonth(minDate), 7),
      end: addDays(endOfMonth(maxDate), 14),
    };
  }, [filteredTasks, milestones, periodMode, customStart, customEnd]);

  // Generate timeline units
  const timelineData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const weeks = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end }, { locale: fr });
    
    // Generate months
    const months: { date: Date; days: number }[] = [];
    let currentMonth = new Date(dateRange.start);
    currentMonth.setDate(1);

    while (currentMonth <= dateRange.end) {
      const monthStart = new Date(Math.max(currentMonth.getTime(), dateRange.start.getTime()));
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const actualEnd = new Date(Math.min(monthEnd.getTime(), dateRange.end.getTime()));
      
      const daysInRange = differenceInDays(actualEnd, monthStart) + 1;
      
      if (daysInRange > 0) {
        months.push({ date: new Date(currentMonth), days: daysInRange });
      }
      
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    return { days, weeks, months };
  }, [dateRange]);

  // Day width based on zoom (for year view we use month-based width calculated differently)
  const dayWidth = useMemo(() => {
    switch (zoom) {
      case 'week': return 48;
      case 'month': return 24;
      case 'quarter': return 8;
      case 'year': return 4; // narrow per-day, months will span ~120px
      default: return 24;
    }
  }, [zoom]);

  // For year view: generate months array for the header
  const yearMonths = useMemo(() => {
    if (zoom !== 'year') return [];
    return eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [zoom, dateRange]);

  const toggleGroup = useCallback((status: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const today = new Date();
  const todayIndex = differenceInDays(today, dateRange.start);
  const leftPanelWidth = 400;

  return (
    <TooltipProvider>
      <div className="border rounded-xl bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold">
              Timeline ({filteredTasks.length} tâche{filteredTasks.length > 1 ? 's' : ''})
            </h3>
            {milestones.length > 0 && (
              <div className="flex items-center gap-3 ml-4">
                {milestones.map((m, idx) => (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-default">
                        <Diamond className={cn('h-3 w-3', m.color)} fill="currentColor" />
                        <span className="text-xs text-muted-foreground">{m.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(m.date), 'dd MMMM yyyy', { locale: fr })}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>

          {/* Period + Zoom Controls */}
          <div className="flex items-center gap-3">
            {/* Period selector */}
            <Select value={periodMode} onValueChange={(v) => onPeriodModeChange(v as PeriodMode)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout afficher</SelectItem>
                <SelectItem value="current_year">Année en cours</SelectItem>
                <SelectItem value="custom">Période</SelectItem>
              </SelectContent>
            </Select>

            {periodMode === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStart || ''}
                  onChange={(e) => onCustomStartChange?.(e.target.value)}
                  className="h-8 w-[140px] text-xs"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <Input
                  type="date"
                  value={customEnd || ''}
                  onChange={(e) => onCustomEndChange?.(e.target.value)}
                  className="h-8 w-[140px] text-xs"
                />
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              {(['week', 'month', 'quarter', 'year'] as ZoomLevel[]).map(level => (
                <Button
                  key={level}
                  variant={zoom === level ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-7 px-3 text-xs',
                    zoom === level && 'shadow-sm'
                  )}
                  onClick={() => onZoomChange(level)}
                >
                  {level === 'week' ? 'Semaine' : level === 'month' ? 'Mois' : level === 'quarter' ? 'Trimestre' : 'Année'}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Gantt Grid */}
        <div className="flex overflow-hidden">
          {/* Left Panel - Tasks List */}
          <div 
            className="flex-shrink-0 border-r bg-card z-10"
            style={{ width: leftPanelWidth }}
          >
            {/* Left Header */}
            <div className="h-14 border-b bg-muted/50 grid grid-cols-[1fr,80px,80px,60px] gap-2 px-3 items-center text-xs font-medium text-muted-foreground">
              <span>Tâche</span>
              <span>Statut</span>
              <span>Échéance</span>
              <span>Resp.</span>
            </div>

            {/* Tasks */}
            <ScrollArea className="h-[calc(100vh-380px)]">
              {groupedTasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Aucune tâche à afficher
                </div>
              ) : (
                groupedTasks.map(group => {
                  const config = statusConfig[group.status] || statusConfig.todo;
                  const isCollapsed = collapsedGroups.has(group.status);

                  return (
                    <Collapsible key={group.status} open={!isCollapsed}>
                      {/* Group Header */}
                      <CollapsibleTrigger asChild>
                        <button
                          onClick={() => toggleGroup(group.status)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 border-b text-sm font-medium transition-colors"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          <div className={cn('w-2 h-2 rounded-full', config.color)} />
                          <span>{config.label}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {group.tasks.length}
                          </Badge>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        {group.tasks.map(task => {
                          const taskWithAssignee = task as any;
                          const assignee = taskWithAssignee.assignee;
                          
                          return (
                            <div 
                              key={task.id} 
                              className="h-10 grid grid-cols-[1fr,80px,80px,60px] gap-2 px-3 items-center border-b hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {task.task_number && (
                                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                                    {task.task_number}
                                  </span>
                                )}
                                <span className="text-sm truncate" title={task.title}>
                                  {task.title}
                                </span>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={cn('text-[10px] px-1.5 py-0', config.bgColor)}
                              >
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {task.due_date 
                                  ? format(new Date(task.due_date), 'dd/MM/yy')
                                  : '-'
                                }
                              </span>
                              <div className="flex justify-center">
                                {assignee?.display_name ? (
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-[10px] bg-primary/10">
                                      {assignee.display_name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <User className="h-4 w-4 text-muted-foreground/50" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Right Panel - Timeline */}
          <ScrollArea className="flex-1" ref={scrollContainerRef}>
            <div className="min-w-max">
              {/* Timeline Header */}
              <div className="h-14 border-b bg-muted/50 sticky top-0 z-10">
                {zoom === 'year' ? (
                  <>
                    {/* Year Row */}
                    <div className="h-7 flex border-b">
                      <div
                        className="flex items-center justify-center text-xs font-medium border-r bg-muted/30"
                        style={{ width: timelineData.days.length * dayWidth }}
                      >
                        {format(dateRange.start, 'yyyy')}
                        {format(dateRange.start, 'yyyy') !== format(dateRange.end, 'yyyy') && 
                          ` – ${format(dateRange.end, 'yyyy')}`}
                      </div>
                    </div>
                    {/* Month columns */}
                    <div className="h-7 flex">
                      {yearMonths.map((monthDate, idx) => {
                        const mStart = new Date(Math.max(monthDate.getTime(), dateRange.start.getTime()));
                        const mEnd = endOfMonth(monthDate);
                        const actualEnd = new Date(Math.min(mEnd.getTime(), dateRange.end.getTime()));
                        const daysInMonth = differenceInDays(actualEnd, mStart) + 1;
                        if (daysInMonth <= 0) return null;
                        const isCurrent = isSameDay(startOfMonth(today), startOfMonth(monthDate));
                        return (
                          <div
                            key={idx}
                            className={cn(
                              'flex items-center justify-center text-[10px] font-medium border-r capitalize',
                              isCurrent && 'bg-primary/10 text-primary font-bold'
                            )}
                            style={{ width: daysInMonth * dayWidth }}
                          >
                            {format(monthDate, 'MMM', { locale: fr })}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Months Row */}
                    <div className="h-7 flex border-b">
                      {timelineData.months.map((month, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-center text-xs font-medium border-r bg-muted/30"
                          style={{ width: month.days * dayWidth }}
                        >
                          {format(month.date, 'MMMM yyyy', { locale: fr })}
                        </div>
                      ))}
                    </div>
                    
                    {/* Days/Weeks Row */}
                    <div className="h-7 flex">
                      {timelineData.days.map((day, idx) => {
                        const isToday = isSameDay(day, today);
                        const isWeekendDay = isWeekend(day);
                        const showLabel = zoom === 'week' || (zoom === 'month' && day.getDate() % 2 === 1);
                        const isFirstOfWeek = day.getDay() === 1;
                        const isQuarterView = zoom === 'quarter';

                        return (
                          <div
                            key={idx}
                            className={cn(
                              'flex items-center justify-center text-[10px] border-r',
                              isToday && 'bg-primary/10 font-bold text-primary',
                              isWeekendDay && !isToday && 'bg-muted/50',
                              isFirstOfWeek && zoom !== 'week' && 'border-l-2 border-l-border'
                            )}
                            style={{ width: dayWidth }}
                          >
                            {showLabel && !isQuarterView && (
                              <span>{format(day, 'd')}</span>
                            )}
                            {isQuarterView && isFirstOfWeek && (
                              <span className="text-[9px]">S{getWeek(day)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Milestone Markers */}
              <div className="relative h-0">
                {milestones.map((m, idx) => {
                  const mDate = new Date(m.date);
                  const dayIndex = differenceInDays(mDate, dateRange.start);
                  if (dayIndex < 0 || dayIndex > timelineData.days.length) return null;

                  const left = dayIndex * dayWidth + dayWidth / 2;

                  return (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute top-0 flex flex-col items-center z-20 cursor-default"
                          style={{ left: left - 8 }}
                        >
                          <Diamond 
                            className={cn('h-4 w-4', m.color)} 
                            fill="currentColor"
                          />
                          <div 
                            className={cn('w-px', m.color.replace('text-', 'bg-'), 'opacity-50')}
                            style={{ height: 'calc(100vh - 380px + 56px)' }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="font-medium">{m.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(m.date), 'dd MMMM yyyy', { locale: fr })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Today Line */}
                {todayIndex >= 0 && todayIndex <= timelineData.days.length && (
                  <div
                    className="absolute top-0 w-0.5 bg-primary z-10"
                    style={{ 
                      left: todayIndex * dayWidth + dayWidth / 2,
                      height: 'calc(100vh - 380px + 56px)'
                    }}
                  />
                )}
              </div>

              {/* Task Bars */}
              <div className="relative">
                {groupedTasks.map(group => {
                  const isCollapsed = collapsedGroups.has(group.status);
                  
                  return (
                    <div key={group.status}>
                      {/* Group Header Space */}
                      <div className="h-[33px] border-b bg-muted/20" />

                      {/* Tasks */}
                      {!isCollapsed && group.tasks.map(task => {
                        const config = statusConfig[task.status] || statusConfig.todo;
                        const startDate = task.created_at ? new Date(task.created_at) : new Date();
                        const endDate = task.due_date ? new Date(task.due_date) : addDays(startDate, 3);
                        
                        const startIdx = Math.max(0, differenceInDays(startDate, dateRange.start));
                        const duration = Math.max(1, differenceInDays(endDate, startDate) + 1);
                        
                        const left = startIdx * dayWidth + 2;
                        const width = Math.max(duration * dayWidth - 4, 20);

                        return (
                          <div key={task.id} className="h-10 relative border-b">
                            {/* Weekend backgrounds */}
                            {timelineData.days.map((day, idx) => (
                              isWeekend(day) && (
                                <div
                                  key={idx}
                                  className="absolute top-0 h-full bg-muted/30"
                                  style={{ left: idx * dayWidth, width: dayWidth }}
                                />
                              )
                            ))}

                            {/* Task Bar */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'absolute top-1.5 h-7 rounded-full flex items-center px-3 cursor-default',
                                    'shadow-sm transition-all hover:shadow-md hover:scale-[1.02]',
                                    config.color, 'text-white text-xs font-medium'
                                  )}
                                  style={{ left, width }}
                                >
                                  {width > 80 && (
                                    <span className="truncate">
                                      {task.task_number ? `${task.task_number} - ` : ''}
                                      {task.title}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-[10px]">
                                    {config.label}
                                  </Badge>
                                  <span>
                                    {format(startDate, 'dd/MM')} → {format(endDate, 'dd/MM/yyyy')}
                                  </span>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </TooltipProvider>
  );
}
