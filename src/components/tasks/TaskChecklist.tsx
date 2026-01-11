import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useChecklists } from '@/hooks/useChecklists';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TaskChecklistProps {
  taskId: string;
  compact?: boolean;
}

export function TaskChecklist({ taskId, compact = false }: TaskChecklistProps) {
  const { 
    items, 
    isLoading, 
    addItem, 
    toggleItem, 
    deleteItem,
    progress,
    completedCount,
    totalCount 
  } = useChecklists(taskId);
  
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;
    await addItem(newItemTitle.trim());
    setNewItemTitle('');
    setIsAdding(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddItem();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewItemTitle('');
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className={cn("space-y-2", compact ? "text-sm" : "")}>
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Avancement</span>
            <span>{completedCount}/{totalCount} ({progress}%)</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Checklist items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={cn(
              "flex items-center gap-2 group rounded-md px-2 py-1 hover:bg-muted/50 transition-colors",
              item.is_completed && "opacity-60"
            )}
          >
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={() => toggleItem(item.id)}
              className="h-4 w-4"
            />
            <span className={cn(
              "flex-1 text-sm",
              item.is_completed && "line-through text-muted-foreground"
            )}>
              {item.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deleteItem(item.id)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      {isAdding ? (
        <div className="flex items-center gap-2">
          <Input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Nouvelle sous-action..."
            className="h-8 text-sm"
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={handleAddItem}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Ajouter une sous-action
        </Button>
      )}
    </div>
  );
}
