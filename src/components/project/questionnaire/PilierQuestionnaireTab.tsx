import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, Info, Lock, Plus, GripVertical } from 'lucide-react';
import { OPTIONS_EVALUATION_RISQUE, type PilierCode } from '@/config/questionnaireConfig';
import { useProjectQuestionnaire, type AnswersMap } from '@/hooks/useProjectQuestionnaire';
import { useQuestionnaireFieldDefs, type FieldDefinition } from '@/hooks/useQuestionnaireFieldDefs';
import { getCanonicalSectionGroups, useQuestionnaireSectionOrder } from '@/hooks/useQuestionnaireSectionOrder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { AddCustomFieldDialog } from './AddCustomFieldDialog';
import { TableInsertSpreadsheet } from './TableInsertSpreadsheet';

interface PilierQuestionnaireTabProps {
  projectId: string;
  codeDivalto: string;
  pilierCode: PilierCode;
  readonly?: boolean;
}

interface AddFieldContext {
  section: string;
  sousSection?: string;
}

type Matrix = string[][];

function colIndexToName(index: number) {
  let n = index;
  let label = '';
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function parseA1(address: string): { rowIndex: number; colIndex: number } | null {
  const m = address.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const letters = m[1];
  const rowNum = Number(m[2]);
  if (!rowNum || rowNum < 1) return null;

  let colIndex = 0;
  for (let i = 0; i < letters.length; i += 1) {
    colIndex = colIndex * 26 + (letters.charCodeAt(i) - 64);
  }
  colIndex -= 1;
  return { rowIndex: rowNum - 1, colIndex };
}

function buildTemplateJsonFromRaw(raw: Matrix) {
  const rows = raw.length;
  const cols = raw[0]?.length ?? 0;
  const cornerLabel = raw[0]?.[0] ?? '';
  const colHeaders = Array.from({ length: Math.max(cols - 1, 0) }, (_, i) => raw[0]?.[i + 1] ?? '');
  const rowHeaders = Array.from({ length: Math.max(rows - 1, 0) }, (_, i) => raw[i + 1]?.[0] ?? '');
  // cornerLabel is the top-left cell (0,0), shared across projects like other headers
  return { rows, cols, cornerLabel, colHeaders, rowHeaders };
}

function buildValueJsonbFromRawAndDisplay(raw: Matrix, display: Matrix) {
  const rows = raw.length;
  const cols = raw[0]?.length ?? 0;
  const cells: Record<string, any> = {};

  for (let r = 1; r < rows; r += 1) {
    for (let c = 1; c < cols; c += 1) {
      const rawCell = (raw[r]?.[c] ?? '').toString();
      const trimmed = rawCell.trim();
      if (!trimmed) continue;

      const addr = `${colIndexToName(c)}${r + 1}`;
      if (trimmed.startsWith('=')) {
        const displayCell = (display[r]?.[c] ?? '').toString();
        cells[addr] = { f: trimmed, v: displayCell };
      } else {
        cells[addr] = { v: rawCell };
      }
    }
  }

  return { cells };
}

function SortableQuestionnaireSection({
  section,
  draggable,
  children,
  triggerSummary,
}: {
  section: string;
  draggable: boolean;
  children: React.ReactNode;
  triggerSummary: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section,
    disabled: !draggable,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const onPointerDown = listeners.onPointerDown;
  const gripListeners =
    draggable && onPointerDown
      ? {
          ...listeners,
          onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
            onPointerDown(e);
            e.stopPropagation();
          },
        }
      : { ...listeners };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'relative z-10 opacity-95')}>
      <AccordionItem value={section} className="border rounded-lg overflow-visible">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
          <div className="flex items-center gap-3 w-full min-w-0">
            {draggable ? (
              <button
                type="button"
                aria-label="Glisser-déposer pour réordonner les sections"
                className="shrink-0 touch-none cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground active:cursor-grabbing"
                {...attributes}
                {...gripListeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            ) : null}
            {triggerSummary}
          </div>
        </AccordionTrigger>
        {children}
      </AccordionItem>
    </div>
  );
}

