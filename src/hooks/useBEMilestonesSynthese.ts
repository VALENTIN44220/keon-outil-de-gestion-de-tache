/**
 * useBEMilestonesSynthese — vue synthèse cross-projets des jalons (BUG-00019).
 *
 * Assemble, pour tous les projets BE, une matrice projet × type de jalon :
 *   - types de jalons = référentiel `be_milestone_types`
 *   - dates = `be_project_milestones` (par type_code : date réelle sinon prévue)
 *   - fusion avec les 4 dates natives de `be_projects`
 *     (os_etude / os_travaux / cloture_bancaire / cloture_juridique)
 *
 * Ainsi CHAQUE projet apparaît, même sans jalon saisi (« dans tous les cas »).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MilestoneType {
  code: string;
  label: string;
  category: 'reglementaire' | 'projet' | string;
  ordre: number;
}

export interface MilestoneCell {
  date: string;        // yyyy-mm-dd
  prevu: boolean;      // true = date prévue seulement (pas de date réelle)
}

export interface MilestoneSyntheseRow {
  project_id: string;
  code_projet: string | null;
  nom_projet: string | null;
  status: string | null;
  cells: Record<string, MilestoneCell | undefined>; // type_code -> cell
}

/** Colonnes natives be_projects → type_code du référentiel. */
const NATIVE_DATE_MAP: Record<string, string> = {
  date_os_etude: 'os_etude',
  date_os_travaux: 'os_travaux',
  date_cloture_bancaire: 'cloture_bancaire',
  date_cloture_juridique: 'cloture_juridique',
};

export function useBEMilestonesSynthese() {
  return useQuery({
    queryKey: ['be-milestones-synthese'],
    queryFn: async () => {
      const [typesRes, projectsRes, milestonesRes] = await Promise.all([
        supabase.from('be_milestone_types' as any)
          .select('code, label, category, ordre')
          .eq('is_active', true)
          .order('ordre'),
        supabase.from('be_projects')
          .select('id, code_projet, nom_projet, status, date_os_etude, date_os_travaux, date_cloture_bancaire, date_cloture_juridique')
          .order('code_projet'),
        supabase.from('be_project_milestones' as any)
          .select('be_project_id, type_code, date_prevue, date_reelle'),
      ]);
      if (typesRes.error) throw typesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (milestonesRes.error) throw milestonesRes.error;

      const types = (typesRes.data ?? []) as MilestoneType[];

      // Index des jalons saisis par (projet, type).
      const byProjectType = new Map<string, MilestoneCell>();
      for (const m of (milestonesRes.data ?? []) as any[]) {
        if (!m.type_code) continue;
        const date = m.date_reelle ?? m.date_prevue;
        if (!date) continue;
        const key = `${m.be_project_id}::${m.type_code}`;
        // La date réelle prime ; ne pas écraser une réelle par une prévue.
        const prev = byProjectType.get(key);
        const prevu = !m.date_reelle;
        if (!prev || (prev.prevu && !prevu)) {
          byProjectType.set(key, { date: String(date).slice(0, 10), prevu });
        }
      }

      const rows: MilestoneSyntheseRow[] = (projectsRes.data ?? []).map((p: any) => {
        const cells: Record<string, MilestoneCell | undefined> = {};
        // 1) dates natives be_projects (considérées comme réelles)
        for (const [col, code] of Object.entries(NATIVE_DATE_MAP)) {
          if (p[col]) cells[code] = { date: String(p[col]).slice(0, 10), prevu: false };
        }
        // 2) jalons saisis (priment sur les dates natives si présents)
        for (const t of types) {
          const m = byProjectType.get(`${p.id}::${t.code}`);
          if (m) cells[t.code] = m;
        }
        return {
          project_id: p.id,
          code_projet: p.code_projet,
          nom_projet: p.nom_projet,
          status: p.status,
          cells,
        };
      });

      return { types, rows };
    },
    staleTime: 30_000,
  });
}
