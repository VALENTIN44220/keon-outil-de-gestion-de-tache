import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BEAffaireStatus } from '@/types/beAffaire';

const sb = supabase as any;

export type BETimelineEventType =
  | 'demarrage'
  | 'CCN'
  | 'CFN'
  | 'FCN'
  | 'FFN'
  | 'temps_mois';

export interface BETimelineEvent {
  id: string;
  affaire_id: string;
  type: BETimelineEventType;
  date: string; // ISO yyyy-MM-dd
  label: string;
  numero_piece?: string;
  montant_ht?: number | null;
  jours?: number;
  heures?: number;
  tiers?: string | null;
}

export interface BEAffaireTimelineRow {
  affaire_id: string;
  code_affaire: string;
  libelle: string | null;
  status: BEAffaireStatus;
  date_demarrage: string | null;
  events: BETimelineEvent[];
  /** Total CA constate sur l'affaire (pour priorisation visuelle). */
  total_ca: number;
  total_jours: number;
}

interface AffaireRow {
  id: string;
  code_affaire: string;
  libelle: string | null;
  status: BEAffaireStatus;
  date_ouverture: string | null;
}

interface MouvRow {
  code_affaire: string | null;
  type_mouv: 'CCN' | 'CFN' | 'FCN' | 'FFN';
  numero_piece: string;
  date_piece: string | null;
  montant_ht: number | null;
  nom_tiers: string | null;
}

interface SaisieRow {
  code_site: string;
  date_saisie: string;
  duree_heures: number;
}

/**
 * Pour un projet BE : retourne 1 row par affaire avec tous ses evenements
 * chronologiques (demarrage, CCN/CFN/FCN/FFN, temps Lucca agrege par mois).
 */
export function useBEProjectTimelineEvents(projectId: string | undefined) {
  return useQuery({
    queryKey: ['be-project-timeline-events', projectId],
    queryFn: async (): Promise<BEAffaireTimelineRow[]> => {
      if (!projectId) return [];

      // 1. Affaires du projet
      const { data: affairesData, error: affErr } = await sb
        .from('be_affaires')
        .select('id,code_affaire,libelle,status,date_ouverture')
        .eq('be_project_id', projectId);
      if (affErr) throw affErr;
      const affaires = (affairesData ?? []) as AffaireRow[];
      if (affaires.length === 0) return [];

      const codes = affaires.map((a) => a.code_affaire);

      // 2. Mouvements Divalto (CCN/CFN/FCN/FFN) avec date renseignee
      const { data: mvData, error: mvErr } = await sb
        .from('be_divalto_mouvements')
        .select('code_affaire,type_mouv,numero_piece,date_piece,montant_ht,nom_tiers')
        .in('code_affaire', codes)
        .in('type_mouv', ['CCN', 'CFN', 'FCN', 'FFN'])
        .not('date_piece', 'is', null);
      if (mvErr) throw mvErr;
      const mouvs = (mvData ?? []) as MouvRow[];

      // 3. Saisies temps Lucca (regroupees plus tard par mois)
      const { data: stData, error: stErr } = await sb
        .from('lucca_saisie_temps')
        .select('code_site,date_saisie,duree_heures')
        .in('code_site', codes);
      if (stErr) throw stErr;
      const saisies = (stData ?? []) as SaisieRow[];

      // 4. Construction des rows
      return affaires.map((a) => {
        const events: BETimelineEvent[] = [];

        // Demarrage
        if (a.date_ouverture) {
          events.push({
            id: `dem-${a.id}`,
            affaire_id: a.id,
            type: 'demarrage',
            date: a.date_ouverture,
            label: 'Démarrage',
          });
        }

        // Mouvements Divalto
        let totalCa = 0;
        for (const m of mouvs.filter((x) => x.code_affaire === a.code_affaire)) {
          if (!m.date_piece) continue;
          if (m.type_mouv === 'FCN') totalCa += m.montant_ht ?? 0;
          events.push({
            id: `${m.type_mouv}-${m.numero_piece}`,
            affaire_id: a.id,
            type: m.type_mouv,
            date: m.date_piece.slice(0, 10),
            label: `${m.type_mouv} ${m.numero_piece}`,
            numero_piece: m.numero_piece,
            montant_ht: m.montant_ht,
            tiers: m.nom_tiers,
          });
        }

        // Saisies temps : agregation par mois (1 evt par mois ayant des saisies)
        const parMois = new Map<string, number>();
        for (const t of saisies.filter((x) => x.code_site === a.code_affaire)) {
          if (!t.date_saisie) continue;
          const mois = t.date_saisie.slice(0, 7); // YYYY-MM
          parMois.set(mois, (parMois.get(mois) ?? 0) + (Number(t.duree_heures) || 0));
        }
        let totalJours = 0;
        for (const [mois, heures] of parMois.entries()) {
          const jours = heures / 8;
          totalJours += jours;
          events.push({
            id: `temps-${a.id}-${mois}`,
            affaire_id: a.id,
            type: 'temps_mois',
            // Place le repere au 15 du mois pour etre centre dans la barre mensuelle
            date: `${mois}-15`,
            label: `${jours.toFixed(1)} j (${heures.toFixed(0)} h)`,
            jours,
            heures,
          });
        }

        events.sort((x, y) => x.date.localeCompare(y.date));

        return {
          affaire_id: a.id,
          code_affaire: a.code_affaire,
          libelle: a.libelle,
          status: a.status,
          date_demarrage: a.date_ouverture,
          events,
          total_ca: totalCa,
          total_jours: totalJours,
        };
      });
    },
    enabled: !!projectId,
  });
}
