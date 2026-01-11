import { useState } from 'react';
import { Plus, Trash2, Check, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ChecklistItem {
  id: string;
  title: string;
  order_index: number;
}

interface InlineChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export function InlineChecklistEditor({ items, onChange }: InlineChecklistEditorProps) {
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;
    
    const newItem: ChecklistItem = {
      id: `temp-${Date.now()}`,
      title: newItemTitle.trim(),
      order_index: items.length,
    };
    
    onChange([...items, newItem]);
    setNewItemTitle('');
    setIsAdding(false);
  };

  const handleDeleteItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewItemTitle('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Sous-actions ({items.length})</Label>
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="flex items-center gap-2 group text-sm rounded px-3 py-2 bg-muted/50"
          >
            <span className="flex-1 text-foreground">
              {item.title}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDeleteItem(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
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
          <Button 
            type="button" 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 p-0" 
            onClick={handleAddItem}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une sous-action
        </Button>
      )}
    </div>
  );
}
