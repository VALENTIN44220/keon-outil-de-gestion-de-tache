import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, GitMerge } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DuplicateProfile {
  id: string;
  user_id: string | null;
  display_name: string | null;
  lovable_email: string | null;
  secondary_email: string | null;
  lovable_status: string | null;
  status: string | null;
  id_lucca: string | null;
  created_at: string;
}

interface DuplicateGroup {
  id_lucca: string;
  profiles: DuplicateProfile[];
}

export function LuccaDuplicatesTab() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<string | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<DuplicateGroup | null>(null);

  const fetchDuplicates = useCallback(async () => {
    setIsLoading(true);
    try {
      // Step 1: get id_lucca values with count > 1
      const { data: allProfiles, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, lovable_email, secondary_email, lovable_status, status, id_lucca, created_at')
        .not('id_lucca', 'is', null)
        .order('id_lucca')
        .order('created_at');

      if (error) throw error;

      // Group by id_lucca and keep only groups with 2+ profiles
      const map = new Map<string, DuplicateProfile[]>();
      for (const p of (allProfiles || []) as DuplicateProfile[]) {
        if (!p.id_lucca) continue;
        const arr = map.get(p.id_lucca) || [];
        arr.push(p);
        map.set(p.id_lucca, arr);
      }

      const duplicateGroups: DuplicateGroup[] = [];
      for (const [id_lucca, profiles] of map) {
        if (profiles.length > 1) {
          duplicateGroups.push({ id_lucca, profiles });
        }
      }

      setGroups(duplicateGroups);
      setHasChecked(true);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleMerge = async (group: DuplicateGroup) => {
    const keepId = selected[group.id_lucca];
    if (!keepId) return;

    setMerging(group.id_lucca);
    const keepProfile = group.profiles.find(p => p.id === keepId)!;
    const toDelete = group.profiles.filter(p => p.id !== keepId);

    try {
      for (const dup of toDelete) {
        // a. Transfer tasks (assignee_id)
        await supabase
          .from('tasks')
          .update({ assignee_id: keepId } as any)
          .eq('assignee_id', dup.id);

        // b. Transfer pending_task_assignments
        await supabase
          .from('pending_task_assignments')
          .update({ assignee_id: keepId } as any)
          .eq('assignee_id', dup.id);

        // c. Preserve email as secondary_email
        if (
          dup.lovable_email &&
          dup.lovable_email !== keepProfile.lovable_email &&
          !keepProfile.secondary_email
        ) {
          await supabase
            .from('profiles')
            .update({ secondary_email: dup.lovable_email })
            .eq('id', keepId);
          keepProfile.secondary_email = dup.lovable_email;
        }

        // d. Delete duplicate profile
        const { error: delError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', dup.id);

        if (delError) throw delError;
      }

      // Remove group from list
      setGroups(prev => prev.filter(g => g.id_lucca !== group.id_lucca));
      setSelected(prev => {
        const next = { ...prev };
        delete next[group.id_lucca];
        return next;
      });

      toast({ title: 'Fusion effectuée avec succès' });
    } catch (err: any) {
      toast({
        title: 'Erreur lors de la fusion',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setMerging(null);
      setConfirmGroup(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Doublons Lucca</h2>
          <p className="text-sm text-muted-foreground">
            Détectez et fusionnez les profils partageant le même identifiant Lucca.
          </p>
        </div>
        <Button onClick={fetchDuplicates} disabled={isLoading} variant="outline">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {hasChecked ? 'Vérifier à nouveau' : 'Lancer la détection'}
        </Button>
      </div>

      {!hasChecked && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GitMerge className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Cliquez sur "Lancer la détection" pour rechercher les doublons.</p>
          </CardContent>
        </Card>
      )}

      {hasChecked && groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium">Aucun doublon détecté ✓</p>
            <p className="text-sm text-muted-foreground mt-1">Tous les identifiants Lucca sont uniques.</p>
          </CardContent>
        </Card>
      )}

      {groups.map(group => (
        <Card key={group.id_lucca}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Lucca #{group.id_lucca}
              <Badge variant="secondary">{group.profiles.length} profils</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selected[group.id_lucca] || ''}
              onValueChange={(val) => setSelected(prev => ({ ...prev, [group.id_lucca]: val }))}
              className="space-y-3"
            >
              {group.profiles.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selected[group.id_lucca] === p.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <RadioGroupItem value={p.id} id={`radio-${p.id}`} />
                  <Label htmlFor={`radio-${p.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.display_name || '(sans nom)'}</span>
                      {p.lovable_email && (
                        <span className="text-sm text-muted-foreground">{p.lovable_email}</span>
                      )}
                      <Badge variant={p.lovable_status === 'OK' ? 'default' : 'secondary'} className="text-xs">
                        {p.lovable_status || 'N/A'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{p.status || 'N/A'}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Créé le {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="mt-4 flex justify-end">
              <Button
                variant="destructive"
                disabled={!selected[group.id_lucca] || merging === group.id_lucca}
                onClick={() => setConfirmGroup(group)}
              >
                {merging === group.id_lucca && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Fusionner
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmGroup} onOpenChange={() => setConfirmGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la fusion</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmGroup && (() => {
                const keepId = selected[confirmGroup.id_lucca];
                const keep = confirmGroup.profiles.find(p => p.id === keepId);
                const toRemove = confirmGroup.profiles.filter(p => p.id !== keepId);
                return (
                  <>
                    Cette action est irréversible.{' '}
                    {toRemove.map(p => p.display_name || p.lovable_email || p.id).join(', ')}{' '}
                    sera supprimé et ses données transférées vers{' '}
                    <strong>{keep?.display_name || keep?.lovable_email}</strong>. Continuer ?
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmGroup && handleMerge(confirmGroup)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Fusionner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
