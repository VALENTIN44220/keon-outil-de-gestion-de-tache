import { useState, useMemo, useCallback, useEffect } from 'react';
import { Task, TaskStats } from '@/types/task';
import { 
  WidgetConfig, 
  CrossFilters, 
  DEFAULT_CROSS_FILTERS, 
  DEFAULT_WIDGETS,
  ChartDataPoint,
  TimelineDataPoint,
} from './types';
import { CrossFiltersPanel } from './CrossFiltersPanel';
import { WidgetWrapper } from './widgets/WidgetWrapper';
import { StatsSummaryWidget } from './widgets/StatsSummaryWidget';
import { BarChartWidget } from './widgets/BarChartWidget';
import { PieChartWidget } from './widgets/PieChartWidget';
import { LineChartWidget } from './widgets/LineChartWidget';
import { DataTableWidget } from './widgets/DataTableWidget';
import { AddWidgetDialog } from './widgets/AddWidgetDialog';
import { ProgressRing } from './ProgressRing';
import { Button } from '@/components/ui/button';
import { Plus, Filter, RotateCcw, Settings2 } from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ConfigurableDashboardProps {
  tasks: Task[];
  stats: TaskStats;
  globalProgress: number;
  onTaskClick?: (task: Task) => void;
}

const STORAGE_KEY = 'dashboard-widgets-config';

// Helper to get grid span classes
const getGridClasses = (widget: WidgetConfig) => {
  const colSpan = widget.size.w >= 3 ? 'md:col-span-2' : widget.size.w >= 2 ? 'md:col-span-1' : '';
  const rowSpan = widget.size.h >= 4 ? 'row-span-2' : '';
  return cn(colSpan, rowSpan);
};

