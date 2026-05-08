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
        .select('*')
        .limit(10000);
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

export interface ImportResult {
  imported: string[];
  /** Projets BE auto-créés à la volée (fiche minimale à compléter). */
  createdProjects: string[];
  /** Codes d'affaire sans code projet extractible (code_affaire trop court). */
  skippedNoCode: string[];
  errors: { code: string; message: string }[];
}

/**
 * Importe en masse les affaires selectionnees.
 *
 * Si le projet parent (chars 2-5 du code) n'existe pas encore dans be_projects,
 * il est AUTO-CRÉÉ avec une fiche minimale (code_projet + nom provisoire).
 * L'utilisateur pourra compléter la fiche depuis la liste BE.
 *
 * Seules les affaires dont le code est trop court pour extraire un code projet
 * sont réellement skippées.
 */
export function useImportBEDivaltoAffaires() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportInput): Promise<ImportResult> => {
      const result: ImportResult = {
        imported: [],
        createdProjects: [],
        skippedNoCode: [],
        errors: [],
      };
      if (input.codes.length === 0) return result;

      // 1. Collecter les codes projets attendus
      const projetCodes = Array.from(
        new Set(
          input.codes
            .map((c) => input.codeProjetByAffaire[c])
            .filter((c): c is string => !!c),
        ),
      );

      // 2. Résoudre les projets existants
      const { data: existingProjects, error: projErr } = await sb
        .from('be_projects')
        .select('id, code_projet')
        .in('code_projet', projetCodes);
      if (projErr) throw projErr;

      const projetIdByCode = new Map<string, string>();
      for (const p of (existingProjects ?? []) as { id: string; code_projet: string }[]) {
        projetIdByCode.set(p.code_projet.toUpperCase(), p.id);
      }

      // 3. Auto-créer les projets manquants (fiche minimale, à compléter)
      const missingProjetCodes = projetCodes.filter(
        (c) => !projetIdByCode.has(c.toUpperCase()),
      );

      if (missingProjetCodes.length > 0) {
        const newProjectRows = missingProjetCodes.map((cp) => ({
          code_projet: cp.toUpperCase(),
          // Nom provisoire : l'utilisateur le complètera depuis la liste BE
          nom_projet: `[À compléter] ${cp.toUpperCase()}`,
          status: 'active',
        }));

        const { data: created, error: createErr } = await sb
          .from('be_projects')
          .insert(newProjectRows)
          .select('id, code_projet');

        if (createErr) throw createErr;

        for (const p of (created ?? []) as { id: string; code_projet: string }[]) {
          projetIdByCode.set(p.code_projet.toUpperCase(), p.id);
          result.createdProjects.push(p.code_projet);
        }
      }

      // 4. Construire les rows be_affaires
      const rows: any[] = [];
      for (const code of input.codes) {
        const codeProjet = input.codeProjetByAffaire[code];
        if (!codeProjet) {
          // Code affaire trop court pour extraire un code projet
          result.skippedNoCode.push(code);
          continue;
        }
        const beProjectId = projetIdByCode.get(codeProjet.toUpperCase());
        if (!beProjectId) {
          // Ne devrait pas arriver après l'auto-création, mais sécurité
          result.skippedNoCode.push(code);
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

      // 5. Insert be_affaires
      const { data: inserted, error: insErr } = await sb
        .from('be_affaires')
        .insert(rows)
        .select('code_affaire');
      if (insErr) throw insErr;

      result.imported = (inserted ?? []).map((r: any) => r.code_affaire as string);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-divalto-affaires-to-import'] });
      qc.invalidateQueries({ queryKey: ['be-affaires'] });
      qc.invalidateQueries({ queryKey: ['be-projects'] });
    },
  });
}
