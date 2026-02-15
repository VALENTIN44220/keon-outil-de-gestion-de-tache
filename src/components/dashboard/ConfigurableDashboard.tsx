import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { WidgetSizePreset, HeightPreset } from './widgets/WidgetWrapper';
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
import { TaskTableWidget } from './widgets/TaskTableWidget';
import { AddWidgetDialog } from './widgets/AddWidgetDialog';
import { ProgressRing } from './ProgressRing';
import { Button } from '@/components/ui/button';
import { Plus, RotateCcw, Settings2, Save, Check, Download, Upload, Trash2 } from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConfigurableDashboardProps {
  tasks: Task[];
  stats: TaskStats;
  globalProgress: number;
  onTaskClick?: (task: Task) => void;
  /** When set, config is persisted per-process in process_dashboard_configs instead of localStorage */
  processId?: string;
  /** Whether the user can edit (customize) the dashboard layout */
  canEdit?: boolean;
}

const STORAGE_KEY = 'dashboard-widgets-config';

// Helper to get grid span classes
const getGridClasses = (widget: WidgetConfig) => {
  const colSpan = widget.size.w >= 3 ? 'md:col-span-2' : '';
  return colSpan;
};

// Helper to derive a size preset from widget dimensions
const getSizePreset = (widget: WidgetConfig): WidgetSizePreset => {
  if (widget.size.w >= 3 && widget.size.h >= 4) return 'full';
  if (widget.size.w >= 3) return 'large';
  if (widget.size.h >= 3) return 'medium';
  return 'small';
};

// Height preset to pixel mapping
const HEIGHT_PRESET_PX: Record<HeightPreset, number> = {
  xs: 150,
  sm: 250,
  md: 350,
  lg: 450,
  xl: 600,
};

// Derive height preset from widget h value
const getHeightPresetFromWidget = (widget: WidgetConfig): HeightPreset => {
  const h = widget.size.h;
  if (h <= 1) return 'xs';
  if (h <= 2) return 'sm';
  if (h <= 3) return 'md';
  if (h <= 4) return 'lg';
  return 'xl';
};

// Height preset to h dimension mapping
const HEIGHT_PRESET_TO_H: Record<HeightPreset, number> = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 5,
};

// Size preset to dimensions mapping
const PRESET_DIMENSIONS: Record<WidgetSizePreset, { w: number; h: number }> = {
  small: { w: 2, h: 2 },
  medium: { w: 2, h: 3 },
  large: { w: 4, h: 3 },
  full: { w: 4, h: 4 },
};

