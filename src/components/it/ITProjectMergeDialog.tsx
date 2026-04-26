import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Search, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useITProjects } from '@/hooks/useITProjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs initialement cochés (optionnel, ex: pré-sélection depuis la liste). */
  initialSelected?: string[];
  onMerged?: (masterId: string) => void;
}

export function ITProjectMergeDialog({ open, onOpenChange, initialSelected, onMerged }: Props) {
  const { projects, isLoading } = useITProjects();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [masterId, setMasterId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setMasterId('');
      setSearch('');
      setConfirmOpen(false);
      return;
    }
    if (initialSelected && initialSelected.length > 0) {
      setSelected(new Set(initialSelected));
      setMasterId(initialSelected[0]);
    }
  }, [open, initialSelected]);

  // Reset master if it leaves the selection
  useEffect(() => {
    if (masterId && !selected.has(masterId)) {
      const next = Array.from(selected)[0] ?? '';
      setMasterId(next);
    }
  }, [selected, masterId]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (!q) return true;
      return `${p.code_projet_digital ?? ''} ${p.nom_projet}`.toLowerCase().includes(q);
    });
  }, [projects, search]);

  const sourceIds = useMemo(
    () => Array.from(selected).filter((id) => id !== masterId),
    [selected, masterId]
  );

  // Compte enfants des sources (preview)
  const previewQuery = useQuery({
    queryKey: ['merge-preview', Array.from(selected).sort().join(',')],
    enabled: open && selected.size >= 2 && !!masterId,
    queryFn: async () => {
      const ids = sourceIds;
      if (ids.length === 0) return { tasks: 0, milestones: 0, budgetLines: 0, expenses: 0, solutionLinks: 0 };

      const counts = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('it_project_id', ids),
        supabase.from('it_project_milestones').select('id', { count: 'exact', head: true }).in('it_project_id', ids),
        supabase.from('it_budget_lines').select('id', { count: 'exact', head: true }).in('it_project_id', ids),
        supabase.from('it_manual_expenses').select('id', { count: 'exact', head: true }).in('it_project_id', ids),
        supabase.from('it_solution_projects').select('project_id', { count: 'exact', head: true }).in('project_id', ids),
      ]);
      return {
        tasks: counts[0].count ?? 0,
        milestones: counts[1].count ?? 0,
        budgetLines: counts[2].count ?? 0,
        expenses: counts[3].count ?? 0,
        solutionLinks: counts[4].count ?? 0,
      };
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runMerge = async () => {
    if (!masterId || sourceIds.length === 0) return;
    setPending(true);
    try {
      const { error } = await supabase.rpc('merge_it_projects', {
        master_id: masterId,
        source_ids: sourceIds,
      });
      if (error) throw error;
      toast({
        title: 'Fusion terminée',
        description: `${sourceIds.length} projet(s) fusionné(s) dans le master.`,
      });
      qc.invalidateQueries(); // tout invalider, plus simple
      onMerged?.(masterId);
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPending(false);
      setConfirmOpen(false);
    }
  };

  const masterProject = projects.find((p) => p.id === masterId);
  const sourceProjects = sourceIds.map((id) => projects.find((p) => p.id === id)).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fusionner des projets IT</DialogTitle>
          <DialogDescription>
            Sélectionne au moins deux projets, choisis le master, puis confirme. Les enfants
            (tâches, jalons, lignes budgétaires, dépenses, liens cartographie) seront réassignés
            au master, puis les projets sources seront supprimés. Action irréversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recherche / liste */}
          <div className="space-y-2">
            <Label className="text-xs">Sélection des projets à fusionner</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par code ou nom..."
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[200px] rounded-md border">
              {isLoading ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : filteredProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Aucun projet</p>
              ) : (
                <div className="p-1">
                  {filteredProjects.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 p-2 rounded-sm hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      <span className="font-mono text-xs text-muted-foreground w-32 shrink-0 truncate">
                        {p.code_projet_digital ?? '—'}
                      </span>
                      <span className="flex-1 truncate">{p.nom_projet}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {p.statut}
                      </Badge>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Choix master */}
          {selected.size >= 2 && (
            <div className="space-y-2">
              <Label className="text-xs">Projet master (celui qui sera conservé)</Label>
              <RadioGroup value={masterId} onValueChange={setMasterId} className="space-y-1">
                {Array.from(selected).map((id) => {
                  const p = projects.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <label
                      key={id}
                      className={
                        'flex items-center gap-3 p-2 rounded-md border cursor-pointer text-sm ' +
                        (masterId === id ? 'border-primary bg-primary/5' : 'border-border')
                      }
                    >
                      <RadioGroupItem value={id} />
                      <span className="font-mono text-xs text-muted-foreground w-32 shrink-0 truncate">{p.code_projet_digital ?? '—'}</span>
                      <span className="flex-1 truncate">{p.nom_projet}</span>
                      {masterId === id && <Badge variant="default" className="text-[10px]">Master</Badge>}
                    </label>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          {/* Preview impact */}
          {selected.size >= 2 && masterId && sourceProjects.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                Impact de la fusion
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Les <strong>{sourceProjects.length}</strong> projet(s) suivant(s) seront fusionné(s) dans <strong>{masterProject?.nom_projet}</strong> (<span className="font-mono">{masterProject?.code_projet_digital}</span>) et <strong className="text-destructive">supprimés</strong> :
                </p>
                <ul className="list-disc list-inside ml-2">
                  {sourceProjects.map((p) => (
                    <li key={p!.id}>
                      <span className="font-mono">{p!.code_projet_digital}</span> — {p!.nom_projet}
                    </li>
                  ))}
                </ul>
                {previewQuery.data && (
                  <p className="pt-1">
                    Réassignations : <strong>{previewQuery.data.tasks}</strong> tâche(s), <strong>{previewQuery.data.milestones}</strong> jalon(s), <strong>{previewQuery.data.budgetLines}</strong> ligne(s) budgétaire(s), <strong>{previewQuery.data.expenses}</strong> dépense(s), <strong>{previewQuery.data.solutionLinks}</strong> lien(s) cartographie.
                  </p>
                )}
                {previewQuery.isFetching && (
                  <p className="text-[11px] italic">Calcul de l'impact en cours…</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          {!confirmOpen ? (
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5"
              disabled={!masterId || sourceIds.length === 0 || pending}
              onClick={() => setConfirmOpen(true)}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Fusionner
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5"
              disabled={pending}
              onClick={runMerge}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Confirmer la fusion irréversible
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
