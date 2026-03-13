import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BEProject } from '@/types/beProject';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  MapPin, CheckCircle2, Clock, AlertTriangle, FolderOpen,
  TrendingUp, Activity, Zap, Globe, Loader2, ChevronDown,
  Settings2, RotateCcw,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  loadWidgetConfig,
  saveWidgetConfig,
  getDefaultWidgets,
  WidgetConfig,
} from './SyntheseWidgetConfigPanel';
import { WidgetWrapper, type WidgetSizePreset, type HeightPreset } from '@/components/dashboard/widgets/WidgetWrapper';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProjectStats {
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  progress: number;
}

interface Props {
  projects: BEProject[];
  qstData: Record<string, Record<string, any>>;
  widgets?: WidgetConfig[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: 'Actif',       color: '#10b981', bg: 'bg-emerald-500/10' },
  closed:  { label: 'Clôturé',     color: '#6b7280', bg: 'bg-slate-500/10'   },
  on_hold: { label: 'En attente',  color: '#f59e0b', bg: 'bg-amber-500/10'   },
};

const TYPO_COLORS: Record<string, string> = {
  metha_agricole:     '#34d399',
  metha_territoriale: '#60a5fa',
  autre:              '#a78bfa',
};

const CHART_COLORS = ['#10b981', '#f59e0b', '#6b7280', '#3b82f6', '#ec4899', '#8b5cf6'];

// ─── Size → height mapping (from WidgetWrapper's HeightPreset) ────────────────
const HEIGHT_PRESET_PX: Record<HeightPreset, number> = { xs: 150, sm: 250, md: 350, lg: 450, xl: 600 };
const HEIGHT_PRESET_TO_H: Record<HeightPreset, number> = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 };
const PRESET_DIMENSIONS: Record<WidgetSizePreset, { w: number; h: number }> = {
  small: { w: 1, h: 2 },
  medium: { w: 1, h: 3 },
  large: { w: 2, h: 3 },
  full: { w: 2, h: 4 },
};

const getSizePreset = (w: WidgetConfig): WidgetSizePreset => {
  if (w.size.w >= 2 && w.size.h >= 4) return 'full';
  if (w.size.w >= 2) return 'large';
  if (w.size.h >= 3) return 'medium';
  return 'small';
};

const getHeightPreset = (w: WidgetConfig): HeightPreset => {
  const h = w.size.h;
  if (h <= 1) return 'xs';
  if (h <= 2) return 'sm';
  if (h <= 3) return 'md';
  if (h <= 4) return 'lg';
  return 'xl';
};

const getHeightPx = (w: WidgetConfig): number => HEIGHT_PRESET_PX[getHeightPreset(w)];

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    const start = prevTarget.current === target ? 0 : value;
    prevTarget.current = target;
    if (target === 0) { setValue(0); return; }
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const animated = useCountUp(value);
  return <>{animated}{suffix}</>;
}

