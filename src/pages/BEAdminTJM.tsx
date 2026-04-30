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
import { Coins, Search, Users, Save, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  useBETjmReferentielFull,
  useUpdateBETjm,
} from '@/hooks/useBEAffaireTemps';
import {
  useBEProfilesPostes,
  useUpdateProfileBEPoste,
} from '@/hooks/useBEProfilesPostes';
import {
  BE_POSTES,
  BE_POSTE_ICON,
  BE_POSTE_LABEL,
  type BEPoste,
} from '@/types/beTemps';
import { cn } from '@/lib/utils';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function BEAdminTJM() {
  const { data: tjmRows = [], isLoading: tjmLoading } = useBETjmReferentielFull();
  const updateTjm = useUpdateBETjm();
  const { data: profiles = [], isLoading: profilesLoading } = useBEProfilesPostes();
  const updateProfilePoste = useUpdateProfileBEPoste();

  // ── État édition TJM ───────────────────────────────────────────────────
  const [editingTjm, setEditingTjm] = useState<Record<BEPoste, string>>({} as any);

  const startEditTjm = (poste: BEPoste, current: number) => {
    setEditingTjm((prev) => ({ ...prev, [poste]: String(current) }));
  };
  const cancelEditTjm = (poste: BEPoste) => {
    setEditingTjm((prev) => {
      const next = { ...prev };
      delete next[poste];
      return next;
    });
  };
  const saveTjm = async (poste: BEPoste) => {
    const raw = editingTjm[poste];
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      toast({ title: 'TJM invalide', variant: 'destructive' });
      return;
    }
    try {
      await updateTjm.mutateAsync({ poste, tjm: val });
      toast({ title: 'TJM mis à jour', description: `${BE_POSTE_LABEL[poste]} → ${eur(val)}/jour` });
      cancelEditTjm(poste);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  // ── État liste profils ───────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterPoste, setFilterPoste] = useState<'all' | 'unassigned' | BEPoste>('all');
  const [filterActifs, setFilterActifs] = useState<'all' | 'with_temps'>('with_temps');

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (q) {
        const match =
          p.display_name.toLowerCase().includes(q) ||
          (p.job_title ?? '').toLowerCase().includes(q) ||
          (p.department ?? '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterPoste === 'unassigned' && p.be_poste != null) return false;
      if (filterPoste !== 'all' && filterPoste !== 'unassigned' && p.be_poste !== filterPoste)
        return false;
      if (filterActifs === 'with_temps' && (p.nb_saisies ?? 0) === 0) return false;
      return true;
    });
  }, [profiles, search, filterPoste, filterActifs]);

  const stats = useMemo(() => {
    const m: Record<string, number> = { total: profiles.length, unassigned: 0 };
    for (const p of profiles) {
      if (!p.be_poste) m.unassigned += 1;
      else m[p.be_poste] = (m[p.be_poste] ?? 0) + 1;
    }
    return m;
  }, [profiles]);

  const handlePosteChange = async (profileId: string, value: string) => {
    const newPoste = value === 'none' ? null : (value as BEPoste);
    try {
      await updateProfilePoste.mutateAsync({ profileId, bePoste: newPoste });
      toast({ title: 'Poste mis à jour' });
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
            Référentiel TJM &amp; postes BE
          </h1>
          <p className="text-muted-foreground mt-2">
            Définissez les TJM par poste BE et assignez un poste à chaque collaborateur.
            Le coût RH des affaires se calcule via : heures Lucca × TJM(poste du collaborateur).
          </p>
        </div>

        {/* TJM par poste */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Coins className="h-5 w-5 text-muted-foreground" />
              TJM par poste
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tjmLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {BE_POSTES.map((poste) => {
                  const row = tjmRows.find((r) => r.poste === poste);
                  const current = row?.tjm ?? 0;
                  const editing = editingTjm[poste] != null;
                  return (
                    <div
                      key={poste}
                      className="border rounded-lg p-3 bg-card flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{BE_POSTE_ICON[poste]}</span>
                        <span className="font-medium text-sm">{BE_POSTE_LABEL[poste]}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          {stats[poste] ?? 0} prof.
                        </Badge>
                      </div>
                      {editing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="10"
                            min="0"
                            value={editingTjm[poste]}
                            onChange={(e) =>
                              setEditingTjm((prev) => ({ ...prev, [poste]: e.target.value }))
                            }
                            className="h-9 text-right tabular-nums"
                            autoFocus
                          />
                          <span className="text-xs text-muted-foreground">€/j</span>
                          <Button
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => saveTjm(poste)}
                            disabled={updateTjm.isPending}
                          >
                            {updateTjm.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0"
                            onClick={() => cancelEditTjm(poste)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditTjm(poste, current)}
                          className="flex items-center justify-between h-9 px-3 rounded border bg-muted/30 hover:bg-muted/60 hover:border-primary/50 transition-colors"
                        >
                          <span className="text-xl font-bold tabular-nums">{eur(current)}</span>
                          <span className="text-[10px] text-muted-foreground">/jour · clic pour éditer</span>
                        </button>
                      )}
                      {row?.description && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {row.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Postes des collaborateurs */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-muted-foreground" />
              Postes des collaborateurs
              <Badge variant="secondary" className="ml-2 text-xs">
                {filteredProfiles.length} / {profiles.length}
              </Badge>
              {stats.unassigned > 0 && (
                <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 bg-amber-500/5">
                  {stats.unassigned} sans poste
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtres */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher (nom, fonction, dept)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterPoste} onValueChange={(v) => setFilterPoste(v as any)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtre poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les postes</SelectItem>
                  <SelectItem value="unassigned">Non assignés</SelectItem>
                  {BE_POSTES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {BE_POSTE_ICON[p]} {BE_POSTE_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterActifs} onValueChange={(v) => setFilterActifs(v as any)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="with_temps">Avec saisies Lucca</SelectItem>
                  <SelectItem value="all">Tous les actifs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {profilesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Aucun collaborateur ne correspond aux filtres.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Collaborateur</TableHead>
                      <TableHead>Fonction</TableHead>
                      <TableHead>Département</TableHead>
                      <TableHead className="text-right">Saisies Lucca</TableHead>
                      <TableHead className="w-[220px]">Poste BE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{p.display_name}</span>
                            {p.id_lucca && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Lucca #{p.id_lucca}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.job_title ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.department ?? '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {(p.nb_saisies ?? 0) > 0 ? (
                            <span>
                              {p.nb_saisies}{' '}
                              <span className="text-muted-foreground">
                                ({Math.round((p.heures_total ?? 0) / 8)} j)
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={p.be_poste ?? 'none'}
                            onValueChange={(v) => handlePosteChange(p.id, v)}
                          >
                            <SelectTrigger
                              className={cn(
                                'h-8 text-xs',
                                !p.be_poste && 'border-amber-500/40 bg-amber-500/5',
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Aucun</SelectItem>
                              {BE_POSTES.map((poste) => (
                                <SelectItem key={poste} value={poste}>
                                  {BE_POSTE_ICON[poste]} {BE_POSTE_LABEL[poste]}
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
