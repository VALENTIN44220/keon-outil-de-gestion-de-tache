import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Link, File, Trash2, ExternalLink } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LinkItem {
  id: string;
  name: string;
  url: string;
  type: 'link' | 'file';
}

interface TaskLinksEditorProps {
  items: LinkItem[];
  onChange: (items: LinkItem[]) => void;
  readOnly?: boolean;
}

export function TaskLinksEditor({ items, onChange, readOnly = false }: TaskLinksEditorProps) {
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<'link' | 'file'>('link');

  const handleAddLink = () => {
    if (!newName.trim() || !newUrl.trim()) return;

    const newItem: LinkItem = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      url: newUrl.trim(),
      type: newType,
    };

    onChange([...items, newItem]);
    setNewName('');
    setNewUrl('');
    setNewType('link');
  };

  const handleRemove = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLink();
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Liens et pièces jointes</Label>

      {/* List of existing links */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
            >
              {item.type === 'link' ? (
                <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline flex items-center gap-1"
                >
                  {item.name}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-xs text-muted-foreground truncate">{item.url}</p>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => handleRemove(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new link form */}
      {!readOnly && (
        <div className="space-y-3 p-3 rounded-lg border border-dashed">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Input
                placeholder="Nom du lien"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Select value={newType} onValueChange={(v) => setNewType(v as 'link' | 'file')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="link">
                  <span className="flex items-center gap-2">
                    <Link className="h-4 w-4" /> Lien
                  </span>
                </SelectItem>
                <SelectItem value="file">
                  <span className="flex items-center gap-2">
                    <File className="h-4 w-4" /> Fichier
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="URL du lien ou du fichier"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddLink}
              disabled={!newName.trim() || !newUrl.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ajoutez des liens vers des documents, fichiers partagés ou ressources externes
          </p>
        </div>
      )}

      {items.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground">Aucun lien ou pièce jointe</p>
      )}
    </div>
  );
}
