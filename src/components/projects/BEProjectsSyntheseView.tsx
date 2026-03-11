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
  TrendingUp, Activity, Zap, Globe, Loader2
} from 'lucide-react';

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

  const [isRegenGeocoding, setIsRegenGeocoding] = useState(false);

  const bulkGeocode = useCallback(async (targetProjects: BEProject[], setLoading: (v: boolean) => void) => {
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
      const addressParts = [p.adresse_site || p.adresse_societe, p.departement, p.region, p.pays_site || p.pays || 'France'].filter(Boolean);
      if (addressParts.length === 0) { errors++; continue; }

      try {
        const address = addressParts.join(', ');
        const { data, error: fnError } = await supabase.functions.invoke('geocode', {
          body: { address },
        });
        if (fnError) throw fnError;
        const result = Array.isArray(data) ? data : [];
        if (result.length > 0) {
          const coords = `${result[0].lat}, ${result[0].lon}`;
          const { error } = await supabase.from('be_projects').update({ gps_coordinates: coords }).eq('id', p.id);
          if (error) { errors++; failedNames.push(p.code_projet); } else { success++; }
        } else {
          errors++;
          failedNames.push(p.code_projet);
        }
      } catch (err: any) {
        errors++;
        failedNames.push(p.code_projet);
      }

      toast({ title: 'Géocodage en cours...', description: `${i + 1} / ${total} projets traités...` });

      if (i < targetProjects.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }

    setLoading(false);
    queryClient.invalidateQueries({ queryKey: ['be-synthese-stats'] });
    toast({
      title: 'Géocodage terminé',
      description: `${success} coordonnées générées, ${errors} échecs sur ${total} projets.${failedNames.length > 0 ? ` Échecs : ${failedNames.slice(0, 5).join(', ')}${failedNames.length > 5 ? '...' : ''}` : ''}`,
    });
  }, [queryClient]);

  const handleBulkGeocode = useCallback(() => {
    bulkGeocode(missingGps, setIsBulkGeocoding);
  }, [missingGps, bulkGeocode]);

  const handleRegenGeocode = useCallback(() => {
    bulkGeocode(projects, setIsRegenGeocoding);
  }, [projects, bulkGeocode]);

  // Leaflet map initialization
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || withCoords.length === 0) return;

    // Destroy previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    const statusColor: Record<string, string> = {
      active: '#10b981',
      on_hold: '#f59e0b',
      closed: '#6b7280',
    };

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
      const lat = parts[0];
      const lon = parts[1];
      bounds.push([lat, lon]);

      const color = statusColor[p.status] || statusColor.active;
      const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
      const stats = allProjectStats[p.id];
      const progressHtml = stats
        ? `<div style="margin-top:6px;font-size:11px;color:#6b7280;">Avancement: ${stats.progress}% · ${stats.doneTasks}/${stats.totalTasks} tâches</div>`
        : '';

      const marker = L.circleMarker([lat, lon], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9,
      });

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

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [withCoords, allProjectStats, navigate]);

  const bulkButton = (
    <div className="flex items-center gap-1 ml-auto">
      {missingGps.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={handleBulkGeocode}
          disabled={isBulkGeocoding || isRegenGeocoding}
        >
          {isBulkGeocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>📍</span>}
          Générer GPS manquants ({missingGps.length})
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs gap-1"
        onClick={handleRegenGeocode}
        disabled={isBulkGeocoding || isRegenGeocoding}
      >
        {isRegenGeocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>🔄</span>}
        Régénérer GPS filtrés ({projects.length})
      </Button>
    </div>
  );

  if (withCoords.length === 0) {
    return (
      <Card className="col-span-2 border-border/50">
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
    <Card className="col-span-2 border-border/50 overflow-hidden">
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
export function BEProjectsSyntheseView({ projects, qstData }: Props) {
  const navigate = useNavigate();

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

  // ── Chart: by status ──────────────────────────────────────────────────────
  const statusData = useMemo(() => [
    { name: 'Actif',      value: kpis.active,  color: '#10b981' },
    { name: 'Clôturé',    value: kpis.closed,  color: '#6b7280' },
    { name: 'En attente', value: kpis.onHold,  color: '#f59e0b' },
  ].filter(d => d.value > 0), [kpis]);

  // ── Chart: by typologie ───────────────────────────────────────────────────
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

  // ── Chart: avancement par projet (top 10 with tasks) ─────────────────────
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

  // ── Chart: by région ──────────────────────────────────────────────────────
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

  // ── KEON questionnaire summary ────────────────────────────────────────────
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

  // ── Project cards (top performers + at risk) ──────────────────────────────
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

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Aucun projet à afficher avec ces filtres.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { icon: FolderOpen,    label: 'Total projets',  value: kpis.total,       color: 'text-primary'  },
          { icon: Activity,      label: 'Actifs',         value: kpis.active,      color: 'text-emerald-500' },
          { icon: Clock,         label: 'En attente',     value: kpis.onHold,      color: 'text-amber-500' },
          { icon: CheckCircle2,  label: 'Clôturés',       value: kpis.closed,      color: 'text-slate-400' },
          { icon: Zap,           label: 'Total tâches',   value: kpis.totalTasks,  color: 'text-blue-500' },
          { icon: CheckCircle2,  label: 'Tâches faites',  value: kpis.doneTasks,   color: 'text-emerald-500' },
          { icon: AlertTriangle, label: 'En retard',      value: kpis.overdue,     color: 'text-red-500' },
          { icon: TrendingUp,    label: 'Avancement moy.', value: `${kpis.avgProgress}%`, color: 'text-violet-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-3 flex flex-col gap-1">
              <Icon className={cn('h-4 w-4', color)} />
              <div className={cn('text-xl font-bold', color)}>{value}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Row 1: Map + Statuts + Typologies ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Map: spans 2 cols */}
        <ProjectMapCard projects={projects} allProjectStats={allProjectStats} />

        {/* Status Pie */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Par statut</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [`${v} projet(s)`, n]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Typologie Pie */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Par typologie</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={typoData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {typoData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [`${v} projet(s)`, n]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Avancement bar + Régions bar ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card className="border-border/50">
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
              <ResponsiveContainer width="100%" height={Math.max(200, progressData.length * 28)}>
                <BarChart data={progressData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Avancement']} />
                  <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                    {progressData.map((entry, i) => (
                      <Cell key={i}
                        fill={entry.progress >= 80 ? '#10b981' : entry.progress >= 40 ? '#f59e0b' : '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
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
              <ResponsiveContainer width="100%" height={Math.max(200, regionData.length * 28)}>
                <BarChart data={regionData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => [`${v} projet(s)`, 'Projets']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {regionData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: KEON questionnaire (SPV) + At risk ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* SPV chart (KEON) */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              KEON — SPV créée
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {keonProjects.length} projet(s) KEON
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {spvData.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">Aucune donnée questionnaire</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={spvData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={40} outerRadius={65} paddingAngle={3}>
                    {spvData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [`${v} projet(s)`, n]} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* At risk projects */}
        <Card className="border-border/50">
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
                <button
                  key={p.id}
                  onClick={() => navigate(`/be/projects/${p.code_projet}/overview`)}
                  className="w-full text-left rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-primary">{p.code_projet}</span>
                    <Badge variant="destructive" className="text-[10px] h-4 px-1">
                      {st?.overdueTasks} retard{st?.overdueTasks > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{p.nom_projet}</div>
                  <Progress value={st?.progress ?? 0} className="h-1 mt-1.5" />
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Top performing projects */}
        <Card className="border-border/50">
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
                <button
                  key={p.id}
                  onClick={() => navigate(`/be/projects/${p.code_projet}/overview`)}
                  className="w-full text-left rounded-lg border border-border/50 hover:bg-muted/30 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-primary">{p.code_projet}</span>
                    <div className="relative w-10 h-10 shrink-0">
                      <RadialProgress value={prog} size={40} stroke={4} color={color} />
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>
                        {prog}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.nom_projet}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{st?.doneTasks}/{st?.totalTasks} tâches</div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
