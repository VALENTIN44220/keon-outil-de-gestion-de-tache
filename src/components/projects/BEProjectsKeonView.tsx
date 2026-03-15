import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BEProject } from '@/types/beProject';
import { PilierCode } from '@/config/questionnaireConfig';
import { computePilierCompletion } from './keon-synthese/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort } from '@/hooks/useTableSort';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Leaf, Building2, Flame, BarChart2, MapPin, CheckCircle2, Settings2, RotateCcw } from 'lucide-react';
import { WidgetWrapper, WidgetSizePreset, HeightPreset } from '@/components/dashboard/widgets/WidgetWrapper';
import { WidgetConfig } from '@/components/dashboard/types';

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'];
const PILIER_CODES: PilierCode[] = ['00', '02', '04', '05', '06', '07'];
const STORAGE_KEY = 'spv_widget_layout';

// Default SPV widget configs using the same WidgetConfig shape as main dashboard
const DEFAULT_SPV_WIDGETS: WidgetConfig[] = [
  { id: 'kpis', type: 'stats-summary', title: 'KPI Band', size: { w: 4, h: 1 }, position: { x: 0, y: 0 } },
  { id: 'map', type: 'bar-chart', title: 'Carte des projets SPV', size: { w: 2, h: 4 }, position: { x: 0, y: 1 } },
  { id: 'typologie', type: 'pie-chart', title: 'Répartition par Typologie', size: { w: 2, h: 4 }, position: { x: 2, y: 1 } },
  { id: 'gisement', type: 'bar-chart', title: 'Gisement par projet', size: { w: 4, h: 4 }, position: { x: 0, y: 5 } },
  { id: 'tableau', type: 'data-table', title: 'Tableau récap', size: { w: 4, h: 5 }, position: { x: 0, y: 9 } },
];

interface Props {
  projects: BEProject[];
  qstData: Record<string, Record<string, any>>;
  keonProjectIds: Set<string>;
}

// --- Height/Size helpers (same as ConfigurableDashboard) ---
const HEIGHT_PRESET_PX: Record<HeightPreset, number> = { xs: 150, sm: 250, md: 350, lg: 450, xl: 600 };
const HEIGHT_PRESET_TO_H: Record<HeightPreset, number> = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 };
const PRESET_DIMENSIONS: Record<WidgetSizePreset, { w: number; h: number }> = {
  small: { w: 2, h: 2 }, medium: { w: 2, h: 3 }, large: { w: 4, h: 3 }, full: { w: 4, h: 4 },
};

const getSizePreset = (widget: WidgetConfig): WidgetSizePreset => {
  if (widget.size.w >= 3 && widget.size.h >= 4) return 'full';
  if (widget.size.w >= 3) return 'large';
  if (widget.size.h >= 3) return 'medium';
  return 'small';
};

const getHeightPresetFromWidget = (widget: WidgetConfig): HeightPreset => {
  const h = widget.size.h;
  if (h <= 1) return 'xs';
  if (h <= 2) return 'sm';
  if (h <= 3) return 'md';
  if (h <= 4) return 'lg';
  return 'xl';
};

const getWidgetHeightPx = (widget: WidgetConfig): number => HEIGHT_PRESET_PX[getHeightPresetFromWidget(widget)];
const isFullWidth = (widget: WidgetConfig) => widget.size.w >= 3;

