import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { PilierCode } from '@/config/questionnaireConfig';
import { groupFieldsBySection, type FieldDefinition, type SectionGroup } from '@/hooks/useQuestionnaireFieldDefs';

const STORAGE_PREFIX = 'qst_section_order:v1';

function storageKey(profileId: string, projectId: string, pilierCode: string) {
  return `${STORAGE_PREFIX}:${profileId}:${projectId}:${pilierCode}`;
}

/** Merge a saved preference with the canonical section list (adds new sections at the end). */
export function mergeSectionOrder(preference: string[], canonicalDefault: string[]): string[] {
  const canonSet = new Set(canonicalDefault);
  const result: string[] = [];
  for (const s of preference) {
    if (canonSet.has(s) && !result.includes(s)) result.push(s);
  }
  for (const s of canonicalDefault) {
    if (!result.includes(s)) result.push(s);
  }
  return result;
}

function readStoredOrder(profileId: string | undefined, projectId: string, pilierCode: PilierCode): string[] | null {
  if (!profileId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(profileId, projectId, pilierCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(x => typeof x === 'string')) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

function writeStoredOrder(profileId: string | undefined, projectId: string, pilierCode: PilierCode, order: string[]) {
  if (!profileId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(profileId, projectId, pilierCode), JSON.stringify(order));
  } catch {
    // ignore quota / private mode
  }
}

/** Default grouping + SPV (02) section ordering used before any user preference. */
export function getCanonicalSectionGroups(fieldDefs: FieldDefinition[], pilierCode: PilierCode): SectionGroup[] {
  const base = groupFieldsBySection(fieldDefs);
  if (pilierCode !== '02') return base;

  const desiredOrder = [
    'GENERALITES',
    'TABLE DE CAPI ET CCA',
    'STRUCTURATION JURIDIQUE',
    'GOUVERNANCE',
    'GESTION ADMINISTRATIVE ET FINANCIERE',
    'GESTION DES RESSOURCES HUMAINES',
    "GESTION DE L'IT",
  ];
  const rank = (s: string) => {
    const idx = desiredOrder.indexOf(s);
    return idx === -1 ? Number.POSITIVE_INFINITY : idx;
  };

  return [...base].sort((a, b) => {
    const ra = rank(a.section);
    const rb = rank(b.section);
    if (ra !== rb) return ra - rb;
    return a.section.localeCompare(b.section, 'fr');
  });
}

export function useQuestionnaireSectionOrder(
  profileId: string | undefined,
  projectId: string,
  pilierCode: PilierCode,
  canonicalGroups: SectionGroup[],
) {
  const canonicalOrder = useMemo(() => canonicalGroups.map(g => g.section), [canonicalGroups]);
  const fingerprint = canonicalOrder.join('\n');

  const [order, setOrder] = useState<string[]>(canonicalOrder);

  useEffect(() => {
    if (canonicalOrder.length === 0) return;
    const stored = readStoredOrder(profileId, projectId, pilierCode);
    const merged = mergeSectionOrder(stored ?? [], canonicalOrder);
    setOrder(merged);
  }, [fingerprint, profileId, projectId, pilierCode]);

  const sectionMap = useMemo(() => new Map(canonicalGroups.map(g => [g.section, g])), [canonicalGroups]);

  const orderedGroups = useMemo(() => {
    const list: SectionGroup[] = [];
    for (const s of order) {
      const g = sectionMap.get(s);
      if (g) list.push(g);
    }
    return list;
  }, [order, sectionMap]);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setOrder(prev => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        if (oldIndex < 0 || newIndex < 0) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        writeStoredOrder(profileId, projectId, pilierCode, next);
        return next;
      });
    },
    [profileId, projectId, pilierCode],
  );

  return { orderedGroups, order, onDragEnd };
}
