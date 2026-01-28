import { 
  Play, 
  Flag, 
  CheckSquare, 
  ShieldCheck, 
  Bell, 
  GitBranch,
  GripVertical,
  Layers,
  Split,
  Merge,
  RefreshCw,
  UserPlus,
  Variable,
  Database
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { WorkflowNodeType } from '@/types/workflow';

interface NodePaletteItem {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  canAdd: boolean;
  defaultConfig?: Record<string, unknown>;
  category?: string;
}

const paletteItems: NodePaletteItem[] = [
  // Flow control
  {
    type: 'start',
    label: 'Début',
    description: 'Point de départ du workflow',
    icon: <Play className="h-4 w-4" />,
    color: 'bg-green-100 text-green-700 border-green-300',
    canAdd: false,
    category: 'flow',
  },
  {
    type: 'fork',
    label: 'Fork / Parallèle',
    description: 'Démarre des branches parallèles',
    icon: <Split className="h-4 w-4" />,
    color: 'bg-teal-100 text-teal-700 border-teal-300',
    canAdd: true,
    category: 'flow',
  },
  {
    type: 'join',
    label: 'Join / Synchronisation',
    description: 'Attend les branches parallèles',
    icon: <Merge className="h-4 w-4" />,
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    canAdd: true,
    category: 'flow',
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branchement conditionnel',
    icon: <GitBranch className="h-4 w-4" />,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    canAdd: true,
    category: 'flow',
  },
  {
    type: 'end',
    label: 'Fin',
    description: 'Point de fin du workflow',
    icon: <Flag className="h-4 w-4" />,
    color: 'bg-red-100 text-red-700 border-red-300',
    canAdd: false,
    category: 'flow',
  },
  // Actions
  {
    type: 'sub_process',
    label: 'Sous-processus',
    description: 'Exécute un sous-processus',
    icon: <Layers className="h-4 w-4" />,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    canAdd: true,
    category: 'actions',
  },
  {
    type: 'task',
    label: 'Tâche',
    description: 'Tâche avec 3 sorties possibles',
    icon: <CheckSquare className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    canAdd: true,
    category: 'actions',
  },
  {
    type: 'task',
    label: 'Tâche (unitaire)',
    description: '1 seule tâche modèle par bloc',
    icon: <CheckSquare className="h-4 w-4" />,
    color: 'bg-sky-100 text-sky-700 border-sky-300',
    canAdd: true,
    defaultConfig: { selection_mode: 'single' },
    category: 'actions',
  },
  {
    type: 'validation',
    label: 'Validation',
    description: 'Approbation requise',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    canAdd: true,
    category: 'actions',
  },
  {
    type: 'status_change',
    label: 'Changement d\'état',
    description: 'Modifie le statut d\'une tâche',
    icon: <RefreshCw className="h-4 w-4" />,
    color: 'bg-pink-100 text-pink-700 border-pink-300',
    canAdd: true,
    category: 'actions',
  },
  {
    type: 'assignment',
    label: 'Affectation',
    description: 'Affecte une tâche à un utilisateur',
    icon: <UserPlus className="h-4 w-4" />,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    canAdd: true,
    category: 'actions',
  },
  {
    type: 'notification',
    label: 'Notification',
    description: 'Envoi de notification',
    icon: <Bell className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    canAdd: true,
    category: 'actions',
  },
  // Variables
  {
    type: 'set_variable',
    label: 'Définir variable',
    description: 'Crée ou modifie une variable workflow',
    icon: <Variable className="h-4 w-4" />,
    color: 'bg-violet-100 text-violet-700 border-violet-300',
    canAdd: true,
    category: 'variables',
  },
  // Integrations
  {
    type: 'datalake_sync',
    label: 'Synchronisation Datalake',
    description: 'Sync bidirectionnelle avec Datalake',
    icon: <Database className="h-4 w-4" />,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    canAdd: true,
    category: 'integrations',
  },
];

interface WorkflowNodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: WorkflowNodeType, label: string) => void;
  disabled?: boolean;
}

export function WorkflowNodePalette({ onDragStart, disabled = false }: WorkflowNodePaletteProps) {
  const handleDragStart = (event: React.DragEvent, item: NodePaletteItem) => {
    if (!item.canAdd || disabled) {
      event.preventDefault();
      return;
    }
    onDragStart(event, item.type, item.label);

    if (item.defaultConfig) {
      event.dataTransfer.setData(
        'application/workflow-node-config',
        JSON.stringify(item.defaultConfig)
      );
    }
  };

  const categories = [
    { id: 'flow', label: 'Flux' },
    { id: 'actions', label: 'Actions' },
    { id: 'variables', label: 'Variables' },
    { id: 'integrations', label: 'Intégrations' },
  ];

  return (
    <Card className="w-64 shrink-0 overflow-hidden">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium">Palette de blocs</CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        {categories.map((category, catIdx) => {
          const items = paletteItems.filter(i => i.category === category.id);
          if (items.length === 0) return null;
          
          return (
            <div key={category.id}>
              {catIdx > 0 && <Separator className="my-2" />}
              <div className="text-xs font-medium text-muted-foreground mb-1 px-1">
                {category.label}
              </div>
              <div className="space-y-1">
                {items.map((item, idx) => (
                  <div
                    key={`${category.id}-${item.type}-${item.label}-${idx}`}
                    draggable={item.canAdd && !disabled}
                    onDragStart={(e) => handleDragStart(e, item)}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg border transition-all
                      ${item.color}
                      ${item.canAdd && !disabled 
                        ? 'cursor-grab hover:shadow-md active:cursor-grabbing' 
                        : 'opacity-50 cursor-not-allowed'
                      }
                    `}
                  >
                    {item.canAdd && !disabled && (
                      <GripVertical className="h-3 w-3 opacity-50 shrink-0" />
                    )}
                    <div className={`p-1 rounded ${item.color} shrink-0`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium leading-tight">{item.label}</div>
                      <div className="text-[10px] opacity-70 truncate">{item.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        
        {disabled && (
          <div className="text-xs text-muted-foreground text-center py-2">
            Mode lecture seule
          </div>
        )}
      </CardContent>
    </Card>
  );
}
