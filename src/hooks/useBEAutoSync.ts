/**
 * useBEAutoSync — synchronise automatiquement les affaires BE depuis
 * divalto_mouvements_all au montage (max 1x/30 min, throttle localStorage).
 *
 * La sync est déléguée à la fonction SQL sync_be_affaires_from_divalto() qui :
 *  - insère les be_projects manquants (fiche minimale)
 *  - insère les be_affaires manquantes (source_creation = 'import')
 * Critères : code_affaire débutant par A ou E, suffixe dans la liste métier BE.
 *
 * Utilisation :
 *   const { resync } = useBEAutoSync();   // dans un composant monté en permanence
 *   <button onClick={() => resync()}>Rafraîchir</button>
 */
import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

const LS_KEY = 'be_auto_sync_last_run';
const THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

export function useBEAutoSync() {
  const qc = useQueryClient();
  const running = useRef(false);

  const runSync = useCallback(
    async (force = false) => {
      if (running.current) return;

      if (!force) {
        const last = Number(localStorage.getItem(LS_KEY) ?? 0);
        if (Date.now() - last < THROTTLE_MS) return;
      }

      running.current = true;
      try {
        const { data, error } = await sb.rpc('sync_be_affaires_from_divalto');
        if (error) {
          console.warn('[BEAutoSync]', error.message);
          return;
        }

        localStorage.setItem(LS_KEY, String(Date.now()));

        const { nb_affaires_crees = 0, nb_projets_crees = 0 } = (data ?? {}) as {
          nb_affaires_crees?: number;
          nb_projets_crees?: number;
        };

        if (nb_affaires_crees > 0 || nb_projets_crees > 0) {
          console.info(
            `[BEAutoSync] +${nb_affaires_crees} affaire(s), +${nb_projets_crees} projet(s) créé(s)`,
          );
          qc.invalidateQueries({ queryKey: ['be-affaires'] });
          qc.invalidateQueries({ queryKey: ['be-projects'] });
          qc.invalidateQueries({ queryKey: ['be-divalto-affaires-to-import'] });
        }
      } finally {
        running.current = false;
      }
    },
    [qc],
  );

  // Lance au montage (respecte le throttle)
  useEffect(() => {
    runSync(false);
  }, [runSync]);

  return { resync: () => runSync(true) };
}
