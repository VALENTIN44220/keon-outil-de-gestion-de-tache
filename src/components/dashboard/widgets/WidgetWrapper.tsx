import { ReactNode } from 'react';
import { GripVertical, Maximize2, Minimize2, X, Settings, RectangleHorizontal, Square, RectangleVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type WidgetSizePreset = 'small' | 'medium' | 'large' | 'full';

export type HeightPreset = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface WidgetWrapperProps {
  title: string;
  children: ReactNode;
  onRemove?: () => void;
  onSettings?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  isDragging?: boolean;
  /** Current size preset for resize UI */
  sizePreset?: WidgetSizePreset;
  /** Called when the user picks a new size */
  onResize?: (preset: WidgetSizePreset) => void;
  /** Current height preset */
  heightPreset?: HeightPreset;
  /** Called when the user picks a new height */
  onHeightChange?: (preset: HeightPreset) => void;
}

const SIZE_OPTIONS: { preset: WidgetSizePreset; label: string; icon: typeof Square; desc: string }[] = [
  { preset: 'small', label: 'Petit', icon: Square, desc: '1 col · compact' },
  { preset: 'medium', label: 'Moyen', icon: RectangleHorizontal, desc: '1 col · standard' },
  { preset: 'large', label: 'Large', icon: RectangleHorizontal, desc: '2 col · standard' },
  { preset: 'full', label: 'Pleine largeur', icon: RectangleVertical, desc: '2 col · étendu' },
];

const HEIGHT_OPTIONS: { preset: HeightPreset; label: string; px: string }[] = [
  { preset: 'xs', label: 'Très petit', px: '150px' },
  { preset: 'sm', label: 'Petit', px: '250px' },
  { preset: 'md', label: 'Moyen', px: '350px' },
  { preset: 'lg', label: 'Grand', px: '450px' },
  { preset: 'xl', label: 'Très grand', px: '600px' },
];

export function WidgetWrapper({
  title,
  children,
  onRemove,
  onSettings,
  isExpanded,
  onToggleExpand,
  className,
  isDragging,
  sizePreset,
  onResize,
  heightPreset,
  onHeightChange,
}: WidgetWrapperProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border-2 border-keon-200 shadow-keon overflow-hidden h-full flex flex-col',
        'hover:border-keon-300 hover:shadow-keon-md transition-all duration-200',
        isDragging && 'opacity-75 shadow-2xl border-keon-blue',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-keon-50 to-white border-b border-keon-100">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-keon-400 cursor-grab active:cursor-grabbing drag-handle" />
          <h3 className="font-semibold text-sm text-keon-900">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {onResize && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Redimensionner">
                  <Maximize2 className="h-3.5 w-3.5 text-keon-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1.5" align="end">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">Taille du widget</p>
                {SIZE_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isActive = sizePreset === opt.preset;
                  return (
                    <button
                      key={opt.preset}
                      className={cn(
                        'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      )}
                      onClick={() => onResize(opt.preset)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="text-left">
                        <span className="block text-sm leading-tight">{opt.label}</span>
                        <span className="block text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}
          {onHeightChange && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Hauteur">
                  <ChevronUp className="h-3 w-3 text-keon-500 -mb-1" />
                  <ChevronDown className="h-3 w-3 text-keon-500 -mt-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1.5" align="end">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">Hauteur</p>
                {HEIGHT_OPTIONS.map(opt => {
                  const isActive = heightPreset === opt.preset;
                  return (
                    <button
                      key={opt.preset}
                      className={cn(
                        'flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      )}
                      onClick={() => onHeightChange(opt.preset)}
                    >
                      <span>{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.px}</span>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}
          {onSettings && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSettings}>
              <Settings className="h-3.5 w-3.5 text-keon-500" />
            </Button>
          )}
          {onToggleExpand && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
              {isExpanded ? (
                <Minimize2 className="h-3.5 w-3.5 text-keon-500" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 text-keon-500" />
              )}
            </Button>
          )}
          {onRemove && (
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500" onClick={onRemove}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {children}
      </div>
    </div>
  );
}
