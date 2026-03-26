import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type CellRef = { row: number; col: number };
type Matrix = string[][];

interface TableInsertSpreadsheetProps {
  className?: string;
  disabled?: boolean;
  maxPickerSize?: number;
  onChange?: (payload: { raw: Matrix; display: Matrix }) => void;
  persistenceKey?: string;
  initialRaw?: Matrix | null;
}

type SuggestionItem = {
  label: string;
  insertText: string;
  kind: 'function' | 'cell';
};

interface HyperFormulaInstance {
  getCellValue: (addr: { sheet: number; row: number; col: number }) => unknown;
  setCellContents: (addr: { sheet: number; row: number; col: number }, values: string[][]) => void;
  destroy?: () => void;
}

interface HyperFormulaLike {
  buildFromArray: (data: Matrix, config: { licenseKey: string }) => HyperFormulaInstance;
}

declare global {
  interface Window {
    HyperFormula?: HyperFormulaLike;
  }
}

const COL_NAME = (index: number) => {
  let n = index;
  let label = '';
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

const VIEWPORT_MARGIN = 8;
const PICKER_WIDTH = 236;
const PICKER_HEIGHT = 250;
const FORMULA_FUNCTIONS = [
  'SUM',
  'AVERAGE',
  'MIN',
  'MAX',
  'COUNT',
  'IF',
  'AND',
  'OR',
  'NOT',
  'ROUND',
  'ROUNDUP',
  'ROUNDDOWN',
  'ABS',
  'CONCATENATE',
  'LEFT',
  'RIGHT',
  'LEN',
  'UPPER',
  'LOWER',
  'TODAY',
  'NOW',
];

const styles = {
  insertBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    borderRadius: 'calc(var(--radius) - 2px)',
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
    fontSize: 14,
    cursor: 'pointer',
  } as const,
  pickerPopup: {
    position: 'fixed' as const,
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius)',
    padding: 12,
    width: PICKER_WIDTH,
    zIndex: 9999,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
  } as const,
  pickerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: 4,
  } as const,
  pickerCell: {
    width: '100%',
    aspectRatio: '1' as const,
    borderRadius: 3,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--secondary))',
    cursor: 'pointer',
  } as const,
  pickerCellActive: {
    background: 'hsl(var(--primary) / 0.25)',
    border: '1px solid hsl(var(--primary) / 0.6)',
  } as const,
  sheetContainer: {
    border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
  } as const,
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderBottom: '1px solid hsl(var(--border))',
    background: 'hsl(var(--secondary))',
  } as const,
  formulaBar: {
    flex: 1,
    padding: '5px 10px',
    fontSize: 13,
    fontFamily: 'monospace',
    background: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'calc(var(--radius) - 2px)',
    outline: 'none',
  } as const,
  headerCell: {
    borderBottom: '1px solid hsl(var(--border))',
    borderRight: '1px solid hsl(var(--border))',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'monospace',
    color: 'hsl(var(--muted-foreground))',
    background: 'hsl(var(--secondary))',
    minWidth: 90,
    height: 30,
    textAlign: 'center' as const,
  } as const,
  rowNum: {
    borderRight: '1px solid hsl(var(--border))',
    borderBottom: '1px solid hsl(var(--border))',
    fontSize: 12,
    fontFamily: 'monospace',
    color: 'hsl(var(--muted-foreground))',
    background: 'hsl(var(--secondary))',
    width: 36,
    textAlign: 'center' as const,
    userSelect: 'none' as const,
    padding: '0 4px',
  } as const,
  cell: {
    borderRight: '1px solid hsl(var(--border))',
    borderBottom: '1px solid hsl(var(--border))',
    minWidth: 90,
    height: 30,
    padding: 0,
    background: 'hsl(var(--card))',
  } as const,
  cellInput: {
    width: '100%',
    height: '100%',
    padding: '4px 8px',
    border: 'none',
    background: 'transparent',
    color: 'hsl(var(--foreground))',
    fontSize: 13,
    outline: 'none',
  } as const,
  formulaText: {
    color: 'hsl(var(--muted-foreground))',
  } as const,
  formulaCellText: {
    color: 'hsl(var(--primary))',
  } as const,
};