function RadialProgress({ value, size = 80, stroke = 7, color = '#10b981' }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor"
        strokeWidth={stroke} className="text-muted/30" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

// ─── OSM Map tile card ────────────────────────────────────────────────────────
function ProjectMapCard({ projects, allProjectStats = {} }: { projects: BEProject[]; allProjectStats?: Record<string, ProjectStats> }) {
  const [isBulkGeocoding, setIsBulkGeocoding] = useState(false);
  const [isRegenGeocoding, setIsRegenGeocoding] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const withCoords = useMemo(() =>
    projects.filter(p => {
      if (!p.gps_coordinates) return false;
      const parts = p.gps_coordinates.split(',').map(s => parseFloat(s.trim()));
      if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return false;
      if (Math.abs(parts[0]) < 0.001 && Math.abs(parts[1]) < 0.001) return false;
      return true;
    }), [projects]);

  const missingGps = useMemo(() =>
    projects.filter(p => {
      if (!p.gps_coordinates || p.gps_coordinates.trim() === '') return true;
      const parts = p.gps_coordinates.split(',').map(s => parseFloat(s.trim()));
      if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return true;
      if (Math.abs(parts[0]) < 0.001 && Math.abs(parts[1]) < 0.001) return true;
      return false;
    }), [projects]);

  type GpsMode = 'missing' | 'questionnaire' | 'societe';

  const buildAddress = useCallback(async (project: BEProject, mode: GpsMode): Promise<{ address: string | null; qstKeys: string[] }> => {
    if (mode === 'societe') {
      const parts = [project.adresse_societe, project.pays || 'France'].filter(Boolean);
      return { address: parts.length > 0 ? parts.join(', ') : null, qstKeys: [] };
    }

    const { data: qstRows } = await (supabase as any)
      .from('project_questionnaire')
      .select('champ_id, valeur')
      .eq('project_id', project.id)
      .in('champ_id', ['04_GEN_commune', '04_GEN_code_postal', '04_GEN_departement_nom', '04_GEN_region', '04_GEN_pays']);

    const qst: Record<string, string> = {};
    qstRows?.forEach((r: any) => { if (r.valeur) qst[r.champ_id] = r.valeur; });
    const qstKeys = Object.keys(qst);

    if (mode === 'questionnaire') {
      const parts = [
        qst['04_GEN_commune'],
        qst['04_GEN_code_postal'],
        qst['04_GEN_departement_nom'],
        qst['04_GEN_region'],
        qst['04_GEN_pays'] || 'France'
      ].filter(Boolean);
      return { address: parts.length > 0 ? parts.join(', ') : null, qstKeys };
    }

    const addressParts = [
      qst['04_GEN_commune'],
      qst['04_GEN_code_postal'],
      qst['04_GEN_departement_nom'] || project.departement,
      qst['04_GEN_region'] || project.region,
      qst['04_GEN_pays'] || project.pays_site || project.pays || 'France'
    ].filter(Boolean);

    if (addressParts.length === 0) {
      const fallback = [project.adresse_societe, project.pays || 'France'].filter(Boolean);
      return { address: fallback.length > 0 ? fallback.join(', ') : null, qstKeys };
    }

    return { address: addressParts.join(', '), qstKeys };
  }, []);

  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void } | null>(null);

  const bulkGeocode = useCallback(async (targetProjects: BEProject[], mode: GpsMode, setLoading: (v: boolean) => void) => {
    if (targetProjects.length === 0) {
      toast({ title: 'Rien à géocoder', description: 'Aucun projet à traiter.' });
      return;
    }
    setLoading(true);
    let success = 0;
    let errors = 0;
    const failedNames: string[] = [];
    const total = targetProjects.length;

    toast({ title: 'Géocodage en cours...', description: `0 / ${total} projets traités...` });

    for (let i = 0; i < targetProjects.length; i++) {
      const p = targetProjects[i];
      const { address, qstKeys } = await buildAddress(p, mode);
      console.log(`[GPS][${mode}] ${p.code_projet} → address: "${address}" | qst keys: ${qstKeys.join(', ')}`);
      if (!address) { errors++; failedNames.push(p.code_projet); continue; }

      try {
        const { data, error: fnError } = await supabase.functions.invoke('geocode', { body: { address } });
        if (fnError) throw fnError;
        const result = Array.isArray(data) ? data : [];
        if (result.length > 0) {
          const coords = `${result[0].lat}, ${result[0].lon}`;
          const { error } = await supabase.from('be_projects').update({ gps_coordinates: coords }).eq('id', p.id);
          if (error) { errors++; failedNames.push(p.code_projet); } else { success++; }
        } else { errors++; failedNames.push(p.code_projet); }
      } catch { errors++; failedNames.push(p.code_projet); }

      toast({ title: 'Géocodage en cours...', description: `${i + 1} / ${total} projets traités...` });
      if (i < targetProjects.length - 1) await new Promise(resolve => setTimeout(resolve, 1100));
    }

    setLoading(false);
    queryClient.invalidateQueries({ queryKey: ['be-synthese-stats'] });
    toast({
      title: 'Géocodage terminé',
      description: `${success} coordonnées générées, ${errors} échecs sur ${total} projets.${failedNames.length > 0 ? ` Échecs : ${failedNames.slice(0, 5).join(', ')}${failedNames.length > 5 ? '...' : ''}` : ''}`,
    });
  }, [queryClient, buildAddress]);

  // Leaflet map initialization
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || withCoords.length === 0) return;

    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const map = L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: true });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);

    const statusColor: Record<string, string> = { active: '#10b981', on_hold: '#f59e0b', closed: '#6b7280' };

    const markers = L.markerClusterGroup({
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let bg = '#10b981';
        if (count > 20) bg = '#ef4444';
        else if (count > 5) bg = '#f59e0b';
        return L.divIcon({
          html: `<div style="background:${bg};color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">${count}</div>`,
          className: '',
          iconSize: L.point(36, 36),
        });
      },
    });

    const bounds: [number, number][] = [];

    withCoords.forEach(p => {
      const parts = p.gps_coordinates!.split(',').map(s => parseFloat(s.trim()));
      const lat = parts[0], lon = parts[1];
      bounds.push([lat, lon]);

      const color = statusColor[p.status] || statusColor.active;
      const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
      const stats = allProjectStats[p.id];
      const progressHtml = stats
        ? `<div style="margin-top:6px;font-size:11px;color:#6b7280;">Avancement: ${stats.progress}% · ${stats.doneTasks}/${stats.totalTasks} tâches</div>`
        : '';

      const marker = L.circleMarker([lat, lon], { radius: 8, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9 });
      marker.bindPopup(`
        <div style="min-width:180px;font-family:system-ui,sans-serif;">
          <div style="font-weight:700;font-size:13px;color:${color};">${p.code_projet}</div>
          <div style="font-size:12px;margin-top:2px;">${p.nom_projet}</div>
          <div style="margin-top:4px;">
            <span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${color}20;color:${color};">${sc.label}</span>
          </div>
          ${p.region ? `<div style="margin-top:4px;font-size:11px;color:#6b7280;">📍 ${p.region}</div>` : ''}
          ${progressHtml}
          <a href="/be/projects/${p.code_projet}/overview" style="display:inline-block;margin-top:6px;font-size:11px;color:#3b82f6;text-decoration:underline;">Ouvrir le projet →</a>
        </div>
      `, { maxWidth: 250 });
      markers.addLayer(marker);
    });

    map.addLayer(markers);
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [withCoords, allProjectStats, navigate]);

  const isGeocoding = isBulkGeocoding || isRegenGeocoding;

  const bulkButton = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 ml-auto" disabled={isGeocoding}>
            {isGeocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>⚡</span>}
            GPS
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {missingGps.length > 0 && (
            <DropdownMenuItem disabled={isGeocoding} onClick={() => setConfirmAction({
              label: `Compléter les GPS manquants pour ${missingGps.length} projet(s) ?`,
              action: () => bulkGeocode(missingGps, 'missing', setIsBulkGeocoding),
            })}>
              <span className="mr-2">📍</span>
              Compléter GPS manquants ({missingGps.length})
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={isGeocoding} onClick={() => setConfirmAction({
            label: `Régénérer les GPS par questionnaire pour ${projects.length} projet(s) ?`,
            action: () => bulkGeocode(projects, 'questionnaire', setIsRegenGeocoding),
          })}>
            <span className="mr-2">🗺️</span>
            Régénérer par questionnaire ({projects.length})
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isGeocoding} onClick={() => setConfirmAction({
            label: `Régénérer les GPS par adresse société pour ${projects.length} projet(s) ?`,
            action: () => bulkGeocode(projects, 'societe', setIsRegenGeocoding),
          })}>
            <span className="mr-2">🏢</span>
            Régénérer par adresse société ({projects.length})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.action(); setConfirmAction(null); }}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (withCoords.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Carte de localisation</span>
          {bulkButton}
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Aucune coordonnée GPS disponible
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Carte de localisation</span>
        <Badge variant="secondary">{withCoords.length} projets géolocalisés</Badge>
        {bulkButton}
      </div>
      <div ref={mapContainerRef} className="flex-1 min-h-0 rounded-lg overflow-hidden relative z-0" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function BEProjectsSyntheseView({ projects, qstData, widgets: externalWidgets }: Props) {
  const navigate = useNavigate();
  const [internalWidgets, setInternalWidgets] = useState<WidgetConfig[]>(loadWidgetConfig);
  const widgets = externalWidgets ?? internalWidgets;
  const setWidgets = useCallback((next: WidgetConfig[] | ((prev: WidgetConfig[]) => WidgetConfig[])) => {
    setInternalWidgets(prev => {
      const result = typeof next === 'function' ? next(prev) : next;
      saveWidgetConfig(result);
      return result;
    });
  }, []);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Fetch task stats for all projects (batch)
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);

  const { data: allProjectStats = {} } = useQuery<Record<string, ProjectStats>>({
    queryKey: ['be-synthese-stats', projectIds.join(',')],
    queryFn: async () => {
      if (projectIds.length === 0) return {};
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, be_project_id, status, due_date')
        .in('be_project_id', projectIds);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const stats: Record<string, ProjectStats> = {};

      projectIds.forEach(id => {
        const pt = (tasks || []).filter(t => t.be_project_id === id);
        const total = pt.length;
        const done = pt.filter(t => ['done', 'validated', 'closed'].includes(t.status)).length;
        const overdue = pt.filter(t => {
          if (!t.due_date) return false;
          if (['done', 'validated', 'closed', 'cancelled'].includes(t.status)) return false;
          return new Date(t.due_date) < today;
        }).length;
        stats[id] = { totalTasks: total, doneTasks: done, overdueTasks: overdue, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
      });
      return stats;
    },
    enabled: projectIds.length > 0,
    staleTime: 30_000,
  });

  // ── Global KPIs ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'active').length;
    const closed = projects.filter(p => p.status === 'closed').length;
    const onHold = projects.filter(p => p.status === 'on_hold').length;
    const totalTasks = Object.values(allProjectStats).reduce((s, v) => s + v.totalTasks, 0);
    const doneTasks  = Object.values(allProjectStats).reduce((s, v) => s + v.doneTasks, 0);
    const overdue    = Object.values(allProjectStats).reduce((s, v) => s + v.overdueTasks, 0);
    const avgProgress = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + (allProjectStats[p.id]?.progress ?? 0), 0) / projects.length)
      : 0;
    return { total, active, closed, onHold, totalTasks, doneTasks, overdue, avgProgress };
  }, [projects, allProjectStats]);

  // ── Chart data ──────────────────────────────────────────────────────────
  const statusData = useMemo(() => [
    { name: 'Actif',      value: kpis.active,  color: '#10b981' },
    { name: 'Clôturé',    value: kpis.closed,  color: '#6b7280' },
    { name: 'En attente', value: kpis.onHold,  color: '#f59e0b' },
  ].filter(d => d.value > 0), [kpis]);

  const typoData = useMemo(() => {
    const map: Record<string, number> = {};
    projects.forEach(p => {
      const k = p.typologie || 'Non renseigné';
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).map(([name, value], i) => ({
      name: name === 'metha_agricole' ? 'Métha. agricole'
          : name === 'metha_territoriale' ? 'Métha. territoriale'
          : name,
      value,
      color: TYPO_COLORS[name] || CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [projects]);

  const progressData = useMemo(() =>
    projects
      .filter(p => (allProjectStats[p.id]?.totalTasks ?? 0) > 0)
      .sort((a, b) => (allProjectStats[b.id]?.progress ?? 0) - (allProjectStats[a.id]?.progress ?? 0))
      .slice(0, 12)
      .map(p => ({
        name: p.code_projet,
        progress: allProjectStats[p.id]?.progress ?? 0,
        tasks: allProjectStats[p.id]?.totalTasks ?? 0,
      })),
    [projects, allProjectStats]
  );

  const regionData = useMemo(() => {
    const map: Record<string, number> = {};
    projects.forEach(p => {
      const k = p.region || p.departement || 'Non renseigné';
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [projects]);

  const keonProjects = useMemo(() =>
    projects.filter(p => qstData[p.id] && Object.keys(qstData[p.id]).length > 0),
    [projects, qstData]
  );

  const spvData = useMemo(() => {
    const map: Record<string, number> = {};
    keonProjects.forEach(p => {
      const v = qstData[p.id]?.['02_GEN_spv_creee'] || 'Non renseigné';
      map[v] = (map[v] || 0) + 1;
    });
    return Object.entries(map).map(([name, value], i) => ({
      name, value, color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [keonProjects, qstData]);

  const topProjects = useMemo(() =>
    [...projects]
      .filter(p => allProjectStats[p.id]?.totalTasks > 0)
      .sort((a, b) => (allProjectStats[b.id]?.progress ?? 0) - (allProjectStats[a.id]?.progress ?? 0))
      .slice(0, 6),
    [projects, allProjectStats]
  );

  const atRiskProjects = useMemo(() =>
    [...projects]
      .filter(p => (allProjectStats[p.id]?.overdueTasks ?? 0) > 0)
      .sort((a, b) => (allProjectStats[b.id]?.overdueTasks ?? 0) - (allProjectStats[a.id]?.overdueTasks ?? 0))
      .slice(0, 4),
    [projects, allProjectStats]
  );

  // ── Edit mode handlers ──────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setWidgets(getDefaultWidgets());
    toast({ title: 'Configuration réinitialisée' });
  }, [setWidgets]);

  const handleResizeWidget = useCallback((widgetId: string, preset: WidgetSizePreset) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, size: { ...PRESET_DIMENSIONS[preset], h: w.size.h } } : w
    ));
  }, [setWidgets]);

  const handleHeightChange = useCallback((widgetId: string, preset: HeightPreset) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, size: { ...w.size, h: HEIGHT_PRESET_TO_H[preset] } } : w
    ));
  }, [setWidgets]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, visible: false } : w
    ));
    toast({ title: 'Widget masqué' });
  }, [setWidgets]);

  const handleRestoreAll = useCallback(() => {
    setWidgets(prev => prev.map(w => ({ ...w, visible: true })));
    toast({ title: 'Tous les widgets sont visibles' });
  }, [setWidgets]);

  // Drag-and-drop
  const handleDragStart = (widgetId: string) => {
    if (!isEditing) return;
    setDraggedWidget(widgetId);
  };

  const handleDragOverEnhanced = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetId) return;
    setDropTargetId(targetId);
  };

  const handleDropEnhanced = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDropTargetId(null);
    if (!draggedWidget || draggedWidget === targetId) return;

    setWidgets(prev => {
      const newWidgets = [...prev];
      const draggedIndex = newWidgets.findIndex(w => w.id === draggedWidget);
      const targetIndex = newWidgets.findIndex(w => w.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      const [removed] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(targetIndex, 0, removed);
      return newWidgets;
    });

    setDraggedWidget(null);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
    setDropTargetId(null);
  };

  // ── Visible widgets ─────────────────────────────────────────────────────
  const visibleWidgets = useMemo(() => widgets.filter(w => w.visible), [widgets]);
  const hiddenCount = widgets.length - visibleWidgets.length;

  // ── 2-column bin-packing layout ─────────────────────────────────────────
  const gridLayout = useMemo(() => {
    const GAP = 16;
    const colHeights = [0, 0];
    const placements: { widget: WidgetConfig; col: 0 | 1 | 'full'; top: number }[] = [];

    for (const w of visibleWidgets) {
      const h = getHeightPx(w);
      if (w.size.w >= 2) {
        const top = Math.max(colHeights[0], colHeights[1]);
        placements.push({ widget: w, col: 'full', top });
        const newBottom = top + h + GAP;
        colHeights[0] = newBottom;
        colHeights[1] = newBottom;
      } else {
        const targetCol = colHeights[0] <= colHeights[1] ? 0 : 1;
        const top = colHeights[targetCol];
        placements.push({ widget: w, col: targetCol as 0 | 1, top });
        colHeights[targetCol] = top + h + GAP;
      }
    }

    const totalHeight = Math.max(colHeights[0], colHeights[1]);
    return { placements, totalHeight };
  }, [visibleWidgets]);

  // ── Render widget content by id ─────────────────────────────────────────
  const renderWidgetContent = useCallback((widget: WidgetConfig) => {
    const h = getHeightPx(widget) - 60; // subtract header height

    switch (widget.id) {
      case 'kpi_strip':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 h-full">
            {[
              { icon: FolderOpen,    label: 'Total projets',  value: kpis.total,       color: 'text-primary',      accent: '#1E5EFF' },
              { icon: Activity,      label: 'Actifs',         value: kpis.active,      color: 'text-emerald-500',  accent: '#10b981' },
              { icon: Clock,         label: 'En attente',     value: kpis.onHold,      color: 'text-amber-500',    accent: '#f59e0b' },
              { icon: CheckCircle2,  label: 'Clôturés',       value: kpis.closed,      color: 'text-muted-foreground', accent: '#6b7280' },
              { icon: Zap,           label: 'Total tâches',   value: kpis.totalTasks,  color: 'text-blue-500',     accent: '#3b82f6' },
              { icon: CheckCircle2,  label: 'Tâches faites',  value: kpis.doneTasks,   color: 'text-emerald-500',  accent: '#10b981' },
              { icon: AlertTriangle, label: 'En retard',      value: kpis.overdue,     color: 'text-red-500',      accent: '#ef4444' },
              { icon: TrendingUp,    label: 'Avancement moy.', value: kpis.avgProgress, color: 'text-violet-500',  accent: '#8b5cf6', suffix: '%' },
            ].map(({ icon: Icon, label, value, color, accent, suffix }) => (
              <Card key={label}
                className="border-border/50 hover:shadow-md transition-all duration-300 overflow-hidden"
                style={{ borderLeft: `3px solid ${accent}` }}
              >
                <CardContent className="p-3 flex flex-col gap-1">
                  <Icon className={cn('h-4 w-4', color)} />
                  <div className={cn('text-xl font-bold tabular-nums', color)}>
                    <AnimatedNumber value={typeof value === 'number' ? value : 0} suffix={suffix} />
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'map':
        return <ProjectMapCard projects={projects} allProjectStats={allProjectStats} />;

      case 'status_pie':
        return (
          <ResponsiveContainer width="100%" height={h}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={h * 0.22} outerRadius={h * 0.37} paddingAngle={3}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v} projet(s)`, n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'typo_pie':
        return (
          <ResponsiveContainer width="100%" height={h}>
            <PieChart>
              <Pie data={typoData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={h * 0.22} outerRadius={h * 0.37} paddingAngle={3}>
                {typoData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v} projet(s)`, n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'progress_bar':
        return progressData.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">Aucune tâche enregistrée</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(h, progressData.length * 28)}>
            <BarChart data={progressData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fontFamily: 'monospace' }} />
              <Tooltip formatter={(v: any) => [`${v}%`, 'Avancement']} />
              <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                {progressData.map((entry, i) => (
                  <Cell key={i} fill={entry.progress >= 80 ? '#10b981' : entry.progress >= 40 ? '#f59e0b' : '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'region_bar':
        return regionData.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">Aucune région renseignée</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(h, regionData.length * 28)}>
            <BarChart data={regionData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => [`${v} projet(s)`, 'Projets']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {regionData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'keon_spv':
        return spvData.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">Aucune donnée questionnaire</div>
        ) : (
          <ResponsiveContainer width="100%" height={h - 20}>
            <PieChart>
              <Pie data={spvData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={h * 0.2} outerRadius={h * 0.32} paddingAngle={3}>
                {spvData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v} projet(s)`, n]} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'at_risk':
        return (
          <div className="space-y-2">
            {atRiskProjects.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-6 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                Aucun projet en retard
              </div>
            ) : atRiskProjects.map(p => {
              const st = allProjectStats[p.id];
              return (
                <button key={p.id}
                  onClick={() => navigate(`/be/projects/${p.code_projet}/overview`)}
                  className="w-full text-left rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-3 py-2 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-primary">{p.code_projet}</span>
                    <Badge variant="destructive" className="text-[10px] h-4 px-1">
                      {st?.overdueTasks} retard{(st?.overdueTasks ?? 0) > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{p.nom_projet}</div>
                  <Progress value={st?.progress ?? 0} className="h-1 mt-1.5" />
                </button>
              );
            })}
          </div>
        );

      case 'top_projects':
        return (
          <div className="space-y-2">
            {topProjects.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-6">Aucune tâche enregistrée</div>
            ) : topProjects.map(p => {
              const st = allProjectStats[p.id];
              const prog = st?.progress ?? 0;
              const color = prog >= 80 ? '#10b981' : prog >= 40 ? '#f59e0b' : '#6b7280';
              return (
                <button key={p.id}
                  onClick={() => navigate(`/be/projects/${p.code_projet}/overview`)}
                  className="w-full text-left rounded-lg border border-border/50 hover:bg-muted/30 px-3 py-2 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-primary">{p.code_projet}</span>
                    <div className="relative w-10 h-10 shrink-0">
                      <RadialProgress value={prog} size={40} stroke={4} color={color} />
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>{prog}%</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.nom_projet}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{st?.doneTasks}/{st?.totalTasks} tâches</div>
                </button>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  }, [kpis, projects, allProjectStats, statusData, typoData, progressData, regionData, spvData, keonProjects, atRiskProjects, topProjects, navigate]);

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Aucun projet à afficher avec ces filtres.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" />
          {isEditing ? 'Terminer' : 'Personnaliser'}
        </Button>

        {isEditing && (
          <>
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </Button>
            {hiddenCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleRestoreAll} className="gap-2">
                Afficher tout ({hiddenCount} masqué{hiddenCount > 1 ? 's' : ''})
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── Widget Grid (2-column bin-packing) ── */}
      <div
        className={cn(
          'relative',
          isEditing && 'rounded-xl border-2 border-dashed border-primary/30 p-4'
        )}
        style={{ minHeight: gridLayout.totalHeight || 'auto' }}
      >
        {/* Grid overlay in edit mode */}
        {isEditing && (
          <div className="absolute inset-0 pointer-events-none z-0 rounded-xl overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px w-[2px] border-l-2 border-dashed border-primary/15" />
            {Array.from({ length: Math.ceil((gridLayout.totalHeight || 600) / 200) }).map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 h-[1px] border-t border-dashed border-primary/10"
                style={{ top: i * 200 }}
              />
            ))}
          </div>
        )}

        {/* Desktop: absolutely positioned widgets */}
        <div className="hidden md:block relative" style={{ height: gridLayout.totalHeight || 'auto' }}>
          {gridLayout.placements.map(({ widget, col, top }) => {
            const heightPx = getHeightPx(widget);
            const isFull = col === 'full';
            return (
              <div
                key={widget.id}
                className={cn(
                  'absolute transition-all duration-300 ease-in-out',
                  isEditing && 'cursor-move',
                  draggedWidget === widget.id && 'opacity-40 scale-[0.98]',
                  dropTargetId === widget.id && 'ring-2 ring-primary ring-offset-2 rounded-xl'
                )}
                style={{
                  top,
                  left: isFull ? 0 : col === 0 ? 0 : 'calc(50% + 8px)',
                  width: isFull ? '100%' : 'calc(50% - 8px)',
                  height: heightPx,
                }}
                draggable={isEditing}
                onDragStart={() => handleDragStart(widget.id)}
                onDragOver={(e) => handleDragOverEnhanced(e, widget.id)}
                onDrop={(e) => handleDropEnhanced(e, widget.id)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => setDropTargetId(null)}
              >
                <WidgetWrapper
                  title={widget.label}
                  onRemove={isEditing ? () => handleRemoveWidget(widget.id) : undefined}
                  isDragging={draggedWidget === widget.id}
                  sizePreset={isEditing ? getSizePreset(widget) : undefined}
                  onResize={isEditing ? (preset) => handleResizeWidget(widget.id, preset) : undefined}
                  heightPreset={isEditing ? getHeightPreset(widget) : undefined}
                  onHeightChange={isEditing ? (preset) => handleHeightChange(widget.id, preset) : undefined}
                >
                  {renderWidgetContent(widget)}
                </WidgetWrapper>
              </div>
            );
          })}
        </div>

        {/* Mobile fallback: stacked layout */}
        <div className="md:hidden space-y-4">
          {visibleWidgets.map(widget => (
            <div
              key={widget.id}
              style={{ height: getHeightPx(widget) }}
              draggable={isEditing}
              onDragStart={() => handleDragStart(widget.id)}
              onDragOver={(e) => handleDragOverEnhanced(e, widget.id)}
              onDrop={(e) => handleDropEnhanced(e, widget.id)}
              onDragEnd={handleDragEnd}
            >
              <WidgetWrapper
                title={widget.label}
                onRemove={isEditing ? () => handleRemoveWidget(widget.id) : undefined}
                isDragging={draggedWidget === widget.id}
                sizePreset={isEditing ? getSizePreset(widget) : undefined}
                onResize={isEditing ? (preset) => handleResizeWidget(widget.id, preset) : undefined}
                heightPreset={isEditing ? getHeightPreset(widget) : undefined}
                onHeightChange={isEditing ? (preset) => handleHeightChange(widget.id, preset) : undefined}
              >
                {renderWidgetContent(widget)}
              </WidgetWrapper>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