function buildInitialRawFromTemplateAndValue(
  template: any | null,
  valueJsonb: any | null,
): Matrix | null {
  if (!template) return null;
  const rows: number = template.rows ?? template.meta?.rows ?? 0;
  const cols: number = template.cols ?? template.meta?.cols ?? 0;
  if (!rows || !cols) return null;

  const cornerLabel: string = template.cornerLabel ?? template.meta?.cornerLabel ?? '';
  const colHeaders: string[] = template.colHeaders ?? template.meta?.colHeaders ?? [];
  const rowHeaders: string[] = template.rowHeaders ?? template.meta?.rowHeaders ?? [];

  const raw = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

  // Headers: row 0 => col headers, col 0 => row headers
  raw[0][0] = cornerLabel ?? '';
  for (let c = 1; c < cols; c += 1) {
    raw[0][c] = colHeaders[c - 1] ?? '';
  }
  for (let r = 1; r < rows; r += 1) {
    raw[r][0] = rowHeaders[r - 1] ?? '';
  }

  const cells = (valueJsonb && typeof valueJsonb === 'object' ? valueJsonb.cells : null) ?? null;
  if (cells && typeof cells === 'object') {
    for (const [a1, cell] of Object.entries(cells)) {
      const idx = parseA1(a1);
      if (!idx) continue;
      const { rowIndex, colIndex } = idx;
      if (rowIndex <= 0 || colIndex <= 0) continue;
      if (rowIndex >= rows || colIndex >= cols) continue;

      if (typeof cell === 'string') {
        raw[rowIndex][colIndex] = cell;
      } else if (cell && typeof cell === 'object') {
        const f = (cell as any).f;
        const v = (cell as any).v;
        raw[rowIndex][colIndex] = (f ?? v ?? '').toString();
      }
    }
  }

  return raw;
}

function SpreadsheetFieldWidget({
  field,
  projectId,
  canWrite,
  section,
  localAnswer,
  onUpsertLocalValue,
  onMarkDirtySection,
}: {
  field: FieldDefinition;
  projectId: string;
  canWrite: boolean;
  section: string;
  localAnswer: any;
  onUpsertLocalValue: (champId: string, valeur_jsonb: any) => void;
  onMarkDirtySection: (section: string) => void;
}) {
  const { profile } = useAuth();

  const templateJson = field.spreadsheet_template ?? null;
  const valueJsonb = localAnswer?.valeur_jsonb ?? null;

  const initialRaw = useMemo(() => buildInitialRawFromTemplateAndValue(templateJson, valueJsonb), [templateJson, valueJsonb]);
  const ignoreFirstOnChangeRef = useRef<boolean>(!!templateJson);
  const debounceRef = useRef<number | null>(null);
  const lastTemplateStrRef = useRef<string>('');
  const lastValueStrRef = useRef<string>('');

  const handleOnChange = useCallback(
    (payload: { raw: Matrix; display: Matrix }) => {
      if (!canWrite) return;
      if (ignoreFirstOnChangeRef.current) {
        ignoreFirstOnChangeRef.current = false;
        return;
      }

      const templateToPersist = buildTemplateJsonFromRaw(payload.raw);
      const valueToPersist = buildValueJsonbFromRawAndDisplay(payload.raw, payload.display);
      const templateStr = JSON.stringify(templateToPersist);
      const valueStr = JSON.stringify(valueToPersist);

      const shouldUpdateTemplate = templateStr !== lastTemplateStrRef.current;
      const shouldUpdateValue = valueStr !== lastValueStrRef.current;

      // Update local state immediately so "Save section" stays consistent
      onUpsertLocalValue(field.champ_id, valueToPersist);
      onMarkDirtySection(section);

      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(async () => {
        try {
          // 1) Propagate headers (only if changed)
          if (shouldUpdateTemplate) {
            const { error: templateError } = await (supabase as any)
              .from('questionnaire_field_definitions')
              .update({ spreadsheet_template: templateToPersist })
              .eq('id', field.id);
            if (templateError) throw templateError;
            lastTemplateStrRef.current = templateStr;
          }

          // 2) Persist sparse internal cells (only if changed)
          if (shouldUpdateValue) {
            const { error: valueError } = await (supabase as any)
              .from('project_field_values')
              .upsert(
                {
                  project_id: projectId,
                  field_def_id: field.id,
                  valeur: null,
                  valeur_evaluation: null,
                  valeur_jsonb: valueToPersist,
                  updated_by: profile?.id ?? null,
                },
                { onConflict: 'project_id,field_def_id' },
              );
            if (valueError) throw valueError;
            lastValueStrRef.current = valueStr;
          }
        } catch (e) {
          console.error('Spreadsheet persist error:', e);
        }
      }, 450);
    },
    [canWrite, field, onMarkDirtySection, onUpsertLocalValue, projectId, profile?.id, section],
  );

  return (
    <TableInsertSpreadsheet
      disabled={!canWrite}
      maxPickerSize={10}
      initialRaw={initialRaw}
      onChange={handleOnChange}
    />
  );
}

