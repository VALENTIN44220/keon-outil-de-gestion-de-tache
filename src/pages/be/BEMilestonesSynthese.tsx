/**
 * BEMilestonesSynthese — vue synthèse cross-projets des jalons (BUG-00019, Lot 1).
 *
 * Tableau projet × type de jalon (pivot). Choix des colonnes affichées +
 * vues enregistrables (user_filter_presets, contexte 'be_milestones_synthese').
 * Chaque projet apparaît même sans jalon (colonnes issues du référentiel).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Columns, Search, Save, Star, Trash2, RefreshCw, CalendarRange, Loader2,
  Table as TableIcon, GitCommitHorizontal,
} from 'lucide-react';
import type { MilestoneCell, MilestoneType } from '@/hooks/useBEMilestonesSynthese';
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

// Régime ICPE : un projet suit UN régime ; les jalons ICPE applicables diffèrent.
const ICPE_TYPES = ['icpe_depot', 'icpe_completude', 'icpe_arrete', 'icpe_purge'];
const ICPE_BY_REGIME: Record<string, string[]> = {
  declaration:    ['icpe_depot', 'icpe_completude', 'icpe_purge'],           // pas d'arrêté (récépissé)
  enregistrement: ['icpe_depot', 'icpe_completude', 'icpe_arrete', 'icpe_purge'],
  autorisation:   ['icpe_depot', 'icpe_arrete', 'icpe_purge'],               // enquête publique, pas de complétude
};
function regimeKey(r: string | null): string | null {
  if (!r) return null;
  const s = r.toLowerCase();
  if (s.startsWith('décl') || s.startsWith('decl')) return 'declaration';
  if (s.startsWith('enreg')) return 'enregistrement';
  if (s.startsWith('autor')) return 'autorisation';
  return null;
}
/** Un type de jalon est-il pertinent pour ce projet (selon son régime ICPE) ? */
function isApplicable(regime: string | null, typeCode: string): boolean {
  if (!ICPE_TYPES.includes(typeCode)) return true;       // non-ICPE : toujours applicable
  const key = regimeKey(regime);
  if (!key) return true;                                  // régime inconnu : tout applicable
  return ICPE_BY_REGIME[key].includes(typeCode);
}

const fmt = (iso: string) => {
  try { return format(new Date(iso), 'dd/MM/yy', { locale: fr }); } catch { return iso; }
};

