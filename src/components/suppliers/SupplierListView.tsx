// SupplierListView.tsx
import { useEffect, useMemo, useState, useCallback, useRef, type CSSProperties } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useSupplierCategories, useSupplierFamillesByCategorie } from "@/hooks/useSupplierCategorisation";
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  useSupplierEnrichment,
  useBulkSupplierValidation,
  isSupplierValidatedByRole,
  SupplierFilters,
  SupplierSortConfig,
  SupplierEnrichment,
  type SupplierValidationRole,
} from '@/hooks/useSupplierEnrichment';
import { useSupplierFilterPresets, SupplierFilterPreset } from '@/hooks/useSupplierFilterPresets';
import { Search, Filter, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutGrid, List, Save, Star, Trash2, FolderOpen, RotateCcw, Columns3, Pencil, Globe, GripVertical, Loader2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  readSupplierVisibleColumnsFromStorage,
  SUPPLIER_VISIBLE_COLUMNS_STORAGE_KEY,
} from '@/lib/supplierVisibleColumnsStorage';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type SupplierViewMode = 'table' | 'grid';

const VALIDATION_GROUP_LABEL: Record<SupplierValidationRole, string> = {
  achat: 'Achats',
  compta: 'Comptabilité',
};

interface SupplierListViewProps {
  onOpenSupplier: (id: string) => void;
  onViewSupplier: (id: string) => void;
  canEdit?: boolean;
  isAdmin?: boolean;
  /** Rôle métier pour valider / annuler la validation (même groupe uniquement). */
  supplierRole?: SupplierValidationRole | null;
  /** Si vrai (route /suppliers uniquement), ordre des colonnes persisté sur le profil et en-têtes réordonnables. */
  persistColumnOrderToProfile?: boolean;
}

type DateTone = 'past' | 'soon' | 'future' | 'none';

function dateTone(iso?: string | null): DateTone {
  if (!iso) return 'none';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((dd.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'past';
  if (diffDays <= 30) return 'soon';
  return 'future';
}

function dateClass(iso?: string | null): string {
  const t = dateTone(iso);
  if (t === 'past') return 'text-red-600 font-semibold';
  if (t === 'soon') return 'text-orange-600 font-semibold';
  if (t === 'future') return 'text-green-700';
  return 'text-muted-foreground';
}

function safeFormatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy', { locale: fr });
}

/** Colonnes figées au défilement horizontal : TIERS + référentiel fournisseur (nom / n° côté métier). */
const HORIZONTAL_STICKY_SUPPLIER_KEYS = ['tiers', 'nomfournisseur'] as const;

const MIN_SUPPLIER_COL_WIDTH = 72;
const MAX_SUPPLIER_COL_WIDTH = 520;
const SUPPLIER_COL_WIDTHS_STORAGE_KEY = 'keon-supplier-table-col-widths-v1';

/** Rempli juste après la définition de ALL_COLUMNS. */
let DEFAULT_SUPPLIER_COLUMN_WIDTHS: Record<string, number> = {};

function colWidthPx(key: string, widths: Record<string, number>): number {
  const w = widths[key] ?? DEFAULT_SUPPLIER_COLUMN_WIDTHS[key];
  if (typeof w === 'number') return w;
  return 170;
}

/** Positions `left` des colonnes sticky (largeurs = état utilisateur). */
function getSupplierStickyColumnLayout(
  activeColumns: SupplierColumnDef[],
  leadingColumnWidthPx: number,
  widths: Record<string, number>,
): { leftByKey: Map<string, number>; order: string[] } {
  const leftByKey = new Map<string, number>();
  const order: string[] = [];
  let left = leadingColumnWidthPx;
  for (const key of HORIZONTAL_STICKY_SUPPLIER_KEYS) {
    if (!activeColumns.some((c) => c.key === key)) continue;
    leftByKey.set(key, left);
    order.push(key);
    left += colWidthPx(key, widths);
  }
  return { leftByKey, order };
}

function stickySupplierCellStyle(
  colKey: string,
  leftByKey: Map<string, number>,
  order: string[],
  baseZ: number,
): CSSProperties | undefined {
  const left = leftByKey.get(colKey);
  if (left === undefined) return undefined;
  const idx = order.indexOf(colKey);
  return {
    left,
    zIndex: baseZ + Math.max(0, idx),
    boxSizing: 'border-box',
  };
}

function mergeColSize(stickyPart: CSSProperties | undefined, widthPx: number): CSSProperties {
  return {
    ...(stickyPart ?? {}),
    width: widthPx,
    minWidth: widthPx,
    maxWidth: widthPx,
    boxSizing: 'border-box',
  };
}

function normalizeSupplierColumnOrder(
  raw: unknown,
  validKeys: ReadonlySet<string>,
  defaultOrder: readonly string[],
): string[] {
  if (!Array.isArray(raw)) return [...defaultOrder];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !validKeys.has(item) || seen.has(item)) continue;
    seen.add(item);
    ordered.push(item);
  }
  for (const k of defaultOrder) {
    if (!seen.has(k)) ordered.push(k);
  }
  return ordered;
}

function mergeVisibleColumnReorder(
  fullOrder: string[],
  visibleSet: Set<string>,
  newVisibleOrder: string[],
): string[] {
  const vis = newVisibleOrder.filter((k) => visibleSet.has(k));
  const result: string[] = [];
  let vi = 0;
  for (const k of fullOrder) {
    if (visibleSet.has(k)) {
      if (vi < vis.length) result.push(vis[vi++]);
    } else {
      result.push(k);
    }
  }
  while (vi < vis.length) result.push(vis[vi++]);
  return result;
}

// All available columns definition
export interface SupplierColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  render: (s: SupplierEnrichment) => React.ReactNode;
  className?: string;
}

