import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { useBEProjectByCode } from '@/hooks/useBEProjectHub';
import { useBEProjectHubCode } from '@/hooks/useBEProjectHubCode';
import { useBETempsDetail, type BETempsDetailRow } from '@/hooks/useBETempsDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Search,
  Clock,
  Download,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertTriangle,
  LayoutList,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BE_POSTE_LABEL, BE_POSTE_ICON, type BEPoste } from '@/types/beTemps';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const numj = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const numh = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

type ViewMode = 'detail' | 'synthese';
type GroupBy = 'mois' | 'affaire' | 'collaborateur' | 'poste';

type SortKey =
  | 'mois'
  | 'code_affaire'
  | 'user_display_name'
  | 'poste'
  | 'jours'
  | 'heures'
  | 'cout_rh';
type SortDir = 'asc' | 'desc';

interface SyntheseRow {
  key: string;
  label: string;
  jours: number;
  heures: number;
  cout_rh: number;
  nb_lignes: number;
}

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'mois', label: 'Période (mois)' },
  { value: 'affaire', label: 'Affaire' },
  { value: 'collaborateur', label: 'Collaborateur' },
  { value: 'poste', label: 'Poste BE' },
];

const BAR_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6',
  '#8b5cf6', '#3b82f6', '#ef4444', '#84cc16', '#f97316',
];

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function BEProjectHubTemps() {
  const code = useBEProjectHubCode();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: rows = [], isLoading: rowsLoading } = useBETempsDetail(project?.id);

  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [groupBy, setGroupBy] = useState<GroupBy>('mois');

  const [search, setSearch] = useState('');
  const [posteFilter, setPosteFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [affaireFilter, setAffaireFilter] = useState<string>('all');
  const [moisFilter, setMoisFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('mois');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
    let jours = 0, heures = 0, cout = 0;
    for (const r of filtered) { jours += r.jours; heures += r.heures; cout += r.cout_rh; }
    return { jours, heures, cout };
  }, [filtered]);

  // ── Synthèse groupée ─────────────────────────────────────────────────────
  const syntheseRows = useMemo((): SyntheseRow[] => {
    const map = new Map<string, SyntheseRow>();
    for (const r of filtered) {
      let key: string;
      let label: string;
      switch (groupBy) {
        case 'mois':
          key = r.mois;
          label = format(new Date(r.mois), 'MMM yyyy', { locale: fr });
          break;
        case 'affaire':
          key = r.code_affaire;
          label = r.affaire_libelle ? `${r.code_affaire} — ${r.affaire_libelle}` : r.code_affaire;
          break;
        case 'collaborateur':
          key = r.user_id ?? '__unknown__';
          label = r.user_display_name ?? 'Inconnu';
          break;
        case 'poste':
          key = r.poste;
          label = `${BE_POSTE_ICON[r.poste as BEPoste] ?? '•'} ${BE_POSTE_LABEL[r.poste as BEPoste] ?? r.poste}`;
          break;
      }
      if (!map.has(key)) {
        map.set(key, { key, label, jours: 0, heures: 0, cout_rh: 0, nb_lignes: 0 });
      }
      const e = map.get(key)!;
      e.jours += r.jours;
      e.heures += r.heures;
      e.cout_rh += r.cout_rh;
      e.nb_lignes++;
    }
    return Array.from(map.values()).sort((a, b) => {
      // Mois: ordre chronologique; autres: décroissant par jours
      if (groupBy === 'mois') return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
      return b.jours - a.jours;
    });
  }, [filtered, groupBy]);

  // Label court pour l'axe X du graphe
  const chartData = useMemo(() =>
    syntheseRows.map((r, i) => ({
      ...r,
      shortLabel:
        groupBy === 'mois'
          ? format(new Date(r.key), 'MMM yy', { locale: fr })
          : r.label.length > 16 ? r.label.slice(0, 15) + '…' : r.label,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    })),
  [syntheseRows, groupBy]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'mois' || k === 'jours' || k === 'heures' || k === 'cout_rh' ? 'desc' : 'asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const exportCsv = () => {
    if (viewMode === 'detail') {
      const header = ['Mois', 'Code affaire', 'Libelle affaire', 'Collaborateur', 'Poste', 'Jours', 'Heures', 'Cout RH (EUR)', 'Nb saisies'];
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
      downloadCsv([header, ...lines], `temps-${project?.code_projet ?? 'export'}-detail`);
    } else {
      const groupLabel = GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ?? groupBy;
      const header = [groupLabel, 'Jours', 'Heures', 'Cout RH (EUR)', 'Nb lignes'];
      const lines = syntheseRows.map((r) => [
        r.label,
        numj(r.jours),
        numh(r.heures),
        Math.round(r.cout_rh).toString(),
        r.nb_lignes.toString(),
      ]);
      downloadCsv([header, ...lines], `temps-${project?.code_projet ?? 'export'}-synthese-${groupBy}`);
    }
  };

  if (projectLoading) return <BEProjectHubLayout><Skeleton className="h-64 w-full" /></BEProjectHubLayout>;
  if (!project) return <BEProjectHubLayout><div className="text-center py-12 text-muted-foreground">Projet non trouvé</div></BEProjectHubLayout>;

  const hasFilters = !!search.trim() || posteFilter !== 'all' || userFilter !== 'all' || affaireFilter !== 'all' || moisFilter !== 'all';
  const orphans = filtered.filter((r) => !r.be_affaire_id).length;

  return (
    <BEProjectHubLayout>
      <div className="space-y-4">
        {/* KPI bandeau */}
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
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Heures déclarées</div>
              <p className="text-xl font-bold tabular-nums">{numh(totals.heures)} h</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Coût RH</div>
              <p className="text-xl font-bold tabular-nums">{eur(totals.cout)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Lignes affichées</div>
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

        {/* Toolbar */}
        <Card className="border-border/50">
          <CardContent className="p-3 space-y-2">
            {/* Ligne 1 : mode + filtres */}
            <div className="flex flex-wrap items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-lg">
                <Button
                  variant={viewMode === 'detail' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setViewMode('detail')}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  Détail
                </Button>
                <Button
                  variant={viewMode === 'synthese' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setViewMode('synthese')}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Synthèse
                </Button>
              </div>

              {/* Group by — visible seulement en synthèse */}
              {viewMode === 'synthese' && (
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  <SelectTrigger className="w-[200px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_BY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Filters */}
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Affaire, libellé, user…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>

              <Select value={moisFilter} onValueChange={setMoisFilter}>
                <SelectTrigger className="w-[130px] h-9">
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
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Affaire" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">Toutes affaires</SelectItem>
                  {allAffaires.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[170px] h-9">
                  <SelectValue placeholder="Collaborateur" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">Tous</SelectItem>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={posteFilter} onValueChange={setPosteFilter}>
                <SelectTrigger className="w-[150px] h-9">
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
                disabled={viewMode === 'detail' ? sorted.length === 0 : syntheseRows.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── VUE DETAIL ──────────────────────────────────────────────── */}
        {viewMode === 'detail' && (
          rowsLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : sorted.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
                {hasFilters ? 'Aucune saisie ne correspond aux filtres.' : 'Aucune saisie de temps Lucca pour ce projet.'}
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
                          <span className="text-xs flex items-center gap-1">
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
          )
        )}

        {/* ── VUE SYNTHÈSE ────────────────────────────────────────────── */}
        {viewMode === 'synthese' && (
          rowsLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : syntheseRows.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                <BarChart2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
                Aucune donnée pour ces filtres.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Bar chart */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Jours déclarés par {GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label.toLowerCase()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: groupBy === 'mois' ? 0 : 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fontSize: 11 }}
                        angle={groupBy !== 'mois' ? -35 : 0}
                        textAnchor={groupBy !== 'mois' ? 'end' : 'middle'}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${v}j`}
                        width={36}
                      />
                      <Tooltip
                        formatter={(value: number, _name: string, props: any) => [
                          `${numj(value)} j — ${eur(props.payload.cout_rh)}`,
                          props.payload.label,
                        ]}
                        labelFormatter={() => ''}
                        contentStyle={{
                          fontSize: 12,
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 6,
                          background: 'hsl(var(--card))',
                        }}
                      />
                      <Bar dataKey="jours" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tableau agrégé */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>
                        {GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label}
                      </TableHead>
                      <TableHead className="text-right w-24">Jours</TableHead>
                      <TableHead className="text-right w-24">Heures</TableHead>
                      <TableHead className="text-right w-32">Coût RH</TableHead>
                      <TableHead className="text-right w-20 text-muted-foreground text-xs">Lignes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syntheseRows.map((r, i) => (
                      <TableRow key={r.key} className="hover:bg-muted/30">
                        <TableCell className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                          />
                          <span className="font-medium text-sm">{r.label}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {numj(r.jours)} j
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {numh(r.heures)} h
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {eur(r.cout_rh)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                          {r.nb_lignes}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Ligne total */}
                    <TableRow className="bg-muted/20 font-bold border-t-2">
                      <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">Total</TableCell>
                      <TableCell className="text-right tabular-nums">{numj(totals.jours)} j</TableCell>
                      <TableCell className="text-right tabular-nums">{numh(totals.heures)} h</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(totals.cout)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {filtered.length}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )
        )}
      </div>
    </BEProjectHubLayout>
  );
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map(escapeCsv).join(';')).join('\n') + '\n';
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
