import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface BEDivaltoAffaireToImport {
  code_affaire: string;
  libelle_principal: string | null;
  nb_pieces: number;
  montant_total: number;
  premier_mouvement: string | null;
  dernier_mouvement: string | null;
  /** 1er char du code_affaire (A, E, ...). Sert de filtre "categorie metier". */
  categorie: string;
  /** Chars 2-5 = code projet attendu (ex: AVINZETD -> VINZ). NULL si code_affaire trop court. */
  code_projet_parent: string | null;
  /** True si be_projects contient deja le code_projet_parent. */
  parent_project_exists: boolean;
}

/**
 * Liste les codes_affaire presents dans Divalto (be_divalto_mouvements)
 * mais pas encore dans be_affaires.
 */
export function useBEDivaltoAffairesToImport() {
  return useQuery({
    queryKey: ['be-divalto-affaires-to-import'],
    queryFn: async (): Promise<BEDivaltoAffaireToImport[]> => {
      const { data, error } = await sb
        .from('v_be_divalto_affaires_to_import')
        .select('*');
      if (error) throw error;
      return (data as BEDivaltoAffaireToImport[]) ?? [];
    },
    staleTime: 60_000,
  });
}

interface ImportInput {
  /** Codes_affaire selectionnes par l'utilisateur. */
  codes: string[];
  /** Map code_affaire -> libelle (libelle_principal Divalto), pour pre-remplir. */
  libelleByCode: Record<string, string | null>;
  /** Map code_affaire -> code_projet attendu (chars 2-5). */
  codeProjetByAffaire: Record<string, string | null>;
}

interface ImportResult {
  imported: string[];
  skippedNoProject: string[];
  errors: { code: string; message: string }[];
}

/**
 * Importe en masse les affaires selectionnees.
 * - Skip celles dont le projet parent n'existe pas dans be_projects.
 * - Cree les be_affaires avec source_creation = 'import' et statut 'ouverte'.
 */
export function useImportBEDivaltoAffaires() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportInput): Promise<ImportResult> => {
      const result: ImportResult = { imported: [], skippedNoProject: [], errors: [] };
      if (input.codes.length === 0) return result;

      // 1. Resoudre id des projets parents
      const projetCodes = Array.from(
        new Set(
          input.codes
            .map((c) => input.codeProjetByAffaire[c])
            .filter((c): c is string => !!c),
        ),
      );

      const { data: projects, error: projErr } = await sb
        .from('be_projects')
        .select('id, code_projet')
        .in('code_projet', projetCodes);
      if (projErr) throw projErr;

      const projetIdByCode = new Map<string, string>();
      for (const p of (projects ?? []) as { id: string; code_projet: string }[]) {
        projetIdByCode.set(p.code_projet.toUpperCase(), p.id);
      }

      // 2. Construire les rows a inserer (skip si pas de projet parent)
      const rows: any[] = [];
      for (const code of input.codes) {
        const codeProjet = input.codeProjetByAffaire[code];
        const beProjectId = codeProjet ? projetIdByCode.get(codeProjet.toUpperCase()) : undefined;
        if (!beProjectId) {
          result.skippedNoProject.push(code);
          continue;
        }
        rows.push({
          be_project_id: beProjectId,
          code_affaire: code,
          libelle: input.libelleByCode[code] ?? null,
          status: 'ouverte',
          source_creation: 'import',
        });
      }

      if (rows.length === 0) return result;

      // 3. Insert (gere conflits sur code_affaire UNIQUE par doublon eventuel)
      const { data: inserted, error: insErr } = await sb
        .from('be_affaires')
        .insert(rows)
        .select('code_affaire');
      if (insErr) {
        // En cas d'erreur globale, on remonte tout
        throw insErr;
      }
      result.imported = (inserted ?? []).map((r: any) => r.code_affaire as string);

      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-divalto-affaires-to-import'] });
      qc.invalidateQueries({ queryKey: ['be-affaires'] });
    },
  });
}
