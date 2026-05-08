/**
 * useUserWeekLoad — charge hebdomadaire (heures) par utilisateur, pour la
 * semaine en cours (lundi → dimanche).
 *
 * Utilisé par le BEDispatchView pour afficher dans le sélecteur d'assignation
 * la charge actuelle de chaque candidat (« Xh / 40h »).
 *
 * La capacité standard d'un utilisateur est 8h/jour ouvré × 5 jours = 40h/semaine
 * (cohérent avec le module Workload : `workload_slots.duration_hours = 4` par
 * demi-journée).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek } from 'date-fns';

const sb = supabase as any;

export const WEEK_CAPACITY_HOURS = 40;

export interface UserWeekLoad {
  userId: string;
  hoursBooked: number;
  capacityHours: number;
  /** Pourcentage 0-150 (peut dépasser 100 si surchargé). */
  percent: number;
}

/**
 * @param userIds liste d'utilisateurs à interroger ; peut être vide (la query
 * est désactivée le cas échéant).
 * @param refDate date de référence pour calculer la semaine (défaut: today).
 */
export function useUserWeekLoad(userIds: string[], refDate?: Date) {
  const today = refDate ?? new Date();
  const ws = startOfWeek(today, { weekStartsOn: 1 });
  const we = endOfWeek(today, { weekStartsOn: 1 });
  const wsStr = format(ws, 'yyyy-MM-dd');
  const weStr = format(we, 'yyyy-MM-dd');

  const usersKey = useMemo(() => [...userIds].sort().join(','), [userIds]);

  const query = useQuery({
    queryKey: ['user-week-load', wsStr, weStr, usersKey],
    queryFn: async (): Promise<Map<string, UserWeekLoad>> => {
      const map = new Map<string, UserWeekLoad>();
      if (userIds.length === 0) return map;

      const { data, error } = await sb
        .from('workload_slots')
        .select('user_id, duration_hours')
        .in('user_id', userIds)
        .gte('date', wsStr)
        .lte('date', weStr);

      if (error) {
        console.error('[useUserWeekLoad] query error', error);
      }

      // Initialise tous les users à 0
      for (const id of userIds) {
        map.set(id, {
          userId: id,
          hoursBooked: 0,
          capacityHours: WEEK_CAPACITY_HOURS,
          percent: 0,
        });
      }

      // Agrège
      for (const row of (data ?? []) as { user_id: string; duration_hours: number | null }[]) {
        const cur = map.get(row.user_id);
        if (!cur) continue;
        cur.hoursBooked += Number(row.duration_hours ?? 4);
        cur.percent = Math.round((cur.hoursBooked / cur.capacityHours) * 100);
      }
      return map;
    },
    enabled: userIds.length > 0,
    staleTime: 30_000,
  });

  return {
    loadByUser: query.data ?? new Map<string, UserWeekLoad>(),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
