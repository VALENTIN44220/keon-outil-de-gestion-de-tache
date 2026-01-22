import { useMemo, useState } from 'react';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  GripVertical,
  Search,
  Calendar,
  Clock,
  AlertCircle,
  Package,
  ChevronDown,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BacklogPanelProps {
  tasks: Task[];
  plannedTaskIds: string[];
  onTaskDragStart: (e: React.DragEvent, task: Task) => void;
  getTaskDuration?: (taskId: string) => number | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return { 
        bg: 'bg-red-500/10', 
        border: 'border-red-500/30', 
        text: 'text-red-600',
        dot: 'bg-red-500',
        label: 'Urgent'
      };
    case 'high':
      return { 
        bg: 'bg-orange-500/10', 
        border: 'border-orange-500/30', 
        text: 'text-orange-600',
        dot: 'bg-orange-500',
        label: 'Haute'
      };
    case 'medium':
      return { 
        bg: 'bg-blue-500/10', 
        border: 'border-blue-500/30', 
        text: 'text-blue-600',
        dot: 'bg-blue-500',
        label: 'Moyenne'
      };
    case 'low':
      return { 
        bg: 'bg-emerald-500/10', 
        border: 'border-emerald-500/30', 
        text: 'text-emerald-600',
        dot: 'bg-emerald-500',
        label: 'Basse'
      };
    default:
      return { 
        bg: 'bg-slate-500/10', 
        border: 'border-slate-500/30', 
        text: 'text-slate-600',
        dot: 'bg-slate-400',
        label: 'Normal'
      };
  }
};

const getDueDateInfo = (dueDate: string | null) => {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  const days = differenceInDays(date, new Date());
  
  if (isPast(date) && !isToday(date)) {
    return { text: `En retard (${Math.abs(days)}j)`, color: 'text-red-600', bg: 'bg-red-50' };
  }
  if (isToday(date)) {
    return { text: "Aujourd'hui", color: 'text-orange-600', bg: 'bg-orange-50' };
  }
  if (days <= 3) {
    return { text: `${days}j restants`, color: 'text-amber-600', bg: 'bg-amber-50' };
  }
  return { text: format(date, 'd MMM', { locale: fr }), color: 'text-muted-foreground', bg: '' };
};

export function BacklogPanel({
  tasks,
  plannedTaskIds,
  onTaskDragStart,
  getTaskDuration,
  isCollapsed = false,
  onToggleCollapse,
}: BacklogPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'duration'>('priority');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['urgent', 'high', 'medium', 'low']));

  // Filter available tasks (not yet planned)
  const availableTasks = useMemo(() => {
    return tasks.filter(t =>
      t.status !== 'done' &&
      t.status !== 'validated' &&
      t.assignee_id &&
      !plannedTaskIds.includes(t.id) &&
      (searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [tasks, plannedTaskIds, searchQuery]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, normal: 4 };
    return [...availableTasks].sort((a, b) => {
      if (sortBy === 'priority') {
        return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4) - 
               (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4);
      }
      if (sortBy === 'dueDate') {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (sortBy === 'duration') {
        const dA = getTaskDuration?.(a.id) ?? 2;
        const dB = getTaskDuration?.(b.id) ?? 2;
        return dB - dA;
      }
      return 0;
    });
  }, [availableTasks, sortBy, getTaskDuration]);

  // Group by priority
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {
      urgent: [],
      high: [],
      medium: [],
      low: [],
    };
    sortedTasks.forEach(task => {
      const key = task.priority || 'low';
      if (groups[key]) {
        groups[key].push(task);
      } else {
        groups.low.push(task);
      }
    });
    return groups;
  }, [sortedTasks]);

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-card border-r flex flex-col items-center py-4 gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleCollapse}
                className="relative"
              >
                <Package className="h-5 w-5" />
                {availableTasks.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {availableTasks.length}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Backlog à planifier ({availableTasks.length})</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="w-80 bg-card border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-card to-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Inbox className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Backlog à planifier</h3>
              <p className="text-xs text-muted-foreground">{availableTasks.length} tâche{availableTasks.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          {onToggleCollapse && (
            <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-background/50"
          />
        </div>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="h-8 text-xs bg-background/50">
            <SelectValue placeholder="Trier par..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priorité</SelectItem>
            <SelectItem value="dueDate">Échéance</SelectItem>
            <SelectItem value="duration">Durée</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {availableTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Aucune tâche à planifier</p>
              <p className="text-xs text-muted-foreground/70">Toutes les tâches ont été assignées</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([priority, tasksInGroup]) => {
              if (tasksInGroup.length === 0) return null;
              const config = getPriorityConfig(priority);
              const isExpanded = expandedGroups.has(priority);

              return (
                <div key={priority} className="space-y-1">
                  <button
                    onClick={() => toggleGroup(priority)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      config.bg,
                      "hover:opacity-80"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", config.dot)} />
                      <span className={config.text}>{config.label}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {tasksInGroup.length}
                      </Badge>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform text-muted-foreground",
                      !isExpanded && "-rotate-90"
                    )} />
                  </button>

                  {isExpanded && (
                    <div className="space-y-1.5 pl-1">
                      {tasksInGroup.map((task) => {
                        const duration = getTaskDuration?.(task.id) ?? 2;
                        const dueInfo = getDueDateInfo(task.due_date);

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => onTaskDragStart(e, task)}
                            className={cn(
                              "group relative bg-background rounded-lg border shadow-sm p-3 cursor-grab",
                              "hover:shadow-md hover:border-primary/30 transition-all duration-200",
                              "active:cursor-grabbing active:shadow-lg active:scale-[1.02]"
                            )}
                          >
                            {/* Drag handle */}
                            <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>

                            <div className="pl-3">
                              {/* Title */}
                              <p className="text-sm font-medium line-clamp-2 mb-2 pr-2">
                                {task.title}
                              </p>

                              {/* Metadata */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Duration */}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{duration / 2}j</span>
                                </div>

                                {/* Due date */}
                                {dueInfo && (
                                  <div className={cn(
                                    "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
                                    dueInfo.bg,
                                    dueInfo.color
                                  )}>
                                    <Calendar className="h-3 w-3" />
                                    <span>{dueInfo.text}</span>
                                  </div>
                                )}

                                {/* Overdue indicator */}
                                {task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && (
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                )}
                              </div>
                            </div>

                            {/* Priority indicator line */}
                            <div className={cn(
                              "absolute left-0 top-2 bottom-2 w-1 rounded-full",
                              config.dot
                            )} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer stats */}
      {availableTasks.length > 0 && (
        <div className="p-3 border-t bg-muted/30">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold text-red-600">
                {groupedTasks.urgent.length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Urgent</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-orange-600">
                {groupedTasks.high.length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Haute</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-blue-600">
                {groupedTasks.medium.length + groupedTasks.low.length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Autre</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
