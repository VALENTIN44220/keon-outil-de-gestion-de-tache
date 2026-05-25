import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BEAffairePiece } from '@/types/beAffaire';

const sb = supabase as any;

/** Toutes les pièces Divalto rattachées à une affaire BE (par code_affaire). */
export function useBEAffairePieces(codeAffaire: string | null | undefined) {
  return useQuery({
    queryKey: ['be-affaire-pieces', codeAffaire],
    enabled: !!codeAffaire,
    queryFn: async (): Promise<BEAffairePiece[]> => {
      const { data, error } = await sb
        .from('divalto_mouvements_all')
        .select('doc_type, numero_piece, prefix, tiers_code, nom_tiers, montant_ht, date_piece, libelle, libelle_entete, fullcdno_lie')
        .eq('code_affaire', codeAffaire)
        .order('date_piece', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BEAffairePiece[];
    },
  });
}

// ── Table be_piece_periode (affectation période prévisionnelle) ──────────────

export interface BEPiecePeriode {
  id: string;
  code_affaire: string;
  numero_piece: string;
  doc_type: string;
  date_prevue: string | null;
  date_prevue_fin: string | null;
  note: string | null;
  created_at: string;
}

export function useBEPiecePeriodes(codeAffaire: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['be-piece-periodes', codeAffaire],
    enabled: !!codeAffaire,
    queryFn: async (): Promise<BEPiecePeriode[]> => {
      const { data, error } = await sb
        .from('be_piece_periode')
        .select('*')
        .eq('code_affaire', codeAffaire);
      if (error) throw error;
      return (data ?? []) as BEPiecePeriode[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: {
      code_affaire: string;
      numero_piece: string;
      doc_type: string;
      date_prevue?: string | null;
      date_prevue_fin?: string | null;
      note?: string | null;
    }) => {
      const { error } = await sb
        .from('be_piece_periode')
        .upsert(input, { onConflict: 'code_affaire,numero_piece' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['be-piece-periodes', codeAffaire] }),
  });

  const remove = useMutation({
    mutationFn: async ({ code_affaire, numero_piece }: { code_affaire: string; numero_piece: string }) => {
      const { error } = await sb
        .from('be_piece_periode')
        .delete()
        .eq('code_affaire', code_affaire)
        .eq('numero_piece', numero_piece);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['be-piece-periodes', codeAffaire] }),
  });

  return { ...query, periodes: query.data ?? [], upsert, remove };
}
