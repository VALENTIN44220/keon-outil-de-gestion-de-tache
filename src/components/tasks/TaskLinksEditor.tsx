import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Link, File, Trash2, ExternalLink, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<'link' | 'file'>('link');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Get user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erreur',
          description: 'Vous devez être connecté pour télécharger des fichiers',
          variant: 'destructive',
        });
        return;
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName);

      // Add to items
      const newItem: LinkItem = {
        id: crypto.randomUUID(),
        name: file.name,
        url: publicUrl,
        type: 'file',
      };

      onChange([...items, newItem]);

      toast({
        title: 'Fichier téléchargé',
        description: `${file.name} a été ajouté avec succès`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erreur de téléchargement',
        description: 'Impossible de télécharger le fichier',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

      {/* Add new link/file form */}
      {!readOnly && (
        <div className="space-y-3 p-3 rounded-lg border border-dashed">
          {/* File upload button */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Télécharger un fichier
                </>
              )}
            </Button>
          </div>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-muted" />
            <span className="px-3 text-xs text-muted-foreground bg-background">ou ajouter un lien</span>
            <div className="flex-1 border-t border-muted" />
          </div>

          {/* Manual link input */}
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
                    <File className="h-4 w-4" /> URL fichier
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="URL du lien"
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
            Téléchargez des fichiers ou ajoutez des liens vers des ressources externes
          </p>
        </div>
      )}

      {items.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground">Aucun lien ou pièce jointe</p>
      )}
    </div>
  );
}
