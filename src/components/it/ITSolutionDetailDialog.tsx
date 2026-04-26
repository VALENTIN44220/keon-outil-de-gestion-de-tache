import { useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useITSolutions } from '@/hooks/useITSolutions';
import { useITProjects } from '@/hooks/useITProjects';
import { ITProjectCombobox } from '@/components/it/ITProjectCombobox';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  CRITICITE_CONFIG,
  DATALAKE_CONFIG,
  LIEN_TYPE_LABEL,
  type ITSolution,
  type ITSolutionLienType,
} from '@/types/itSolution';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solution: ITSolution | null;
  onEdit?: (solution: ITSolution) => void;
}

export function ITSolutionDetailDialog({ open, onOpenChange, solution, onEdit }: Props) {
  const navigate = useNavigate();
  const { links, linkProject, unlinkProject, deleteSolution } = useITSolutions();
  const { projects } = useITProjects();
  const [pickProjectId, setPickProjectId] = useState('');
  const [pickType, setPickType] = useState<ITSolutionLienType | ''>('');
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setPickProjectId('');
      setPickType('');
      setConfirmDelete(false);
    }
  }, [open]);

  const linkedRows = useMemo(() => {
    if (!solution) return [] as { project_id: string; type_lien: ITSolutionLienType | null; nom: string; code: string }[];
    const map = new Map(projects.map((p) => [p.id, p]));
    return links
      .filter((l) => l.solution_id === solution.id)
      .map((l) => {
        const p = map.get(l.project_id);
        return {
          project_id: l.project_id,
          type_lien: (l.type_lien ?? null) as ITSolutionLienType | null,
          nom: p?.nom_projet ?? '(projet supprimé)',
          code: p?.code_projet_digital ?? '—',
        };
      })
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [links, projects, solution]);

  const handleLink = async () => {
    if (!solution || !pickProjectId) return;
    setPending(true);
    try {
      await linkProject.mutateAsync({
        solution_id: solution.id,
        project_id: pickProjectId,
        type_lien: pickType || null,
      });
      setPickProjectId('');
      setPickType('');
      toast({ title: 'Projet lié à la solution' });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };

  const handleUnlink = async (projectId: string) => {
    if (!solution) return;
    setPending(true);
    try {
      await unlinkProject.mutateAsync({ solution_id: solution.id, project_id: projectId });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (!solution) return;
    setPending(true);
    try {
      await deleteSolution.mutateAsync(solution.id);
      toast({ title: 'Solution supprimée' });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    } finally {
      setPending(false);
      setConfirmDelete(false);
    }
  };

  if (!solution) return null;
  const criticite = solution.criticite ? CRITICITE_CONFIG[solution.criticite] : null;
  const datalake = solution.connecte_datalake ? DATALAKE_CONFIG[solution.connecte_datalake] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{solution.nom}</span>
            {solution.categorie && <Badge variant="secondary">{solution.categorie}</Badge>}
            {criticite && (
              <Badge variant="outline" className={cn('border', criticite.className)}>
                {criticite.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="Type">{solution.type ?? '—'}</Field>
            <Field label="Datalake">
              {datalake ? (
                <Badge variant="outline" className={cn('border', datalake.className)}>{datalake.label}</Badge>
              ) : '—'}
            </Field>
            <Field label="Usage principal">{solution.usage_principal ?? '—'}</Field>
            <Field label="Domaine métier">{solution.domaine_metier ?? '—'}</Field>
            <Field label="Owner métier">{solution.owner_metier?.display_name ?? '—'}</Field>
            <Field label="Owner IT">{solution.owner_it?.display_name ?? '—'}</Field>
            <Field label="Périmètre / entité">{solution.perimetre ?? '—'}</Field>
            <Field label="Statut / temporalité">{solution.statut_temporalite ?? '—'}</Field>
          </div>

          {solution.flux_principaux && (
            <Field label="Flux principaux visibles">
              <p className="whitespace-pre-wrap text-sm">{solution.flux_principaux}</p>
            </Field>
          )}

          {solution.commentaires && (
            <Field label="Commentaires / points à confirmer">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{solution.commentaires}</p>
            </Field>
          )}

          {/* Projets liés */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Projets IT liés</Label>
              <Badge variant="secondary" className="text-[10px]">{linkedRows.length}</Badge>
            </div>

            {/* Add a project link */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <ITProjectCombobox
                  value={pickProjectId}
                  onValueChange={setPickProjectId}
                  placeholder="Choisir un projet à lier..."
                />
              </div>
              <Select value={pickType || '__none__'} onValueChange={(v) => setPickType(v === '__none__' ? '' : (v as ITSolutionLienType))}>
                <SelectTrigger className="sm:w-[220px]">
                  <SelectValue placeholder="Type de lien (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {(Object.entries(LIEN_TYPE_LABEL) as [ITSolutionLienType, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={handleLink} disabled={!pickProjectId || pending} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Lier
              </Button>
            </div>

            {linkedRows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Aucun projet lié.</p>
            ) : (
              <ScrollArea className="max-h-[280px]">
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">Code</th>
                        <th className="text-left px-3 py-1.5 font-medium">Projet</th>
                        <th className="text-left px-3 py-1.5 font-medium">Type de lien</th>
                        <th className="w-[64px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedRows.map((r) => (
                        <tr key={r.project_id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-mono">{r.code}</td>
                          <td className="px-3 py-1.5">
                            <button
                              type="button"
                              className="text-blue-600 hover:underline"
                              onClick={() => {
                                onOpenChange(false);
                                navigate(`/it/projects/${r.code}`);
                              }}
                            >
                              {r.nom}
                            </button>
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {r.type_lien ? LIEN_TYPE_LABEL[r.type_lien] : '—'}
                          </td>
                          <td className="px-1 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleUnlink(r.project_id)}
                              disabled={pending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <span>Supprimer définitivement cette solution ?</span>
              <Button type="button" size="sm" variant="destructive" onClick={handleDelete} disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                Confirmer
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={pending}>
                Annuler
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive gap-1.5"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </Button>
          )}

          <div className="flex gap-2 sm:ml-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            {onEdit && (
              <Button type="button" onClick={() => onEdit(solution)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
