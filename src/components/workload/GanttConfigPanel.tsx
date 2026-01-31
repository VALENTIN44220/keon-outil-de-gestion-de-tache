import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Settings2,
  RotateCcw,
  Layers,
  Eye,
  Grid3X3,
  Maximize,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkloadPreferences, GroupByOption, ZoomLevel, WorkloadColumnConfig } from '@/hooks/useWorkloadPreferences';

interface GanttConfigPanelProps {
  preferences: WorkloadPreferences;
  onGroupByChange: (groupBy: GroupByOption) => void;
  onZoomChange: (zoom: ZoomLevel) => void;
  onToggleHeatmap: () => void;
  onToggleCompact: () => void;
  onColumnChange: (column: keyof WorkloadColumnConfig, visible: boolean) => void;
  onWidthChange: (width: number) => void;
  onReset: () => void;
}

const GROUP_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'department', label: 'Par service' },
  { value: 'company', label: 'Par société' },
  { value: 'team', label: 'Par équipe' },
];

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
];

const COLUMN_OPTIONS: { key: keyof WorkloadColumnConfig; label: string }[] = [
  { key: 'avatar', label: 'Avatar' },
  { key: 'name', label: 'Nom' },
  { key: 'role', label: 'Rôle / Poste' },
  { key: 'department', label: 'Service' },
  { key: 'capacity', label: 'Indicateur de charge' },
];

export function GanttConfigPanel({
  preferences,
  onGroupByChange,
  onZoomChange,
  onToggleHeatmap,
  onToggleCompact,
  onColumnChange,
  onWidthChange,
  onReset,
}: GanttConfigPanelProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Personnaliser</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Configuration de la vue</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Réinitialiser
            </Button>
          </div>

          <Separator />

          {/* Groupement */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Layers className="h-3.5 w-3.5" />
              Regrouper par
            </Label>
            <Select
              value={preferences.groupBy}
              onValueChange={(value) => onGroupByChange(value as GroupByOption)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zoom */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Maximize className="h-3.5 w-3.5" />
              Niveau de zoom
            </Label>
            <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
              {ZOOM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onZoomChange(option.value)}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    preferences.zoomLevel === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Affichage */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" />
              Options d'affichage
            </Label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Heatmap surcharge</span>
                <Switch
                  checked={preferences.showHeatmap}
                  onCheckedChange={onToggleHeatmap}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Mode compact</span>
                <Switch
                  checked={preferences.compactMode}
                  onCheckedChange={onToggleCompact}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Colonnes visibles */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Grid3X3 className="h-3.5 w-3.5" />
              Colonnes visibles
            </Label>

            <div className="space-y-2">
              {COLUMN_OPTIONS.map((col) => (
                <div key={col.key} className="flex items-center justify-between">
                  <span className="text-sm">{col.label}</span>
                  <Switch
                    checked={preferences.columns[col.key]}
                    onCheckedChange={(checked) => onColumnChange(col.key, checked)}
                    disabled={col.key === 'name'} // Name is always visible
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Largeur colonne membre */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Largeur colonne membre
              </Label>
              <span className="text-xs text-muted-foreground">
                {preferences.memberColumnWidth}px
              </span>
            </div>
            <Slider
              value={[preferences.memberColumnWidth]}
              min={180}
              max={400}
              step={20}
              onValueChange={([value]) => onWidthChange(value)}
              className="w-full"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