function getSafePopupPosition(anchorRect: DOMRect) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let left = anchorRect.left;
  let top = anchorRect.bottom + 8;

  if (left + PICKER_WIDTH + VIEWPORT_MARGIN > viewportW) {
    left = viewportW - PICKER_WIDTH - VIEWPORT_MARGIN;
  }
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN;
  }

  if (top + PICKER_HEIGHT + VIEWPORT_MARGIN > viewportH) {
    top = anchorRect.top - PICKER_HEIGHT - 8;
  }
  if (top < VIEWPORT_MARGIN) {
    top = VIEWPORT_MARGIN;
  }

  return { top, left };
}

async function ensureHyperFormulaLoaded() {
  if (window.HyperFormula) return;
  const existing = document.querySelector<HTMLScriptElement>('script[data-hf-cdn="1"]');
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.HyperFormula) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load HyperFormula script')), { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hyperformula/dist/hyperformula.full.min.js';
    script.async = true;
    script.dataset.hfCdn = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load HyperFormula script'));
    document.head.appendChild(script);
  });
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function hasSelfReference(value: string, row: number, col: number) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('=')) return false;
  const currentRef = `${COL_NAME(col)}${row + 1}`;
  const refPattern = new RegExp(`\\b\\$?${COL_NAME(col)}\\$?${row + 1}\\b`, 'i');
  return refPattern.test(trimmed) || trimmed.toUpperCase().includes(currentRef);
}

