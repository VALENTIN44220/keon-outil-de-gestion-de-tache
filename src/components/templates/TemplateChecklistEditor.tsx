import { useState } from 'react';
import { Plus, Trash2, Check, ListChecks } from 'lucide-react';
import { useTemplateChecklists } from '@/hooks/useTemplateChecklists';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TemplateChecklistEditorProps {
  taskTemplateId: string;
}

export function TemplateChecklistEditor({ taskTemplateId }: TemplateChecklistEditorProps) {
  const { 
    items, 
    isLoading, 
    addItem, 
    deleteItem,
  } = useTemplateChecklists(taskTemplateId);
  
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
    return <div className="text-xs text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-2 mt-2 border-t border-border/50 pt-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <ListChecks className="h-3 w-3" />
        <span>Sous-actions ({items.length})</span>
      </div>

      {/* Checklist items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="flex items-center gap-2 group text-xs rounded px-2 py-1 bg-muted/30"
          >
            <span className="flex-1 text-muted-foreground">
              {item.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deleteItem(item.id)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      {isAdding ? (
        <div className="flex items-center gap-1">
          <Input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Nouvelle sous-action..."
            className="h-6 text-xs"
            autoFocus
          />
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleAddItem}>
            <Check className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-6 px-2"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Ajouter une sous-action
        </Button>
      )}
    </div>
  );
}
