import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, RotateCcw, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Widget definitions ──────────────────────────────────────────────────────
export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  size: 'compact' | 'normal' | 'large';
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
}

export const WIDGET_DEFINITIONS: Omit<WidgetConfig, 'visible' | 'size'>[] = [
  { id: 'kpi_strip',     label: 'KPI Strip (8 indicateurs)',     accentColor: '#1E5EFF', gradientFrom: 'from-blue-500/10',   gradientTo: 'to-blue-600/5'   },
  { id: 'map',           label: 'Carte de localisation',         accentColor: '#12B6C8', gradientFrom: 'from-cyan-500/10',   gradientTo: 'to-cyan-600/5'   },
  { id: 'status_pie',    label: 'Par statut (pie)',              accentColor: '#10b981', gradientFrom: 'from-emerald-500/10',gradientTo: 'to-emerald-600/5'},
  { id: 'typo_pie',      label: 'Par typologie (pie)',           accentColor: '#60a5fa', gradientFrom: 'from-blue-400/10',   gradientTo: 'to-blue-500/5'   },
  { id: 'progress_bar',  label: 'Avancement par projet (bar)',   accentColor: '#78C050', gradientFrom: 'from-green-500/10',  gradientTo: 'to-green-600/5'  },
  { id: 'region_bar',    label: 'Répartition géographique (bar)',accentColor: '#FF9432', gradientFrom: 'from-orange-500/10', gradientTo: 'to-orange-600/5' },
  { id: 'keon_spv',      label: 'KEON — SPV créée (pie)',        accentColor: '#8b5cf6', gradientFrom: 'from-violet-500/10', gradientTo: 'to-violet-600/5' },
  { id: 'at_risk',       label: 'Projets en retard',             accentColor: '#ef4444', gradientFrom: 'from-red-500/10',    gradientTo: 'to-red-600/5'    },
  { id: 'top_projects',  label: 'Projets les plus avancés',      accentColor: '#10b981', gradientFrom: 'from-emerald-500/10',gradientTo: 'to-emerald-600/5'},
];

const STORAGE_KEY = 'synthese_widget_config';

function getDefaultWidgets(): WidgetConfig[] {
  return WIDGET_DEFINITIONS.map(w => ({ ...w, visible: true, size: 'normal' as const }));
}

export function loadWidgetConfig(): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWidgets();
    const saved: WidgetConfig[] = JSON.parse(raw);
    const savedMap = new Map(saved.map(w => [w.id, w]));
    const merged: WidgetConfig[] = [];
    saved.forEach(s => {
      const def = WIDGET_DEFINITIONS.find(d => d.id === s.id);
      if (def) merged.push({ ...def, visible: s.visible, size: s.size });
    });
    WIDGET_DEFINITIONS.forEach(d => {
      if (!savedMap.has(d.id)) merged.push({ ...d, visible: true, size: 'normal' });
    });
    return merged;
  } catch {
    return getDefaultWidgets();
  }
}

function saveWidgetConfig(widgets: WidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

// ─── Size button labels ──────────────────────────────────────────────────────
const SIZE_OPTIONS: { key: WidgetConfig['size']; label: string }[] = [
  { key: 'compact', label: 'C' },
  { key: 'normal', label: 'N' },
  { key: 'large', label: 'L' },
];

// ─── Sortable widget row ─────────────────────────────────────────────────────
function SortableWidgetRow({
  widget,
  onToggleVisible,
  onChangeSize,
}: {
  widget: WidgetConfig;
  onToggleVisible: () => void;
  onChangeSize: (size: WidgetConfig['size']) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-2.5 transition-colors border',
        isDragging && 'z-50 shadow-lg',
        widget.visible
          ? 'bg-card border-border/60'
          : 'bg-muted/30 border-transparent opacity-60'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Accent dot */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: widget.accentColor }}
      />

      {/* Label */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{widget.label}</span>
      </div>

      {/* Size selector: C / N / L */}
      <div className="flex items-center gap-0.5 shrink-0">
        {SIZE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => onChangeSize(opt.key)}
            className={cn(
              'w-6 h-6 rounded text-[10px] font-semibold transition-colors',
              widget.size === opt.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Toggle */}
      <Switch
        checked={widget.visible}
        onCheckedChange={onToggleVisible}
        className="shrink-0"
      />
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────
interface Props {
  widgets: WidgetConfig[];
  onChange: (widgets: WidgetConfig[]) => void;
}

export function SyntheseWidgetConfigPanel({ widgets, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commit = (next: WidgetConfig[]) => {
    onChange(next);
    saveWidgetConfig(next);
  };

  const toggleVisible = (id: string) => {
    commit(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const changeSize = (id: string, size: WidgetConfig['size']) => {
    commit(widgets.map(w => w.id === id ? { ...w, size } : w));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = widgets.findIndex(w => w.id === active.id);
    const newIndex = widgets.findIndex(w => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    commit(arrayMove(widgets, oldIndex, newIndex));
  };

  const reset = () => commit(getDefaultWidgets());

  const visibleCount = widgets.filter(w => w.visible).length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Settings className="h-3.5 w-3.5" />
          Configurer
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Configuration Synthèse
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Glissez pour réordonner, ajustez la taille et la visibilité de chaque widget.
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary" className="text-xs">
              {visibleCount}/{widgets.length} widgets visibles
            </Badge>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={reset}>
              <RotateCcw className="h-3 w-3" />
              Réinitialiser
            </Button>
          </div>

          <Separator />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1 pt-2">
                {widgets.map(widget => (
                  <SortableWidgetRow
                    key={widget.id}
                    widget={widget}
                    onToggleVisible={() => toggleVisible(widget.id)}
                    onChangeSize={(size) => changeSize(widget.id, size)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </SheetContent>
    </Sheet>
  );
}
