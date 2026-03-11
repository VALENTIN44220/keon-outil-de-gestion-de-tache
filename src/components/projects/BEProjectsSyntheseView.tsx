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
  TrendingUp, Activity, Zap, Globe, Loader2, ChevronDown
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
  WidgetConfig,
} from './SyntheseWidgetConfigPanel';

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

// ─── Size → height mapping ────────────────────────────────────────────────────
const SIZE_HEIGHTS: Record<string, number> = { compact: 160, normal: 200, large: 280 };

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
      // ease-out cubic
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

// ─── Animated widget wrapper ──────────────────────────────────────────────────
function WidgetCard({
  children,
  accentColor,
  gradientFrom,
  gradientTo,
  className,
  delay = 0,
  ...props
}: {
  children: React.ReactNode;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  className?: string;
  delay?: number;
} & React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        'border-border/50 overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-black/5',
        className
      )}
      style={{
        borderLeft: `3px solid ${accentColor}`,
        animation: `synthese-slide-up 0.5s ease-out ${delay}ms both`,
      }}
      {...props}
    >
      {children}
    </Card>
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

    // mode === 'missing': questionnaire priority then fallback
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
      <Card className="col-span-full border-border/50" style={{ borderLeft: '3px solid #12B6C8' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Carte de localisation
            {bulkButton}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Aucune coordonnée GPS disponible
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full border-border/50 overflow-hidden" style={{ borderLeft: '3px solid #12B6C8' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Carte de localisation
          <Badge variant="secondary">{withCoords.length} projets géolocalisés</Badge>
          {bulkButton}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={mapContainerRef} style={{ height: 340, width: '100%' }} />
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function BEProjectsSyntheseView({ projects, qstData, widgets: externalWidgets }: Props) {
  const navigate = useNavigate();
  const [internalWidgets, setInternalWidgets] = useState<WidgetConfig[]>(loadWidgetConfig);
  const widgets = externalWidgets ?? internalWidgets;

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

  // ── Widget visibility helper ──────────────────────────────────────────────
  const isVisible = useCallback((id: string) => widgets.find(w => w.id === id)?.visible ?? true, [widgets]);
  const getWidgetConfig = useCallback((id: string) => widgets.find(w => w.id === id), [widgets]);
  const getHeight = useCallback((id: string) => {
    const w = widgets.find(w => w.id === id);
    return SIZE_HEIGHTS[w?.size ?? 'normal'];
  }, [widgets]);

  // Build ordered widget render map
  const visibleWidgets = useMemo(() => widgets.filter(w => w.visible), [widgets]);

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Aucun projet à afficher avec ces filtres.
      </div>
    );
  }

  // ── Render a widget by id ────────────────────────────────────────────────
  const renderWidget = (widget: WidgetConfig, delay: number) => {
    const h = SIZE_HEIGHTS[widget.size];

    switch (widget.id) {
      case 'kpi_strip':
        return (
          <div
            key={widget.id}
            className="col-span-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3"
            style={{ animation: `synthese-slide-up 0.5s ease-out ${delay}ms both` }}
          >
            {[
              { icon: FolderOpen,    label: 'Total projets',  value: kpis.total,       color: 'text-primary',      accent: '#1E5EFF' },
              { icon: Activity,      label: 'Actifs',         value: kpis.active,      color: 'text-emerald-500',  accent: '#10b981' },
              { icon: Clock,         label: 'En attente',     value: kpis.onHold,      color: 'text-amber-500',    accent: '#f59e0b' },
              { icon: CheckCircle2,  label: 'Clôturés',       value: kpis.closed,      color: 'text-muted-foreground', accent: '#6b7280' },
              { icon: Zap,           label: 'Total tâches',   value: kpis.totalTasks,  color: 'text-blue-500',     accent: '#3b82f6' },
              { icon: CheckCircle2,  label: 'Tâches faites',  value: kpis.doneTasks,   color: 'text-emerald-500',  accent: '#10b981' },
              { icon: AlertTriangle, label: 'En retard',      value: kpis.overdue,     color: 'text-red-500',      accent: '#ef4444' },
              { icon: TrendingUp,    label: 'Avancement moy.', value: kpis.avgProgress, color: 'text-violet-500',  accent: '#8b5cf6', suffix: '%' },
            ].map(({ icon: Icon, label, value, color, accent, suffix }, i) => (
              <Card key={label}
                className="border-border/50 hover:shadow-md transition-all duration-300 overflow-hidden"
                style={{
                  borderLeft: `3px solid ${accent}`,
                  animation: `synthese-slide-up 0.4s ease-out ${delay + i * 50}ms both`,
                }}
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
        return (
          <div key={widget.id} className="col-span-full"
            style={{ animation: `synthese-slide-up 0.5s ease-out ${delay}ms both` }}>
            <ProjectMapCard projects={projects} allProjectStats={allProjectStats} />
          </div>
        );

      case 'status_pie':
        return (
          <WidgetCard key={widget.id} accentColor={widget.accentColor}
            gradientFrom={widget.gradientFrom} gradientTo={widget.gradientTo} delay={delay}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Par statut</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
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
            </CardContent>
          </WidgetCard>
        );

      case 'typo_pie':
        return (
          <WidgetCard key={widget.id} accentColor={widget.accentColor}
            gradientFrom={widget.gradientFrom} gradientTo={widget.gradientTo} delay={delay}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Par typologie</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
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
            </CardContent>
          </WidgetCard>
        );

      case 'progress_bar':
        return (
          <WidgetCard key={widget.id} accentColor={widget.accentColor}
            gradientFrom={widget.gradientFrom} gradientTo={widget.gradientTo} delay={delay}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Avancement par projet (tâches)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {progressData.length === 0 ? (
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
              )}
            </CardContent>
          </WidgetCard>
        );

      case 'region_bar':
        return (
          <WidgetCard key={widget.id} accentColor={widget.accentColor}
            gradientFrom={widget.gradientFrom} gradientTo={widget.gradientTo} delay={delay}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Répartition géographique
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {regionData.length === 0 ? (
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
              )}
            </CardContent>
          </WidgetCard>
        );

      case 'keon_spv':
        return (
          <WidgetCard key={widget.id} accentColor={widget.accentColor}
            gradientFrom={widget.gradientFrom} gradientTo={widget.gradientTo} delay={delay}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                KEON — SPV créée
                <Badge variant="secondary" className="ml-auto text-[10px]">{keonProjects.length} projet(s) KEON</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {spvData.length === 0 ? (
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
              )}
            </CardContent>
          </WidgetCard>
        );

      case 'at_risk':
        return (
          <WidgetCard key={widget.id} accentColor={widget.accentColor}
            gradientFrom={widget.gradientFrom} gradientTo={widget.gradientTo} delay={delay}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Projets en retard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
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
            </CardContent>
          </WidgetCard>
        );

      case 'top_projects':
        return (
          <WidgetCard key={widget.id} accentColor={widget.accentColor}
            gradientFrom={widget.gradientFrom} gradientTo={widget.gradientTo} delay={delay}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Projets les plus avancés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
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
            </CardContent>
          </WidgetCard>
        );

      default:
        return null;
    }
  };

  // ── Layout: group widgets into rows ──────────────────────────────────────
  // full-width: kpi_strip, map, progress_bar, region_bar
  // half-width: status_pie, typo_pie
  // third-width: keon_spv, at_risk, top_projects
  const FULL_WIDTH = new Set(['kpi_strip', 'map']);
  const HALF_WIDTH = new Set(['progress_bar', 'region_bar']);
  const THIRD_WIDTH = new Set(['keon_spv', 'at_risk', 'top_projects']);

  // Group visible widgets into layout sections
  const fullWidgets = visibleWidgets.filter(w => FULL_WIDTH.has(w.id));
  const halfWidgets = visibleWidgets.filter(w => HALF_WIDTH.has(w.id) || w.id === 'status_pie' || w.id === 'typo_pie');
  const thirdWidgets = visibleWidgets.filter(w => THIRD_WIDTH.has(w.id));

  let delayCounter = 0;
  const getDelay = () => { delayCounter += 80; return delayCounter; };

  return (
    <div className="space-y-6">

      {/* Render widgets in order */}
      {visibleWidgets.map(widget => {
        const delay = getDelay();

        if (FULL_WIDTH.has(widget.id)) {
          return renderWidget(widget, delay);
        }

        return null;
      })}

      {/* Half-width row */}
      {halfWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {halfWidgets.map(w => renderWidget(w, getDelay()))}
        </div>
      )}

      {/* Third-width row */}
      {thirdWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {thirdWidgets.map(w => renderWidget(w, getDelay()))}
        </div>
      )}
    </div>
  );
}
