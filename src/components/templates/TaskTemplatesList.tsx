import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Trash2,
  Layers,
  GitBranch,
  Clock,
  Lock,
  Users,
  Building2,
  Globe,
  ListTodo,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { VISIBILITY_LABELS } from '@/types/template';
import { TaskTemplateWithContext } from '@/hooks/useAllTaskTemplates';
import { TemplateChecklistEditor } from './TemplateChecklistEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TaskTemplatesListProps {
  tasks: TaskTemplateWithContext[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRefresh?: () => void;
  viewMode?: 'list' | 'grid';
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const priorityLabels: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

const visibilityIcons: Record<string, any> = {
  private: Lock,
  internal_department: Users,
  internal_company: Building2,
  public: Globe,
};

export function TaskTemplatesList({
  tasks,
  isLoading,
  onDelete,
  onDuplicate,
  viewMode = 'list',
}: TaskTemplatesListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-card rounded-xl shadow-sm">
        <ListTodo className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-lg mb-2">Aucune tâche modèle</p>
        <p className="text-sm text-muted-foreground">
          Créez une tâche depuis l'onglet ou un processus/sous-processus
        </p>
      </div>
    );
  }

  const isGridView = viewMode === 'grid';

  return (
    <div className={isGridView ? 'space-y-1' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
      {tasks.map((task) => {
        const VisibilityIcon = visibilityIcons[task.visibility_level] || Globe;
        const isExpanded = expandedTasks.has(task.id);

        if (isGridView) {
          return (
            <Card key={task.id} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{task.title}</span>
                  <Badge variant="outline" className={`text-xs shrink-0 ${priorityColors[task.priority]}`}>
                    {priorityLabels[task.priority]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {task.process_name && (
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {task.process_name}
                    </span>
                  )}
                  {task.sub_process_name && (
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {task.sub_process_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {task.default_duration_days}j
                  </span>
                  <span className="flex items-center gap-1">
                    <VisibilityIcon className="h-3 w-3" />
                    {VISIBILITY_LABELS[task.visibility_level]}
                  </span>
                </div>
              </div>
              {task.can_manage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDuplicate(task.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Dupliquer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(task.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Card>
          );
        }

        return (
          <Card key={task.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base line-clamp-1">{task.title}</CardTitle>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
                {task.can_manage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onDuplicate(task.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Dupliquer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(task.id)}
                        className="text-destructive focus:text-destructive"
                      >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline" className={priorityColors[task.priority]}>
                  {priorityLabels[task.priority]}
                </Badge>
                {task.process_name && (
                  <Badge variant="outline" className="text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    {task.process_name}
                  </Badge>
                )}
                {task.sub_process_name && (
                  <Badge variant="outline" className="text-xs">
                    <GitBranch className="h-3 w-3 mr-1" />
                    {task.sub_process_name}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {task.default_duration_days}j
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <VisibilityIcon className="h-3 w-3 mr-1" />
                  {VISIBILITY_LABELS[task.visibility_level]}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(task.id)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    Checklist / Actions
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <TemplateChecklistEditor taskTemplateId={task.id} />
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
