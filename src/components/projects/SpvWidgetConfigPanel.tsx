import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Settings, GripVertical, RotateCcw } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type WidgetSize = 'compact' | 'normal' | 'large';

export interface SpvWidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  size: WidgetSize;
}

const STORAGE_KEY = 'spv_widget_config';

const DEFAULT_WIDGETS: SpvWidgetConfig[] = [
  { id: 'kpi_band', label: 'KPI Band', visible: true, size: 'normal' },
  { id: 'map', label: 'Carte des projets SPV', visible: true, size: 'normal' },
  { id: 'typologie', label: 'Répartition par Typologie', visible: true, size: 'normal' },
  { id: 'gisement', label: 'Gisement par projet', visible: true, size: 'normal' },
  { id: 'table', label: 'Tableau récap', visible: true, size: 'normal' },
];

export function loadSpvWidgetConfig(): SpvWidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const parsed = JSON.parse(raw) as SpvWidgetConfig[];
    // Merge with defaults to handle new widgets
    const ids = new Set(parsed.map(w => w.id));
    const merged = [...parsed];
    DEFAULT_WIDGETS.forEach(dw => {
      if (!ids.has(dw.id)) merged.push(dw);
    });
    return merged.filter(w => DEFAULT_WIDGETS.some(dw => dw.id === w.id));
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveConfig(config: SpvWidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────
function SortableWidgetRow({
  widget,
  onToggle,
  onSizeChange,
}: {
  widget: SpvWidgetConfig;
  onToggle: () => void;
  onSizeChange: (size: WidgetSize) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const sizes: { key: WidgetSize; label: string }[] = [
    { key: 'compact', label: 'C' },
    { key: 'normal', label: 'N' },
    { key: 'large', label: 'L' },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card transition-shadow',
        isDragging && 'shadow-lg z-10 opacity-90',
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className={cn('flex-1 text-sm font-medium', !widget.visible && 'text-muted-foreground line-through')}>
        {widget.label}
      </span>

      {/* Size selector */}
      <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-md">
        {sizes.map(s => (
          <button
            key={s.key}
            onClick={() => onSizeChange(s.key)}
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded transition-colors',
              widget.size === s.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Switch checked={widget.visible} onCheckedChange={onToggle} />
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
interface Props {
  config: SpvWidgetConfig[];
  onChange: (config: SpvWidgetConfig[]) => void;
}

export function SpvWidgetConfigPanel({ config, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = config.findIndex(w => w.id === active.id);
    const newIndex = config.findIndex(w => w.id === over.id);
    const next = arrayMove(config, oldIndex, newIndex);
    onChange(next);
    saveConfig(next);
  };

  const toggleVisibility = (id: string) => {
    const next = config.map(w => (w.id === id ? { ...w, visible: !w.visible } : w));
    onChange(next);
    saveConfig(next);
  };

  const changeSize = (id: string, size: WidgetSize) => {
    const next = config.map(w => (w.id === id ? { ...w, size } : w));
    onChange(next);
    saveConfig(next);
  };

  const reset = () => {
    onChange(DEFAULT_WIDGETS);
    saveConfig(DEFAULT_WIDGETS);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Personnaliser</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[380px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Personnaliser les widgets
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={config.map(w => w.id)} strategy={verticalListSortingStrategy}>
              {config.map(widget => (
                <SortableWidgetRow
                  key={widget.id}
                  widget={widget}
                  onToggle={() => toggleVisibility(widget.id)}
                  onSizeChange={(size) => changeSize(widget.id, size)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="mt-6">
          <Button variant="outline" size="sm" className="gap-2" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