export function ConfigurableDashboard({ 
  tasks, 
  stats, 
  globalProgress,
  onTaskClick 
}: ConfigurableDashboardProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });
  const [filters, setFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  // Save widgets to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);

  // Filter tasks based on cross-filters
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Date range filter
    if (filters.period !== 'all' || filters.dateRange.start) {
      const now = new Date();
      let startDate: Date;
      
      if (filters.dateRange.start) {
        startDate = filters.dateRange.start;
      } else {
        switch (filters.period) {
          case 'day': startDate = subDays(now, 1); break;
          case 'week': startDate = startOfWeek(now, { locale: fr }); break;
          case 'month': startDate = startOfMonth(now); break;
          case 'quarter': startDate = startOfQuarter(now); break;
          case 'year': startDate = startOfYear(now); break;
          default: startDate = subDays(now, 30);
        }
      }
      
      const endDate = filters.dateRange.end || now;
      
      result = result.filter(t => {
        const taskDate = new Date(t.created_at);
        return isWithinInterval(taskDate, { start: startDate, end: endDate });
      });
    }

    // Assignee filter
    if (filters.assigneeIds.length > 0) {
      result = result.filter(t => t.assignee_id && filters.assigneeIds.includes(t.assignee_id));
    }

    // Department filter
    if (filters.departmentIds.length > 0) {
      result = result.filter(t => t.target_department_id && filters.departmentIds.includes(t.target_department_id));
    }

    // Category filter
    if (filters.categoryIds.length > 0) {
      result = result.filter(t => t.category_id && filters.categoryIds.includes(t.category_id));
    }

    // Status filter
    if (filters.statuses.length > 0) {
      result = result.filter(t => filters.statuses.includes(t.status));
    }

    // Priority filter
    if (filters.priorities.length > 0) {
      result = result.filter(t => filters.priorities.includes(t.priority));
    }

    return result;
  }, [tasks, filters]);

  // Calculate filtered stats
  const filteredStats = useMemo((): TaskStats => {
    const total = filteredTasks.length;
    const todo = filteredTasks.filter(t => t.status === 'todo').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in-progress').length;
    const done = filteredTasks.filter(t => t.status === 'done').length;
    const pendingValidation = filteredTasks.filter(t => t.status === 'pending_validation_1' || t.status === 'pending_validation_2').length;
    const validated = filteredTasks.filter(t => t.status === 'validated').length;
    const refused = filteredTasks.filter(t => t.status === 'refused').length;
    
    return {
      total,
      todo,
      inProgress,
      done,
      pendingValidation,
      validated,
      refused,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [filteredTasks]);

  // Generate chart data based on dataKey
  const getChartData = useCallback((dataKey: string): ChartDataPoint[] => {
    switch (dataKey) {
      case 'status':
        return [
          { name: 'À faire', value: filteredStats.todo, color: '#FF9432' },
          { name: 'En cours', value: filteredStats.inProgress, color: '#4DBEC8' },
          { name: 'Terminé', value: filteredStats.done, color: '#78C050' },
        ];
      case 'priority':
        return [
          { name: 'Urgente', value: filteredTasks.filter(t => t.priority === 'urgent').length, color: '#ef4444' },
          { name: 'Haute', value: filteredTasks.filter(t => t.priority === 'high').length, color: '#f97316' },
          { name: 'Moyenne', value: filteredTasks.filter(t => t.priority === 'medium').length, color: '#FF9432' },
          { name: 'Basse', value: filteredTasks.filter(t => t.priority === 'low').length, color: '#78C050' },
        ];
      case 'assignee':
        const assigneeCounts = new Map<string, number>();
        filteredTasks.forEach(t => {
          const key = t.assignee_id || 'Non assigné';
          assigneeCounts.set(key, (assigneeCounts.get(key) || 0) + 1);
        });
        return Array.from(assigneeCounts.entries())
          .slice(0, 10)
          .map(([name, value]) => ({ name: name === 'Non assigné' ? name : `Assigné`, value }));
      default:
        return [];
    }
  }, [filteredStats, filteredTasks]);

  // Generate timeline data
  const getTimelineData = useCallback((): TimelineDataPoint[] => {
    const days = 14;
    const data: TimelineDataPoint[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'dd/MM', { locale: fr });
      
      const dayTasks = filteredTasks.filter(t => {
        const taskDate = new Date(t.created_at);
        return format(taskDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      });
      
      const completedTasks = filteredTasks.filter(t => {
        if (t.status !== 'done' || !t.updated_at) return false;
        const doneDate = new Date(t.updated_at);
        return format(doneDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      });
      
      data.push({
        date: dateStr,
        created: dayTasks.length,
        completed: completedTasks.length,
        inProgress: filteredTasks.filter(t => t.status === 'in-progress').length,
      });
    }
    
    return data;
  }, [filteredTasks]);

  // Add widget
  const handleAddWidget = useCallback((widget: Omit<WidgetConfig, 'id' | 'position'>) => {
    const newWidget: WidgetConfig = {
      ...widget,
      id: `widget-${Date.now()}`,
      position: { x: 0, y: widgets.length },
    };
    setWidgets(prev => [...prev, newWidget]);
    toast.success('Widget ajouté');
  }, [widgets.length]);

  // Remove widget
  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    toast.success('Widget supprimé');
  }, []);

  // Reset to default
  const handleReset = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    toast.success('Tableau de bord réinitialisé');
  }, []);

  // Drag and drop handlers
  const handleDragStart = (widgetId: string) => {
    if (!isEditing) return;
    setDraggedWidget(widgetId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetId) return;
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetId) return;
    
    setWidgets(prev => {
      const newWidgets = [...prev];
      const draggedIndex = newWidgets.findIndex(w => w.id === draggedWidget);
      const targetIndex = newWidgets.findIndex(w => w.id === targetId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const [removed] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(targetIndex, 0, removed);
      
      return newWidgets;
    });
    
    setDraggedWidget(null);
  };

  // Render widget content
  const renderWidgetContent = useCallback((widget: WidgetConfig) => {
    switch (widget.type) {
      case 'stats-summary':
        return <StatsSummaryWidget stats={filteredStats} />;
      case 'bar-chart':
        return <BarChartWidget data={getChartData(widget.dataKey || 'status')} />;
      case 'pie-chart':
        return <PieChartWidget data={getChartData(widget.dataKey || 'priority')} />;
      case 'line-chart':
        return <LineChartWidget data={getTimelineData()} />;
      case 'data-table':
        return <DataTableWidget tasks={filteredTasks} onTaskClick={onTaskClick} />;
      case 'progress-ring':
        return (
          <div className="flex items-center justify-center h-full">
            <ProgressRing progress={filteredStats.completionRate} size={140} />
          </div>
        );
      default:
        return <div className="text-keon-500">Widget non reconnu</div>;
    }
  }, [filteredStats, filteredTasks, getChartData, getTimelineData, onTaskClick]);

  // Get height class based on widget type
  const getHeightClass = (widget: WidgetConfig) => {
    switch (widget.type) {
      case 'stats-summary':
        return 'h-[200px]';
      case 'data-table':
        return 'h-[400px]';
      case 'line-chart':
        return 'h-[300px]';
      default:
        return 'h-[280px]';
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtres
            {(filters.assigneeIds.length + filters.statuses.length + filters.priorities.length) > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {filters.assigneeIds.length + filters.statuses.length + filters.priorities.length}
              </span>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isEditing ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            {isEditing ? 'Terminer' : 'Personnaliser'}
          </Button>
          
          {isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Réinitialiser
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cross Filters Panel */}
      {showFilters && (
        <CrossFiltersPanel
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Task count indicator */}
      <div className="text-sm text-keon-600">
        {filteredTasks.length} tâche{filteredTasks.length !== 1 ? 's' : ''} 
        {filteredTasks.length !== tasks.length && ` (sur ${tasks.length} au total)`}
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgets.map(widget => (
          <div
            key={widget.id}
            className={cn(
              getHeightClass(widget),
              getGridClasses(widget),
              isEditing && 'cursor-move',
              draggedWidget === widget.id && 'opacity-50'
            )}
            draggable={isEditing}
            onDragStart={() => handleDragStart(widget.id)}
            onDragOver={(e) => handleDragOver(e, widget.id)}
            onDrop={(e) => handleDrop(e, widget.id)}
          >
            <WidgetWrapper
              title={widget.title}
              onRemove={isEditing ? () => handleRemoveWidget(widget.id) : undefined}
              isDragging={draggedWidget === widget.id}
            >
              {renderWidgetContent(widget)}
            </WidgetWrapper>
          </div>
        ))}
      </div>

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={handleAddWidget}
      />
    </div>
  );
}
