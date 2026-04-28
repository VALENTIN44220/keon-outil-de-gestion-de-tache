import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { groupBEMouvementsByPiece } from '@/hooks/useBEDivaltoMouvements';
import type {
  BEDivaltoMouvement,
  BEDivaltoMouvementGrouped,
  BEDivaltoTypeMouv,
} from '@/types/beAffaire';

const sb = supabase as any;

interface BudgetLineLien {
  id: string;
  budget_line_id: string;
  numero_piece: string;
  created_at: string;
}

const COMMANDES_TYPES: BEDivaltoTypeMouv[] = ['CCN', 'CFK'];
const FACTURES_TYPES: BEDivaltoTypeMouv[] = ['FCN', 'FFK'];

/**
 * Rapprochement d'une ligne budget BE avec les pieces Divalto :
 *   - commandes : CCN / CFK
 *   - factures  : FCN / FFK
 * Filtrage des candidats restreint au code_affaire de l'affaire parente.
 *
 * Adapte de useITBudgetRapprochement (les tables BE n'utilisent qu'une seule
 * table miroir `be_divalto_mouvements` discriminee par `type_mouv`).
 */
export function useBEBudgetRapprochement(
  budgetLineId: string | null,
  codeAffaire: string | null,
) {
  const qc = useQueryClient();

  // ── Liens commandes (lignes brutes en base) ───────────────────────────────
  const commandesLiensQuery = useQuery({
    queryKey: ['be-budget-commandes-liens', budgetLineId],
    queryFn: async (): Promise<BudgetLineLien[]> => {
      if (!budgetLineId) return [];
      const { data, error } = await sb
        .from('be_budget_line_commandes')
        .select('id, budget_line_id, numero_piece, created_at')
        .eq('budget_line_id', budgetLineId);
      if (error) throw error;
      return (data ?? []) as BudgetLineLien[];
    },
    enabled: !!budgetLineId,
  });

  // ── Donnees Divalto pour les commandes liees (resolution batch) ──────────
  const commandesLiensCount = commandesLiensQuery.data?.length ?? 0;
  const commandesQuery = useQuery({
    queryKey: ['be-budget-commandes-data', budgetLineId, commandesLiensCount],
    queryFn: async (): Promise<BEDivaltoMouvementGrouped[]> => {
      const liens = commandesLiensQuery.data ?? [];
      const refs = Array.from(new Set(liens.map(l => l.numero_piece).filter(Boolean)));
      if (refs.length === 0) return [];
      const { data, error } = await sb
        .from('be_divalto_mouvements')
        .select('*')
        .in('numero_piece', refs)
        .in('type_mouv', COMMANDES_TYPES);
      if (error) throw error;
      return groupBEMouvementsByPiece((data ?? []) as BEDivaltoMouvement[]);
    },
    enabled: !!budgetLineId && commandesLiensCount > 0,
  });

  // ── Liens factures ────────────────────────────────────────────────────────
  const facturesLiensQuery = useQuery({
    queryKey: ['be-budget-factures-liens', budgetLineId],
    queryFn: async (): Promise<BudgetLineLien[]> => {
      if (!budgetLineId) return [];
      const { data, error } = await sb
        .from('be_budget_line_factures')
        .select('id, budget_line_id, numero_piece, created_at')
        .eq('budget_line_id', budgetLineId);
      if (error) throw error;
      return (data ?? []) as BudgetLineLien[];
    },
    enabled: !!budgetLineId,
  });

  const facturesLiensCount = facturesLiensQuery.data?.length ?? 0;
  const facturesQuery = useQuery({
    queryKey: ['be-budget-factures-data', budgetLineId, facturesLiensCount],
    queryFn: async (): Promise<BEDivaltoMouvementGrouped[]> => {
      const liens = facturesLiensQuery.data ?? [];
      const refs = Array.from(new Set(liens.map(l => l.numero_piece).filter(Boolean)));
      if (refs.length === 0) return [];
      const { data, error } = await sb
        .from('be_divalto_mouvements')
        .select('*')
        .in('numero_piece', refs)
        .in('type_mouv', FACTURES_TYPES);
      if (error) throw error;
      return groupBEMouvementsByPiece((data ?? []) as BEDivaltoMouvement[]);
    },
    enabled: !!budgetLineId && facturesLiensCount > 0,
  });

  // ── Recherche pour le dialog de rapprochement ────────────────────────────
  const searchPieces = async (
    typesMouv: BEDivaltoTypeMouv[],
    query: string,
  ): Promise<BEDivaltoMouvementGrouped[]> => {
    if (!codeAffaire) return [];
    let q = sb
      .from('be_divalto_mouvements')
      .select('*')
      .eq('code_affaire', codeAffaire)
      .in('type_mouv', typesMouv)
      .order('date_piece', { ascending: false })
      .limit(200);
    if (query.trim()) {
      const term = query.trim();
      q = q.or(
        `numero_piece.ilike.%${term}%,libelle.ilike.%${term}%,nom_tiers.ilike.%${term}%`,
      );
    }
    const { data, error } = await q;
    if (error) throw error;
    return groupBEMouvementsByPiece((data ?? []) as BEDivaltoMouvement[]).slice(0, 50);
  };

  const searchCommandes = (query: string) => searchPieces(COMMANDES_TYPES, query);
  const searchFactures = (query: string) => searchPieces(FACTURES_TYPES, query);

  // ── Mutations link/unlink ────────────────────────────────────────────────
  const lierCommande = useMutation({
    mutationFn: async (numero_piece: string) => {
      if (!budgetLineId) throw new Error('budget_line_id manquant');
      const { error } = await sb
        .from('be_budget_line_commandes')
        .insert({ budget_line_id: budgetLineId, numero_piece });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-budget-commandes-liens', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['be-affaire-budget-kpi-raw'] });
      qc.invalidateQueries({ queryKey: ['be-affaires-kpis'] });
    },
  });

  const delierCommande = useMutation({
    mutationFn: async (lienId: string) => {
      const { error } = await sb.from('be_budget_line_commandes').delete().eq('id', lienId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-budget-commandes-liens', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['be-affaire-budget-kpi-raw'] });
      qc.invalidateQueries({ queryKey: ['be-affaires-kpis'] });
    },
  });

  const lierFacture = useMutation({
    mutationFn: async (numero_piece: string) => {
      if (!budgetLineId) throw new Error('budget_line_id manquant');
      const { error } = await sb
        .from('be_budget_line_factures')
        .insert({ budget_line_id: budgetLineId, numero_piece });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-budget-factures-liens', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['be-affaire-budget-kpi-raw'] });
      qc.invalidateQueries({ queryKey: ['be-affaires-kpis'] });
    },
  });

  const delierFacture = useMutation({
    mutationFn: async (lienId: string) => {
      const { error } = await sb.from('be_budget_line_factures').delete().eq('id', lienId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['be-budget-factures-liens', budgetLineId] });
      qc.invalidateQueries({ queryKey: ['be-affaire-budget-kpi-raw'] });
      qc.invalidateQueries({ queryKey: ['be-affaires-kpis'] });
    },
  });

  // ── Aggregats locaux ─────────────────────────────────────────────────────
  const commandes = commandesQuery.data ?? [];
  const factures = facturesQuery.data ?? [];

  const commandeLienByPiece = useMemo(() => {
    const m = new Map<string, BudgetLineLien>();
    for (const l of commandesLiensQuery.data ?? []) m.set(l.numero_piece, l);
    return m;
  }, [commandesLiensQuery.data]);

  const factureLienByPiece = useMemo(() => {
    const m = new Map<string, BudgetLineLien>();
    for (const l of facturesLiensQuery.data ?? []) m.set(l.numero_piece, l);
    return m;
  }, [facturesLiensQuery.data]);

  const engage = commandes.reduce((s, p) => s + (p.montant_ht ?? 0), 0);
  const constate = factures.reduce((s, p) => s + (p.montant_ht ?? 0), 0);

  return {
    commandesLiees: commandes,
    facturesLiees: factures,
    commandeLienByPiece,
    factureLienByPiece,
    isLoading:
      commandesLiensQuery.isLoading ||
      facturesLiensQuery.isLoading ||
      commandesQuery.isLoading ||
      facturesQuery.isLoading,
    searchCommandes,
    searchFactures,
    searchPieces,
    lierCommande,
    delierCommande,
    lierFacture,
    delierFacture,
    engage,
    constate,
  };
}
