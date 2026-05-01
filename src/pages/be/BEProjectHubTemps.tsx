import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { useBEProjectByCode } from '@/hooks/useBEProjectHub';
import { useBEProjectHubCode } from '@/hooks/useBEProjectHubCode';
import { useBETempsDetail, type BETempsDetailRow } from '@/hooks/useBETempsDetail';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import {
  Search,
  Clock,
  Download,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BE_POSTE_LABEL, BE_POSTE_ICON, type BEPoste } from '@/types/beTemps';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const numj = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const numh = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

type SortKey =
  | 'mois'
  | 'code_affaire'
  | 'user_display_name'
  | 'poste'
  | 'jours'
  | 'heures'
  | 'cout_rh';
type SortDir = 'asc' | 'desc';

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function BEProjectHubTemps() {
  const code = useBEProjectHubCode();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: rows = [], isLoading: rowsLoading } = useBETempsDetail(project?.id);

  const [search, setSearch] = useState('');
  const [posteFilter, setPosteFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [affaireFilter, setAffaireFilter] = useState<string>('all');
  const [moisFilter, setMoisFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('mois');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Listes pour les selecteurs (recalcules sur les donnees brutes)
  const allUsers = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.user_id) m.set(r.user_id, r.user_display_name ?? '—');
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const allAffaires = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.code_affaire);
    return Array.from(s).sort();
  }, [rows]);

  const allMois = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.mois);
    return Array.from(s).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (posteFilter !== 'all' && r.poste !== posteFilter) return false;
      if (userFilter !== 'all' && r.user_id !== userFilter) return false;
      if (affaireFilter !== 'all' && r.code_affaire !== affaireFilter) return false;
      if (moisFilter !== 'all' && r.mois !== moisFilter) return false;
      if (q) {
        const hay = `${r.code_affaire} ${r.affaire_libelle ?? ''} ${r.user_display_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, posteFilter, userFilter, affaireFilter, moisFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = (a as any)[sortKey] ?? '';
      const vb = (b as any)[sortKey] ?? '';
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(() => {
    let jours = 0;
    let heures = 0;
    let cout = 0;
    for (const r of filtered) {
      jours += r.jours;
      heures += r.heures;
      cout += r.cout_rh;
    }
    return { jours, heures, cout };
  }, [filtered]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'mois' || k === 'jours' || k === 'heures' || k === 'cout_rh' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const exportCsv = () => {
    const header = [
      'Mois',
      'Code affaire',
      'Libelle affaire',
      'Collaborateur',
      'Poste',
      'Jours',
      'Heures',
      'Cout RH (EUR)',
      'Nb saisies',
    ];
    const lines = sorted.map((r) => [
      format(new Date(r.mois), 'yyyy-MM'),
      r.code_affaire,
      r.affaire_libelle ?? '',
      r.user_display_name ?? '',
      BE_POSTE_LABEL[r.poste as BEPoste] ?? r.poste,
      numj(r.jours),
      numh(r.heures),
      Math.round(r.cout_rh).toString(),
      r.nb_saisies.toString(),
    ]);
    const csv =
      [header, ...lines]
        .map((row) => row.map(escapeCsv).join(';'))
        .join('\n') + '\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temps-${project?.code_projet ?? 'export'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (projectLoading) {
    return (
      <BEProjectHubLayout>
        <Skeleton className="h-64 w-full" />
      </BEProjectHubLayout>
    );
  }

  if (!project) {
    return (
      <BEProjectHubLayout>
        <div className="text-center py-12 text-muted-foreground">Projet non trouvé</div>
      </BEProjectHubLayout>
    );
  }

  const hasFilters =
    !!search.trim() ||
    posteFilter !== 'all' ||
    userFilter !== 'all' ||
    affaireFilter !== 'all' ||
    moisFilter !== 'all';

  // Saisies orphelines = code Lucca sans affaire BE rattachee
  const orphans = filtered.filter((r) => !r.be_affaire_id).length;

  return (
    <BEProjectHubLayout>
      <div className="space-y-4">
        {/* KPI bandeau (totaux filtres) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                <Clock className="h-3 w-3 text-emerald-600" />
                Jours déclarés
              </div>
              <p className="text-xl font-bold tabular-nums">{numj(totals.jours)} j</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Heures déclarées
              </div>
              <p className="text-xl font-bold tabular-nums">{numh(totals.heures)} h</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Coût RH
              </div>
              <p className="text-xl font-bold tabular-nums">{eur(totals.cout)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Lignes affichées
              </div>
              <p className="text-xl font-bold tabular-nums">{filtered.length.toLocaleString('fr-FR')}</p>
              {orphans > 0 && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  {orphans} sans affaire BE
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Toolbar filtres */}
        <Card className="border-border/50">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (affaire, libellé, user)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <Select value={moisFilter} onValueChange={setMoisFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Mois" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous mois</SelectItem>
                {allMois.map((m) => (
                  <SelectItem key={m} value={m}>
                    {format(new Date(m), 'MMMM yyyy', { locale: fr })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={affaireFilter} onValueChange={setAffaireFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Affaire" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">Toutes affaires</SelectItem>
                {allAffaires.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Collaborateur" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">Tous collaborateurs</SelectItem>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={posteFilter} onValueChange={setPosteFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Poste" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous postes</SelectItem>
                {(Object.keys(BE_POSTE_LABEL) as BEPoste[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {BE_POSTE_ICON[p]} {BE_POSTE_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 ml-auto"
              onClick={exportCsv}
              disabled={sorted.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </CardContent>
        </Card>

        {/* Tableau */}
        {rowsLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : sorted.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
              {hasFilters
                ? 'Aucune saisie ne correspond aux filtres.'
                : 'Aucune saisie de temps Lucca pour ce projet.'}
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-28">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('mois')}>
                      Mois <SortIcon k="mois" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('code_affaire')}>
                      Affaire <SortIcon k="code_affaire" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('user_display_name')}>
                      Collaborateur <SortIcon k="user_display_name" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('poste')}>
                      Poste <SortIcon k="poste" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button className="flex items-center gap-1 ml-auto hover:text-foreground" onClick={() => toggleSort('jours')}>
                      Jours <SortIcon k="jours" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button className="flex items-center gap-1 ml-auto hover:text-foreground" onClick={() => toggleSort('heures')}>
                      Heures <SortIcon k="heures" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button className="flex items-center gap-1 ml-auto hover:text-foreground" onClick={() => toggleSort('cout_rh')}>
                      Coût RH <SortIcon k="cout_rh" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r, i) => {
                  const posteLabel = BE_POSTE_LABEL[r.poste as BEPoste] ?? r.poste;
                  const posteIcon = BE_POSTE_ICON[r.poste as BEPoste] ?? '•';
                  return (
                    <TableRow key={`${r.mois}-${r.code_affaire}-${r.user_id}-${r.poste}-${i}`} className="hover:bg-muted/30">
                      <TableCell className="font-medium capitalize text-xs">
                        {format(new Date(r.mois), 'MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <code className="text-xs font-mono font-semibold text-primary">{r.code_affaire}</code>
                          {r.affaire_libelle && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={r.affaire_libelle}>
                              {r.affaire_libelle}
                            </span>
                          )}
                          {!r.be_affaire_id && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 mt-0.5 border-amber-500/40 text-amber-600 w-fit">
                              orpheline
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.user_display_name ?? <span className="text-muted-foreground italic">inconnu</span>}</TableCell>
                      <TableCell>
                        <span className={cn('text-xs flex items-center gap-1')}>
                          <span>{posteIcon}</span>
                          {posteLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{numj(r.jours)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{numh(r.heures)}</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(r.cout_rh)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </BEProjectHubLayout>
  );
}