export function PilierQuestionnaireTab({
  projectId,
  codeDivalto,
  pilierCode,
  readonly = false,
}: PilierQuestionnaireTabProps) {
  const { profile } = useAuth();
  const { answers, isLoading: isLoadingAnswers, isSaving, fetchAnswers, saveSectionAnswers, canWritePilier } =
    useProjectQuestionnaire(projectId, codeDivalto);
  const { data: fieldDefs = [], isLoading: isLoadingDefs } = useQuestionnaireFieldDefs(pilierCode);

  const [localAnswers, setLocalAnswers] = useState<AnswersMap>({});
  const [dirtySection, setDirtySection] = useState<Set<string>>(new Set());
  const [addFieldCtx, setAddFieldCtx] = useState<AddFieldContext | null>(null);

  const canWrite = !readonly && canWritePilier(pilierCode);
  const canonicalGroups = useMemo(() => getCanonicalSectionGroups(fieldDefs, pilierCode), [fieldDefs, pilierCode]);
  const { orderedGroups, order, onDragEnd } = useQuestionnaireSectionOrder(profile?.id, projectId, pilierCode, canonicalGroups);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isLoading = isLoadingAnswers || isLoadingDefs;

  useEffect(() => {
    fetchAnswers(pilierCode);
  }, [pilierCode, fetchAnswers]);

  useEffect(() => {
    setLocalAnswers(answers);
  }, [answers]);

  const handleChange = (champ_id: string, field: 'valeur' | 'valeur_evaluation', value: string, section: string) => {
    setLocalAnswers(prev => ({
      ...prev,
      [champ_id]: { ...prev[champ_id], champ_id, [field]: value },
    }));
    setDirtySection(prev => new Set(prev).add(section));
  };

  const handleSave = async (section: string, sectionFields: FieldDefinition[]) => {
    const ok = await saveSectionAnswers(pilierCode, section, sectionFields, localAnswers);
    if (ok) {
      setDirtySection(prev => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
    }
  };

  const renderField = (field: FieldDefinition) => {
    const val = localAnswers[field.champ_id]?.valeur ?? '';
    const evalVal = localAnswers[field.champ_id]?.valeur_evaluation ?? '';

    return (
      <div key={field.champ_id} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor={field.champ_id} className="text-sm font-medium">
            {field.label}
            {!field.is_builtin && (
              <Badge variant="outline" className="ml-1.5 text-[10px] py-0">custom</Badge>
            )}
          </Label>
          {field.note && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">{field.note}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div>
          {field.type === 'spreadsheet' && (
            <SpreadsheetFieldWidget
              field={field}
              projectId={projectId}
              canWrite={canWrite}
              section={field.section}
              localAnswer={localAnswers[field.champ_id]}
              onUpsertLocalValue={(champId, valeur_jsonb) => {
                setLocalAnswers((prev) => ({
                  ...prev,
                  [champId]: {
                    champ_id: champId,
                    valeur: null,
                    valeur_evaluation: null,
                    valeur_jsonb,
                  },
                }));
              }}
              onMarkDirtySection={(s) => setDirtySection((prev) => new Set(prev).add(s))}
            />
          )}

          {field.type === 'select' && (
            <Select
              value={val}
              onValueChange={v => handleChange(field.champ_id, 'valeur', v, field.section)}
              disabled={!canWrite}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="— Sélectionner —" />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === 'textarea' && (
            <Textarea
              id={field.champ_id}
              value={val}
              onChange={e => handleChange(field.champ_id, 'valeur', e.target.value, field.section)}
              disabled={!canWrite}
              rows={2}
              className="text-sm"
            />
          )}

          {field.type === 'text' && (
            <Input
              id={field.champ_id}
              value={val}
              onChange={e => handleChange(field.champ_id, 'valeur', e.target.value, field.section)}
              disabled={!canWrite}
              className="h-8 text-sm"
            />
          )}

          {(field.type === 'number' || field.type === 'percentage' || field.type === 'euros') && (
            <div className="relative">
              <Input
                id={field.champ_id}
                type="number"
                value={val}
                onChange={e => handleChange(field.champ_id, 'valeur', e.target.value, field.section)}
                disabled={!canWrite}
                className="h-8 text-sm pr-10"
              />
              {field.type === 'percentage' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              )}
              {field.type === 'euros' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              )}
            </div>
          )}
        </div>

        {field.has_evaluation_risque && (
          <div className="mt-1">
            <Label className="text-xs text-muted-foreground">Évaluation des risques</Label>
            <Select
              value={evalVal}
              onValueChange={v => handleChange(field.champ_id, 'valeur_evaluation', v, field.section)}
              disabled={!canWrite}
            >
              <SelectTrigger className="h-7 text-xs mt-0.5">
                <SelectValue placeholder="— Risque —" />
              </SelectTrigger>
              <SelectContent>
                {OPTIONS_EVALUATION_RISQUE.map(opt => (
                  <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (canonicalGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <p className="text-sm">Aucun champ défini pour ce pilier.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!canWrite && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>Vous avez un accès en lecture seule sur ce pilier.</span>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <Accordion type="multiple" defaultValue={[]} className="space-y-2">
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {orderedGroups.map(({ section, fields: sectionFields }) => {
              const isDirty = dirtySection.has(section);
              const filledCount = sectionFields.filter(f => localAnswers[f.champ_id]?.valeur).length;
              const sousSections = [...new Set(sectionFields.map(f => f.sous_section || ''))];

              return (
                <SortableQuestionnaireSection
                  key={section}
                  section={section}
                  draggable={canWrite}
                  triggerSummary={
                    <>
                      <span className="font-semibold text-sm text-left flex-1 min-w-0">{section}</span>
                      <Badge
                        variant={
                          filledCount === sectionFields.length ? 'default' : filledCount > 0 ? 'secondary' : 'outline'
                        }
                        className="text-xs shrink-0 ml-auto mr-2"
                      >
                        {filledCount} / {sectionFields.length}
                      </Badge>
                      {isDirty && (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          Non sauvegardé
                        </Badge>
                      )}
                    </>
                  }
                >
                  <AccordionContent className="px-4 pb-4">
                    {sousSections.map(ss => {
                      const ssFields = sectionFields.filter(f => (f.sous_section || '') === ss);
                      return (
                        <div key={ss || 'default'} className="mb-4">
                          {ss && (
                            <div className="flex items-center justify-between mb-3 border-b pb-1">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {ss}
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => setAddFieldCtx({ section, sousSection: ss })}
                              >
                                <Plus className="h-3 w-3" />
                                Ajouter un champ
                              </Button>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {ssFields.map(f => renderField(f))}
                          </div>
                        </div>
                      );
                    })}

                    {sousSections.length === 1 && sousSections[0] === '' && (
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setAddFieldCtx({ section })}
                        >
                          <Plus className="h-3 w-3" />
                          Ajouter un champ à cette section
                        </Button>
                      </div>
                    )}

                    {canWrite && (
                      <div className="flex justify-end mt-4 pt-3 border-t">
                        <Button
                          size="sm"
                          onClick={() => handleSave(section, sectionFields)}
                          disabled={isSaving || !isDirty}
                          className="gap-2"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {isSaving ? 'Sauvegarde…' : 'Sauvegarder la section'}
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </SortableQuestionnaireSection>
              );
            })}
          </SortableContext>
        </Accordion>
      </DndContext>

      {addFieldCtx && (
        <AddCustomFieldDialog
          open={true}
          onClose={() => setAddFieldCtx(null)}
          pilierCode={pilierCode}
          section={addFieldCtx.section}
          sousSection={addFieldCtx.sousSection}
        />
      )}
    </div>
  );
}