const ALL_COLUMNS: SupplierColumnDef[] = [
  { key: 'tiers', label: 'TIERS', defaultVisible: true, className: 'w-[120px]', render: (s) => <span className="font-mono font-medium">{s.tiers}</span> },
  { key: 'nomfournisseur', label: 'Nom Fournisseur', defaultVisible: true, render: (s) => <span className="font-medium">{s.nomfournisseur || '—'}</span> },
  { key: 'entite', label: 'Entité', defaultVisible: true, render: (s) => {
    const entites = (s.entite || '').split(',').map(e => e.trim()).filter(Boolean);
    if (!entites.length) return '—';
    return <div className="flex flex-wrap gap-1">{entites.map(e => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}</div>;
  }},
  { key: 'categorie', label: 'Catégorie', defaultVisible: true, render: (s) => s.categorie || '—' },
  { key: 'famille_source_initiale', label: 'Famille source', defaultVisible: false, render: (s) => s.famille_source_initiale || '—' },
  { key: 'famille', label: 'Famille', defaultVisible: true, render: (s) => s.famille || '—' },
  { key: 'segment', label: 'Segment', defaultVisible: true, render: (s) => (
    s.segment ? <span>{s.segment}{s.sous_segment && <span className="text-muted-foreground"> / {s.sous_segment}</span>}</span> : '—'
  )},
  { key: 'sous_segment', label: 'Sous-segment', defaultVisible: false, render: (s) => s.sous_segment || '—' },
  { key: 'type_de_contrat', label: 'Type de contrat', defaultVisible: false, render: (s) => s.type_de_contrat || '—' },
  { key: 'validite_prix', label: 'Validité prix', defaultVisible: true, className: 'w-[140px]', render: (s) => <span className={dateClass(s.validite_prix)}>{safeFormatDate(s.validite_prix)}</span> },
  { key: 'validite_du_contrat', label: 'Validité contrat', defaultVisible: true, className: 'w-[140px]', render: (s) => <span className={dateClass(s.validite_du_contrat)}>{safeFormatDate(s.validite_du_contrat)}</span> },
  { key: 'date_premiere_signature', label: 'Première signature', defaultVisible: false, render: (s) => safeFormatDate(s.date_premiere_signature) },
  { key: 'avenants', label: 'Avenants', defaultVisible: false, render: (s) => <span title={s.avenants || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.avenants || '—'}</span> },
  { key: 'evolution_tarif_2026', label: 'Évolution tarif 2026', defaultVisible: false, render: (s) => <span title={s.evolution_tarif_2026 || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.evolution_tarif_2026 || '—'}</span> },
  { key: 'echeances_de_paiement', label: 'Échéances paiement', defaultVisible: false, render: (s) => <span title={s.echeances_de_paiement || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.echeances_de_paiement || '—'}</span> },
  { key: 'delai_de_paiement', label: 'Délai paiement', defaultVisible: false, render: (s) => <span title={s.delai_de_paiement || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.delai_de_paiement || '—'}</span> },
  { key: 'delais_de_paiement_commentaires', label: 'Commentaires délai paiement', defaultVisible: false, render: (s) => <span title={s.delais_de_paiement_commentaires || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.delais_de_paiement_commentaires || '—'}</span> },
  { key: 'penalites', label: 'Pénalités', defaultVisible: false, render: (s) => <span title={s.penalites || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.penalites || '—'}</span> },
  { key: 'exclusivite_non_sollicitation', label: 'Exclusivité / Non-sollicitation', defaultVisible: false, render: (s) => <span title={s.exclusivite_non_sollicitation || ''} className="max-w-[250px] block whitespace-pre-wrap">{s.exclusivite_non_sollicitation || '—'}</span> },
  { key: 'remise', label: 'Remise', defaultVisible: false, render: (s) => <span title={s.remise || ''} className="max-w-[250px] block whitespace-pre-wrap">{s.remise || '—'}</span> },
  { key: 'rfa', label: 'RFA', defaultVisible: false, render: (s) => s.rfa || '—' },
  { key: 'incoterm', label: 'Incoterm', defaultVisible: false, render: (s) => s.incoterm || '—' },
  { key: 'garanties_bancaire_et_equipement', label: 'Garanties bancaires & équipement', defaultVisible: false, render: (s) => <span title={s.garanties_bancaire_et_equipement || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.garanties_bancaire_et_equipement || '—'}</span> },
  { key: 'transport', label: 'Transport', defaultVisible: false, render: (s) => s.transport || '—' },
  { key: 'nom_contact', label: 'Contact', defaultVisible: false, render: (s) => s.nom_contact || '—' },
  { key: 'poste', label: 'Poste', defaultVisible: false, render: (s) => s.poste || '—' },
  { key: 'adresse_mail', label: 'Email', defaultVisible: false, render: (s) => s.adresse_mail || '—' },
  { key: 'telephone', label: 'Téléphone', defaultVisible: false, render: (s) => s.telephone || '—' },
  { key: 'commentaires', label: 'Commentaires', defaultVisible: false, render: (s) => <span title={s.commentaires || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.commentaires || '—'}</span> },
  { key: 'site_web', label: 'Site web', defaultVisible: false, render: (s) => s.site_web || '—' },
  { key: 'siret', label: 'SIRET', defaultVisible: false, render: (s) => s.siret || '—' },
  { key: 'tva', label: 'TVA', defaultVisible: false, render: (s) => s.tva || '—' },
  { key: 'ca_estime', label: 'CA estimé', defaultVisible: false, render: (s) => s.ca_estime != null ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(s.ca_estime) : '—' },
  { key: 'description', label: 'Description', defaultVisible: false, render: (s) => <span title={s.description || ''} className="max-w-[300px] block whitespace-pre-wrap">{s.description || '—'}</span> },
  { key: 'status', label: 'Statut', defaultVisible: false, render: (s) => s.status || '—' },
  {
    key: 'validation_achats',
    label: 'Validé achats',
    defaultVisible: false,
    className: 'w-[124px]',
    render: (s) =>
      s.validated_by_achats_at ? (
        <span className="text-xs text-muted-foreground">{safeFormatDate(s.validated_by_achats_at)}</span>
      ) : (
        '—'
      ),
  },
  {
    key: 'validation_compta',
    label: 'Validé compta',
    defaultVisible: false,
    className: 'w-[124px]',
    render: (s) =>
      s.validated_by_compta_at ? (
        <span className="text-xs text-muted-foreground">{safeFormatDate(s.validated_by_compta_at)}</span>
      ) : (
        '—'
      ),
  },
  { key: 'created_at', label: 'Date création', defaultVisible: false, render: (s) => <span className="text-muted-foreground text-sm">{safeFormatDate(s.created_at)}</span> },
  { key: 'completeness_score', label: 'Complétude', defaultVisible: true, className: 'w-[150px]', render: () => null /* special */ },
  { key: 'updated_at', label: 'Mise à jour', defaultVisible: true, render: (s) => <span className="text-muted-foreground text-sm">{safeFormatDate(s.updated_at)}</span> },
];

function buildDefaultSupplierColumnWidths(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const col of ALL_COLUMNS) {
    if (col.key === 'tiers') m[col.key] = 128;
    else if (col.key === 'nomfournisseur') m[col.key] = 260;
    else if (col.key === 'completeness_score') m[col.key] = 160;
    else if (col.key === 'validite_prix' || col.key === 'validite_du_contrat') m[col.key] = 140;
    else m[col.key] = 170;
  }
  return m;
}