export default function BEMilestonesSynthese() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const openProject = (code: string | null) => {
    if (code) navigate(`/be/projects/${encodeURIComponent(code)}/overview`);
  };
  const [activeView, setActiveView] = useState('be-jalons');
  const { data, isLoading, refetch, isFetching } = useBEMilestonesSynthese();

  const types = data?.types ?? [];
  const rows = data?.rows ?? [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [onlyWithData, setOnlyWithData] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
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

                <div className="flex items-center rounded-md border overflow-hidden">
                  <button
                    onClick={() => setViewMode('table')}
                    className={cn('h-9 px-3 text-xs flex items-center gap-1.5', viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                  >
                    <TableIcon className="h-4 w-4" /> Tableau
                  </button>
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={cn('h-9 px-3 text-xs flex items-center gap-1.5 border-l', viewMode === 'timeline' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                  >
                    <GitCommitHorizontal className="h-4 w-4" /> Timeline
                  </button>
                </div>

                <Button variant="outline" size="sm" className="h-9" onClick={() => void refetch()} disabled={isFetching}>
                  <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                <span>{filteredRows.length} projet{filteredRows.length !== 1 ? 's' : ''}</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> date réelle</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> prévue</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-muted-foreground/30" /> vide (cliquable)</span>
                <span className="inline-flex items-center gap-1">—&nbsp;n/a selon régime ICPE</span>
              </p>
            </Card>

            {viewMode === 'table' ? (
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
                            <button
                              type="button"
                              onClick={() => openProject(r.code_projet)}
                              className="text-left hover:underline hover:text-primary"
                              title="Ouvrir la fiche projet"
                            >
                              <span className="font-mono text-xs text-muted-foreground">{r.code_projet ?? '—'}</span>
                              <span className="ml-2">{r.nom_projet ?? ''}</span>
                            </button>
                            <RegimeBadge regime={r.regime_icpe} />
                          </TableCell>
                          {visibleTypes.map(t => (
                            <TableCell key={t.code} className="text-center text-sm whitespace-nowrap p-1">
                              <MilestoneCellEditor
                                projectId={r.project_id}
                                type={t}
                                cell={r.cells[t.code]}
                                applicable={isApplicable(r.regime_icpe, t.code)}
                                onSaved={() => void refetch()}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ) : (
              /* ── Vue timeline : un axe chronologique par projet ── */
              <div className="space-y-3">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground py-10 text-center">Chargement…</p>
                ) : filteredRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-10 text-center">Aucun projet</p>
                ) : filteredRows.map(r => {
                  const nodes = visibleTypes
                    .filter(t => r.cells[t.code] && isApplicable(r.regime_icpe, t.code))
                    .map(t => ({ type: t, cell: r.cells[t.code]! }))
                    .sort((a, b) => a.cell.date.localeCompare(b.cell.date));
                  return (
                    <Card key={r.project_id} className="border-border/50 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => openProject(r.code_projet)}
                          className="flex items-center gap-2 text-left hover:underline hover:text-primary"
                          title="Ouvrir la fiche projet"
                        >
                          <span className="font-mono text-xs text-muted-foreground">{r.code_projet ?? '—'}</span>
                          <span className="font-medium text-sm">{r.nom_projet ?? ''}</span>
                        </button>
                        <RegimeBadge regime={r.regime_icpe} />
                      </div>
                      {nodes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucun jalon daté</p>
                      ) : (
                        <div className="flex items-start gap-0 overflow-x-auto pb-2">
                          {nodes.map((n, i) => (
                            <div key={n.type.code} className="flex items-start shrink-0">
                              <div className="flex flex-col items-center min-w-[110px] px-1">
                                <span className="text-[11px] text-center text-muted-foreground leading-tight mb-1 h-8 flex items-end">
                                  {n.type.label}
                                </span>
                                <span className={cn(
                                  'h-3 w-3 rounded-full border-2',
                                  n.cell.prevu ? 'bg-amber-200 border-amber-400' : 'bg-emerald-500 border-emerald-600',
                                )} />
                                <span className={cn(
                                  'text-xs mt-1 whitespace-nowrap',
                                  n.cell.prevu ? 'italic text-amber-700' : 'font-medium text-emerald-700',
                                )}>
                                  {fmt(n.cell.date)}
                                </span>
                              </div>
                              {i < nodes.length - 1 && (
                                <div className="h-3 mt-[34px] w-8 border-t-2 border-dashed border-muted-foreground/30 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Cellule éditable : clic → popover date. Upsert dans be_project_milestones.
function RegimeBadge({ regime }: { regime: string | null }) {
  if (!regime) return null;
  return (
    <span className="ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded-full border border-sky-300 bg-sky-50 text-sky-700 align-middle">
      ICPE {regime}
    </span>
  );
}

function MilestoneCellEditor({ projectId, type, cell, applicable, onSaved }: {
  projectId: string;
  type: MilestoneType;
  cell: MilestoneCell | undefined;
  applicable: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(cell?.date ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setValue(cell?.date ?? ''); }, [open, cell?.date]);

  const save = async () => {
    if (!value) return;
    setBusy(true);
    try {
      const sb = supabase as any;
      const { data: existing } = await sb
        .from('be_project_milestones')
        .select('id, source_task_id')
        .eq('be_project_id', projectId)
        .eq('type_code', type.code)
        .eq('is_auto_delayed', false)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await sb.from('be_project_milestones')
          .update({ date_reelle: value, statut: 'termine', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('be_project_milestones').insert({
          be_project_id: projectId,
          type_code: type.code,
          titre: type.label,
          date_reelle: value,
          statut: 'termine',
          source_task_id: null,
          is_auto_delayed: false,
          ordre: type.ordre ?? null,
        });
        if (error) throw error;
      }
      toast.success(`${type.label} : ${value}`);
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      const sb = supabase as any;
      const { data: existing } = await sb
        .from('be_project_milestones')
        .select('id, source_task_id')
        .eq('be_project_id', projectId)
        .eq('type_code', type.code)
        .eq('is_auto_delayed', false)
        .maybeSingle();
      if (existing?.id) {
        // Jalon auto (issu d'une tâche) : on efface juste la date réelle.
        // Jalon manuel : on le supprime.
        if (existing.source_task_id) {
          const { error } = await sb.from('be_project_milestones')
            .update({ date_reelle: null, statut: 'en_cours', updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await sb.from('be_project_milestones').delete().eq('id', existing.id);
          if (error) throw error;
        }
      }
      toast.success('Date effacée');
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setBusy(false);
    }
  };

  // Jalon non pertinent pour le régime ICPE du projet → non éditable.
  if (!applicable) {
    return (
      <span
        className="block w-full min-w-[64px] rounded px-1.5 py-1 text-muted-foreground/40 bg-muted/30"
        title="Non applicable pour ce régime ICPE"
      >
        —
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'w-full min-w-[64px] rounded px-1.5 py-1 transition-colors border',
            cell && !cell.prevu && 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
            cell && cell.prevu && 'bg-amber-50 border-amber-200 hover:bg-amber-100',
            !cell && 'border-transparent text-muted-foreground/30 hover:bg-muted',
          )}
          title="Cliquer pour saisir / modifier la date"
        >
          {cell
            ? <span className={cn(cell.prevu ? 'italic text-amber-700' : 'font-medium text-emerald-700')}>{fmt(cell.date)}</span>
            : '·'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64 space-y-2">
        <p className="text-xs font-medium">{type.label}</p>
        <Input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          className="h-8"
        />
        <div className="flex items-center justify-between gap-2">
          {cell ? (
            <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={clear} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Effacer
            </Button>
          ) : <span />}
          <Button size="sm" className="h-8" onClick={save} disabled={busy || !value}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Enregistrer'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
