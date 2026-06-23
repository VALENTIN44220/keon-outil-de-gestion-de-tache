import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Map as MapIcon, Undo2, Redo2, AlertTriangle, Loader2, ExternalLink,
  EyeOff, Eye, CalendarRange, Filter, X, ChevronDown, ChevronRight, Hash,
  ArrowUp, ArrowDown, Maximize2, Minimize2, CalendarClock, Bookmark, RotateCcw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useFdrProjects, usePatchFdrProject, type FdrRoadmapProject, type FdrProjectPatch } from '@/hooks/useFdrProjects';
import { FdrImportExport } from '@/components/it/FdrImportExport';
import { FdrHistorySheet } from '@/components/it/FdrHistorySheet';
import { useFdrSettings, useFdrProfils } from '@/hooks/useFdrSettings';
import { useViewPreferences } from '@/hooks/useViewPreferences';
import {
  computeCapacityMatrix, computeProjectMonthLoads, generateHorizon, getMepRetenue, toYM, addMonths,
} from '@/lib/fdr/calculationEngine';
import {
  type YearGran, type Period, GRAN_CYCLE, GRAN_LETTER, buildPeriods, periodIndexOfMonth,
} from '@/lib/fdr/periods';
import { STATUT_PORTEFEUILLE_CONFIG, ACTIVITES_METIER, type StatutPortefeuille, type FdrEngineSettings } from '@/types/fdr';
import { IT_PROJECT_PILIER_CONFIG } from '@/types/itProject';
import { cn } from '@/lib/utils';

// ---- Constantes d'affichage ----

const MONTH_W = 56;       // largeur d'un mois en px
const ROW_H = 34;         // hauteur d'une ligne projet
const LABEL_W = 260;      // largeur par défaut de la colonne libellés
const LABEL_W_WIDE = 460; // largeur élargie

const ALL = '__all__';

// ---- Groupements ----

type GroupMode = 'activite' | 'profil' | 'pilier' | 'categorie' | 'statut' | 'none';

const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: 'activite', label: 'Activité' },
  { value: 'profil', label: 'Profil principal' },
  { value: 'pilier', label: 'Pilier' },
  { value: 'categorie', label: 'Catégorie' },
  { value: 'statut', label: 'Statut portefeuille' },
  { value: 'none', label: 'Aucun groupe' },
];

/** Palette (teintes ~600, texte blanc lisible) pour colorer les barres par groupe. */
const GROUP_COLORS = [
  '#4f46e5', '#0284c7', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#db2777', '#0d9488', '#ea580c', '#65a30d', '#0891b2', '#9333ea',
];

// ---- Préférences de vue (enregistrement personnel "standard") ----
interface RoadmapViewConfig {
  search: string;
  fCategorie: string;
  fActivite: string;
  fPilier: string;
  fStatut: string;
  fProfil: string;
  onlyWithDays: boolean;
  groupBy: GroupMode;
  yearGran: Record<string, YearGran>;
  showCode: boolean;
  wideLabels: boolean;
}
const ROADMAP_VIEW_DEFAULTS: RoadmapViewConfig = {
  search: '', fCategorie: ALL, fActivite: ALL, fPilier: ALL, fStatut: ALL, fProfil: ALL,
  onlyWithDays: false, groupBy: 'activite', yearGran: {}, showCode: false, wideLabels: true,
};

// ---- Granularité temporelle : voir src/lib/fdr/periods.ts (partagé avec le Plan de charge) ----

/** Somme de charge (build+suivi, j/mois) d'un projet sur un mois donné. */
function projectMonthCharge(
  p: FdrRoadmapProject,
  ym: string,
  settings: { echeance_standard_permanentes: string; jours_productifs_mois: number } | null,
): number {
  if (!settings) return 0;
  return computeProjectMonthLoads(p, ym, settings).reduce((s, l) => s + l.j_mois, 0);
}

/** Un projet « a des jours » s'il porte une charge build ou suivi. */
function hasDays(p: FdrRoadmapProject): boolean {
  return p.loads.some(l => l.j_mois > 0) || (p.suivi_j_mois ?? 0) > 0;
}

// ---- Utilitaires date ----

/** Décale une date 'YYYY-MM-DD' de n mois (jour clampé à la fin de mois). */
function shiftDateMonths(date: string, n: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  const nd = Math.min(d || 1, lastDay);
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

// ---- Drag state ----

interface DragState {
  projectId: string;
  mode: 'move' | 'resize';
  startX: number;
  delta: number; // en mois
}

// ---- Undo/redo ----

interface HistoryEntry {
  label: string;
  redo: FdrProjectPatch;
  undo: FdrProjectPatch;
}

// ---- Page ----

export default function ITRoadmap() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10">
                <CalendarRange className="h-7 w-7 text-violet-500" />
              </div>
              Feuille de route IT
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Glissez une barre pour décaler le kickoff, étirez le bord droit pour modifier la durée.
              Le plan de charge est recalculé en temps réel. Clic droit pour les actions.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/it/feuille-de-route/definition')}>
              <MapIcon className="h-4 w-4" />Définition & matrices
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/it/feuille-de-route/suivi')}>
              <AlertTriangle className="h-4 w-4" />Suivi
            </Button>
          </div>
        </div>
        <RoadmapContent />
      </div>
    </Layout>
  );
}

