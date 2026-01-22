import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  LayoutGrid,
  Maximize2,
  Download,
  Settings,
} from 'lucide-react';
import { format, getWeek, getQuarter } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ViewLevel = 'year' | 'quarter' | 'month' | 'week';

interface CalendarHeaderProps {
  currentDate: Date;
  viewLevel: ViewLevel;
  onViewLevelChange: (level: ViewLevel) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onToday: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  showHeatmap?: boolean;
  onToggleHeatmap?: () => void;
  kpis?: {
    plannedTasks: number;
    plannedDays: number;
    capacityPercent: number;
  };
}

export function CalendarHeader({
  currentDate,
  viewLevel,
  onViewLevelChange,
  onNavigate,
  onToday,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  showHeatmap = false,
  onToggleHeatmap,
  kpis,
}: CalendarHeaderProps) {
  const getPeriodLabel = () => {
    switch (viewLevel) {
      case 'year':
        return format(currentDate, 'yyyy');
      case 'quarter':
        return `T${getQuarter(currentDate)} ${format(currentDate, 'yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: fr });
      case 'week':
        return `Semaine ${getWeek(currentDate, { locale: fr })} • ${format(currentDate, 'MMM yyyy', { locale: fr })}`;
    }
  };

  const viewOptions = [
    { value: 'week', label: 'Semaine', icon: LayoutGrid },
    { value: 'month', label: 'Mois', icon: Grid3X3 },
    { value: 'quarter', label: 'Trimestre', icon: Maximize2 },
    { value: 'year', label: 'Année', icon: CalendarIcon },
  ];

  return (
    <div className="bg-card rounded-xl border shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: Navigation */}
        <div className="flex items-center gap-3">
          {/* View Level Selector */}
          <div className="flex bg-muted rounded-lg p-1">
            {viewOptions.map((option) => {
              const Icon = option.icon;
              return (
                <TooltipProvider key={option.value}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onViewLevelChange(option.value as ViewLevel)}
                        className={cn(
                          "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                          viewLevel === option.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="hidden sm:inline">{option.label}</span>
                        <Icon className="h-4 w-4 sm:hidden" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="sm:hidden">
                      <p>{option.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onNavigate('prev')}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              onClick={onToday}
              className="h-8 px-3 text-sm font-medium"
            >
              Aujourd'hui
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => onNavigate('next')}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Period Label */}
          <h2 className="text-lg font-semibold capitalize">
            {getPeriodLabel()}
          </h2>
        </div>

        {/* Center: KPIs */}
        {kpis && (
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">Planifié</span>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {kpis.plannedTasks} tâches
              </span>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-xs text-muted-foreground">Charge</span>
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                {kpis.plannedDays}j
              </span>
            </div>
            
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
              kpis.capacityPercent >= 100 
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                : kpis.capacityPercent >= 80
                  ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900"
                  : "bg-muted border-border"
            )}>
              <span className="text-xs text-muted-foreground">Capacité</span>
              <span className={cn(
                "text-sm font-semibold",
                kpis.capacityPercent >= 100 ? "text-red-700 dark:text-red-400" :
                kpis.capacityPercent >= 80 ? "text-orange-700 dark:text-orange-400" :
                "text-foreground"
              )}>
                {kpis.capacityPercent}%
              </span>
            </div>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onZoomOut}
                    disabled={!canZoomOut}
                    className="h-7 w-7 rounded-md"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom arrière</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onZoomIn}
                    disabled={!canZoomIn}
                    className="h-7 w-7 rounded-md"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom avant</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Heatmap Toggle */}
          {onToggleHeatmap && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showHeatmap ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleHeatmap}
                    className="h-8 gap-1.5"
                  >
                    <Grid3X3 className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs">Heatmap</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showHeatmap ? 'Masquer' : 'Afficher'} la carte de chaleur
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}
