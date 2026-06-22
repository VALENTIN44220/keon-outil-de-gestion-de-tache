import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { PilierCode } from '@/config/questionnaireConfig';
import { groupFieldsBySection, type FieldDefinition, type SectionGroup } from '@/hooks/useQuestionnaireFieldDefs';
import {
  useReorderSections,
  type SectionRow,
  type SousSectionRow,
} from '@/hooks/useQuestionnaireSections';

/**
 * Groupe enrichi d'un ordre de sous-sections explicite (clé '' = champs sans
 * sous-section). L'ordre vient désormais de la base (questionnaire_sections /
 * questionnaire_sous_sections), partagé par TOUTES les SPV — fini le
 * localStorage par utilisateur/projet.
 */
export interface OrderedSectionGroup extends SectionGroup {
  /** Clés de sous-sections dans l'ordre d'affichage ('' = bucket par défaut). */
  orderedSousSections: string[];
}

/**
 * Construit la liste ordonnée des sections d'un pilier à partir :
 *  - des champs (questionnaire_field_definitions),
 *  - de l'ordre persisté des sections,
 *  - de l'ordre persisté des sous-sections.
 * Inclut les sections vides (présentes en base mais sans champ) afin que
 * l'admin puisse les construire avant d'y ajouter des champs.
 */
export function buildOrderedSectionGroups(
  fieldDefs: FieldDefinition[],
  sectionRows: SectionRow[],
  sousSectionRows: SousSectionRow[],
  pilierCode: PilierCode,
): OrderedSectionGroup[] {
  const base = groupFieldsBySection(fieldDefs);
  const groupBySection = new Map(base.map(g => [g.section, g]));

  const sectionsForPilier = sectionRows.filter(r => r.pilier_code === pilierCode);
  const orderedNames: string[] = sectionsForPilier.map(r => r.section);
  // Sections issues des champs mais absentes de la table d'ordre -> à la fin.
  for (const g of base) {
    if (!orderedNames.includes(g.section)) orderedNames.push(g.section);
  }

  const sousRank = new Map<string, number>();
  for (const r of sousSectionRows) {
    if (r.pilier_code === pilierCode) sousRank.set(`${r.section}␟${r.sous_section}`, r.order_index);
  }

  return orderedNames.map(section => {
    const g = groupBySection.get(section);
    const fields = g?.fields ?? [];

    // Sous-sections : union (ordre persisté) + (issues des champs), '' en tête si présent.
    const named = new Set<string>();
    sousSectionRows
      .filter(r => r.pilier_code === pilierCode && r.section === section)
      .sort((a, b) => a.order_index - b.order_index)
      .forEach(r => named.add(r.sous_section));
    // Ajoute les sous-sections vues dans les champs mais pas encore en base.
    fields.forEach(f => { if (f.sous_section) named.add(f.sous_section); });

    const orderedNamed = [...named].sort((a, b) => {
      const ra = sousRank.get(`${section}␟${a}`) ?? Number.POSITIVE_INFINITY;
      const rb = sousRank.get(`${section}␟${b}`) ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b, 'fr');
    });

    const hasDefaultBucket = fields.some(f => !f.sous_section);
    const orderedSousSections = hasDefaultBucket ? ['', ...orderedNamed] : orderedNamed;

    return {
      section,
      sousSections: orderedNamed,
      orderedSousSections,
      fields,
    };
  });
}

/**
 * Gère l'ordre des sections avec drag-drop persisté en base (ordre global).
 * Le réordonnancement n'est actif que si `canReorder` (permission
 * can_manage_questionnaire / admin). Les autres utilisateurs lisent l'ordre.
 */
export function useDbSectionOrder(
  pilierCode: PilierCode,
  orderedGroups: OrderedSectionGroup[],
  sectionRows: SectionRow[],
  canReorder: boolean,
) {
  const reorder = useReorderSections();
  const canonicalOrder = useMemo(() => orderedGroups.map(g => g.section), [orderedGroups]);
  const fingerprint = canonicalOrder.join('\n');

  const [order, setOrder] = useState<string[]>(canonicalOrder);
  useEffect(() => { setOrder(canonicalOrder); }, [fingerprint]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowIdBySection = useMemo(() => {
    const m = new Map<string, string>();
    sectionRows.filter(r => r.pilier_code === pilierCode).forEach(r => m.set(r.section, r.id));
    return m;
  }, [sectionRows, pilierCode]);

  const groupMap = useMemo(() => new Map(orderedGroups.map(g => [g.section, g])), [orderedGroups]);
  const displayGroups = useMemo(
    () => order.map(s => groupMap.get(s)).filter(Boolean) as OrderedSectionGroup[],
    [order, groupMap],
  );

  const onDragEnd = useCallback((event: DragEndEvent) => {
    if (!canReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      const items = next
        .map((sec, i) => ({ id: rowIdBySection.get(sec), order_index: (i + 1) * 10 }))
        .filter((x): x is { id: string; order_index: number } => Boolean(x.id));
      if (items.length) reorder.mutate(items);
      return next;
    });
  }, [canReorder, rowIdBySection, reorder]);

  return { orderedGroups: displayGroups, order, onDragEnd };
}