function RoadmapContent() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading: projectsLoading } = useFdrProjects();
  const { data: settings } = useFdrSettings();
  const { data: profils = [] } = useFdrProfils();
  const patchProject = usePatchFdrProject();

  // ---- Filtres ----
  const [search, setSearch] = useState('');
  const [fCategorie, setFCategorie] = useState(ALL);
  const [fActivite, setFActivite] = useState(ALL);
  const [fPilier, setFPilier] = useState(ALL);
  const [fStatut, setFStatut] = useState(ALL);
  const [fProfil, setFProfil] = useState(ALL);
  const [onlyWithDays, setOnlyWithDays] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupMode>('activite');

  // ---- Affichage (configuration standard : N° masqué, colonne large) ----
  const [showCode, setShowCode] = useState(false);
  const [wideLabels, setWideLabels] = useState(true);
  const labelW = wideLabels ? LABEL_W_WIDE : LABEL_W;

  const [historyOpen, setHistoryOpen] = useState(false);

  // ---- Granularité temporelle par année ----
  const [yearGran, setYearGran] = useState<Record<string, YearGran>>({});
  const cycleYearGran = (year: string) =>
    setYearGran(g => ({ ...g, [year]: GRAN_CYCLE[g[year] ?? 'month'] }));

  // ---- Vue enregistrée (standard personnel) : filtres + granularité + groupement ----
  const { config: savedView, isLoaded: viewLoaded, save: saveView, reset: resetView, isSaving: viewSaving } =
    useViewPreferences<RoadmapViewConfig>('it-roadmap', ROADMAP_VIEW_DEFAULTS);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !viewLoaded) return;
    hydratedRef.current = true;
    const v = savedView;
    setSearch(v.search); setFCategorie(v.fCategorie); setFActivite(v.fActivite);
    setFPilier(v.fPilier); setFStatut(v.fStatut); setFProfil(v.fProfil);
    setOnlyWithDays(v.onlyWithDays); setGroupBy(v.groupBy); setYearGran(v.yearGran ?? {});
    setShowCode(v.showCode); setWideLabels(v.wideLabels);
  }, [viewLoaded, savedView]);

  const handleSaveView = () => {
    saveView({
      search, fCategorie, fActivite, fPilier, fStatut, fProfil,
      onlyWithDays, groupBy, yearGran, showCode, wideLabels,
    });
    toast({ title: 'Vue enregistrée', description: 'Cet affichage est désormais votre standard.' });
  };
  const handleResetView = () => {
    resetView();
    const d = ROADMAP_VIEW_DEFAULTS;
    setSearch(d.search); setFCategorie(d.fCategorie); setFActivite(d.fActivite);
    setFPilier(d.fPilier); setFStatut(d.fStatut); setFProfil(d.fProfil);
    setOnlyWithDays(d.onlyWithDays); setGroupBy(d.groupBy); setYearGran(d.yearGran);
    setShowCode(d.showCode); setWideLabels(d.wideLabels);
    toast({ title: 'Vue réinitialisée' });
  };

  // ---- Groupes repliés (affichent la somme) ----
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) => setCollapsed(s => {
    const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n;
  });

  // ---- Tri par colonne ----
  // key = 'name' (libellé) | 'YYYY-MM' (charge du mois) ; null = ordre naturel
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const onSortColumn = (key: string) => setSort(s =>
    s && s.key === key ? (s.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' });

  const hasFilters = fCategorie !== ALL || fActivite !== ALL || fPilier !== ALL || fStatut !== ALL || fProfil !== ALL || onlyWithDays || !!search;
  const resetFilters = () => {
    setSearch(''); setFCategorie(ALL); setFActivite(ALL); setFPilier(ALL); setFStatut(ALL); setFProfil(ALL); setOnlyWithDays(false);
  };

  // ---- Drag & historique ----
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const applyPatch = useCallback(async (entry: HistoryEntry, fromHistory: 'undo' | 'redo' | null) => {
    const op = fromHistory === 'undo' ? entry.undo : entry.redo;
    try {
      await patchProject.mutateAsync(op);
      if (fromHistory === 'undo') {
        setUndoStack(s => s.slice(0, -1));
        setRedoStack(s => [...s, entry]);
      } else if (fromHistory === 'redo') {
        setRedoStack(s => s.slice(0, -1));
        setUndoStack(s => [...s, entry]);
      } else {
        setUndoStack(s => [...s, entry]);
        setRedoStack([]);
      }
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  }, [patchProject]);

  const undo = useCallback(() => {
    const entry = undoStack[undoStack.length - 1];
    if (entry) applyPatch(entry, 'undo');
  }, [undoStack, applyPatch]);

  const redo = useCallback(() => {
    const entry = redoStack[redoStack.length - 1];
    if (entry) applyPatch(entry, 'redo');
  }, [redoStack, applyPatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ---- Horizon ----
  const horizonDebut = toYM(settings?.horizon_debut) ?? '2026-06';
  const horizonDuree = settings?.horizon_duree_mois ?? 19;
  const months = useMemo(() => generateHorizon(horizonDebut, horizonDuree), [horizonDebut, horizonDuree]);

  // Colonnes affichées (mois repliés en trimestre/année selon yearGran)
  const periods = useMemo(() => buildPeriods(months, yearGran), [months, yearGran]);
  const ymIndex = useCallback((ym: string | null) => periodIndexOfMonth(periods, ym), [periods]);

  // Années présentes dans l'horizon (pour les boutons de granularité)
  const years = useMemo(() => [...new Set(months.map(m => m.slice(0, 4)))], [months]);

  // Position en px de la ligne « aujourd'hui » dans la zone des barres (null si hors horizon)
  const todayX = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const idx = periods.findIndex(per => per.months.includes(ym));
    if (idx < 0) return null;
    const per = periods[idx];
    const monthPos = per.months.indexOf(ym);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const frac = (monthPos + now.getDate() / daysInMonth) / per.months.length;
    return idx * MONTH_W + frac * MONTH_W;
  }, [periods]);

  // ---- Paramètres moteur (sert au calcul de charge, aux sommes et au tri) ----
  const engineSettings = useMemo<FdrEngineSettings | null>(() => {
    if (!settings || profils.length === 0) return null;
    return {
      jours_productifs_mois: settings.jours_productifs_mois,
      echeance_standard_permanentes: toYM(settings.echeance_standard_permanentes) ?? '2030-12',
      horizon_debut: horizonDebut,
      horizon_duree_mois: horizonDuree,
      profils: profils.filter(p => p.actif).map(p => ({ code: p.code, capacite_j_mois: p.capacite_j_mois })),
    };
  }, [settings, profils, horizonDebut, horizonDuree]);

  // ---- Projets avec preview drag appliqué ----
  const previewProjects = useMemo<FdrRoadmapProject[]>(() => {
    if (!drag || drag.delta === 0) return projects;
    return projects.map(p => {
      if (p.id !== drag.projectId) return p;
      if (drag.mode === 'move') {
        return {
          ...p,
          date_kickoff: p.date_kickoff ? shiftDateMonths(p.date_kickoff, drag.delta) : p.date_kickoff,
          date_mep_saisie: p.date_mep_saisie ? shiftDateMonths(p.date_mep_saisie, drag.delta) : p.date_mep_saisie,
          echeance_cible: p.statut_portefeuille === 'Tâche permanente' && p.echeance_cible
            ? shiftDateMonths(p.echeance_cible, drag.delta) : p.echeance_cible,
        };
      }
      // resize
      if (p.statut_portefeuille === 'Tâche permanente') {
        return {
          ...p,
          echeance_cible: p.echeance_cible ? shiftDateMonths(p.echeance_cible, drag.delta) : p.echeance_cible,
        };
      }
      return {
        ...p,
        delai_projete_mois: Math.max(1, (p.delai_projete_mois ?? 1) + drag.delta),
      };
    });
  }, [projects, drag]);

  // ---- Filtrage ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return previewProjects.filter(p => {
      if (q && !p.nom.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
      if (fCategorie !== ALL && p.categorie_fdr !== fCategorie) return false;
      if (fActivite !== ALL && p.activite_metier !== fActivite) return false;
      if (fPilier !== ALL && p.pilier !== fPilier) return false;
      if (fStatut !== ALL && p.statut_portefeuille !== fStatut) return false;
      if (fProfil !== ALL) {
        const hasLoad = p.loads.some(l => l.profil_code === fProfil) || p.profil_principal === fProfil;
        if (!hasLoad) return false;
      }
      if (onlyWithDays && !hasDays(p)) return false;
      return true;
    });
  }, [previewProjects, search, fCategorie, fActivite, fPilier, fStatut, fProfil, onlyWithDays]);

  // ---- Clé de groupe selon le mode ----
  const groupKeyOf = useCallback((p: FdrRoadmapProject): string => {
    switch (groupBy) {
      case 'activite':  return p.activite_metier ?? '— Sans activité —';
      case 'profil':    return profils.find(pr => pr.code === p.profil_principal)?.nom ?? '— Sans profil —';
      case 'pilier':    return p.pilier ?? '— Sans pilier —';
      case 'categorie': return p.categorie_fdr ?? '— Sans catégorie —';
      case 'statut':    return p.statut_portefeuille ?? '— Sans statut —';
      default:          return '';
    }
  }, [groupBy, profils]);

  const periodByKey = useMemo(() => new Map(periods.map(p => [p.key, p])), [periods]);

  /** Pic de charge (build+suivi) d'un projet sur une période (max de ses mois). */
  const projectPeriodPeak = useCallback((p: FdrRoadmapProject, per: Period): number => {
    let peak = 0;
    for (const ym of per.months) { const v = projectMonthCharge(p, ym, engineSettings); if (v > peak) peak = v; }
    return peak;
  }, [engineSettings]);

  // ---- Tri des projets (par libellé ou par charge d'une colonne) ----
  const sortItems = useCallback((items: FdrRoadmapProject[]): FdrRoadmapProject[] => {
    if (!sort) return items;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const per = sort.key === 'name' ? null : periodByKey.get(sort.key);
    const val = (p: FdrRoadmapProject): string | number =>
      sort.key === 'name' ? p.nom.toLowerCase() : (per ? projectPeriodPeak(p, per) : 0);
    return [...items].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [sort, periodByKey, projectPeriodPeak]);

  // ---- Groupes ----
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ label: null as string | null, items: sortItems(filtered) }];
    const map = new Map<string, FdrRoadmapProject[]>();
    for (const p of filtered) {
      const key = groupKeyOf(p);
      (map.get(key) ?? map.set(key, []).get(key)!).push(p);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([label, items]) => ({ label: label as string | null, items: sortItems(items) }));
  }, [filtered, groupBy, groupKeyOf, sortItems]);

  // ---- Couleur de barre par groupe (selon le paramètre de groupement) ----
  const groupColors = useMemo(() => {
    const m = new Map<string, string>();
    if (groupBy === 'none') return m;
    groups.forEach((g, i) => {
      if (g.label != null) m.set(g.label, GROUP_COLORS[i % GROUP_COLORS.length]);
    });
    return m;
  }, [groups, groupBy]);

  /** Charge cumulée du groupe par colonne = pic mensuel de la période. */
  const groupPeriodSums = useCallback((items: FdrRoadmapProject[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const per of periods) {
      let peak = 0;
      for (const ym of per.months) {
        let s = 0;
        for (const p of items) s += projectMonthCharge(p, ym, engineSettings);
        if (s > peak) peak = s;
      }
      out[per.key] = Math.round(peak * 10) / 10;
    }
    return out;
  }, [periods, engineSettings]);

  // ---- Matrice capacité temps réel (sur TOUS les projets, pas seulement filtrés) ----
  const matrix = useMemo(() => {
    if (!engineSettings) return null;
    return computeCapacityMatrix(previewProjects, engineSettings);
  }, [previewProjects, engineSettings]);

  // ---- Handlers drag ----
  const onBarPointerDown = (e: React.PointerEvent, p: FdrRoadmapProject, mode: 'move' | 'resize') => {
    if (e.button !== 0) return; // clic gauche uniquement (clic droit = menu)
    if (!p.date_kickoff) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const st: DragState = { projectId: p.id, mode, startX: e.clientX, delta: 0 };
    dragRef.current = st;
    setDrag(st);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st) return;
    const delta = Math.round((e.clientX - st.startX) / MONTH_W);
    if (delta !== st.delta) {
      const next = { ...st, delta };
      dragRef.current = next;
      setDrag(next);
    }
  };

  const onPointerUp = () => {
    const st = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!st || st.delta === 0) return;

    const p = projects.find(x => x.id === st.projectId);
    if (!p) return;

    if (st.mode === 'move') {
      const patch: Record<string, unknown> = {};
      const undoPatch: Record<string, unknown> = {};
      const changes: HistoryEntry['redo']['changes'] = [];
      const undoChanges: HistoryEntry['redo']['changes'] = [];

      const shiftField = (field: string, value: string | null | undefined) => {
        if (!value) return;
        const nv = shiftDateMonths(value, st.delta);
        patch[field] = nv; undoPatch[field] = value;
        changes.push({ field, oldValue: value, newValue: nv });
        undoChanges.push({ field, oldValue: nv, newValue: value });
      };
      shiftField('date_kickoff', p.date_kickoff);
      shiftField('date_mep_saisie', p.date_mep_saisie);
      if (p.statut_portefeuille === 'Tâche permanente') shiftField('echeance_cible', p.echeance_cible);

      applyPatch({
        label: `Décalage ${p.code} de ${st.delta > 0 ? '+' : ''}${st.delta} mois`,
        redo: { projectId: p.id, patch, action: 'move', changes },
        undo: { projectId: p.id, patch: undoPatch, action: 'move', changes: undoChanges },
      }, null);
    } else {
      // resize
      if (p.statut_portefeuille === 'Tâche permanente') {
        if (!p.echeance_cible) return;
        const nv = shiftDateMonths(p.echeance_cible, st.delta);
        applyPatch({
          label: `Échéance ${p.code} → ${nv}`,
          redo: { projectId: p.id, patch: { echeance_cible: nv }, action: 'resize', changes: [{ field: 'echeance_cible', oldValue: p.echeance_cible, newValue: nv }] },
          undo: { projectId: p.id, patch: { echeance_cible: p.echeance_cible }, action: 'resize', changes: [{ field: 'echeance_cible', oldValue: nv, newValue: p.echeance_cible }] },
        }, null);
      } else {
        const old = p.delai_projete_mois ?? 1;
        const nv = Math.max(1, old + st.delta);
        if (nv === old) return;
        applyPatch({
          label: `Durée ${p.code} → ${nv} mois`,
          redo: { projectId: p.id, patch: { delai_projete_mois: nv }, action: 'resize', changes: [{ field: 'delai_projete_mois', oldValue: old, newValue: nv }] },
          undo: { projectId: p.id, patch: { delai_projete_mois: old }, action: 'resize', changes: [{ field: 'delai_projete_mois', oldValue: nv, newValue: old }] },
        }, null);
      }
    }
  };

  // ---- Actions menu contextuel ----
  const toggleFdr = (p: FdrRoadmapProject) => {
    const nv = !p.sur_feuille_de_route;
    applyPatch({
      label: nv ? `Restauration ${p.code}` : `Retrait FDR ${p.code}`,
      redo: { projectId: p.id, patch: { sur_feuille_de_route: nv }, action: nv ? 'restore_fdr' : 'remove_fdr', changes: [{ field: 'sur_feuille_de_route', oldValue: p.sur_feuille_de_route, newValue: nv }] },
      undo: { projectId: p.id, patch: { sur_feuille_de_route: p.sur_feuille_de_route }, action: p.sur_feuille_de_route ? 'restore_fdr' : 'remove_fdr', changes: [{ field: 'sur_feuille_de_route', oldValue: nv, newValue: p.sur_feuille_de_route }] },
    }, null);
  };

  const changeStatus = (p: FdrRoadmapProject, statut: StatutPortefeuille) => {
    if (statut === p.statut_portefeuille) return;
    applyPatch({
      label: `Statut ${p.code} → ${statut}`,
      redo: { projectId: p.id, patch: { statut_portefeuille: statut }, action: 'change_status', changes: [{ field: 'statut_portefeuille', oldValue: p.statut_portefeuille, newValue: statut }] },
      undo: { projectId: p.id, patch: { statut_portefeuille: p.statut_portefeuille }, action: 'change_status', changes: [{ field: 'statut_portefeuille', oldValue: statut, newValue: p.statut_portefeuille }] },
    }, null);
  };

  const shiftProject = (p: FdrRoadmapProject, n: number) => {
    if (!p.date_kickoff) {
      toast({ title: 'Pas de date kickoff', description: 'Renseignez le kickoff dans la fiche projet.', variant: 'destructive' });
      return;
    }
    const patch: Record<string, unknown> = {};
    const undoPatch: Record<string, unknown> = {};
    const changes: HistoryEntry['redo']['changes'] = [];
    const undoChanges: HistoryEntry['redo']['changes'] = [];
    for (const field of ['date_kickoff', 'date_mep_saisie', 'echeance_cible'] as const) {
      const value = p[field];
      if (!value) continue;
      if (field === 'echeance_cible' && p.statut_portefeuille !== 'Tâche permanente') continue;
      const nv = shiftDateMonths(value, n);
      patch[field] = nv; undoPatch[field] = value;
      changes.push({ field, oldValue: value, newValue: nv });
      undoChanges.push({ field, oldValue: nv, newValue: value });
    }
    applyPatch({
      label: `Décalage ${p.code} +${n} mois`,
      redo: { projectId: p.id, patch, action: 'shift_months', changes },
      undo: { projectId: p.id, patch: undoPatch, action: 'shift_months', changes: undoChanges },
    }, null);
  };

  // ---- Rendu ----
  if (projectsLoading || !settings) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  const surchargeByYm = new Map(matrix?.rsi_cascade.map(r => [r.ym, r.sous_effectif_net]) ?? []);

  return (
    <div className="space-y-4">
      {/* Barre filtres + undo/redo */}
      <Card className="border-border/50">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Rechercher code ou nom…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs w-44"
          />
          <FilterSelect value={fCategorie} onChange={setFCategorie} placeholder="Catégorie"
            options={[['IA', 'IA'], ['HORS IA', 'HORS IA']]} />
          <FilterSelect value={fActivite} onChange={setFActivite} placeholder="Activité"
            options={ACTIVITES_METIER.map(a => [a, a])} />
          <FilterSelect value={fPilier} onChange={setFPilier} placeholder="Pilier"
            options={Object.entries(IT_PROJECT_PILIER_CONFIG).map(([k, c]) => [k, `${k} — ${c.label}`])} />
          <FilterSelect value={fStatut} onChange={setFStatut} placeholder="Statut"
            options={Object.keys(STATUT_PORTEFEUILLE_CONFIG).map(s => [s, s])} />
          <FilterSelect value={fProfil} onChange={setFProfil} placeholder="Profil"
            options={profils.filter(p => p.actif).map(p => [p.code, p.nom])} />
          <Button
            variant={onlyWithDays ? 'default' : 'outline'} size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setOnlyWithDays(v => !v)}
            title="N'afficher que les projets portant une charge (j/mois)"
          >
            <CalendarClock className="h-3.5 w-3.5" />Avec charge
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={resetFilters}>
              <X className="h-3 w-3" />Réinitialiser
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <FdrHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
            <FdrImportExport projects={projects} />
            <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupMode)}>
              <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.value === 'none' ? o.label : `Grouper par ${o.label.toLowerCase()}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={handleSaveView} disabled={viewSaving}
              title="Enregistrer cet affichage (filtres + granularité + groupement) comme votre standard"
            >
              {viewSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
              Enregistrer la vue
            </Button>
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={handleResetView}
              title="Réinitialiser la vue standard (retour aux défauts)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={showCode ? 'outline' : 'default'} size="icon" className="h-8 w-8"
              onClick={() => setShowCode(v => !v)}
              title={showCode ? 'Masquer le numéro de projet' : 'Afficher le numéro de projet'}
            >
              <Hash className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setWideLabels(v => !v)}
              title={wideLabels ? 'Réduire la colonne projets' : 'Élargir la colonne projets'}
            >
              {wideLabels ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={undo} disabled={undoStack.length === 0 || patchProject.isPending}>
              <Undo2 className="h-3.5 w-3.5" />Annuler
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={redo} disabled={redoStack.length === 0 || patchProject.isPending}>
              <Redo2 className="h-3.5 w-3.5" />Rétablir
            </Button>
            {patchProject.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {/* Gantt */}
      <Card className="border-border/50">
        <CardContent className="p-0 overflow-x-auto select-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <div style={{ minWidth: labelW + periods.length * MONTH_W }}>
            {/* En-tête : bande années (granularité) + colonnes */}
            <div className="sticky top-0 z-20 bg-muted/30">
              {/* Bande années avec bouton de granularité */}
              <div className="flex border-b border-border/20">
                <div style={{ width: labelW }} className="shrink-0 px-3 py-1 sticky left-0 bg-muted/30 z-10 text-[10px] text-muted-foreground flex items-center">
                  Granularité / année →
                </div>
                {years.map(year => {
                  const cnt = periods.filter(pe => pe.year === year).length;
                  if (cnt === 0) return null;
                  const g = yearGran[year] ?? 'month';
                  return (
                    <div key={year} style={{ width: cnt * MONTH_W }} className="shrink-0 border-l border-border/30 flex items-center justify-center gap-1.5 py-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">{year}</span>
                      <button
                        type="button"
                        onClick={() => cycleYearGran(year)}
                        className="text-[9px] font-bold w-4 h-4 rounded bg-violet-100 text-violet-700 hover:bg-violet-200 leading-none"
                        title="Granularité : Mois → Trimestre → Année"
                      >
                        {GRAN_LETTER[g]}
                      </button>
                    </div>
                  );
                })}
              </div>
              {/* Colonnes (cliquables pour trier) */}
              <div className="flex border-b">
                <button
                  type="button"
                  onClick={() => onSortColumn('name')}
                  style={{ width: labelW }}
                  className="shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 flex items-center gap-1 hover:text-foreground text-left"
                  title="Trier par nom"
                >
                  Projet ({filtered.length})
                  <SortIcon sort={sort} col="name" />
                </button>
                {periods.map(per => {
                  const surcharge = per.months.some(ym => (surchargeByYm.get(ym) ?? 0) > 0);
                  const sorted = sort?.key === per.key;
                  const isNow = per.months.includes(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
                  return (
                    <button
                      key={per.key} type="button"
                      onClick={() => onSortColumn(per.key)}
                      style={{ width: MONTH_W }}
                      className={cn(
                        'shrink-0 text-center text-[10px] py-2 font-medium border-l border-border/30 hover:bg-muted/60 leading-tight',
                        surcharge ? 'text-red-600 bg-red-50' : 'text-muted-foreground',
                        sorted && 'bg-violet-100 text-violet-700',
                        per.kind !== 'month' && 'bg-muted/50',
                        isNow && 'border-b-2 border-b-red-500',
                      )}
                      title={`Trier par charge — ${per.label}${per.sub ? ' ' + per.sub : ''}`}
                    >
                      {per.label}{per.sub && <span className="opacity-60"> {per.sub}</span>}
                      {surcharge && <AlertTriangle className="h-2.5 w-2.5 inline ml-0.5 text-red-500" />}
                      <SortIcon sort={sort} col={per.key} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lignes */}
            {groups.map(group => {
              const key = group.label ?? '__nogroup__';
              const isCollapsed = group.label != null && collapsed.has(key);
              return (
                <div key={key}>
                  {group.label && (
                    <button
                      type="button"
                      onClick={() => toggleCollapse(key)}
                      className="w-full flex items-stretch bg-muted/20 border-b border-border/40 hover:bg-muted/40 text-left"
                    >
                      <div style={{ width: labelW }} className="shrink-0 px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/20 flex items-center gap-1.5">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {group.label} <span className="font-normal normal-case">({group.items.length})</span>
                      </div>
                      {/* Pic de charge du groupe par colonne */}
                      {(() => {
                        const sums = groupPeriodSums(group.items);
                        return periods.map(per => (
                          <div key={per.key} style={{ width: MONTH_W }} className="shrink-0 text-center text-[10px] py-1 tabular-nums border-l border-border/20 text-violet-700 font-medium">
                            {sums[per.key] > 0 ? sums[per.key] : ''}
                          </div>
                        ));
                      })()}
                    </button>
                  )}
                  {!isCollapsed && group.items.map(p => (
                    <GanttRow
                      key={p.id}
                      project={p}
                      barColor={group.label != null ? groupColors.get(group.label) : undefined}
                      periods={periods}
                      todayX={todayX}
                      labelW={labelW}
                      showCode={showCode}
                      ymIndex={ymIndex}
                      engineSettings={engineSettings}
                      dragging={drag?.projectId === p.id}
                      onPointerDown={onBarPointerDown}
                      onToggleFdr={() => toggleFdr(p)}
                      onChangeStatus={s => changeStatus(p, s)}
                      onShift={n => shiftProject(p, n)}
                      onOpen={() => navigate(`/it/projects/${encodeURIComponent(p.code)}/overview`)}
                    />
                  ))}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Aucun projet ne correspond aux filtres.
              </div>
            )}

            {/* Bandeau surcharge (pic du sous-effectif net par colonne) */}
            {matrix && (
              <div className="flex border-t bg-muted/30">
                <div style={{ width: labelW }} className="shrink-0 px-3 py-1.5 text-[11px] font-medium text-muted-foreground sticky left-0 bg-muted/30">
                  Sous-effectif net (j, pic)
                </div>
                {periods.map(per => {
                  const v = Math.max(0, ...per.months.map(ym => surchargeByYm.get(ym) ?? 0));
                  return (
                    <div key={per.key} style={{ width: MONTH_W }} className={cn(
                      'shrink-0 text-center text-[10px] py-1.5 tabular-nums border-l border-border/30',
                      v > 0 ? 'text-red-700 font-bold bg-red-100' : 'text-muted-foreground/40',
                    )}>
                      {v > 0 ? Math.round(v * 10) / 10 : '—'}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground px-1">
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded bg-violet-500 inline-block" /> Build</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded inline-block" style={{ background: 'repeating-linear-gradient(45deg,#8b5cf6,#8b5cf6 3px,#ddd6fe 3px,#ddd6fe 6px)' }} /> Suivi (run applicatif)</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-3 rounded bg-amber-400 inline-block" /> Tâche permanente</span>
        <span className="flex items-center gap-1.5"><EyeOff className="h-3 w-3" /> Hors feuille de route (grisé, exclu des calculs)</span>
      </div>
    </div>
  );
}

// ---- Sous-composants ----

function SortIcon({ sort, col }: { sort: { key: string; dir: 'asc' | 'desc' } | null; col: string }) {
  if (!sort || sort.key !== col) return null;
  return sort.dir === 'desc'
    ? <ArrowDown className="h-2.5 w-2.5 inline ml-0.5" />
    : <ArrowUp className="h-2.5 w-2.5 inline ml-0.5" />;
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('h-8 text-xs w-32', value !== ALL && 'border-violet-400 bg-violet-50')}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder} : tous</SelectItem>
        {options.map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function GanttRow({
  project: p, barColor, periods, todayX, labelW, showCode, ymIndex, engineSettings, dragging,
  onPointerDown, onToggleFdr, onChangeStatus, onShift, onOpen,
}: {
  project: FdrRoadmapProject;
  barColor?: string;
  periods: Period[];
  todayX: number | null;
  labelW: number;
  showCode: boolean;
  ymIndex: (ym: string | null) => number | null;
  engineSettings: FdrEngineSettings | null;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent, p: FdrRoadmapProject, mode: 'move' | 'resize') => void;
  onToggleFdr: () => void;
  onChangeStatus: (s: StatutPortefeuille) => void;
  onShift: (n: number) => void;
  onOpen: () => void;
}) {
  const excluded = !p.sur_feuille_de_route || p.statut_portefeuille === 'Abandonné';
  const isPermanente = p.statut_portefeuille === 'Tâche permanente';
  const statutCfg = STATUT_PORTEFEUILLE_CONFIG[p.statut_portefeuille];
  const nCols = periods.length;

  // Géométrie des segments (en index de colonnes/périodes)
  const kickoff = toYM(p.date_kickoff);
  const kIdx = ymIndex(kickoff);
  let buildStart: number | null = null, buildEnd: number | null = null;
  let suiviStart: number | null = null, suiviEnd: number | null = null;

  if (kIdx != null && kickoff) {
    if (isPermanente) {
      const fin = toYM(p.date_mep_saisie) ?? toYM(p.echeance_cible) ?? engineSettings?.echeance_standard_permanentes ?? null;
      const fIdx = fin ? ymIndex(fin) : nCols - 1;
      buildStart = Math.max(0, kIdx);
      buildEnd = Math.min(nCols - 1, fIdx ?? nCols - 1);
    } else {
      const mep = getMepRetenue(p);
      const mIdx = mep ? ymIndex(mep) : null;
      buildStart = Math.max(0, kIdx);
      // En vue repliée, build et suivi peuvent tomber dans la même colonne :
      // on garde au moins la colonne du kickoff pour le build.
      buildEnd = mIdx != null ? Math.min(nCols - 1, Math.max(buildStart, mIdx - 1)) : nCols - 1;
      if (mIdx != null && mIdx < nCols && p.suivi_j_mois > 0) {
        suiviStart = Math.max(0, mIdx);
        suiviEnd = nCols - 1;
      }
    }
  }

  const hasBuild = buildStart != null && buildEnd != null && buildEnd >= buildStart && buildStart < nCols;
  const hasSuivi = suiviStart != null && suiviEnd != null && suiviEnd >= suiviStart;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'flex border-b border-border/30 hover:bg-muted/20 transition-colors',
            excluded && 'opacity-40',
            dragging && 'bg-violet-50',
          )}
          style={{ height: ROW_H }}
        >
          {/* Libellé */}
          <div style={{ width: labelW }} className="shrink-0 px-3 flex items-center gap-2 sticky left-0 bg-background z-10 overflow-hidden">
            {excluded && <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />}
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statutCfg?.color ?? '#94a3b8' }} />
            <span className="text-xs truncate" title={`${p.code} — ${p.nom}`}>
              {showCode && <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{p.code}</span>}
              {p.nom}
            </span>
          </div>

          {/* Zone barres */}
          <div className="relative" style={{ width: nCols * MONTH_W }}>
            {/* Grille colonnes */}
            {periods.map((per, i) => (
              <div key={per.key} className={cn(
                'absolute top-0 bottom-0 border-l',
                per.kind === 'month' ? 'border-border/20' : 'border-border/40',
              )} style={{ left: i * MONTH_W }} />
            ))}

            {/* Ligne « aujourd'hui » */}
            {todayX != null && (
              <div className="absolute top-0 bottom-0 w-px bg-red-500/60 z-[5] pointer-events-none" style={{ left: todayX }} />
            )}

            {/* Barre build / permanente */}
            {hasBuild && (
              <div
                className={cn(
                  'absolute rounded-md flex items-center px-1.5 text-[10px] font-medium overflow-hidden whitespace-nowrap',
                  excluded ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
                  // Sans couleur de groupe : couleurs par défaut (build violet / permanente ambre)
                  barColor ? 'text-white' : (isPermanente ? 'bg-amber-400 text-amber-950' : 'bg-violet-500 text-white'),
                  dragging && 'ring-2 ring-violet-300 shadow-lg',
                )}
                style={{
                  left: buildStart! * MONTH_W + 1,
                  width: (buildEnd! - buildStart! + 1) * MONTH_W - 2,
                  top: 5, bottom: 5,
                  ...(barColor ? { background: barColor } : {}),
                }}
                onPointerDown={e => !excluded && onPointerDown(e, p, 'move')}
              >
                {(p.pct_avancement ?? 0) > 0 && (
                  <div className="absolute inset-y-0 left-0 bg-black/15 pointer-events-none"
                    style={{ width: `${Math.min(100, p.pct_avancement!)}%` }} />
                )}
                <span className="relative pointer-events-none truncate">
                  {isPermanente ? '∞' : ''} {Math.round(p.loads.reduce((s, l) => s + l.j_mois, 0) * 10) / 10}j/m
                </span>
                {(p.pct_avancement ?? 0) > 0 && (
                  <span className="relative ml-auto pl-1 pr-2.5 tabular-nums font-semibold pointer-events-none">
                    {Math.round(p.pct_avancement!)}%
                  </span>
                )}
                {/* Poignée resize */}
                {!excluded && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-black/20 rounded-r-md"
                    onPointerDown={e => onPointerDown(e, p, 'resize')}
                  />
                )}
              </div>
            )}

            {/* Barre suivi (hachurée) — même code couleur que le build (par groupe) */}
            {hasSuivi && (
              <div
                className="absolute rounded-md pointer-events-none flex items-center px-1.5 text-[9px] text-violet-900"
                style={{
                  left: suiviStart! * MONTH_W + 1,
                  width: (suiviEnd! - suiviStart! + 1) * MONTH_W - 2,
                  top: 9, bottom: 9,
                  background: barColor
                    ? `repeating-linear-gradient(45deg,${barColor},${barColor} 3px,${barColor}33 3px,${barColor}33 6px)`
                    : 'repeating-linear-gradient(45deg,#a78bfa,#a78bfa 3px,#ede9fe 3px,#ede9fe 6px)',
                }}
              >
                <span className="truncate">{p.suivi_j_mois}j/m</span>
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onOpen} className="gap-2 text-xs">
          <ExternalLink className="h-3.5 w-3.5" />Ouvrir la fiche projet
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onToggleFdr} className="gap-2 text-xs">
          {p.sur_feuille_de_route
            ? <><EyeOff className="h-3.5 w-3.5" />Retirer de la feuille de route</>
            : <><Eye className="h-3.5 w-3.5" />Remettre sur la feuille de route</>}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2 text-xs">
            <MapIcon className="h-3.5 w-3.5" />Changer de statut
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {(Object.keys(STATUT_PORTEFEUILLE_CONFIG) as StatutPortefeuille[]).map(s => (
              <ContextMenuItem key={s} onClick={() => onChangeStatus(s)} className="gap-2 text-xs">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUT_PORTEFEUILLE_CONFIG[s].color }} />
                {s}
                {s === p.statut_portefeuille && <Badge variant="secondary" className="ml-auto text-[9px]">actuel</Badge>}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onShift(3)} className="gap-2 text-xs">
          <CalendarRange className="h-3.5 w-3.5" />Décaler de +3 mois
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onShift(6)} className="gap-2 text-xs">
          <CalendarRange className="h-3.5 w-3.5" />Décaler de +6 mois
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
