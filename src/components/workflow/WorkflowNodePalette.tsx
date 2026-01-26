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
  UserPlus
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { WorkflowNodeType } from '@/types/workflow';

interface NodePaletteItem {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  canAdd: boolean;
}

const paletteItems: NodePaletteItem[] = [
  {
    type: 'start',
    label: 'Début',
    description: 'Point de départ du workflow',
    icon: <Play className="h-4 w-4" />,
    color: 'bg-green-100 text-green-700 border-green-300',
    canAdd: false, // Only one allowed, created automatically
  },
  {
    type: 'fork',
    label: 'Fork / Parallèle',
    description: 'Démarre des branches parallèles',
    icon: <Split className="h-4 w-4" />,
    color: 'bg-teal-100 text-teal-700 border-teal-300',
    canAdd: true,
  },
  {
    type: 'sub_process',
    label: 'Sous-processus',
    description: 'Exécute un sous-processus',
    icon: <Layers className="h-4 w-4" />,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    canAdd: true,
  },
  {
    type: 'task',
    label: 'Tâche',
    description: 'Tâche avec 3 sorties possibles',
    icon: <CheckSquare className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    canAdd: true,
  },
  {
    type: 'validation',
    label: 'Validation',
    description: 'Approbation requise',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    canAdd: true,
  },
  {
    type: 'status_change',
    label: 'Changement d\'état',
    description: 'Modifie le statut d\'une tâche',
    icon: <RefreshCw className="h-4 w-4" />,
    color: 'bg-pink-100 text-pink-700 border-pink-300',
    canAdd: true,
  },
  {
    type: 'notification',
    label: 'Notification',
    description: 'Envoi de notification',
    icon: <Bell className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    canAdd: true,
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branchement conditionnel',
    icon: <GitBranch className="h-4 w-4" />,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    canAdd: true,
  },
  {
    type: 'join',
    label: 'Join / Synchronisation',
    description: 'Attend les branches parallèles',
    icon: <Merge className="h-4 w-4" />,
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    canAdd: true,
  },
  {
    type: 'assignment',
    label: 'Affectation',
    description: 'Affecte une tâche à un utilisateur',
    icon: <UserPlus className="h-4 w-4" />,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    canAdd: true,
  },
  {
    type: 'end',
    label: 'Fin',
    description: 'Point de fin du workflow',
    icon: <Flag className="h-4 w-4" />,
    color: 'bg-red-100 text-red-700 border-red-300',
    canAdd: false, // Only one allowed, created automatically
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
  };

  return (
    <Card className="w-64 shrink-0">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium">Palette de blocs</CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 space-y-1">
        {paletteItems.map((item) => (
          <div
            key={item.type}
            draggable={item.canAdd && !disabled}
            onDragStart={(e) => handleDragStart(e, item)}
            className={`
              flex items-center gap-3 p-2 rounded-lg border transition-all
              ${item.color}
              ${item.canAdd && !disabled 
                ? 'cursor-grab hover:shadow-md active:cursor-grabbing' 
                : 'opacity-50 cursor-not-allowed'
              }
            `}
          >
            {item.canAdd && !disabled && (
              <GripVertical className="h-4 w-4 opacity-50" />
            )}
            <div className={`p-1.5 rounded ${item.color}`}>
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs opacity-70 truncate">{item.description}</div>
            </div>
          </div>
        ))}
        
        {disabled && (
          <div className="text-xs text-muted-foreground text-center py-2">
            Mode lecture seule
          </div>
        )}
      </CardContent>
    </Card>
  );
}
