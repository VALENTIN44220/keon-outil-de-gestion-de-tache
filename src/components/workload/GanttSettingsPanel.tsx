import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings2, 
  RotateCcw, 
  Eye, 
  Grid3X3, 
  Users, 
  Thermometer,
  Calendar,
  Columns3,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  GanttViewPreferences, 
  GroupByOption, 
  ZoomLevel,
  GanttColumnConfig,
} from '@/hooks/useGanttViewPreferences';

interface GanttSettingsPanelProps {
  preferences: GanttViewPreferences;
  onPreferencesChange: (prefs: Partial<GanttViewPreferences>) => void;
  onReset: () => void;
}

export function GanttSettingsPanel({
  preferences,
  onPreferencesChange,
  onReset,
}: GanttSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const groupByOptions: { value: GroupByOption; label: string; description: string }[] = [
    { value: 'none', label: 'Aucun', description: 'Liste simple' },
    { value: 'department', label: 'Service', description: 'Grouper par département' },
    { value: 'company', label: 'Société', description: 'Grouper par entreprise' },
    { value: 'team', label: 'Équipe', description: 'Grouper par équipe N+1' },
  ];

  const zoomOptions: { value: ZoomLevel; label: string; dayWidth: number }[] = [
    { value: 'day', label: 'Jour', dayWidth: 120 },
    { value: 'week', label: 'Semaine', dayWidth: 80 },
    { value: 'month', label: 'Mois', dayWidth: 40 },
  ];

  const columnOptions: { key: keyof GanttColumnConfig; label: string }[] = [
    { key: 'avatar', label: 'Avatar' },
    { key: 'name', label: 'Nom' },
    { key: 'role', label: 'Poste' },
    { key: 'department', label: 'Service' },
    { key: 'capacity', label: 'Jauge de charge' },
    { key: 'taskCount', label: 'Nb de tâches' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Paramètres</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[450px] p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Personnaliser la vue
          </SheetTitle>
          <SheetDescription>
            Configurez l'affichage du Gantt selon vos préférences
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="px-6 space-y-6">
            {/* Group By */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Grouper par</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {groupByOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => onPreferencesChange({ groupBy: option.value })}
                    className={cn(
                      "p-3 rounded-xl border-2 text-left transition-all",
                      preferences.groupBy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-sm font-medium">{option.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Zoom Level */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Niveau de zoom</Label>
              </div>
              <div className="flex rounded-xl bg-muted p-1">
                {zoomOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => onPreferencesChange({ zoomLevel: option.value })}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                      preferences.zoomLevel === option.value
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Display Options */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Affichage</Label>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm">Heatmap de charge</Label>
                      <p className="text-xs text-muted-foreground">Coloration par niveau de charge</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.showHeatmap}
                    onCheckedChange={(checked) => onPreferencesChange({ showHeatmap: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm">Week-ends</Label>
                      <p className="text-xs text-muted-foreground">Afficher les colonnes week-end</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.showWeekends}
                    onCheckedChange={(checked) => onPreferencesChange({ showWeekends: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Columns3 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm">Mode compact</Label>
                      <p className="text-xs text-muted-foreground">Réduire la hauteur des lignes</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.compactMode}
                    onCheckedChange={(checked) => onPreferencesChange({ compactMode: checked })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Column Config */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Columns3 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Colonnes collaborateur</Label>
              </div>
              <div className="space-y-2">
                {columnOptions.map(option => (
                  <div
                    key={option.key}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Label className="text-sm cursor-pointer">{option.label}</Label>
                    <Switch
                      checked={preferences.columnConfig[option.key]}
                      onCheckedChange={(checked) => 
                        onPreferencesChange({ 
                          columnConfig: { ...preferences.columnConfig, [option.key]: checked } 
                        })
                      }
                      disabled={option.key === 'name'} // Name is required
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Row Height */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Hauteur des lignes</Label>
                <span className="text-sm text-muted-foreground">{preferences.rowHeight}px</span>
              </div>
              <Slider
                value={[preferences.rowHeight]}
                onValueChange={([value]) => onPreferencesChange({ rowHeight: value })}
                min={48}
                max={120}
                step={8}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Compact</span>
                <span>Large</span>
              </div>
            </div>

            <Separator />

            {/* Member Column Width */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Largeur colonne collaborateur</Label>
                <span className="text-sm text-muted-foreground">{preferences.memberColumnWidth}px</span>
              </div>
              <Slider
                value={[preferences.memberColumnWidth]}
                onValueChange={([value]) => onPreferencesChange({ memberColumnWidth: value })}
                min={180}
                max={400}
                step={20}
                className="py-2"
              />
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 pt-4 border-t">
          <Button variant="outline" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
