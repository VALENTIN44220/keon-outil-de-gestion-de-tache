import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Coins, Save, Loader2, X, Clock, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  useBETjmFonctions,
  useUpdateBETjmFonction,
} from '@/hooks/useBEAffaireTemps';
import {
  useBEProfilesPostes,
  useUpdateProfileBEFonction,
} from '@/hooks/useBEProfilesPostes';
import { cn } from '@/lib/utils';

const eurH = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function BEAdminTJM() {
  // ── Référentiel fonctions ────────────────────────────────────────────────
  const { data: fonctions = [], isLoading: fonctionsLoading } = useBETjmFonctions();
  const updateFonction = useUpdateBETjmFonction();
  const [editingFonction, setEditingFonction] = useState<Record<string, string>>({});

  const startEdit = (fn: string, cur: number) =>
    setEditingFonction((p) => ({ ...p, [fn]: String(cur) }));
  const cancelEdit = (fn: string) =>
    setEditingFonction((p) => { const n = { ...p }; delete n[fn]; return n; });
  const saveEdit = async (fn: string) => {
    const val = parseFloat(editingFonction[fn]);
    if (isNaN(val) || val < 0) { toast({ title: 'Taux invalide', variant: 'destructive' }); return; }
    try {
      await updateFonction.mutateAsync({ fonction: fn, taux_horaire: val });
      toast({ title: 'Taux mis à jour', description: `${fn} → ${eurH(val)}/h` });
      cancelEdit(fn);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  // ── Profils sans correspondance auto ────────────────────────────────────
  const { data: profiles = [], isLoading: profilesLoading } = useBEProfilesPostes();
  const updateFonctionProfile = useUpdateProfileBEFonction();

  const fonctionSet = useMemo(() => new Set(fonctions.map((f) => f.fonction)), [fonctions]);

  /** Profils avec saisies Lucca dont le job_title ne matche pas le référentiel. */
  const unmatched = useMemo(
    () =>
      profiles.filter(
        (p) =>
          (p.nb_saisies ?? 0) > 0 &&
          (!p.job_title || !fonctionSet.has(p.job_title)),
      ),
    [profiles, fonctionSet],
  );

  const handleFonctionAssign = async (profileId: string, value: string) => {
    const fn = value === 'none' ? null : value;
    try {
      await updateFonctionProfile.mutateAsync({ profileId, beFonction: fn });
      toast({ title: fn ? `Fonction assignée : ${fn}` : 'Fonction retirée' });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10">
              <Coins className="h-7 w-7 text-violet-500" />
            </div>
            Référentiel TJM BE
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Les taux horaires Lucca sont appliqués automatiquement via le titre de poste du collaborateur.
            Les profils sans correspondance peuvent être affectés manuellement ci-dessous.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Priorité 1 — job_title → référentiel fonctions (auto)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              Priorité 2 — affectation manuelle ci-dessous
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              Fallback — TJM poste BE / 8h
            </span>
          </div>
        </div>

        {/* Taux horaires par fonction */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Taux horaires par fonction Lucca
              <Badge variant="secondary" className="ml-2 text-xs">{fonctions.length} fonctions</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Appliqués automatiquement quand{' '}
              <code className="bg-muted px-1 rounded text-[11px]">profiles.job_title</code>
              {' '}correspond exactement au nom de fonction. Cliquez sur un taux pour le modifier.
            </p>
          </CardHeader>
          <CardContent>
            {fonctionsLoading ? (
              <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Fonction</TableHead>
                      <TableHead className="text-right w-[220px]">Taux horaire (€/h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fonctions.map((fn) => {
                      const editing = editingFonction[fn.fonction] != null;
                      return (
                        <TableRow key={fn.fonction}>
                          <TableCell className="text-sm font-medium">{fn.fonction}</TableCell>
                          <TableCell className="text-right">
                            {editing ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editingFonction[fn.fonction]}
                                  onChange={(e) =>
                                    setEditingFonction((p) => ({ ...p, [fn.fonction]: e.target.value }))
                                  }
                                  className="h-8 w-32 text-right tabular-nums"
                                  autoFocus
                                />
                                <Button
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => saveEdit(fn.fonction)}
                                  disabled={updateFonction.isPending}
                                >
                                  {updateFonction.isPending
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Save className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => cancelEdit(fn.fonction)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(fn.fonction, fn.taux_horaire)}
                                className="tabular-nums text-sm font-semibold hover:text-primary transition-colors px-2 py-1 rounded hover:bg-muted/50"
                              >
                                {eurH(fn.taux_horaire)}/h
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profils sans correspondance */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Profils sans correspondance automatique
              {!profilesLoading && (
                <Badge
                  variant={unmatched.length > 0 ? 'outline' : 'secondary'}
                  className={cn('ml-2 text-xs', unmatched.length > 0 && 'border-amber-500/40 text-amber-600 bg-amber-500/5')}
                >
                  {unmatched.length} profil{unmatched.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Collaborateurs avec saisies Lucca dont le titre de poste ne correspond à aucune fonction du référentiel.
              Affectez-leur une fonction manuellement pour que leur taux horaire soit appliqué.
            </p>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : unmatched.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                ✅ Tous les profils avec saisies Lucca ont une correspondance automatique.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Collaborateur</TableHead>
                      <TableHead>Titre Lucca (non reconnu)</TableHead>
                      <TableHead className="text-right">Saisies</TableHead>
                      <TableHead className="w-[280px]">Affecter une fonction (TJM)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatched.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{p.display_name}</div>
                          {p.id_lucca && (
                            <div className="text-[10px] text-muted-foreground font-mono">Lucca #{p.id_lucca}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            {p.job_title ?? '— sans titre'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {p.nb_saisies} ({Math.round((p.heures_total ?? 0) / 8)} j)
                        </TableCell>
                        <TableCell>
                          <Select
                            value={p.be_fonction ?? 'none'}
                            onValueChange={(v) => handleFonctionAssign(p.id, v)}
                          >
                            <SelectTrigger
                              className={cn(
                                'h-8 text-xs',
                                p.be_fonction
                                  ? 'border-blue-500/40 bg-blue-500/5'
                                  : 'border-amber-500/40 bg-amber-500/5',
                              )}
                            >
                              <SelectValue placeholder="— Choisir une fonction…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Aucune affectation</SelectItem>
                              {fonctions.map((fn) => (
                                <SelectItem key={fn.fonction} value={fn.fonction}>
                                  <span className="flex items-center justify-between w-full gap-4">
                                    <span>{fn.fonction}</span>
                                    <span className="text-muted-foreground tabular-nums text-[11px]">
                                      {eurH(fn.taux_horaire)}/h
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
