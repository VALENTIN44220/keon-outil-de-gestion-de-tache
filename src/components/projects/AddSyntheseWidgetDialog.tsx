import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetConfig } from './SyntheseWidgetConfigPanel';

export type SyntheseChartType = 'pie' | 'bar';

export interface AddSyntheseWidgetResult {
  widget: WidgetConfig;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (widget: WidgetConfig) => void;
}

const CHART_TYPES: { value: SyntheseChartType; label: string; icon: typeof BarChart2; desc: string }[] = [
  { value: 'pie', label: 'Camembert / Donut', icon: PieChartIcon, desc: 'Répartition en pourcentage' },
  { value: 'bar', label: 'Graphique en barres', icon: BarChart2, desc: 'Comparaison par catégorie' },
];

const DATA_CRITERIA = [
  { value: 'status', label: 'Statut du projet' },
  { value: 'typologie', label: 'Typologie' },
  { value: 'region', label: 'Région' },
  { value: 'departement', label: 'Département' },
  { value: 'actionnariat', label: 'Actionnariat' },
  { value: 'regime_icpe', label: 'Régime ICPE' },
  { value: 'pays', label: 'Pays' },
];

const ACCENT_COLORS = ['#1E5EFF', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#FF9432', '#12B6C8', '#ec4899'];

export function AddSyntheseWidgetDialog({ open, onClose, onAdd }: Props) {
  const [chartType, setChartType] = useState<SyntheseChartType>('pie');
  const [criterion, setCriterion] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  const handleAdd = () => {
    if (!criterion) return;

    const critDef = DATA_CRITERIA.find(c => c.value === criterion);
    const label = customLabel.trim() || `${critDef?.label ?? criterion} (${chartType === 'pie' ? 'pie' : 'bar'})`;
    const accentColor = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];

    const widget: WidgetConfig = {
      id: `custom_${chartType}_${criterion}_${Date.now()}`,
      label,
      visible: true,
      size: chartType === 'bar' ? { w: 1, h: 3 } : { w: 1, h: 3 },
      accentColor,
      gradientFrom: 'from-primary/10',
      gradientTo: 'to-primary/5',
    };

    onAdd(widget);
    onClose();
    setChartType('pie');
    setCriterion('');
    setCustomLabel('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un widget</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Chart type */}
          <div className="space-y-2">
            <Label>Type de graphique</Label>
            <div className="grid grid-cols-2 gap-2">
              {CHART_TYPES.map(ct => {
                const Icon = ct.icon;
                const isActive = chartType === ct.value;
                return (
                  <button
                    key={ct.value}
                    onClick={() => setChartType(ct.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/40'
                    )}
                  >
                    <Icon className={cn('h-6 w-6', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('text-sm font-medium', isActive ? 'text-primary' : 'text-foreground')}>{ct.label}</span>
                    <span className="text-[10px] text-muted-foreground">{ct.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data criterion */}
          <div className="space-y-2">
            <Label>Critère de données</Label>
            <Select value={criterion} onValueChange={setCriterion}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un critère..." />
              </SelectTrigger>
              <SelectContent>
                {DATA_CRITERIA.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom label */}
          <div className="space-y-2">
            <Label>Nom personnalisé (optionnel)</Label>
            <Input
              placeholder="Ex: Répartition par région"
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleAdd} disabled={!criterion}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