export function TableInsertSpreadsheet({
  className,
  disabled = false,
  maxPickerSize = 8,
  onChange,
  persistenceKey,
  initialRaw = null,
}: TableInsertSpreadsheetProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hover, setHover] = useState({ r: -1, c: -1 });
  const [table, setTable] = useState<{ rows: number; cols: number } | null>(null);
  const [cellData, setCellData] = useState<Matrix>([]);
  const [displayValues, setDisplayValues] = useState<Matrix>([]);
  const [selected, setSelected] = useState<CellRef>({ row: 0, col: 0 });
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [formulaInput, setFormulaInput] = useState('');
  const [editingValue, setEditingValue] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [suggestionSource, setSuggestionSource] = useState<'formula' | 'cell' | null>(null);
  const [suggestionReplaceRange, setSuggestionReplaceRange] = useState<{ start: number; end: number } | null>(null);
  const [hfError, setHfError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const formulaInputRef = useRef<HTMLInputElement | null>(null);
  const hfRef = useRef<HyperFormulaInstance | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [isFormulaBarFocused, setIsFormulaBarFocused] = useState(false);

  const persistSnapshot = useCallback((rows: number, cols: number, data: Matrix) => {
    if (!persistenceKey) return;
    try {
      const payload = JSON.stringify({ rows, cols, data });
      localStorage.setItem(`table-spreadsheet:${persistenceKey}`, payload);
    } catch {
      // Ignore storage failures (quota/private mode)
    }
  }, [persistenceKey]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedWrapper = wrapperRef.current?.contains(target);
      const clickedPopup = popupRef.current?.contains(target);
      if (!clickedWrapper && !clickedPopup) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const updatePopupPosition = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopupPos(getSafePopupPosition(rect));
    };

    updatePopupPosition();
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
    };
  }, [pickerOpen]);

  useEffect(() => {
    return () => {
      hfRef.current?.destroy?.();
      hfRef.current = null;
    };
  }, []);

  const refreshDisplay = useCallback((data: Matrix, rows: number, cols: number) => {
    if (!hfRef.current) {
      const next = data.map((r) => [...r]);
      setDisplayValues(next);
      return next;
    }
    const next = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const raw = data[r][c] ?? '';
        if (!raw.startsWith('=')) return raw;
        try {
          const val = hfRef.current?.getCellValue({ sheet: 0, row: r, col: c });
          return val !== null && val !== undefined ? String(val) : '';
        } catch {
          return '#ERR';
        }
      }),
    );
    setDisplayValues(next);
    return next;
  }, []);

  useEffect(() => {
    if (!persistenceKey || table) return;
    try {
      const raw = localStorage.getItem(`table-spreadsheet:${persistenceKey}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { rows?: number; cols?: number; data?: Matrix };
      const rows = parsed.rows ?? parsed.data?.length ?? 0;
      const cols = parsed.cols ?? (parsed.data?.[0]?.length ?? 0);
      if (!rows || !cols || !parsed.data) return;

      const normalized = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => parsed.data?.[r]?.[c] ?? ''),
      );

      setTable({ rows, cols });
      setCellData(normalized);
      setDisplayValues(normalized);
      setSelected({ row: 0, col: 0 });
      setFormulaInput(normalized[0]?.[0] ?? '');

      const hydrate = async () => {
        try {
          await ensureHyperFormulaLoaded();
          hfRef.current?.destroy?.();
          if (!window.HyperFormula) return;
          hfRef.current = window.HyperFormula.buildFromArray(normalized, { licenseKey: 'gpl-v3' });
          refreshDisplay(normalized, rows, cols);
          setHfError(null);
        } catch {
          setHfError('Moteur de formules indisponible.');
        }
      };
      hydrate();
    } catch {
      // Ignore invalid persisted payload
    }
  }, [persistenceKey, table, onChange, refreshDisplay]);

  useEffect(() => {
    if (table) return;
    if (!initialRaw || initialRaw.length === 0) return;

    const rows = initialRaw.length;
    const cols = initialRaw[0]?.length ?? 0;
    if (!rows || !cols) return;

    const normalized = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => initialRaw?.[r]?.[c] ?? ''),
    );

    setTable({ rows, cols });
    setCellData(normalized);
    setDisplayValues(normalized);
    setSelected({ row: 0, col: 0 });
    setFormulaInput(normalized[0]?.[0] ?? '');

    const hydrate = async () => {
      try {
        await ensureHyperFormulaLoaded();
        hfRef.current?.destroy?.();
        if (!window.HyperFormula) return;
        hfRef.current = window.HyperFormula.buildFromArray(normalized, { licenseKey: 'gpl-v3' });
        refreshDisplay(normalized, rows, cols);
        setHfError(null);
      } catch {
        setHfError('Moteur de formules indisponible.');
      }
    };
    hydrate();
  }, [initialRaw, onChange, refreshDisplay, table]);

  const commitValue = useCallback((row: number, col: number, value: string) => {
    if (!table) return;
    let nextValue = value;
    // Headers (row 0 and col 0) must be plain text (no formulas).
    if ((row === 0 || col === 0) && nextValue.trim().startsWith('=')) {
      nextValue = nextValue.trim().replace(/^=/, '');
    }

    if (hasSelfReference(nextValue, row, col)) {
      setHfError(`Reference circulaire interdite: ${COL_NAME(col)}${row + 1} ne peut pas se referencer elle-meme.`);
      setFormulaInput(cellData[row]?.[col] ?? '');
      setEditingValue(cellData[row]?.[col] ?? '');
      return;
    }

    setHfError(null);
    setCellData((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = nextValue;
      try {
        hfRef.current?.setCellContents({ sheet: 0, row, col }, [[nextValue || '']]);
      } catch {
        // keep raw value even if formula parsing fails
      }
      const display = refreshDisplay(next, table.rows, table.cols);
      persistSnapshot(table.rows, table.cols, next);
      onChange?.({ raw: next, display });
      return next;
    });
  }, [onChange, refreshDisplay, table, persistSnapshot]);

  const selectCell = useCallback((row: number, col: number) => {
    setSelected({ row, col });
    setEditing(null);
    setFormulaInput(cellData[row]?.[col] ?? '');
    setSuggestions([]);
    setSuggestionSource(null);
  }, [cellData]);

  const startEdit = useCallback((row: number, col: number) => {
    if (disabled) return;
    setSelected({ row, col });
    setEditing({ row, col });
    setFormulaInput(cellData[row]?.[col] ?? '');
    setEditingValue(cellData[row]?.[col] ?? '');
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, [cellData, disabled]);

  const cellRefLabel = useCallback((row: number, col: number) => `${COL_NAME(col)}${row + 1}`, []);

  const allCellRefs = useCallback(() => {
    if (!table) return [] as string[];
    const refs: string[] = [];
    for (let r = 0; r < table.rows; r += 1) {
      for (let c = 0; c < table.cols; c += 1) {
        refs.push(cellRefLabel(r, c));
      }
    }
    return refs;
  }, [table, cellRefLabel]);

  const getSuggestionsForInput = useCallback((
    value: string,
    cursor: number,
  ): { items: SuggestionItem[]; range: { start: number; end: number } | null } => {
    if (!value.trim().startsWith('=')) return { items: [], range: null };
    const left = value.slice(0, cursor);
    const tokenMatch = left.match(/([A-Za-z]+[0-9]*)$/);
    if (!tokenMatch) return { items: [], range: null };

    const token = tokenMatch[1].toUpperCase();
    const start = cursor - token.length;
    const end = cursor;

    const functionItems: SuggestionItem[] = token
      ? FORMULA_FUNCTIONS
          .filter((fn) => fn.startsWith(token))
          .slice(0, 8)
          .map((fn) => ({ label: fn, insertText: `${fn}()`, kind: 'function' }))
      : [];

    const cellItems: SuggestionItem[] = token
      ? allCellRefs()
          .filter((ref) => ref.startsWith(token))
          .slice(0, 8)
          .map((ref) => ({ label: ref, insertText: ref, kind: 'cell' }))
      : [];

    const items = [...functionItems, ...cellItems].slice(0, 10);
    return { items, range: items.length > 0 ? { start, end } : null };
  }, [allCellRefs]);

  const updateSuggestions = useCallback((value: string, source: 'formula' | 'cell', cursor: number) => {
    const { items, range } = getSuggestionsForInput(value, cursor);
    setSuggestions(items);
    setActiveSuggestionIndex(0);
    setSuggestionReplaceRange(range);
    setSuggestionSource(items.length > 0 ? source : null);
  }, [getSuggestionsForInput]);

  const applySuggestion = useCallback((item: SuggestionItem, source: 'formula' | 'cell') => {
    const applyOnValue = (current: string, inputEl?: HTMLInputElement | null) => {
      const selectionStart = inputEl?.selectionStart ?? null;
      const range = suggestionReplaceRange;
      if (range) {
        return `${current.slice(0, range.start)}${item.insertText}${current.slice(range.end)}`;
      }
      if (selectionStart == null) {
        return `${current}${item.insertText}`;
      }
      return `${current.slice(0, selectionStart)}${item.insertText}${current.slice(selectionStart)}`;
    };

    if (source === 'formula') {
      const nextValue = applyOnValue(formulaInput, formulaInputRef.current);
      setFormulaInput(nextValue);
      requestAnimationFrame(() => {
        const el = formulaInputRef.current;
        if (!el) return;
        const pos = (suggestionReplaceRange?.start ?? (el.selectionStart ?? nextValue.length)) + item.insertText.length;
        el.focus();
        if (item.kind === 'function') {
          el.setSelectionRange(pos - 1, pos - 1);
        } else {
          el.setSelectionRange(pos, pos);
        }
      });
    } else {
      const nextValue = applyOnValue(editingValue, editInputRef.current);
      setEditingValue(nextValue);
      setFormulaInput(nextValue);
      requestAnimationFrame(() => {
        const el = editInputRef.current;
        if (!el) return;
        const pos = (suggestionReplaceRange?.start ?? (el.selectionStart ?? nextValue.length)) + item.insertText.length;
        el.focus();
        if (item.kind === 'function') {
          el.setSelectionRange(pos - 1, pos - 1);
        } else {
          el.setSelectionRange(pos, pos);
        }
      });
    }
    setSuggestions([]);
    setSuggestionSource(null);
    setSuggestionReplaceRange(null);
  }, [editingValue, formulaInput, suggestionReplaceRange]);

  const cancelEditing = useCallback(() => {
    setEditing(null);
    setSuggestions([]);
    setSuggestionSource(null);
    setSuggestionReplaceRange(null);
    setFormulaInput(cellData[selected.row]?.[selected.col] ?? '');
  }, [cellData, selected.row, selected.col]);

  const insertAtCursor = useCallback((base: string, toInsert: string, inputEl?: HTMLInputElement | null) => {
    if (!inputEl || inputEl.selectionStart == null || inputEl.selectionEnd == null) {
      return `${base}${toInsert}`;
    }
    const start = inputEl.selectionStart;
    const end = inputEl.selectionEnd;
    return `${base.slice(0, start)}${toInsert}${base.slice(end)}`;
  }, []);

  const isReferenceInsertMode = useCallback(() => {
    const editingFormula = !!editing && editingValue.trim().startsWith('=');
    const formulaBarFormula = !editing && isFormulaBarFocused && formulaInput.trim().startsWith('=');
    return editingFormula || formulaBarFormula;
  }, [editing, editingValue, isFormulaBarFocused, formulaInput]);

  const handleReferenceCellClick = useCallback((row: number, col: number) => {
    // Prevent selecting the currently edited cell as a reference (self-reference).
    if (editing && editing.row === row && editing.col === col) {
      return true;
    }

    const ref = cellRefLabel(row, col);

    if (editing && editingValue.trim().startsWith('=')) {
      setEditingValue((prev) => insertAtCursor(prev, ref, editInputRef.current));
      setFormulaInput((prev) => insertAtCursor(prev, ref, editInputRef.current));
      setSuggestions([]);
      setSuggestionSource(null);
      setSuggestionReplaceRange(null);
      requestAnimationFrame(() => editInputRef.current?.focus());
      return true;
    }

    if (!editing && isFormulaBarFocused && formulaInput.trim().startsWith('=')) {
      setFormulaInput((prev) => insertAtCursor(prev, ref, formulaInputRef.current));
      setSuggestions([]);
      setSuggestionSource(null);
      setSuggestionReplaceRange(null);
      requestAnimationFrame(() => formulaInputRef.current?.focus());
      return true;
    }

    return false;
  }, [
    cellRefLabel,
    editing,
    editingValue,
    formulaInput,
    insertAtCursor,
    isFormulaBarFocused,
  ]);

  const insertTable = useCallback(async (rows: number, cols: number) => {
    const data = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
    setTable({ rows, cols });
    setCellData(data);
    setDisplayValues(data);
    setSelected({ row: 0, col: 0 });
    setFormulaInput('');
    setPickerOpen(false);
    persistSnapshot(rows, cols, data);

    try {
      await ensureHyperFormulaLoaded();
      hfRef.current?.destroy?.();
      if (!window.HyperFormula) {
        setHfError('Moteur de formules indisponible.');
        return;
      }
      hfRef.current = window.HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3' });
      const display = refreshDisplay(data, rows, cols);
      onChange?.({ raw: data, display });
      setHfError(null);
    } catch {
      setHfError('Moteur de formules indisponible.');
    }
  }, [onChange, refreshDisplay, persistSnapshot]);

  if (!table) {
    const popup = pickerOpen && popupPos ? (
      <div
        ref={popupRef}
        style={{
          ...styles.pickerPopup,
          top: popupPos.top,
          left: popupPos.left,
        }}
      >
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider" style={styles.formulaText}>
          Dimensions du tableau
        </div>
        <div
          style={{ ...styles.pickerGrid, gridTemplateColumns: `repeat(${maxPickerSize}, 1fr)` }}
          onMouseLeave={() => setHover({ r: -1, c: -1 })}
        >
          {Array.from({ length: maxPickerSize }, (_, r) =>
            Array.from({ length: maxPickerSize }, (_, c) => {
              const isActive = r <= hover.r && c <= hover.c;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  style={isActive ? { ...styles.pickerCell, ...styles.pickerCellActive } : styles.pickerCell}
                  onMouseEnter={() => setHover({ r, c })}
                  onClick={() => insertTable(r + 1, c + 1)}
                  aria-label={`${r + 1} lignes x ${c + 1} colonnes`}
                />
              );
            }),
          )}
        </div>
        <div className="mt-2 text-center text-xs" style={styles.formulaText}>
          {hover.r >= 0
            ? `${hover.r + 1} ligne${hover.r > 0 ? 's' : ''} × ${hover.c + 1} colonne${hover.c > 0 ? 's' : ''}`
            : 'Survolez pour choisir'}
        </div>
      </div>
    ) : null;

    return (
      <div className={className}>
        <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            style={styles.insertBtn}
            onClick={() => {
              const next = !pickerOpen;
              if (next) {
                const rect = wrapperRef.current?.getBoundingClientRect();
                if (rect) {
                  setPopupPos(getSafePopupPosition(rect));
                }
              }
              setPickerOpen(next);
            }}
            disabled={disabled}
          >
            <GridIcon />
            Inserer un tableau
          </button>
        </div>
        {popup && createPortal(popup, document.body)}
      </div>
    );
  }

  return (
    <div className={className} style={styles.sheetContainer}>
      <div style={styles.toolbar}>
        <span className="min-w-9 text-xs font-medium" style={styles.formulaText}>
          {COL_NAME(selected.col)}
          {selected.row + 1}
        </span>
        <span className="text-xs italic" style={styles.formulaText}>fx</span>
        <input
          ref={formulaInputRef}
          style={styles.formulaBar}
          value={formulaInput}
          onChange={(e) => {
            const value = e.target.value;
            setFormulaInput(value);
            updateSuggestions(value, 'formula', e.target.selectionStart ?? value.length);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (suggestions.length > 0 && suggestionSource === 'formula') {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                applySuggestion(suggestions[activeSuggestionIndex], 'formula');
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setSuggestions([]);
                setSuggestionSource(null);
                setSuggestionReplaceRange(null);
                cancelEditing();
                setIsFormulaBarFocused(false);
                formulaInputRef.current?.blur();
                return;
              }
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEditing();
              setIsFormulaBarFocused(false);
              formulaInputRef.current?.blur();
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              commitValue(selected.row, selected.col, formulaInput);
              setEditing(null);
              setSuggestions([]);
              setSuggestionSource(null);
              setSuggestionReplaceRange(null);
              setIsFormulaBarFocused(false);
              formulaInputRef.current?.blur();
            }
          }}
          onFocus={() => setIsFormulaBarFocused(true)}
          onBlur={() => setIsFormulaBarFocused(false)}
          placeholder="Valeur ou formule (ex: =SUM(A1:A4))"
          disabled={disabled}
        />
      </div>
      {suggestions.length > 0 && suggestionSource === 'formula' && (
        <div className="relative">
          <div className="absolute left-20 top-0 z-20 min-w-44 rounded-md border bg-popover p-1 shadow-md">
            {suggestions.map((fn, index) => (
              <button
                key={`${fn.kind}:${fn.label}`}
                type="button"
                className={`block w-full rounded-sm px-2 py-1 text-left text-xs ${index === activeSuggestionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySuggestion(fn, 'formula');
                }}
              >
                <span>{fn.label}</span>
                <span className="ml-2 text-[10px] opacity-60">{fn.kind === 'function' ? 'fn' : 'cell'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th style={{ ...styles.headerCell, minWidth: 36, width: 36 }} />
              {Array.from({ length: table.cols }, (_, c) => (
                <th key={c} style={styles.headerCell}>{COL_NAME(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: table.rows }, (_, r) => (
              <tr key={r}>
                <td style={styles.rowNum}>{r + 1}</td>
                {Array.from({ length: table.cols }, (_, c) => {
                  const isSelected = selected.row === r && selected.col === c;
                  const isEditing = editing?.row === r && editing?.col === c;
                  const raw = cellData[r]?.[c] ?? '';
                  const isFormula = raw.startsWith('=');

                  return (
                    <td
                      key={`${r}-${c}`}
                      style={{
                        ...styles.cell,
                        outline: isSelected ? '2px solid hsl(var(--primary) / 0.7)' : 'none',
                        outlineOffset: -2,
                      }}
                      onMouseDown={(e) => {
                        if (isReferenceInsertMode()) {
                          // Keep focus on the active editor while selecting references by click.
                          e.preventDefault();
                        }
                      }}
                      onClick={() => {
                        if (handleReferenceCellClick(r, c)) return;
                        selectCell(r, c);
                      }}
                      onDoubleClick={() => startEdit(r, c)}
                    >
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          value={editingValue}
                          style={styles.cellInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditingValue(value);
                            setFormulaInput(value);
                            updateSuggestions(value, 'cell', e.target.selectionStart ?? value.length);
                          }}
                          onBlur={(e) => {
                            commitValue(r, c, e.target.value);
                            setEditing(null);
                            setSuggestions([]);
                            setSuggestionSource(null);
                          }}
                          onKeyDown={(e) => {
                            if (suggestions.length > 0 && suggestionSource === 'cell') {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
                                return;
                              }
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                                return;
                              }
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                applySuggestion(suggestions[activeSuggestionIndex], 'cell');
                                return;
                              }
                              if (e.key === 'Escape') {
                                setSuggestions([]);
                                setSuggestionSource(null);
                                setSuggestionReplaceRange(null);
                              }
                            }
                            if (e.key === 'Escape') {
                              cancelEditing();
                              return;
                            }
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              e.preventDefault();
                              commitValue(r, c, (e.target as HTMLInputElement).value);
                              setEditing(null);
                              const nextCol = c + 1 < table.cols ? c + 1 : 0;
                              const nextRow = c + 1 < table.cols ? r : Math.min(r + 1, table.rows - 1);
                              selectCell(nextRow, nextCol);
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="flex h-full min-h-[30px] items-center px-2"
                          style={isFormula ? styles.formulaCellText : undefined}
                        >
                          {displayValues[r]?.[c] ?? ''}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {suggestions.length > 0 && suggestionSource === 'cell' && (
        <div className="relative">
          <div className="absolute left-12 top-1 z-20 min-w-44 rounded-md border bg-popover p-1 shadow-md">
            {suggestions.map((fn, index) => (
              <button
                key={`${fn.kind}:${fn.label}`}
                type="button"
                className={`block w-full rounded-sm px-2 py-1 text-left text-xs ${index === activeSuggestionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySuggestion(fn, 'cell');
                }}
              >
                <span>{fn.label}</span>
                <span className="ml-2 text-[10px] opacity-60">{fn.kind === 'function' ? 'fn' : 'cell'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hfError && (
        <div className="px-3 py-2 text-xs" style={styles.formulaText}>
          {hfError}
        </div>
      )}
    </div>
  );
}

