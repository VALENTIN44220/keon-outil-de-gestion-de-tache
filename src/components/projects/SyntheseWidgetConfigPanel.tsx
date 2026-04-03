// ─── Widget definitions & config persistence for Synthèse view ───────────────
// This module defines the widget catalog, config shape, and localStorage helpers.
// The inline edit mode (drag-drop, resize) lives in BEProjectsSyntheseView.

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  /** Grid dimensions: w (1=half, 2=full), h (1-5 height preset) */
  size: { w: number; h: number };
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
}

export const WIDGET_DEFINITIONS: Omit<WidgetConfig, 'visible' | 'size'>[] = [
  { id: 'kpi_strip',     label: 'KPI Strip (8 indicateurs)',     accentColor: '#1E5EFF', gradientFrom: 'from-blue-500/10',   gradientTo: 'to-blue-600/5'   },
  { id: 'map',           label: 'Carte de localisation',         accentColor: '#12B6C8', gradientFrom: 'from-cyan-500/10',   gradientTo: 'to-cyan-600/5'   },
  { id: 'status_pie',    label: 'Par statut (pie)',              accentColor: '#10b981', gradientFrom: 'from-emerald-500/10',gradientTo: 'to-emerald-600/5'},
  { id: 'typo_pie',      label: 'Par typologie (pie)',           accentColor: '#60a5fa', gradientFrom: 'from-blue-400/10',   gradientTo: 'to-blue-500/5'   },
  { id: 'progress_bar',  label: 'Avancement par projet (bar)',   accentColor: '#78C050', gradientFrom: 'from-green-500/10',  gradientTo: 'to-green-600/5'  },
  { id: 'region_bar',    label: 'Répartition géographique (bar)',accentColor: '#FF9432', gradientFrom: 'from-orange-500/10', gradientTo: 'to-orange-600/5' },
  { id: 'keon_spv',      label: 'KEON — SPV créée (pie)',        accentColor: '#8b5cf6', gradientFrom: 'from-violet-500/10', gradientTo: 'to-violet-600/5' },
  { id: 'at_risk',       label: 'Projets en retard',             accentColor: '#ef4444', gradientFrom: 'from-red-500/10',    gradientTo: 'to-red-600/5'    },
  { id: 'top_projects',  label: 'Projets les plus avancés',      accentColor: '#10b981', gradientFrom: 'from-emerald-500/10',gradientTo: 'to-emerald-600/5'},
];

// Default widths: kpi_strip = full (w:2), charts/widgets = half (w:1)
const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  kpi_strip:    { w: 2, h: 2 },
  map:          { w: 1, h: 3 },
  status_pie:   { w: 1, h: 3 },
  typo_pie:     { w: 1, h: 3 },
  progress_bar: { w: 1, h: 3 },
  region_bar:   { w: 1, h: 3 },
  keon_spv:     { w: 1, h: 3 },
  at_risk:      { w: 1, h: 3 },
  top_projects: { w: 1, h: 3 },
};

const STORAGE_KEY = 'synthese_widget_config';

export function getDefaultWidgets(): WidgetConfig[] {
  return WIDGET_DEFINITIONS.map(w => ({
    ...w,
    visible: true,
    size: DEFAULT_SIZES[w.id] || { w: 1, h: 3 },
  }));
}

export function loadWidgetConfig(): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWidgets();
    const saved: WidgetConfig[] = JSON.parse(raw);

    // Migration: convert old string size format to { w, h }
    const migrated = saved.map(s => {
      if (typeof s.size === 'string') {
        const def = DEFAULT_SIZES[s.id] || { w: 1, h: 3 };
        const hMap: Record<string, number> = { compact: 2, normal: 3, large: 4 };
        return { ...s, size: { w: def.w, h: hMap[s.size as string] || 3 } };
      }
      return s;
    });

    // Migration: align "map" default width with other half-width widgets.
    // If user kept the old default map size (w:2,h:3), convert to (w:1,h:3).
    const migrated2 = migrated.map(w => {
      if (w.id === 'map' && w.size?.w === 2 && w.size?.h === 3) {
        return { ...w, size: { ...w.size, w: 1 } };
      }
      return w;
    });

    const savedMap = new Map(migrated2.map(w => [w.id, w]));
    const merged: WidgetConfig[] = [];
    migrated2.forEach(s => {
      const def = WIDGET_DEFINITIONS.find(d => d.id === s.id);
      if (def) merged.push({ ...def, visible: s.visible, size: s.size });
    });
    WIDGET_DEFINITIONS.forEach(d => {
      if (!savedMap.has(d.id)) merged.push({ ...d, visible: true, size: DEFAULT_SIZES[d.id] || { w: 1, h: 3 } });
    });
    return merged;
  } catch {
    return getDefaultWidgets();
  }
}

export function saveWidgetConfig(widgets: WidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}