DEFAULT_SUPPLIER_COLUMN_WIDTHS = buildDefaultSupplierColumnWidths();

/** Ordre par défaut des colonnes (= définition actuelle du tableau). Exporté pour aligner les presets. */
export const SUPPLIER_TABLE_DEFAULT_COLUMN_ORDER: string[] = ALL_COLUMNS.map((c) => c.key);

const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);

export const SUPPLIER_VALID_COLUMN_KEYS = new Set(ALL_COLUMNS.map((c) => c.key));

export const DEFAULT_SUPPLIER_FILTERS: SupplierFilters = {
  search: '',
  status: 'all',
  entite: 'all',
  categorie: 'all',
  famille: 'all',
  segment: 'all',
  sous_segment: 'all',
  validite_prix_from: '',
  validite_prix_to: '',
  validite_contrat_from: '',
  validite_contrat_to: '',
};

// Check if any filter is active (not default)
function hasActiveFilters(filters: SupplierFilters): boolean {
  return (
    filters.search !== '' ||
    filters.status !== 'all' ||
    filters.entite !== 'all' ||
    filters.categorie !== 'all' ||
    filters.famille !== 'all' ||
    filters.segment !== 'all' ||
    (filters.sous_segment ?? 'all') !== 'all' ||
    !!filters.validite_prix_from ||
    !!filters.validite_prix_to ||
    !!filters.validite_contrat_from ||
    !!filters.validite_contrat_to
  );
}

function isFilterActive(value: string | undefined, defaultValue = 'all'): boolean {
  return !!value && value !== defaultValue;
}

const SUPPLIER_SESSION_KEY = 'keon-supplier-session-filters';

function readSessionFilters(): { filters: SupplierFilters; page: number; viewMode: SupplierViewMode; sortConfig: SupplierSortConfig } | null {
  try {
    const raw = sessionStorage.getItem(SUPPLIER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.filters) return null;
    return parsed;
  } catch { return null; }
}

function SortableSupplierColumnHead({
  column,
  sortConfig,
  onSort,
  columnWidths,
  onColumnResizeStart,
  stickyPart,
  stickyHeadColClass,
  widthPx,
  dragEnabled,
}: {
  column: SupplierColumnDef;
  sortConfig: SupplierSortConfig;
  onSort: (k: string) => void;
  columnWidths: Record<string, number>;
  onColumnResizeStart: (key: string, clientX: number) => void;
  stickyPart: CSSProperties | undefined;
  stickyHeadColClass: string;
  widthPx: number;
  dragEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.key,
    disabled: !dragEnabled,
  });
  const stickyStyle = mergeColSize(stickyPart, widthPx);
  return (
    <SortableTableHead
      ref={setNodeRef}
      sortKey={column.key}
      currentSortKey={sortConfig.key}
      currentDirection={sortConfig.direction}
      onSort={onSort}
      className={cn(column.className, 'bg-card', !!stickyPart && stickyHeadColClass, isDragging && 'z-20')}
      style={{
        ...stickyStyle,
        // Important: `transform` can break `position: sticky` in some browsers.
        // Only apply it while dragging.
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: isDragging ? transition : undefined,
      }}
      onColumnResizeMouseDown={(e) => onColumnResizeStart(column.key, e.clientX)}
      headerStart={
        dragEnabled ? (
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-0.5 -ml-1"
            aria-label="Réordonner la colonne"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : undefined
      }
    >
      {column.label}
    </SortableTableHead>
  );
}

