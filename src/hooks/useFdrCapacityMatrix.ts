import { useMemo } from 'react';
import { computeCapacityMatrix } from '@/lib/fdr/calculationEngine';
import { useFdrProjectInputs } from './useFdrProjectInputs';
import type { FdrCapacityMatrix } from '@/types/fdr';

/**
 * Matrice capacité baseline (sans simulation), recalculée à partir des projets
 * actifs de la feuille de route. Délègue le chargement des inputs à
 * `useFdrProjectInputs` puis applique le moteur pur.
 */
export function useFdrCapacityMatrix() {
  const query = useFdrProjectInputs();

  const data: FdrCapacityMatrix | undefined = useMemo(
    () =>
      query.data
        ? computeCapacityMatrix(query.data.inputs, query.data.engineSettings)
        : undefined,
    [query.data],
  );

  return { ...query, data } as typeof query & { data: FdrCapacityMatrix | undefined };
}