// --- Utility functions ---
function safeFloat(v: any): number { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function getQstValue(qst: Record<string, any>, ...keywords: string[]): string | null {
  const key = Object.keys(qst).find(k => keywords.every(kw => k.toLowerCase().includes(kw.toLowerCase())));
  return key ? qst[key] : null;
}
function avgCompletion(projectQst: Record<string, any>): number {
  const totals = PILIER_CODES.map(code => computePilierCompletion(code, projectQst));
  return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
}
function completionColor(pct: number) {
  if (pct <= 30) return 'text-destructive';
  if (pct <= 70) return 'text-amber-500';
  return 'text-emerald-500';
}

export function BEProjectsKeonView({ projects, qstData, keonProjectIds }: Props) {
  const navigate = useNavigate();

  // --- Widget config state (same pattern as ConfigurableDashboard) ---
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try { return saved ? JSON.parse(saved) : DEFAULT_SPV_WIDGETS; } catch { return DEFAULT_SPV_WIDGETS; }
  });
  const [isEditing, setIsEditing] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Persist to localStorage
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets)); }, [widgets]);

  // --- Data computations ---
  const keonProjects = useMemo(() => projects.filter(p => keonProjectIds.has(p.id)), [projects, keonProjectIds]);

  const kpis = useMemo(() => {
    let spvCount = 0, gisementSum = 0, cmasValues: number[] = [], ksSum = 0, ksCount = 0, completeCount = 0;
    keonProjects.forEach(p => {
      const d = qstData[p.id] || {};
      if ((getQstValue(d, 'spv') || '').toUpperCase() === 'OUI') spvCount++;
      gisementSum += safeFloat(getQstValue(d, 'quantite', 'totale') || getQstValue(d, 'gisement', 'total') || '0');
      const cmas = safeFloat(getQstValue(d, 'cmax1') || '0');
      if (cmas > 0) cmasValues.push(cmas);
      const ks = safeFloat(getQstValue(d, 'keon', 'pct') || getQstValue(d, 'ks', 'keon') || '0');
      if (ks > 0) { ksSum += ks; ksCount++; }
      if (avgCompletion(d) > 50) completeCount++;
    });
    const cmasMoyen = cmasValues.length > 0 ? (cmasValues.reduce((a, b) => a + b, 0) / cmasValues.length).toFixed(1) : null;
    return { total: keonProjects.length, spv: spvCount, gisement: Math.round(gisementSum), cmas: cmasMoyen ?? 'N/A', ks: ksCount > 0 ? (ksSum / ksCount).toFixed(1) : '—', complete: completeCount };
  }, [keonProjects, qstData]);

  const typoPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    keonProjects.forEach(p => { const t = getQstValue(qstData[p.id] || {}, 'typologie') || 'Non renseigné'; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [keonProjects, qstData]);

  const gisementBarData = useMemo(() => {
    return keonProjects.map(p => {
      const d = qstData[p.id] || {};
      return { code: p.code_projet, gisement: safeFloat(getQstValue(d, 'quantite', 'totale') || getQstValue(d, 'gisement', 'total') || '0') };
    }).filter(d => d.gisement > 0).sort((a, b) => b.gisement - a.gisement);
  }, [keonProjects, qstData]);

  const tableData = useMemo(() => {
    return keonProjects.map(p => {
      const d = qstData[p.id] || {};
      return {
        id: p.id, code_projet: p.code_projet, nom_projet: p.nom_projet,
        region: getQstValue(d, 'region') || p.region || '—',
        typologie: getQstValue(d, 'typologie') || '—',
        spv: (getQstValue(d, 'spv') || '').toUpperCase(),
        ks: safeFloat(getQstValue(d, 'keon', 'pct') || getQstValue(d, 'ks', 'keon') || '0'),
        gisement: safeFloat(getQstValue(d, 'quantite', 'totale') || getQstValue(d, 'gisement', 'total') || '0'),
        cmas: safeFloat(getQstValue(d, 'cmax1') || '0'),
        completion: avgCompletion(d),
      };
    });
  }, [keonProjects, qstData]);

  const { sortedData, sortConfig, handleSort } = useTableSort(tableData, 'code_projet', 'asc');

  // --- Map ---
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const keonWithCoords = useMemo(() =>
    keonProjects.filter(p => {
      if (!p.gps_coordinates) return false;
      const parts = p.gps_coordinates.split(',').map(s => parseFloat(s.trim()));
      return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && (Math.abs(parts[0]) > 0.001 || Math.abs(parts[1]) > 0.001);
    }), [keonProjects]);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let initTimeoutId: number | null = null;
    let invalidateTimeoutId: number | null = null;

    // Load Leaflet CSS if not already loaded
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const scheduleInvalidate = () => {
      if (invalidateTimeoutId) window.clearTimeout(invalidateTimeoutId);
      invalidateTimeoutId = window.setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    };

    const initMap = () => {
      const L = (window as any).L;
      const container = mapRef.current;
      if (!L || !container || keonWithCoords.length === 0) return;

      const { height } = container.getBoundingClientRect();
      if (height <= 0) {
        initTimeoutId = window.setTimeout(initMap, 100);
        return;
      }

      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

      const map = L.map(container, { zoomControl: true, scrollWheelZoom: true });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
      const bounds: [number, number][] = [];
      keonWithCoords.forEach(p => {
        const [lat, lon] = p.gps_coordinates!.split(',').map(s => parseFloat(s.trim()));
        bounds.push([lat, lon]);
        const marker = L.circleMarker([lat, lon], { radius: 8, fillColor: '#10b981', color: '#fff', weight: 2, fillOpacity: 0.9 });
        marker.bindPopup(`<div style="min-width:160px;font-family:system-ui,sans-serif;"><div style="font-weight:700;font-size:13px;color:#10b981;">${p.code_projet}</div><div style="font-size:12px;margin-top:2px;">${p.nom_projet}</div>${p.region ? `<div style="margin-top:4px;font-size:11px;color:#6b7280;">📍 ${p.region}</div>` : ''}</div>`, { maxWidth: 250 });
        marker.addTo(map);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });

      // Force layout recompute once map is in the DOM
      scheduleInvalidate();

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          scheduleInvalidate();
        });
        resizeObserver.observe(container);
      }
    };

    const launchInit = () => {
      initTimeoutId = window.setTimeout(initMap, 150);
    };

    if ((window as any).L) {
      launchInit();
    } else {
      const existingScript = document.querySelector('script[src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"]') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', launchInit, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = launchInit;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (initTimeoutId) window.clearTimeout(initTimeoutId);
      if (invalidateTimeoutId) window.clearTimeout(invalidateTimeoutId);
      resizeObserver?.disconnect();
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [keonWithCoords]);

  // --- Widget manipulation handlers (same as ConfigurableDashboard) ---
  const handleRemoveWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  }, []);

  const handleResizeWidget = useCallback((id: string, preset: WidgetSizePreset) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, size: { ...PRESET_DIMENSIONS[preset] } } : w));
  }, []);

  const handleHeightChange = useCallback((id: string, preset: HeightPreset) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, size: { ...w.size, h: HEIGHT_PRESET_TO_H[preset] } } : w));
  }, []);

  const handleReset = useCallback(() => { setWidgets(DEFAULT_SPV_WIDGETS); }, []);

  const handleRestoreAll = useCallback(() => { setWidgets(DEFAULT_SPV_WIDGETS); }, []);

  const handleDragStart = (widgetId: string) => { if (isEditing) setDraggedWidget(widgetId); };
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedWidget && draggedWidget !== targetId) setDropTargetId(targetId);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDropTargetId(null);
    if (!draggedWidget || draggedWidget === targetId) return;
    setWidgets(prev => {
      const arr = [...prev];
      const di = arr.findIndex(w => w.id === draggedWidget);
      const ti = arr.findIndex(w => w.id === targetId);
      if (di === -1 || ti === -1) return prev;
      const [moved] = arr.splice(di, 1);
      arr.splice(ti, 0, moved);
      return arr;
    });
    setDraggedWidget(null);
  };
  const handleDragEnd = () => { setDraggedWidget(null); setDropTargetId(null); };

  // --- Bin-packing grid layout (same as ConfigurableDashboard) ---
  const gridLayout = useMemo(() => {
    const GAP = 16;
    const colHeights = [0, 0];
    const placements: { widget: WidgetConfig; col: 0 | 1 | 'full'; top: number }[] = [];
    for (const w of widgets) {
      const h = getWidgetHeightPx(w);
      if (isFullWidth(w)) {
        const top = Math.max(colHeights[0], colHeights[1]);
        placements.push({ widget: w, col: 'full', top });
        const nb = top + h + GAP;
        colHeights[0] = nb; colHeights[1] = nb;
      } else {
        const tc = colHeights[0] <= colHeights[1] ? 0 : 1;
        const top = colHeights[tc];
        placements.push({ widget: w, col: tc as 0 | 1, top });
        colHeights[tc] = top + h + GAP;
      }
    }
    return { placements, totalHeight: Math.max(colHeights[0], colHeights[1]) };
  }, [widgets]);

  // --- Widget content renderers ---
  const renderWidgetContent = useCallback((widget: WidgetConfig) => {
    const mapH = getWidgetHeightPx(widget) - 60;
    const safeMapHeight = Math.max(200, mapH);
    switch (widget.id) {
      case 'kpis':
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard icon={<Leaf className="h-5 w-5 text-emerald-500" />} label="Projets SPV" value={String(kpis.total)} />
            <KpiCard icon={<Building2 className="h-5 w-5 text-blue-500" />} label="SPV créées" value={String(kpis.spv)} badge badgeClass="bg-emerald-500/10 text-emerald-600 border-emerald-500/20" />
            <KpiCard icon={<BarChart2 className="h-5 w-5 text-amber-500" />} label="Gisement cumulé" value={`${kpis.gisement.toLocaleString('fr-FR')} tMB/an`} />
            <KpiCard icon={<Flame className="h-5 w-5 text-orange-500" />} label="Cmax moyen" value={kpis.cmas === 'N/A' ? 'N/A' : `${kpis.cmas} Nm³/h`} />
            <KpiCard icon={<BarChart2 className="h-5 w-5 text-violet-500" />} label="KS Keon moyen" value={`${kpis.ks} %`} />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Questionnaire >50%" value={String(kpis.complete)} />
          </div>
        );
      case 'map':
        return (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Carte des projets SPV</span>
              <Badge variant="secondary" className="ml-auto text-xs">{keonWithCoords.length} localisés</Badge>
            </div>
            {keonWithCoords.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground" style={{ height: safeMapHeight }}>
                <MapPin className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun projet localisé</p>
                <p className="text-xs mt-1">Renseignez les coordonnées GPS dans les fiches projet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div ref={mapRef} style={{ height: safeMapHeight }} className="w-full rounded-lg border border-border" />
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                  {keonWithCoords.map(p => (
                    <Badge
                      key={p.id}
                      variant="secondary"
                      className="cursor-pointer hover:bg-accent/20 text-xs"
                      onClick={() => navigate(`/be/projects/${p.code_projet}/overview`)}
                    >
                      <MapPin className="h-3 w-3 mr-1 text-emerald-500" />
                      {p.code_projet}{p.region ? ` · ${p.region}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case 'typologie':
        return typoPieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, mapH)}>
            <PieChart>
              <Pie data={typoPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} label={({ name, percent }) => percent > 0.05 ? name : ''}>
                {typoPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : <p className="text-center text-muted-foreground py-8">Aucune donnée</p>;
      case 'gisement':
        return gisementBarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, gisementBarData.length * 38)}>
            <BarChart data={gisementBarData} layout="vertical" margin={{ left: 80, right: 40 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="code" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('fr-FR')} tMB/an`, 'Gisement']} />
              <Bar dataKey="gisement" fill="#10b981" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: (v: number) => v.toLocaleString('fr-FR') }} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-center text-muted-foreground py-8">Aucune donnée</p>;
      case 'tableau':
        return (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <SortableTableHead sortKey="code_projet" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Code</SortableTableHead>
                  <SortableTableHead sortKey="nom_projet" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Nom projet</SortableTableHead>
                  <SortableTableHead sortKey="region" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Région</SortableTableHead>
                  <SortableTableHead sortKey="typologie" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Typologie</SortableTableHead>
                  <SortableTableHead sortKey="spv" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>SPV</SortableTableHead>
                  <SortableTableHead sortKey="ks" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>KS%</SortableTableHead>
                  <SortableTableHead sortKey="gisement" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Gisement</SortableTableHead>
                  <SortableTableHead sortKey="cmas" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Cmax</SortableTableHead>
                  <SortableTableHead sortKey="completion" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Complétion</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(row => (
                  <TableRow key={row.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/be/projects/${row.code_projet}/overview`)}>
                    <TableCell className="font-mono font-medium text-primary">{row.code_projet}</TableCell>
                    <TableCell className="font-medium">{row.nom_projet}</TableCell>
                    <TableCell className="text-muted-foreground">{row.region}</TableCell>
                    <TableCell className="text-muted-foreground">{row.typologie}</TableCell>
                    <TableCell><SpvBadge value={row.spv} /></TableCell>
                    <TableCell className="text-muted-foreground">{row.ks > 0 ? `${row.ks}%` : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.gisement > 0 ? row.gisement.toLocaleString('fr-FR') : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.cmas > 0 ? row.cmas.toLocaleString('fr-FR') : '—'}</TableCell>
                    <TableCell><span className={cn('font-semibold', completionColor(row.completion))}>{row.completion}%</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      default:
        return <div className="text-muted-foreground">Widget non reconnu</div>;
    }
  }, [kpis, keonWithCoords, typoPieData, gisementBarData, sortedData, sortConfig, handleSort, navigate]);

  if (keonProjects.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Leaf className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p>Aucun projet SPV trouvé dans les filtres actuels.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar - identical to ConfigurableDashboard */}
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
            <Button variant="outline" size="sm" onClick={handleRestoreAll}>
              Afficher tout
            </Button>
          </>
        )}
      </div>

      {/* Widget Grid - Smart 2-column bin-packing layout (same as ConfigurableDashboard) */}
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
              <div key={i} className="absolute left-0 right-0 h-[1px] border-t border-dashed border-primary/10" style={{ top: i * 200 }} />
            ))}
          </div>
        )}

        {/* Desktop: Absolutely positioned widgets for true 2-column packing */}
        <div className="hidden md:block relative" style={{ height: gridLayout.totalHeight || 'auto' }}>
          {gridLayout.placements.map(({ widget, col, top }) => {
            const heightPx = getWidgetHeightPx(widget);
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
                onDragOver={(e) => handleDragOver(e, widget.id)}
                onDrop={(e) => handleDrop(e, widget.id)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => setDropTargetId(null)}
              >
                <WidgetWrapper
                  title={widget.title}
                  onRemove={isEditing ? () => handleRemoveWidget(widget.id) : undefined}
                  isDragging={draggedWidget === widget.id}
                  sizePreset={isEditing ? getSizePreset(widget) : undefined}
                  onResize={isEditing ? (preset) => handleResizeWidget(widget.id, preset) : undefined}
                  heightPreset={isEditing ? getHeightPresetFromWidget(widget) : undefined}
                  onHeightChange={isEditing ? (preset) => handleHeightChange(widget.id, preset) : undefined}
                >
                  {renderWidgetContent(widget)}
                </WidgetWrapper>
              </div>
            );
          })}
        </div>

        {/* Mobile fallback: simple stacked layout */}
        <div className="md:hidden space-y-4">
          {widgets.map(widget => (
            <div
              key={widget.id}
              style={{ height: getWidgetHeightPx(widget) }}
              draggable={isEditing}
              onDragStart={() => handleDragStart(widget.id)}
              onDragOver={(e) => handleDragOver(e, widget.id)}
              onDrop={(e) => handleDrop(e, widget.id)}
              onDragEnd={handleDragEnd}
            >
              <WidgetWrapper
                title={widget.title}
                onRemove={isEditing ? () => handleRemoveWidget(widget.id) : undefined}
                isDragging={draggedWidget === widget.id}
                sizePreset={isEditing ? getSizePreset(widget) : undefined}
                onResize={isEditing ? (preset) => handleResizeWidget(widget.id, preset) : undefined}
                heightPreset={isEditing ? getHeightPresetFromWidget(widget) : undefined}
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

function KpiCard({ icon, label, value, badge, badgeClass }: { icon: React.ReactNode; label: string; value: string; badge?: boolean; badgeClass?: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex flex-col items-center justify-center gap-1.5 text-center">
        {icon}
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        {badge ? (
          <Badge className={cn('border', badgeClass)}>{value}</Badge>
        ) : (
          <span className="text-xl font-bold text-foreground">{value}</span>
        )}
      </CardContent>
    </Card>
  );
}

function SpvBadge({ value }: { value: string }) {
  if (value === 'OUI') return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Oui</Badge>;
  if (value === 'NON') return <Badge className="bg-destructive/10 text-destructive border border-destructive/20">Non</Badge>;
  if (value && value !== '—') return <Badge variant="secondary">{value}</Badge>;
  return <span className="text-muted-foreground">—</span>;
}