export function SupplierListView({
  onOpenSupplier,
  onViewSupplier,
  canEdit = false,
  isAdmin = false,
  supplierRole = null,
  persistColumnOrderToProfile = false,
}: SupplierListViewProps) {
  const pageSize = 200;
  const sessionState = useMemo(() => readSessionFilters(), []);
  const [viewMode, setViewMode] = useState<SupplierViewMode>(sessionState?.viewMode ?? 'table');
  const [page, setPage] = useState(sessionState?.page ?? 0);
  const [filters, setFilters] = useState<SupplierFilters>(sessionState?.filters ?? DEFAULT_SUPPLIER_FILTERS);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBLE_COLUMNS;
    return (
      readSupplierVisibleColumnsFromStorage(SUPPLIER_VALID_COLUMN_KEYS) ?? DEFAULT_VISIBLE_COLUMNS
    );
  });
  const skipNextVisibleColumnsPersist = useRef(true);

  const { profile, updateProfile } = useAuth();
  const [columnOrderKeys, setColumnOrderKeys] = useState<string[]>(() => [...SUPPLIER_TABLE_DEFAULT_COLUMN_ORDER]);
  const columnOrderHydratedRef = useRef(false);
  const lastPersistedOrderJsonRef = useRef<string | null>(null);

  useEffect(() => {
    if (!persistColumnOrderToProfile) return;
    columnOrderHydratedRef.current = false;
    lastPersistedOrderJsonRef.current = null;
  }, [persistColumnOrderToProfile, profile?.id]);

  useEffect(() => {
    if (!persistColumnOrderToProfile || !profile || columnOrderHydratedRef.current) return;
    columnOrderHydratedRef.current = true;
    const next = normalizeSupplierColumnOrder(
      profile.suppliers_list_column_order,
      SUPPLIER_VALID_COLUMN_KEYS,
      SUPPLIER_TABLE_DEFAULT_COLUMN_ORDER,
    );
    setColumnOrderKeys(next);
    lastPersistedOrderJsonRef.current = JSON.stringify(next);
  }, [persistColumnOrderToProfile, profile]);

  useEffect(() => {
    if (!persistColumnOrderToProfile || !profile) return;
    if (!columnOrderHydratedRef.current) return;
    const json = JSON.stringify(columnOrderKeys);
    if (json === lastPersistedOrderJsonRef.current) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const { error } = await updateProfile({ suppliers_list_column_order: columnOrderKeys });
        if (!error) lastPersistedOrderJsonRef.current = json;
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [persistColumnOrderToProfile, profile, columnOrderKeys, updateProfile]);

  const displayColumnOrderKeys = persistColumnOrderToProfile ? columnOrderKeys : SUPPLIER_TABLE_DEFAULT_COLUMN_ORDER;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_SUPPLIER_COLUMN_WIDTHS };
    try {
      const raw = localStorage.getItem(SUPPLIER_COL_WIDTHS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SUPPLIER_COLUMN_WIDTHS };
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const merged = { ...DEFAULT_SUPPLIER_COLUMN_WIDTHS };
      for (const k of Object.keys(merged)) {
        const v = parsed[k];
        if (typeof v === 'number' && v >= MIN_SUPPLIER_COL_WIDTH && v <= MAX_SUPPLIER_COL_WIDTH) {
          merged[k] = v;
        }
      }
      return merged;
    } catch {
      return { ...DEFAULT_SUPPLIER_COLUMN_WIDTHS };
    }
  });

  const resizeDragRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SUPPLIER_COL_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      /* ignore */
    }
  }, [columnWidths]);

  useEffect(() => {
    if (skipNextVisibleColumnsPersist.current) {
      skipNextVisibleColumnsPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(SUPPLIER_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      /* ignore */
    }
  }, [visibleColumns]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = resizeDragRef.current;
      if (!d) return;
      const next = Math.min(
        MAX_SUPPLIER_COL_WIDTH,
        Math.max(MIN_SUPPLIER_COL_WIDTH, d.startW + e.clientX - d.startX),
      );
      setColumnWidths((prev) => (prev[d.key] === next ? prev : { ...prev, [d.key]: next }));
    };
    const onUp = () => {
      if (resizeDragRef.current) {
        resizeDragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onColumnResizeStart = useCallback((colKey: string, clientX: number) => {
    resizeDragRef.current = {
      key: colKey,
      startX: clientX,
      startW: colWidthPx(colKey, columnWidths),
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  const updateFilters = (patch: Partial<SupplierFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_SUPPLIER_FILTERS);
    setPage(0);
  };

  // Preset management
  const {
    presets,
    loaded: presetsLoaded,
    savePreset,
    overwritePreset,
    deletePreset,
    toggleDefault,
    toggleGlobal,
    loadPreset,
  } = useSupplierFilterPresets(
    filters,
    setFilters,
    DEFAULT_SUPPLIER_FILTERS,
    visibleColumns,
    setVisibleColumns,
    SUPPLIER_VALID_COLUMN_KEYS,
  );
  const [showPresetPopover, setShowPresetPopover] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Server-side sort config
  const [sortConfig, setSortConfig] = useState<SupplierSortConfig>(sessionState?.sortConfig ?? { key: 'updated_at', direction: 'desc' });

  // Persist filters/page/view/sort to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SUPPLIER_SESSION_KEY, JSON.stringify({ filters, page, viewMode, sortConfig }));
    } catch { /* ignore */ }
  }, [filters, page, viewMode, sortConfig]);
  const handleSort = useCallback((key: string) => {
    setSortConfig((current) => {
      if (current.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        if (current.direction === 'desc') return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
    setPage(0);
  }, []);

  const { suppliers, total, isLoading, filterOptions } = useSupplierEnrichment(filters, page, pageSize, sortConfig);

  // `useSupplierEnrichment` is already constrained to TIERS starting with F (and excluding FY).
  const filteredSuppliers = suppliers;
  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total, pageSize]);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const showValidationControls = supplierRole === 'achat' || supplierRole === 'compta';
  const leadingColumnWidthPx = useMemo(() => {
    if (!showValidationControls && !canEdit) return 0;
    if (showValidationControls && canEdit) return 88;
    return 52;
  }, [showValidationControls, canEdit]);
  const showLeadingColumn = leadingColumnWidthPx > 0;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const bulkValidation = useBulkSupplierValidation();

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, viewMode]);

  const pageSupplierIds = useMemo(() => filteredSuppliers.map((s) => s.id), [filteredSuppliers]);
  const allOnPageSelected =
    pageSupplierIds.length > 0 && pageSupplierIds.every((id) => selectedIds.has(id));
  const someOnPageSelected =
    pageSupplierIds.some((id) => selectedIds.has(id)) && !allOnPageSelected;

  const selectedRowsOnPage = useMemo(
    () => filteredSuppliers.filter((s) => selectedIds.has(s.id)),
    [filteredSuppliers, selectedIds],
  );

  const allSelectedValidatedByMyGroup =
    !!supplierRole &&
    selectedRowsOnPage.length > 0 &&
    selectedRowsOnPage.length === selectedIds.size &&
    selectedRowsOnPage.every((s) => isSupplierValidatedByRole(s, supplierRole));

  const idsToValidate =
    supplierRole && selectedRowsOnPage.length > 0
      ? selectedRowsOnPage.filter((s) => !isSupplierValidatedByRole(s, supplierRole)).map((s) => s.id)
      : [];

  const handleValidationAction = async () => {
    if (!supplierRole || selectedIds.size === 0) return;
    if (selectedRowsOnPage.length !== selectedIds.size) {
      toast({
        title: 'Sélection invalide',
        description: 'Les fournisseurs sélectionnés doivent être visibles sur la page courante (changement de page réinitialise la sélection).',
        variant: 'destructive',
      });
      return;
    }
    try {
      if (allSelectedValidatedByMyGroup) {
        await bulkValidation.mutateAsync({
          ids: selectedRowsOnPage.map((s) => s.id),
          mode: 'cancel',
          role: supplierRole,
        });
        toast({
          title: 'Validation annulée',
          description: `La validation ${VALIDATION_GROUP_LABEL[supplierRole]} a été retirée pour ${selectedRowsOnPage.length} fiche(s).`,
        });
      } else {
        if (idsToValidate.length === 0) return;
        await bulkValidation.mutateAsync({
          ids: idsToValidate,
          mode: 'validate',
          role: supplierRole,
        });
        toast({
          title: 'Fournisseurs validés',
          description: `${idsToValidate.length} fiche(s) marquée(s) par ${VALIDATION_GROUP_LABEL[supplierRole]}.`,
        });
      }
      setSelectedIds(new Set());
    } catch (e: unknown) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Mise à jour impossible',
        variant: 'destructive',
      });
    }
  };

  const validationPrimaryDisabled =
    bulkValidation.isPending ||
    !supplierRole ||
    selectedIds.size === 0 ||
    selectedRowsOnPage.length !== selectedIds.size ||
    (!allSelectedValidatedByMyGroup && idsToValidate.length === 0);

  const statusConfig = {
    a_completer: { label: 'À compléter', color: 'bg-destructive/10 text-destructive' },
    en_cours: { label: 'En cours', color: 'bg-warning/10 text-warning' },
    complet: { label: 'Complet', color: 'bg-success/10 text-success' },
  } as const;

  const stats = useMemo(() => ({
    total,
    aCompleter: filterOptions?.stats?.a_completer ?? 0,
    enCours: filterOptions?.stats?.en_cours ?? 0,
    complet: filterOptions?.stats?.complet ?? 0,
  }), [total, filterOptions]);

  const { data: categories = [] } = useSupplierCategories();
  const selectedCategorie = filters.categorie !== "all" ? filters.categorie : null;
  const { data: famillesByCategorie = [] } = useSupplierFamillesByCategorie(selectedCategorie);

  const famillesList = useMemo(() => {
    if (filters.categorie !== "all") return famillesByCategorie;
    return filterOptions.familles ?? [];
  }, [filters.categorie, famillesByCategorie, filterOptions.familles]);

  useEffect(() => {
    if (filters.famille !== 'all' && famillesList.length > 0 && !famillesList.includes(filters.famille)) {
      updateFilters({ famille: 'all' });
    }
  }, [famillesList.join('|')]);

  // Visible columns for table (ordre = displayColumnOrderKeys quand /suppliers avec persistance)
  const activeColumns = useMemo(() => {
    const visible = new Set(visibleColumns);
    return displayColumnOrderKeys
      .filter((k) => visible.has(k))
      .map((k) => ALL_COLUMNS.find((c) => c.key === k))
      .filter((c): c is SupplierColumnDef => c != null);
  }, [displayColumnOrderKeys, visibleColumns]);

  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!persistColumnOrderToProfile) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const visibleKeys = activeColumns.map((c) => c.key);
      const oldIndex = visibleKeys.indexOf(String(active.id));
      const newIndex = visibleKeys.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const newVisibleOrder = arrayMove(visibleKeys, oldIndex, newIndex);
      const visibleSet = new Set(visibleColumns);
      setColumnOrderKeys((prev) => mergeVisibleColumnReorder(prev, visibleSet, newVisibleOrder));
    },
    [persistColumnOrderToProfile, activeColumns, visibleColumns],
  );
  const stickyLayout = useMemo(
    () => getSupplierStickyColumnLayout(activeColumns, leadingColumnWidthPx, columnWidths),
    [activeColumns, leadingColumnWidthPx, columnWidths],
  );
  /** Fond opaque (carte / muted au survol de ligne) — pas de transparence. */
  const stickyColClass =
    'sticky border-r border-border bg-card shadow-[4px_0_8px_-6px_rgba(0,0,0,0.14)] group-hover:bg-muted';
  const stickyHeadColClass =
    'sticky border-r border-border bg-card shadow-[4px_0_8px_-6px_rgba(0,0,0,0.14)] hover:!bg-muted';
  const tableWidthPx = useMemo(() => {
    const sum = activeColumns.reduce((acc, c) => acc + colWidthPx(c.key, columnWidths), 0);
    return Math.max(sum + leadingColumnWidthPx, 800);
  }, [activeColumns, columnWidths, leadingColumnWidthPx]);
  const toggleColumn = (key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const filtersActive = hasActiveFilters(filters);

  // Helper for highlight ring on active filters
  const activeRing = (active: boolean) =>
    active ? 'ring-2 ring-primary/40 border-primary' : '';

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
          <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" className={cn('h-8 px-3 gap-2', viewMode === 'grid' && 'shadow-sm')} onClick={() => setViewMode('grid')}>
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Grille</span>
          </Button>
          <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" className={cn('h-8 px-3 gap-2', viewMode === 'table' && 'shadow-sm')} onClick={() => setViewMode('table')}>
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Table</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total ?? 0}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-destructive">
          <div className="text-sm text-muted-foreground">À compléter</div>
          <div className="text-2xl font-bold text-destructive">{stats.aCompleter}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-warning">
          <div className="text-sm text-muted-foreground">En cours</div>
          <div className="text-2xl font-bold text-warning">{stats.enCours}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-success">
          <div className="text-sm text-muted-foreground">Complet</div>
          <div className="text-2xl font-bold text-success">{stats.complet}</div>
        </Card>
      </div>

      {showValidationControls && selectedIds.size > 0 && supplierRole && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="font-medium">{selectedIds.size}</span> fournisseur(s) sélectionné(s)
              {selectedRowsOnPage.length !== selectedIds.size && (
                <span className="block text-destructive text-xs mt-1">
                  Sélectionnez uniquement des lignes visibles sur cette page pour agir.
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={allSelectedValidatedByMyGroup ? 'outline' : 'default'}
                className={cn(!allSelectedValidatedByMyGroup && 'bg-green-600 hover:bg-green-700')}
                disabled={validationPrimaryDisabled}
                onClick={() => void handleValidationAction()}
              >
                {bulkValidation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {allSelectedValidatedByMyGroup
                  ? `Annuler la validation de ${VALIDATION_GROUP_LABEL[supplierRole]}`
                  : 'Valider le(s) fournisseur(s)'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Effacer la sélection
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par Nom Fournisseur..."
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className={cn("pl-9", isFilterActive(filters.search, '') && 'ring-2 ring-primary/40 border-primary')}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className={cn("h-4 w-4", filtersActive ? "text-primary" : "text-muted-foreground")} />

            {/* Prefix filter */}
            {/* Removed: prefix selection. Business rule forces TIERS starting with 'F' (excluding FY). */}

            <SearchableSelect
              value={filters.status}
              onValueChange={(value) => updateFilters({ status: value })}
              options={[
                { value: 'all', label: 'Tous les status' },
                { value: 'a_completer', label: 'À compléter' },
                { value: 'en_cours', label: 'En cours' },
                { value: 'complet', label: 'Complet' },
              ]}
              placeholder="Status"
              triggerClassName={cn("w-[150px]", activeRing(isFilterActive(filters.status)))}
            />

            <SearchableSelect
              value={filters.entite}
              onValueChange={(value) => updateFilters({ entite: value })}
              options={[
                { value: 'all', label: 'Toutes entités' },
                ...filterOptions.entites.map((e) => ({ value: e, label: e })),
              ]}
              placeholder="Entité"
              triggerClassName={cn("w-[150px]", activeRing(isFilterActive(filters.entite)))}
            />

            <SearchableSelect
              value={filters.categorie}
              onValueChange={(value) => updateFilters({ categorie: value, famille: 'all', segment: 'all', sous_segment: 'all' })}
              options={[
                { value: 'all', label: 'Toutes catégories' },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
              placeholder="Catégorie"
              triggerClassName={cn("w-[180px]", activeRing(isFilterActive(filters.categorie)))}
            />

            <SearchableSelect
              value={filters.famille}
              onValueChange={(value) => updateFilters({ famille: value, segment: 'all', sous_segment: 'all' })}
              disabled={filters.categorie !== 'all' && famillesList.length === 0}
              options={[
                { value: 'all', label: 'Toutes familles' },
                ...famillesList.map((f) => ({ value: f, label: f })),
              ]}
              placeholder="Famille"
              triggerClassName={cn("w-[220px]", activeRing(isFilterActive(filters.famille)))}
            />

            <SearchableSelect
              value={filters.segment}
              onValueChange={(value) => updateFilters({ segment: value, sous_segment: 'all' })}
              options={[
                { value: 'all', label: 'Tous segments' },
                ...filterOptions.segments.map((s) => ({ value: s, label: s })),
              ]}
              placeholder="Segment"
              triggerClassName={cn("w-[170px]", activeRing(isFilterActive(filters.segment)))}
            />

            <SearchableSelect
              value={filters.sous_segment ?? 'all'}
              onValueChange={(value) => updateFilters({ sous_segment: value })}
              options={[
                { value: 'all', label: 'Tous sous-segments' },
                ...filterOptions.sous_segments.map((s) => ({ value: s, label: s })),
              ]}
              placeholder="Sous-segment"
              triggerClassName={cn("w-[190px]", activeRing(isFilterActive(filters.sous_segment)))}
            />

            {/* Reset filters button */}
            {filtersActive && (
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-destructive hover:text-destructive" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
                Réinitialiser
              </Button>
            )}
          </div>
        </div>

        {/* Date filters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Validité prix - du</div>
            <Input type="date" value={filters.validite_prix_from || ''} onChange={(e) => updateFilters({ validite_prix_from: e.target.value })} className={cn(isFilterActive(filters.validite_prix_from, '') && 'ring-2 ring-primary/40 border-primary')} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Validité prix - au</div>
            <Input type="date" value={filters.validite_prix_to || ''} onChange={(e) => updateFilters({ validite_prix_to: e.target.value })} className={cn(isFilterActive(filters.validite_prix_to, '') && 'ring-2 ring-primary/40 border-primary')} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Validité contrat - du</div>
            <Input type="date" value={filters.validite_contrat_from || ''} onChange={(e) => updateFilters({ validite_contrat_from: e.target.value })} className={cn(isFilterActive(filters.validite_contrat_from, '') && 'ring-2 ring-primary/40 border-primary')} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Validité contrat - au</div>
            <Input type="date" value={filters.validite_contrat_to || ''} onChange={(e) => updateFilters({ validite_contrat_to: e.target.value })} className={cn(isFilterActive(filters.validite_contrat_to, '') && 'ring-2 ring-primary/40 border-primary')} />
          </div>
        </div>

        {/* Preset Controls + Column Visibility */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t flex-wrap">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Contextes :</span>

          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-0.5">
              <Button variant={preset.is_default ? "default" : "outline"} size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => loadPreset(preset)}>
                {preset.is_global && <Globe className="h-3 w-3" />}
                {preset.is_default && <Star className="h-3 w-3 fill-current" />}
                {preset.name}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleDefault(preset.id)} title={preset.is_default ? "Retirer par défaut" : "Définir par défaut"}>
                <Star className={cn("h-3 w-3", preset.is_default ? "fill-warning text-warning" : "text-muted-foreground")} />
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleGlobal(preset.id)} title={preset.is_global ? "Retirer standard global" : "Standard pour tous"}>
                  <Globe className={cn("h-3 w-3", preset.is_global ? "fill-primary text-primary" : "text-muted-foreground")} />
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deletePreset(preset.id)} title="Supprimer">
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}

          {/* Save Popover */}
          <Popover open={showPresetPopover} onOpenChange={setShowPresetPopover}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Save className="h-3 w-3" />
                Enregistrer
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-3">
                <div className="text-sm font-medium">Enregistrer le contexte</div>
                <div className="space-y-2">
                  <Input
                    placeholder="Nom du contexte..."
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPresetName.trim()) {
                        savePreset(newPresetName.trim());
                        setNewPresetName('');
                        setShowPresetPopover(false);
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs"
                    disabled={!newPresetName.trim()}
                    onClick={() => {
                      savePreset(newPresetName.trim());
                      setNewPresetName('');
                      setShowPresetPopover(false);
                    }}
                  >
                    Nouveau contexte
                  </Button>
                </div>

                {presets.length > 0 && (
                  <>
                    <div className="border-t pt-2">
                      <div className="text-xs text-muted-foreground mb-2">Écraser un contexte existant :</div>
                      <div className="space-y-1">
                        {presets.map((p) => (
                          <Button
                            key={p.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start h-7 text-xs"
                            onClick={() => {
                              overwritePreset(p.id);
                              setShowPresetPopover(false);
                            }}
                          >
                            {p.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Column Visibility Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 ml-auto">
                <Columns3 className="h-3 w-3" />
                Colonnes ({visibleColumns.length}/{ALL_COLUMNS.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 max-h-[400px] overflow-y-auto" align="end">
              <div className="space-y-1">
                <div className="text-sm font-medium mb-2">Colonnes visibles</div>
                {displayColumnOrderKeys.map((key) => {
                  const col = ALL_COLUMNS.find((c) => c.key === key);
                  if (!col) return null;
                  return (
                  <label key={col.key} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer text-sm">
                    <Checkbox
                      checked={visibleColumns.includes(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                  );
                })}
                <div className="border-t pt-2 mt-2 flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => setVisibleColumns(ALL_COLUMNS.map(c => c.key))}>
                    Tout afficher
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}>
                    Par défaut
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      {/* Top Pagination */}
      <PaginationControls page={page} totalPages={totalPages} isLoading={isLoading} setPage={setPage} total={total} pageSize={pageSize} />

      {/* Grid View */}
      {viewMode === 'grid' && (
        isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-2/3" />
              </Card>
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Aucun fournisseur trouvé</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSuppliers.map((supplier) => {
              const score = supplier.completeness_score ?? 0;
              const st = supplier.status ? statusConfig[supplier.status] : null;
              return (
                <Card key={supplier.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: score >= 80 ? 'hsl(var(--success))' : score >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }} onClick={() => onViewSupplier(supplier.id)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {showValidationControls && (
                        <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(supplier.id)}
                            onCheckedChange={(v) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (v === true) next.add(supplier.id);
                                else next.delete(supplier.id);
                                return next;
                              });
                            }}
                            aria-label={`Sélectionner ${supplier.nomfournisseur || supplier.tiers}`}
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{supplier.nomfournisseur || '—'}</p>
                        <p className="font-mono text-xs text-muted-foreground">{supplier.tiers}</p>
                      </div>
                    </div>
                    {st && <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', st.color)}>{score}%</Badge>}
                  </div>
                  <Progress value={score} className="h-1.5 mb-3" />
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {supplier.entite && <div className="flex justify-between"><span>Entité</span><span className="text-foreground font-medium truncate ml-2">{supplier.entite.split(',').map(e => e.trim()).filter(Boolean).join(', ')}</span></div>}
                    {supplier.categorie && <div className="flex justify-between"><span>Catégorie</span><span className="text-foreground font-medium truncate ml-2">{supplier.categorie}</span></div>}
                    {supplier.famille && <div className="flex justify-between"><span>Famille</span><span className="text-foreground font-medium truncate ml-2">{supplier.famille}</span></div>}
                    {supplier.segment && <div className="flex justify-between"><span>Segment</span><span className="text-foreground font-medium truncate ml-2">{supplier.segment}{supplier.sous_segment && ` / ${supplier.sous_segment}`}</span></div>}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t text-[10px] text-muted-foreground">
                    <span className={dateClass(supplier.validite_prix)}>Prix: {safeFormatDate(supplier.validite_prix)}</span>
                    <div className="flex items-center gap-1">
                      <span className={dateClass(supplier.validite_du_contrat)}>Contrat: {safeFormatDate(supplier.validite_du_contrat)}</span>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" title="Modifier" onClick={(e) => { e.stopPropagation(); onOpenSupplier(supplier.id); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <Card className="isolate overflow-hidden">
          {/* Scroll H+V sur le même nœud : sinon un ancêtre `overflow-y-hidden` casse le sticky du thead. */}
          <div
            className="w-full max-h-[calc(100vh-340px)] overflow-auto pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:min-h-[40px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-track]:bg-muted/20"
            style={{ overscrollBehavior: 'contain' }}
          >
              <div className="min-w-max" style={{ position: 'relative' }}>
                <table className="caption-bottom text-sm" style={{ width: `${tableWidthPx}px` }}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
                <TableHeader className="sticky top-0 z-[10] bg-card [&_tr]:border-b shadow-[0_1px_3px_-1px_rgba(0,0,0,0.1)]">
                  <TableRow>
                    {showLeadingColumn && (
                      <TableHead
                        className={cn('bg-card', stickyHeadColClass)}
                        style={{
                          left: 0,
                          zIndex: 12,
                          width: leadingColumnWidthPx,
                          minWidth: leadingColumnWidthPx,
                          maxWidth: leadingColumnWidthPx,
                        }}
                      >
                        {showValidationControls ? (
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={
                                allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false
                              }
                              onCheckedChange={() => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (allOnPageSelected) {
                                    pageSupplierIds.forEach((id) => next.delete(id));
                                  } else {
                                    pageSupplierIds.forEach((id) => next.add(id));
                                  }
                                  return next;
                                });
                              }}
                              aria-label="Sélectionner tous les fournisseurs de la page"
                            />
                          </div>
                        ) : null}
                      </TableHead>
                    )}
                    <SortableContext items={activeColumns.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
                    {activeColumns.map((col) => {
                      const w = colWidthPx(col.key, columnWidths);
                      const stickyPart = stickySupplierCellStyle(
                        col.key,
                        stickyLayout.leftByKey,
                        stickyLayout.order,
                        11,
                      );
                      return (
                        <SortableSupplierColumnHead
                          key={col.key}
                          column={col}
                          sortConfig={sortConfig}
                          onSort={handleSort}
                          columnWidths={columnWidths}
                          onColumnResizeStart={onColumnResizeStart}
                          stickyPart={stickyPart}
                          stickyHeadColClass={stickyHeadColClass}
                          widthPx={w}
                          dragEnabled={persistColumnOrderToProfile}
                        />
                      );
                    })}
                    </SortableContext>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {showLeadingColumn && (
                          <TableCell
                            className={stickyColClass}
                            style={{
                              left: 0,
                              zIndex: 3,
                              width: leadingColumnWidthPx,
                              minWidth: leadingColumnWidthPx,
                              maxWidth: leadingColumnWidthPx,
                            }}
                          >
                            <Skeleton className="h-4 w-8 mx-auto" />
                          </TableCell>
                        )}
                        {activeColumns.map((col, j) => {
                          const w = colWidthPx(col.key, columnWidths);
                          const stickyPart = stickySupplierCellStyle(
                            col.key,
                            stickyLayout.leftByKey,
                            stickyLayout.order,
                            2,
                          );
                          const isSticky = !!stickyPart;
                          return (
                            <TableCell key={j} className={cn(isSticky && stickyColClass)} style={mergeColSize(stickyPart, w)}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeColumns.length + (showLeadingColumn ? 1 : 0)} className="text-center py-8 text-muted-foreground">Aucun fournisseur trouvé</TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => onViewSupplier(supplier.id)}>
                        {showLeadingColumn && (
                          <TableCell
                            className={cn(stickyColClass, 'p-0')}
                            style={{
                              left: 0,
                              zIndex: 3,
                              width: leadingColumnWidthPx,
                              minWidth: leadingColumnWidthPx,
                              maxWidth: leadingColumnWidthPx,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-0.5 py-1">
                              {showValidationControls && (
                                <Checkbox
                                  checked={selectedIds.has(supplier.id)}
                                  onCheckedChange={(v) => {
                                    setSelectedIds((prev) => {
                                      const next = new Set(prev);
                                      if (v === true) next.add(supplier.id);
                                      else next.delete(supplier.id);
                                      return next;
                                    });
                                  }}
                                  aria-label={`Sélectionner ${supplier.nomfournisseur || supplier.tiers}`}
                                />
                              )}
                              {canEdit && (
                                <Button variant="ghost" size="icon" title="Modifier" onClick={(e) => { e.stopPropagation(); onOpenSupplier(supplier.id); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {activeColumns.map((col) => {
                          const w = colWidthPx(col.key, columnWidths);
                          const stickyPart = stickySupplierCellStyle(
                            col.key,
                            stickyLayout.leftByKey,
                            stickyLayout.order,
                            2,
                          );
                          const isSticky = !!stickyPart;
                          return (
                            <TableCell key={col.key} className={cn(isSticky && stickyColClass)} style={mergeColSize(stickyPart, w)}>
                              {col.key === 'completeness_score' ? (
                                <div className="flex items-center gap-2">
                                  <Progress value={supplier.completeness_score ?? 0} className="h-2 flex-1" />
                                  <Badge className={supplier.status ? (statusConfig[supplier.status]?.color ?? 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground'}>
                                    {supplier.completeness_score ?? 0}%
                                  </Badge>
                                </div>
                              ) : isSticky ? (
                                <div className="min-w-0 truncate">{col.render(supplier)}</div>
                              ) : (
                                col.render(supplier)
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
                </DndContext>
                </table>
              </div>
          </div>

          {/* Bottom Pagination */}
          <div className="px-4 py-3 border-t">
            <PaginationControls page={page} totalPages={totalPages} isLoading={isLoading} setPage={setPage} total={total} pageSize={pageSize} />
          </div>
        </Card>
      )}
    </div>
  );
}

// Pagination sub-component with first/last page
function PaginationControls({ page, totalPages, isLoading, setPage, total, pageSize }: {
  page: number; totalPages: number; isLoading: boolean; setPage: (fn: (p: number) => number) => void; total: number; pageSize: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm text-muted-foreground">
        {total} lignes — page {page + 1} / {totalPages} — {pageSize} / page
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page === 0 || isLoading} onClick={() => setPage(() => 0)} className="gap-1" title="Première page">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={page === 0 || isLoading} onClick={() => setPage((p) => Math.max(0, p - 1))} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>
        <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || isLoading} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="gap-1">
          Suivant
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || isLoading} onClick={() => setPage(() => totalPages - 1)} className="gap-1" title="Dernière page">
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
