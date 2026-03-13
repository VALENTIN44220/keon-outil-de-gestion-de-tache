import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BEProject } from '@/types/beProject';
import { PilierCode } from '@/config/questionnaireConfig';
import { computePilierCompletion } from './keon-synthese/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort } from '@/hooks/useTableSort';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Leaf, Building2, Flame, BarChart2, MapPin, CheckCircle2, Settings2, RotateCcw, GripVertical } from 'lucide-react';
import {
  SpvWidgetConfig,
  WidgetSize,
  getDefaultSpvWidgetConfig,
  loadSpvWidgetConfig,
  saveSpvWidgetConfig,
} from './SpvWidgetConfigPanel';

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'];
const PILIER_CODES: PilierCode[] = ['00', '02', '04', '05', '06', '07'];

interface Props {
  projects: BEProject[];
  qstData: Record<string, Record<string, any>>;
  keonProjectIds: Set<string>;
  widgetConfig?: SpvWidgetConfig[];
  onWidgetConfigChange?: (config: SpvWidgetConfig[]) => void;
}

function safeFloat(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

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

export function BEProjectsKeonView({ projects, qstData, keonProjectIds, widgetConfig, onWidgetConfigChange }: Props) {
  const navigate = useNavigate();
  const [internalWidgetConfig, setInternalWidgetConfig] = useState<SpvWidgetConfig[]>(loadSpvWidgetConfig);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const widgets = widgetConfig ?? internalWidgetConfig;

  const setWidgets = useCallback((next: SpvWidgetConfig[] | ((prev: SpvWidgetConfig[]) => SpvWidgetConfig[])) => {
    const prev = widgetConfig ?? internalWidgetConfig;
    const result = typeof next === 'function' ? next(prev) : next;

    if (!widgetConfig) {
      setInternalWidgetConfig(result);
    }

    onWidgetConfigChange?.(result);
    saveSpvWidgetConfig(result);
  }, [widgetConfig, internalWidgetConfig, onWidgetConfigChange]);

  const keonProjects = useMemo(
    () => projects.filter(p => keonProjectIds.has(p.id)),
    [projects, keonProjectIds]
  );

  const kpis = useMemo(() => {
    let spvCount = 0;
    let gisementSum = 0;
    let cmasValues: number[] = [];
    let ksSum = 0;
    let ksCount = 0;
    let completeCount = 0;

    keonProjects.forEach(p => {
      const d = qstData[p.id] || {};
      const spvVal = getQstValue(d, 'spv') || '';
      if (spvVal.toUpperCase() === 'OUI') spvCount++;
      const gis = safeFloat(getQstValue(d, 'quantite', 'totale') || getQstValue(d, 'gisement', 'total') || '0');
      gisementSum += gis;
      const cmas = safeFloat(getQstValue(d, 'cmax1') || '0');
      if (cmas > 0) cmasValues.push(cmas);
      const ks = safeFloat(getQstValue(d, 'keon', 'pct') || getQstValue(d, 'ks', 'keon') || '0');
      if (ks > 0) { ksSum += ks; ksCount++; }
      if (avgCompletion(d) > 50) completeCount++;
    });

    const cmasMoyen = cmasValues.length > 0 ? (cmasValues.reduce((a, b) => a + b, 0) / cmasValues.length).toFixed(1) : null;

    return {
      total: keonProjects.length,
      spv: spvCount,
      gisement: Math.round(gisementSum),
      cmas: cmasMoyen ?? 'N/A',
      ks: ksCount > 0 ? (ksSum / ksCount).toFixed(1) : '—',
      complete: completeCount,
    };
  }, [keonProjects, qstData]);

  const typoPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    keonProjects.forEach(p => {
      const t = getQstValue(qstData[p.id] || {}, 'typologie') || 'Non renseigné';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [keonProjects, qstData]);

  const gisementBarData = useMemo(() => {
    return keonProjects
      .map(p => {
        const d = qstData[p.id] || {};
        return {
          code: p.code_projet,
          gisement: safeFloat(getQstValue(d, 'quantite', 'totale') || getQstValue(d, 'gisement', 'total') || '0'),
        };
      })
      .filter(d => d.gisement > 0)
      .sort((a, b) => b.gisement - a.gisement);
  }, [keonProjects, qstData]);

  const tableData = useMemo(() => {
    return keonProjects.map(p => {
      const d = qstData[p.id] || {};
      return {
        id: p.id,
        code_projet: p.code_projet,
        nom_projet: p.nom_projet,
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

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const keonWithCoords = useMemo(() =>
    keonProjects.filter(p => {
      if (!p.gps_coordinates) return false;
      const parts = p.gps_coordinates.split(',').map(s => parseFloat(s.trim()));
      return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && (Math.abs(parts[0]) > 0.001 || Math.abs(parts[1]) > 0.001);
    }), [keonProjects]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || keonWithCoords.length === 0) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
    mapInstanceRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);

    const markers = L.markerClusterGroup({
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let bg = '#10b981';
        if (count > 20) bg = '#ef4444';
        else if (count > 5) bg = '#f59e0b';
        return L.divIcon({
          html: `<div style="background:${bg};color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">${count}</div>`,
          className: '', iconSize: L.point(36, 36),
        });
      },
    });

    const bounds: [number, number][] = [];
    keonWithCoords.forEach(p => {
      const [lat, lon] = p.gps_coordinates!.split(',').map(s => parseFloat(s.trim()));
      bounds.push([lat, lon]);
      const marker = L.circleMarker([lat, lon], { radius: 8, fillColor: '#10b981', color: '#fff', weight: 2, fillOpacity: 0.9 });
      marker.bindPopup(`
        <div style="min-width:160px;font-family:system-ui,sans-serif;">
          <div style="font-weight:700;font-size:13px;color:#10b981;">${p.code_projet}</div>
          <div style="font-size:12px;margin-top:2px;">${p.nom_projet}</div>
          ${p.region ? `<div style="margin-top:4px;font-size:11px;color:#6b7280;">📍 ${p.region}</div>` : ''}
          <a href="/be/projects/${p.code_projet}/overview" style="display:inline-block;margin-top:6px;font-size:11px;color:#3b82f6;text-decoration:underline;">Ouvrir →</a>
        </div>
      `, { maxWidth: 250 });
      markers.addLayer(marker);
    });

    map.addLayer(markers);
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [keonWithCoords]);

  const getWidgetSize = useCallback((id: string): WidgetSize => {
    const w = widgets.find(c => c.id === id);
    return w?.size ?? 'normal';
  }, [widgets]);

  const sizeToHeight = useCallback((id: string, base: number) => {
    const s = getWidgetSize(id);
    if (s === 'compact') return Math.round(base * 0.7);
    if (s === 'large') return Math.round(base * 1.4);
    return base;
  }, [getWidgetSize]);

  const orderedWidgetIds = widgets.filter(w => w.visible).map(w => w.id);
  const hiddenCount = widgets.length - orderedWidgetIds.length;

  const handleReset = useCallback(() => {
    setWidgets(getDefaultSpvWidgetConfig());
  }, [setWidgets]);

  const handleRestoreAll = useCallback(() => {
    setWidgets(prev => prev.map(widget => ({ ...widget, visible: true })));
  }, [setWidgets]);

  const handleToggleVisibility = useCallback((id: string) => {
    setWidgets(prev => prev.map(widget => (
      widget.id === id ? { ...widget, visible: !widget.visible } : widget
    )));
  }, [setWidgets]);

  const handleSizeChange = useCallback((id: string, size: WidgetSize) => {
    setWidgets(prev => prev.map(widget => (
      widget.id === id ? { ...widget, size } : widget
    )));
  }, [setWidgets]);

  const handleDragStart = (widgetId: string) => {
    if (!isEditing) return;
    setDraggedWidget(widgetId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetId) return;
    setDropTargetId(targetId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDropTargetId(null);
    if (!draggedWidget || draggedWidget === targetId) return;

    setWidgets(prev => {
      const newWidgets = [...prev];
      const draggedIndex = newWidgets.findIndex(w => w.id === draggedWidget);
      const targetIndex = newWidgets.findIndex(w => w.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      const [moved] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(targetIndex, 0, moved);
      return newWidgets;
    });

    setDraggedWidget(null);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
    setDropTargetId(null);
  };

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

  const mapHeight = sizeToHeight('map', 350);
  const pieHeight = sizeToHeight('typologie', 300);

  const widgetRenderers: Record<string, () => React.ReactNode> = {
    kpis: () => (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={<Leaf className="h-5 w-5 text-emerald-500" />} label="Projets SPV" value={String(kpis.total)} />
        <KpiCard icon={<Building2 className="h-5 w-5 text-blue-500" />} label="SPV créées" value={String(kpis.spv)} badge badgeClass="bg-emerald-500/10 text-emerald-600 border-emerald-500/20" />
        <KpiCard icon={<BarChart2 className="h-5 w-5 text-amber-500" />} label="Gisement cumulé" value={`${kpis.gisement.toLocaleString('fr-FR')} tMB/an`} />
        <KpiCard icon={<Flame className="h-5 w-5 text-orange-500" />} label="Cmax moyen" value={kpis.cmas === 'N/A' ? 'N/A' : `${kpis.cmas} Nm³/h`} />
        <KpiCard icon={<BarChart2 className="h-5 w-5 text-violet-500" />} label="KS Keon moyen" value={`${kpis.ks} %`} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Questionnaire >50%" value={String(kpis.complete)} />
      </div>
    ),

    map: () => (
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Carte des projets SPV
            <Badge variant="secondary" className="ml-auto text-xs">{keonWithCoords.length} localisés</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={mapRef} style={{ height: mapHeight }} className="w-full rounded-b-lg" />
        </CardContent>
      </Card>
    ),

    typologie: () => (
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Répartition par Typologie</CardTitle>
        </CardHeader>
        <CardContent>
          {typoPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={pieHeight}>
              <PieChart>
                <Pie data={typoPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} label={({ name, percent }) => percent > 0.05 ? name : ''}>
                  {typoPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">Aucune donnée</p>
          )}
        </CardContent>
      </Card>
    ),

    gisement: () => gisementBarData.length > 0 ? (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            Gisement par projet (tMB/an)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, gisementBarData.length * 38)}>
            <BarChart data={gisementBarData} layout="vertical" margin={{ left: 80, right: 40 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="code" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('fr-FR')} tMB/an`, 'Gisement']} />
              <Bar dataKey="gisement" fill="#10b981" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: (v: number) => v.toLocaleString('fr-FR') }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    ) : null,

    tableau: () => (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Tableau récapitulatif
            <Badge variant="secondary" className="ml-2">{keonProjects.length} projets</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
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
                  <SortableTableHead sortKey="gisement" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Gisement (tMB/an)</SortableTableHead>
                  <SortableTableHead sortKey="cmas" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Cmax</SortableTableHead>
                  <SortableTableHead sortKey="completion" currentSortKey={String(sortConfig.key)} currentDirection={sortConfig.direction} onSort={handleSort}>Complétion %</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(row => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/be/projects/${row.code_projet}/overview`)}
                  >
                    <TableCell className="font-mono font-medium text-primary">{row.code_projet}</TableCell>
                    <TableCell className="font-medium">{row.nom_projet}</TableCell>
                    <TableCell className="text-muted-foreground">{row.region}</TableCell>
                    <TableCell className="text-muted-foreground">{row.typologie}</TableCell>
                    <TableCell>
                      <SpvBadge value={row.spv} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.ks > 0 ? `${row.ks}%` : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.gisement > 0 ? row.gisement.toLocaleString('fr-FR') : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.cmas > 0 ? row.cmas.toLocaleString('fr-FR') : '—'}</TableCell>
                    <TableCell>
                      <span className={cn('font-semibold', completionColor(row.completion))}>
                        {row.completion}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    ),
  };

  const renderWidgetShell = (id: string, node: React.ReactNode) => {
    const widget = widgets.find(w => w.id === id);
    if (!widget) return null;

    const sizes: { key: WidgetSize; label: string }[] = [
      { key: 'compact', label: 'C' },
      { key: 'normal', label: 'N' },
      { key: 'large', label: 'L' },
    ];

    return (
      <div
        key={id}
        className={cn(
          'space-y-2 transition-all duration-200',
          isEditing && 'cursor-move',
          draggedWidget === id && 'opacity-40 scale-[0.98]',
          dropTargetId === id && 'ring-2 ring-primary ring-offset-2 rounded-xl p-2'
        )}
        draggable={isEditing}
        onDragStart={() => handleDragStart(id)}
        onDragOver={(e) => handleDragOver(e, id)}
        onDrop={(e) => handleDrop(e, id)}
        onDragEnd={handleDragEnd}
        onDragLeave={() => setDropTargetId(null)}
      >
        {isEditing && (
          <div className="flex items-center gap-3 p-2 rounded-lg border border-dashed border-border bg-muted/20">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: widget.dotColor }} />
            <span className="flex-1 text-sm font-medium">{widget.label}</span>
            <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-md">
              {sizes.map(size => (
                <button
                  key={size.key}
                  onClick={() => handleSizeChange(widget.id, size.key)}
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded transition-colors',
                    widget.size === size.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {size.label}
                </button>
              ))}
            </div>
            <Switch checked={widget.visible} onCheckedChange={() => handleToggleVisibility(widget.id)} />
          </div>
        )}
        {node}
      </div>
    );
  };

  const renderWidgets = () => {
    const result: React.ReactNode[] = [];
    let i = 0;

    while (i < orderedWidgetIds.length) {
      const id = orderedWidgetIds[i];
      const nextId = orderedWidgetIds[i + 1];

      if ((id === 'map' && nextId === 'typologie') || (id === 'typologie' && nextId === 'map')) {
        const mapWidget = renderWidgetShell('map', widgetRenderers.map());
        const typoWidget = renderWidgetShell('typologie', widgetRenderers.typologie());

        result.push(
          <div key={`map-typo-row-${i}`} className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ minHeight: Math.max(mapHeight, pieHeight) + 80 }}>
            <div className="lg:col-span-3">{id === 'map' ? mapWidget : typoWidget}</div>
            <div className="lg:col-span-2">{id === 'map' ? typoWidget : mapWidget}</div>
          </div>
        );

        i += 2;
        continue;
      }

      const node = widgetRenderers[id]?.();
      if (node) result.push(renderWidgetShell(id, node));
      i += 1;
    }

    return result;
  };

  return (
    <div className="space-y-4">
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
              <Button variant="outline" size="sm" onClick={handleRestoreAll}>
                Afficher tout ({hiddenCount} masqué{hiddenCount > 1 ? 's' : ''})
              </Button>
            )}
          </>
        )}
      </div>

      <div
        className={cn(
          'space-y-6',
          isEditing && 'rounded-xl border-2 border-dashed border-primary/30 p-4'
        )}
      >
        {renderWidgets()}
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