export function ConfigurableDashboard({ 
  tasks, 
  stats, 
  globalProgress,
  onTaskClick,
  processId,
  canEdit = true,
}: ConfigurableDashboardProps) {
  const { user } = useAuth();
  const isProcessMode = !!processId;
  const storageKey = isProcessMode ? `process-dashboard-widgets-${processId}` : STORAGE_KEY;

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    if (isProcessMode) return DEFAULT_WIDGETS; // will be loaded from DB
    const saved = localStorage.getItem(storageKey);
    try {
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });
  const [filters, setFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<CrossFilters>(DEFAULT_CROSS_FILTERS);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filtersDirty, setFiltersDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  // Layout presets state
  const [layoutPresets, setLayoutPresets] = useState<{ id: string; name: string; widgets_config: WidgetConfig[] }[]>([]);
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Load layout presets
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('widget_layout_presets')
        .select('id, name, widgets_config')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setLayoutPresets(data);
    })();
  }, [user?.id]);

  // Save current layout as preset
  const handleSavePreset = useCallback(async () => {
    if (!user?.id || !presetName.trim()) return;
    const { data, error } = await (supabase as any)
      .from('widget_layout_presets')
      .insert({ user_id: user.id, name: presetName.trim(), widgets_config: widgets })
      .select('id, name, widgets_config')
      .single();
    if (error) { toast.error('Erreur'); return; }
    setLayoutPresets(prev => [data, ...prev]);
    setSavePresetDialogOpen(false);
    setPresetName('');
    toast.success(`Preset "${data.name}" enregistré`);
  }, [user?.id, presetName, widgets]);

  // Load a preset
  const handleLoadPreset = useCallback((preset: { widgets_config: WidgetConfig[] }) => {
    setWidgets(preset.widgets_config);
    if (isProcessMode) setFiltersDirty(true);
    toast.success('Layout chargé');
  }, [isProcessMode]);

  // Delete a preset
  const handleDeletePreset = useCallback(async (presetId: string) => {
    await (supabase as any).from('widget_layout_presets').delete().eq('id', presetId);
    setLayoutPresets(prev => prev.filter(p => p.id !== presetId));
    toast.success('Preset supprimé');
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      if (isProcessMode) {
        // Load from process_dashboard_configs
        const { data } = await (supabase as any)
          .from('process_dashboard_configs')
          .select('widgets_config, filters_config')
          .eq('process_template_id', processId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          if (data.widgets_config && Array.isArray(data.widgets_config) && data.widgets_config.length > 0) {
            setWidgets(data.widgets_config);
          }
          if (data.filters_config && Object.keys(data.filters_config).length > 0) {
            const restored: CrossFilters = {
              ...DEFAULT_CROSS_FILTERS,
              ...data.filters_config,
              dateRange: {
                start: data.filters_config.dateRange?.start ? new Date(data.filters_config.dateRange.start) : null,
                end: data.filters_config.dateRange?.end ? new Date(data.filters_config.dateRange.end) : null,
              },
            };
            setFilters(restored);
            setPendingFilters(restored);
          }
        }
      } else {
        // Load from user_dashboard_filters (global mode)
        const { data } = await (supabase as any)
          .from('user_dashboard_filters')
          .select('filters')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.filters) {
          const restored: CrossFilters = {
            ...DEFAULT_CROSS_FILTERS,
            ...data.filters,
            dateRange: {
              start: data.filters.dateRange?.start ? new Date(data.filters.dateRange.start) : null,
              end: data.filters.dateRange?.end ? new Date(data.filters.dateRange.end) : null,
            },
          };
          setFilters(restored);
          setPendingFilters(restored);
        }
      }
      setFiltersLoaded(true);
    })();
  }, [user?.id, processId, isProcessMode]);

  // Track dirty state
  const handlePendingFiltersChange = useCallback((newFilters: CrossFilters) => {
    setPendingFilters(newFilters);
    setFiltersDirty(true);
  }, []);

  // Save filters (and widgets in process mode) to DB
  const handleSaveFilters = useCallback(async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const serializedFilters = {
        ...pendingFilters,
        dateRange: {
          start: pendingFilters.dateRange.start?.toISOString() ?? null,
          end: pendingFilters.dateRange.end?.toISOString() ?? null,
        },
      };

      if (isProcessMode) {
        const { error } = await (supabase as any)
          .from('process_dashboard_configs')
          .upsert({
            process_template_id: processId,
            user_id: user.id,
            widgets_config: widgets,
            filters_config: serializedFilters,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'process_template_id,user_id' });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('user_dashboard_filters')
          .upsert({ user_id: user.id, filters: serializedFilters, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
      }
      setFilters(pendingFilters);
      setFiltersDirty(false);
      toast.success('Configuration enregistrée');
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, pendingFilters, isProcessMode, processId, widgets]);

  // Save widgets to localStorage (global mode only)
  useEffect(() => {
    if (!isProcessMode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    }
  }, [widgets]);

  // Filter tasks based on cross-filters
  const filteredTasks = useMemo(() => {
    let result = tasks;
    const activeFilters = pendingFilters;

    // Search query filter
    if (activeFilters.searchQuery) {
      const q = activeFilters.searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.request_number && t.request_number.toLowerCase().includes(q))
      );
    }

    // Date range filter
    if (activeFilters.period !== 'all' || activeFilters.dateRange.start) {
      const now = new Date();
      let startDate: Date;
      
      if (activeFilters.dateRange.start) {
        startDate = activeFilters.dateRange.start;
      } else {
        switch (activeFilters.period) {
          case 'day': startDate = subDays(now, 1); break;
          case 'week': startDate = startOfWeek(now, { locale: fr }); break;
          case 'month': startDate = startOfMonth(now); break;
          case 'quarter': startDate = startOfQuarter(now); break;
          case 'year': startDate = startOfYear(now); break;
          default: startDate = subDays(now, 30);
        }
      }
      
      const endDate = activeFilters.dateRange.end || now;
      
      result = result.filter(t => {
        const taskDate = new Date(t.created_at);
        return isWithinInterval(taskDate, { start: startDate, end: endDate });
      });
    }

    // Assignee filter
    if (activeFilters.assigneeIds.length > 0) {
      result = result.filter(t => t.assignee_id && activeFilters.assigneeIds.includes(t.assignee_id));
    }

    // Department filter
    if (activeFilters.departmentIds.length > 0) {
      result = result.filter(t => t.target_department_id && activeFilters.departmentIds.includes(t.target_department_id));
    }

    // Category filter
    if (activeFilters.categoryIds.length > 0) {
      result = result.filter(t => t.category_id && activeFilters.categoryIds.includes(t.category_id));
    }

    // Status filter
    if (activeFilters.statuses.length > 0) {
      result = result.filter(t => activeFilters.statuses.includes(t.status));
    }

    // Priority filter
    if (activeFilters.priorities.length > 0) {
      result = result.filter(t => activeFilters.priorities.includes(t.priority));
    }

    return result;
  }, [tasks, pendingFilters]);

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
    if (isProcessMode) setFiltersDirty(true);
    toast.success('Widget ajouté');
  }, [widgets.length, isProcessMode]);

  // Remove widget
  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    if (isProcessMode) setFiltersDirty(true);
    toast.success('Widget supprimé');
  }, [isProcessMode]);

  // Reset to default
  const handleReset = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    if (isProcessMode) setFiltersDirty(true);
    toast.success('Tableau de bord réinitialisé');
  }, [isProcessMode]);

  // Resize widget (width preset)
  const handleResizeWidget = useCallback((widgetId: string, preset: WidgetSizePreset) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, size: { ...PRESET_DIMENSIONS[preset], h: w.size.h } } : w
    ));
    if (isProcessMode) setFiltersDirty(true);
  }, [isProcessMode]);

  // Resize widget height
  const handleHeightChange = useCallback((widgetId: string, preset: HeightPreset) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, size: { ...w.size, h: HEIGHT_PRESET_TO_H[preset] } } : w
    ));
    if (isProcessMode) setFiltersDirty(true);
  }, [isProcessMode]);

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
        return <DataTableWidget tasks={filteredTasks} onTaskClick={onTaskClick} processId={processId} />;
      case 'task-table':
        return <TaskTableWidget tasks={filteredTasks} onTaskClick={onTaskClick} processId={processId} />;
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

  // Get height style based on widget h dimension
  const getHeightStyle = (widget: WidgetConfig): React.CSSProperties => {
    const preset = getHeightPresetFromWidget(widget);
    return { height: `${HEIGHT_PRESET_PX[preset]}px` };
  };

  return (
    <div className="space-y-4">
      {/* Toolbar - above filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {filtersDirty && (
            <Button
              size="sm"
              onClick={handleSaveFilters}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Valider et enregistrer
            </Button>
          )}
        </div>

        {canEdit && (
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

                {/* Save / Load layout presets */}
                <Button variant="outline" size="sm" onClick={() => setSavePresetDialogOpen(true)} className="gap-2">
                  <Save className="h-4 w-4" />
                  Sauver layout
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" disabled={layoutPresets.length === 0}>
                      <Download className="h-4 w-4" />
                      Charger layout
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Layouts enregistrés</p>
                    {layoutPresets.length === 0 && (
                      <p className="text-xs text-muted-foreground px-1">Aucun preset enregistré</p>
                    )}
                    {layoutPresets.map(preset => (
                      <div key={preset.id} className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-md hover:bg-muted">
                        <button
                          className="flex-1 text-left text-sm truncate"
                          onClick={() => handleLoadPreset(preset)}
                        >
                          {preset.name}
                          <span className="text-[10px] text-muted-foreground ml-1">({preset.widgets_config.length} widgets)</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 hover:text-destructive"
                          onClick={() => handleDeletePreset(preset.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cross Filters Panel - always visible */}
      <CrossFiltersPanel
        filters={pendingFilters}
        onFiltersChange={handlePendingFiltersChange}
      />

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgets.map(widget => (
          <div
            key={widget.id}
            className={cn(
              getGridClasses(widget),
              isEditing && 'cursor-move',
              draggedWidget === widget.id && 'opacity-50'
            )}
            style={getHeightStyle(widget)}
            draggable={isEditing}
            onDragStart={() => handleDragStart(widget.id)}
            onDragOver={(e) => handleDragOver(e, widget.id)}
            onDrop={(e) => handleDrop(e, widget.id)}
          >
            <WidgetWrapper
              title={widget.title}
              onRemove={isEditing ? () => handleRemoveWidget(widget.id) : undefined}
              isDragging={draggedWidget === widget.id}
              sizePreset={isEditing ? getSizePreset(widget) : undefined}
              onResize={isEditing ? (preset) => handleResizeWidget(widget.id, preset) : undefined}
              heightPreset={isEditing ? getHeightPresetFromWidget(widget) : undefined}
              onHeightChange={isEditing ? (preset) => handleHeightChange(widget.id, preset) : undefined}
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

      {/* Save Layout Preset Dialog */}
      <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sauvegarder le layout</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="preset-name">Nom du preset</Label>
            <Input
              id="preset-name"
              placeholder="Ex: Mon layout tableaux de bord"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSavePresetDialogOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
