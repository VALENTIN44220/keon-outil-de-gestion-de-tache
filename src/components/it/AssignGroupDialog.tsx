import { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useITBudgetGroups } from '@/hooks/useITBudgetGroups';
import { extractErrorMessage } from '@/lib/extractErrorMessage';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs des lignes à assigner au groupe sélectionné/créé. */
  selectedIds: string[];
  /** Callback succès (invalidate / clearSelection côté parent). */
  onSuccess?: () => void;
}

export function AssignGroupDialog({ open, onOpenChange, selectedIds, onSuccess }: Props) {
  const { groups, isLoading, createGroup, assignLinesToGroup } = useITBudgetGroups();
  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [pickedGroupId, setPickedGroupId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode('pick');
      setPickedGroupId('');
      setNewName('');
      setNewDescription('');
    }
  }, [open]);

  const apply = async () => {
    if (selectedIds.length === 0) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    try {
      let groupId: string;
      if (mode === 'create') {
        const trimmed = newName.trim();
        if (!trimmed) {
          toast({ title: 'Nom de groupe requis', variant: 'destructive' });
          setPending(false);
          return;
        }
        const created = await createGroup.mutateAsync({
          nom: trimmed,
          description: newDescription.trim() || null,
        });
        groupId = created.id;
      } else {
        if (!pickedGroupId) {
          toast({ title: 'Sélectionnez un groupe', variant: 'destructive' });
          setPending(false);
          return;
        }
        groupId = pickedGroupId;
      }
      await assignLinesToGroup.mutateAsync({ lineIds: selectedIds, groupId });
      toast({
        title: 'Groupe affecté',
        description: `${selectedIds.length} ligne${selectedIds.length > 1 ? 's' : ''} ajoutée${selectedIds.length > 1 ? 's' : ''} au groupe.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };

  const detach = async () => {
    if (selectedIds.length === 0) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    try {
      await assignLinesToGroup.mutateAsync({ lineIds: selectedIds, groupId: null });
      toast({
        title: 'Groupe retiré',
        description: `${selectedIds.length} ligne${selectedIds.length > 1 ? 's' : ''} dégroupée${selectedIds.length > 1 ? 's' : ''}.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Affecter {selectedIds.length} ligne{selectedIds.length > 1 ? 's' : ''} à un groupe
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'pick' ? 'default' : 'outline'}
              onClick={() => setMode('pick')}
              disabled={pending}
            >
              Groupe existant
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'create' ? 'default' : 'outline'}
              onClick={() => setMode('create')}
              disabled={pending}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Créer un groupe
            </Button>
          </div>

          {mode === 'pick' ? (
            <div className="space-y-2">
              <Label>Groupe</Label>
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
                </div>
              ) : groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun groupe existant. Crée-en un avec le bouton « Créer un groupe ».
                </p>
              ) : (
                <SearchableSelect
                  value={pickedGroupId}
                  onValueChange={setPickedGroupId}
                  options={groups.map((g) => ({ value: g.id, label: g.nom }))}
                  placeholder="Sélectionner un groupe"
                  searchPlaceholder="Rechercher un groupe..."
                />
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Nom du groupe *</Label>
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Migration Divalto Q3 2026"
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optionnel)</Label>
                <Textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Contexte du regroupement..."
                  disabled={pending}
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-t pt-3">
            <Badge variant="outline" className="text-[10px]">{selectedIds.length}</Badge>
            ligne(s) sélectionnée(s) seront affectée(s) au groupe.
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={detach}
            disabled={pending}
          >
            <X className="h-3.5 w-3.5" />
            Retirer du groupe
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="button" onClick={apply} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              {mode === 'create' ? 'Créer + affecter' : 'Affecter'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
