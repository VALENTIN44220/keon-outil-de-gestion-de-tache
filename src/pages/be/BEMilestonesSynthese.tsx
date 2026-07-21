/**
 * BEMilestonesSynthese — vue synthèse cross-projets des jalons (BUG-00019, Lot 1).
 *
 * Tableau projet × type de jalon (pivot). Choix des colonnes affichées +
 * vues enregistrables (user_filter_presets, contexte 'be_milestones_synthese').
 * Chaque projet apparaît même sans jalon (colonnes issues du référentiel).
 */
import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Columns, Search, Save, Star, Trash2, RefreshCw, CalendarRange, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useBEMilestonesSynthese } from '@/hooks/useBEMilestonesSynthese';

const CONTEXT = 'be_milestones_synthese';
const LS_KEY = 'be-milestones-cols';

interface Preset { id: string; name: string; filters: any; user_id: string | null; }

const CATEGORY_LABELS: Record<string, string> = {
  reglementaire: 'Réglementaire',
  projet: 'Projet',
};

const fmt = (iso: string) => {
  try { return format(new Date(iso), 'dd/MM/yy', { locale: fr }); } catch { return iso; }
};

export default function BEMilestonesSynthese() {
  const { profile } = useAuth();
  const [activeView, setActiveView] = useState('be-jalons');
  const { data, isLoading, refetch, isFetching } = useBEMilestonesSynthese();

  const types = data?.types ?? [];
  const rows = data?.rows ?? [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [onlyWithData, setOnlyWithData] = useState(true);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newViewName, setNewViewName] = useState('');
  const [savingView, setSavingView] = useState(false);

  // Initialise la sélection de colonnes (localStorage ou tout).
  useEffect(() => {
    if (types.length === 0 || selectedCols.length > 0) return;
    let init: string[] | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) init = (JSON.parse(raw) as string[]).filter(c => types.some(t => t.code === c));
    } catch { /* ignore */ }
    setSelectedCols(init && init.length > 0 ? init : types.map(t => t.code));
  }, [types, selectedCols.length]);

  useEffect(() => {
    if (selectedCols.length > 0) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(selectedCols)); } catch { /* ignore */ }
    }
  }, [selectedCols]);

  // Vues enregistrées.
  const loadPresets = async () => {
    const { data: pr } = await (supabase as any)
      .from('user_filter_presets')
      .select('id, name, filters, user_id')
      .eq('context_type', CONTEXT)
      .order('name');
    setPresets((pr ?? []) as Preset[]);
  };
  useEffect(() => { void loadPresets(); }, []);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.status) s.add(r.status);
    return [...s].sort();
  }, [rows]);

  const visibleTypes = useMemo(
    () => types.filter(t => selectedCols.includes(t.code)),
    [types, selectedCols],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (onlyWithData && Object.keys(r.cells).length === 0) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (r.code_projet ?? '').toLowerCase().includes(q)
        || (r.nom_projet ?? '').toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter, onlyWithData]);

  const toggleCol = (code: string) =>
    setSelectedCols(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

  const saveView = async () => {
    if (!newViewName.trim() || !profile?.id) return;
    setSavingView(true);
    const { error } = await (supabase as any).from('user_filter_presets').insert({
      context_type: CONTEXT,
      name: newViewName.trim(),
      filters: { columns: selectedCols },
      user_id: profile.id,
    });
    setSavingView(false);
    if (error) { toast.error(`Erreur : ${error.message}`); return; }
    toast.success('Vue enregistrée');
    setNewViewName('');
    void loadPresets();
  };

  const applyPreset = (p: Preset) => {
    const cols = (p.filters?.columns as string[] | undefined) ?? [];
    if (cols.length > 0) setSelectedCols(cols.filter(c => types.some(t => t.code === c)));
  };

  const deletePreset = async (id: string) => {
    const { error } = await (supabase as any).from('user_filter_presets').delete().eq('id', id);
    if (error) { toast.error(`Erreur : ${error.message}`); return; }
    void loadPresets();
  };

  const grouped = useMemo(() => {
    const m = new Map<string, typeof types>();
    for (const t of types) {
      if (!m.has(t.category)) m.set(t.category, []);
      m.get(t.category)!.push(t);
    }
    return [...m.entries()];
  }, [types]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Synthèse jalons projets" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <CalendarRange className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Synthèse des jalons projets</h1>
                <p className="text-sm text-muted-foreground">
                  Dates clés par projet (dépôt PC, ICPE, OS, clôtures…). Date réelle si connue, sinon prévue.
                </p>
              </div>
            </div>

            <Card className="border-border/50 p-3">
              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9 w-[240px]"
                    placeholder="Rechercher un projet…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Statut */}
                <div className="flex items-center gap-1">
                  {['all', ...statuses].map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-colors capitalize',
                        statusFilter === st
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent text-muted-foreground border-border hover:border-primary/50',
                      )}
                    >
                      {st === 'all' ? 'Tous' : st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setOnlyWithData(v => !v)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    onlyWithData
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground border-border hover:border-primary/50',
                  )}
                >
                  Avec jalons uniquement
                </button>

                {/* Choix des colonnes */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 ml-auto">
                      <Columns className="h-4 w-4" /> Colonnes ({selectedCols.length}/{types.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
                    <DropdownMenuLabel className="flex items-center justify-between">
                      Colonnes affichées
                      <button
                        className="text-[11px] text-muted-foreground underline"
                        onClick={() => setSelectedCols(types.map(t => t.code))}
                      >
                        tout
                      </button>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {grouped.map(([cat, list]) => (
                      <div key={cat} className="px-2 py-1">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase px-1 py-1">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </p>
                        {list.map(t => (
                          <label key={t.code} className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-muted rounded">
                            <Checkbox
                              checked={selectedCols.includes(t.code)}
                              onCheckedChange={() => toggleCol(t.code)}
                            />
                            {t.label}
                          </label>
                        ))}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Vues enregistrées */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5">
                      <Star className="h-4 w-4" /> Vues
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>Vues enregistrées</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {presets.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Aucune vue enregistrée</p>
                    )}
                    {presets.map(p => (
                      <div key={p.id} className="flex items-center gap-1 px-2 py-1">
                        <button
                          onClick={() => applyPreset(p)}
                          className="flex-1 text-left text-sm px-1 py-1 hover:bg-muted rounded truncate"
                        >
                          {p.name}
                        </button>
                        {p.user_id === profile?.id && (
                          <button
                            onClick={() => deletePreset(p.id)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <DropdownMenuSeparator />
                    <div className="flex items-center gap-1 px-2 py-2" onKeyDown={(e) => e.stopPropagation()}>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Nom de la vue…"
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void saveView(); }}
                      />
                      <Button size="sm" className="h-8" onClick={saveView} disabled={savingView || !newViewName.trim()}>
                        {savingView ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" size="sm" className="h-9" onClick={() => void refetch()} disabled={isFetching}>
                  <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                {filteredRows.length} projet{filteredRows.length !== 1 ? 's' : ''} ·
                {' '}date <span className="font-medium text-foreground">réelle</span> en gras,
                {' '}<span className="italic">prévue</span> en gris italique.
              </p>
            </Card>

            <Card className="border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[220px]">Projet</TableHead>
                      {visibleTypes.map(t => (
                        <TableHead key={t.code} className="whitespace-nowrap text-center text-xs">
                          {t.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={visibleTypes.length + 1} className="text-center py-10 text-muted-foreground">Chargement…</TableCell></TableRow>
                    ) : filteredRows.length === 0 ? (
                      <TableRow><TableCell colSpan={visibleTypes.length + 1} className="text-center py-10 text-muted-foreground">Aucun projet</TableCell></TableRow>
                    ) : filteredRows.map(r => (
                      <TableRow key={r.project_id}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">
                          <span className="font-mono text-xs text-muted-foreground">{r.code_projet ?? '—'}</span>
                          <span className="ml-2">{r.nom_projet ?? ''}</span>
                        </TableCell>
                        {visibleTypes.map(t => {
                          const cell = r.cells[t.code];
                          return (
                            <TableCell key={t.code} className="text-center text-sm whitespace-nowrap">
                              {cell
                                ? <span className={cn(cell.prevu ? 'italic text-muted-foreground' : 'font-medium')}>{fmt(cell.date)}</span>
                                : <span className="text-muted-foreground/30">·</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
