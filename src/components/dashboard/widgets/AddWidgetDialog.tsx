import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WidgetType, WidgetConfig } from '../types';
import { BarChart2, PieChart, TrendingUp, Table, Activity, Hash, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddWidgetDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (widget: Omit<WidgetConfig, 'id' | 'position'>) => void;
}

const WIDGET_OPTIONS: { type: WidgetType; label: string; description: string; icon: typeof BarChart2; color: string }[] = [
  { 
    type: 'stats-summary', 
    label: 'Résumé statistiques', 
    description: 'Vue d\'ensemble des compteurs', 
    icon: Activity,
    color: 'text-keon-blue bg-keon-blue/10'
  },
  { 
    type: 'bar-chart', 
    label: 'Graphique en barres', 
    description: 'Comparaison par catégorie', 
    icon: BarChart2,
    color: 'text-keon-green bg-keon-green/10'
  },
  { 
    type: 'pie-chart', 
    label: 'Camembert / Donut', 
    description: 'Répartition en pourcentage', 
    icon: PieChart,
    color: 'text-keon-orange bg-keon-orange/10'
  },
  { 
    type: 'line-chart', 
    label: 'Courbe temporelle', 
    description: 'Évolution dans le temps', 
    icon: TrendingUp,
    color: 'text-purple-500 bg-purple-500/10'
  },
  { 
    type: 'data-table', 
    label: 'Liste des demandes', 
    description: 'Demandes avec tâches enfants dépliables', 
    icon: Table,
    color: 'text-cyan-500 bg-cyan-500/10'
  },
  { 
    type: 'task-table', 
    label: 'Liste des tâches', 
    description: 'Tâches directes + synchronisées Planner', 
    icon: ListChecks,
    color: 'text-keon-blue bg-keon-blue/10'
  },
  { 
    type: 'progress-ring', 
    label: 'Anneau de progression', 
    description: 'Taux de complétion global', 
    icon: Hash,
    color: 'text-indigo-500 bg-indigo-500/10'
  },
];

const DATA_KEYS = [
  { value: 'status', label: 'Par statut' },
  { value: 'priority', label: 'Par priorité' },
  { value: 'assignee', label: 'Par assigné' },
  { value: 'category', label: 'Par catégorie' },
  { value: 'department', label: 'Par département' },
  { value: 'timeline', label: 'Évolution temporelle' },
];

export function AddWidgetDialog({ open, onClose, onAdd }: AddWidgetDialogProps) {
  const handleAdd = (type: WidgetType) => {
    const defaultDataKey = type === 'line-chart' ? 'timeline' : type === 'bar-chart' ? 'status' : 'priority';
    const defaultSize = type === 'stats-summary' ? { w: 4, h: 2 } : 
                        type === 'data-table' || type === 'task-table' ? { w: 4, h: 4 } : 
                        type === 'line-chart' ? { w: 4, h: 3 } : 
                        { w: 2, h: 3 };
    
    onAdd({
      type,
      title: WIDGET_OPTIONS.find(w => w.type === type)?.label || 'Widget',
      dataKey: defaultDataKey,
      size: defaultSize,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-keon-900">Ajouter un widget</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
          {WIDGET_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.type}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 hover:border-keon-blue transition-all"
                onClick={() => handleAdd(option.type)}
              >
                <div className={cn('p-3 rounded-lg', option.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="font-semibold text-keon-900">{option.label}</span>
                <span className="text-xs text-keon-500 text-center">{option.description}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
