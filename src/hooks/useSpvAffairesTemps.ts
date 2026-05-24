import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface SpvAffaireTempsKpi {
  code_affaire: string;
  heures_declarees: number;
  jours_declares: number;
  cout_rh_declare: number;
  nb_collaborateurs: number;
  premiere_saisie: string | null;
  derniere_saisie: string | null;
}

export interface SpvAffaireTempsUser {
  code_affaire: string;
  user_id: string | null;
  display_name: string | null;
  job_title: string | null;
  taux_horaire: number;
  heures: number;
  jours: number;
  cout_rh: number;
}

/**
 * Suivi des temps SPV — affaires dont le code commence par 'M'.
 * Source : vues v_spv_affaire_temps_kpi / v_spv_affaire_temps_par_user
 * (alimentées par lucca_saisie_temps, tous salariés confondus).
 */
export function useSpvAffairesTemps() {
  return useQuery({
    queryKey: ['spv-affaires-temps-kpi'],
    queryFn: async (): Promise<SpvAffaireTempsKpi[]> => {
      const { data, error } = await sb
        .from('v_spv_affaire_temps_kpi')
        .select('*')
        .order('heures_declarees', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpvAffaireTempsKpi[];
    },
  });
}

/** Détail par collaborateur pour une affaire M donnée. */
export function useSpvAffaireTempsByUser(codeAffaire: string | null) {
  return useQuery({
    queryKey: ['spv-affaire-temps-user', codeAffaire],
    enabled: !!codeAffaire,
    queryFn: async (): Promise<SpvAffaireTempsUser[]> => {
      const { data, error } = await sb
        .from('v_spv_affaire_temps_par_user')
        .select('*')
        .eq('code_affaire', codeAffaire)
        .order('heures', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpvAffaireTempsUser[];
    },
  });
}

// ── Budget SPV : KPI CA/COGS/marges + lignes de budget ──────────────────────

export interface SpvAffaireBudgetKpi {
  spv_affaire_id: string;
  code_affaire: string;
  affaire_libelle: string | null;
  affaire_status: string;
  ca_engage_brut: number;
  ca_constate_brut: number;
  cogs_engage_brut: number;
  cogs_constate_brut: number;
  devis_client_brut: number;
  devis_fournisseur_brut: number;
  marge_brute: number;
  marge_directe: number;
  nb_commandes: number;
  nb_factures: number;
  nb_devis: number;
  jours_declares: number;
  cout_rh_declare: number;
  budget_total: number;
}

export interface SpvBudgetLine {
  id: string;
  spv_affaire_id: string;
  poste: string;
  fournisseur_prevu: string | null;
  description: string | null;
  montant_budget: number;
  montant_budget_revise: number | null;
  type_depense: string | null;
  exercice: number | null;
  statut: string;
  commentaire: string | null;
}

/** KPI budget (CA/COGS/marges + temps + budget) de toutes les affaires SPV. */
export function useSpvAffairesBudgetKpi() {
  return useQuery({
    queryKey: ['spv-affaires-budget-kpi'],
    queryFn: async (): Promise<SpvAffaireBudgetKpi[]> => {
      const { data, error } = await sb
        .from('v_spv_affaire_budget_kpi')
        .select('*')
        .order('code_affaire');
      if (error) throw error;
      return (data ?? []) as SpvAffaireBudgetKpi[];
    },
  });
}

/** Lignes de budget d'une affaire SPV + mutations CRUD. */
export function useSpvBudgetLines(spvAffaireId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['spv-budget-lines', spvAffaireId] });
    qc.invalidateQueries({ queryKey: ['spv-affaires-budget-kpi'] });
  };

  const query = useQuery({
    queryKey: ['spv-budget-lines', spvAffaireId],
    enabled: !!spvAffaireId,
    queryFn: async (): Promise<SpvBudgetLine[]> => {
      const { data, error } = await sb
        .from('spv_affaire_budget_lines')
        .select('*')
        .eq('spv_affaire_id', spvAffaireId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpvBudgetLine[];
    },
  });

  const upsertLine = useMutation({
    mutationFn: async (line: Partial<SpvBudgetLine> & { spv_affaire_id: string }) => {
      if (line.id) {
        const { error } = await sb.from('spv_affaire_budget_lines').update(line).eq('id', line.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('spv_affaire_budget_lines').insert(line);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('spv_affaire_budget_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, upsertLine, deleteLine };
}

// ── Détail des pièces Divalto d'une affaire (devis/commandes/factures) ──────

export interface SpvAffairePiece {
  doc_type: string;            // 'commande' | 'facture' | 'devis'
  numero_piece: string | null;
  prefix: string | null;
  tiers_code: string | null;
  nom_tiers: string | null;
  montant_ht: number;          // signé brut (client négatif, fournisseur positif)
  date_piece: string | null;
  libelle: string | null;       // libellé de la ligne analytique (mouv_gold.des)
  libelle_entete: string | null; // libellé entête pièce (ent_gold.des) — même valeur pour toutes les lignes d'une pièce
}

/** Toutes les pièces Divalto rattachées à une affaire SPV (par projet axe_0001). */
export function useSpvAffairePieces(codeAffaire: string | null) {
  return useQuery({
    queryKey: ['spv-affaire-pieces', codeAffaire],
    enabled: !!codeAffaire,
    queryFn: async (): Promise<SpvAffairePiece[]> => {
      const { data, error } = await sb
        .from('divalto_mouvements_all')
        .select('doc_type, numero_piece, prefix, tiers_code, nom_tiers, montant_ht, date_piece, libelle, libelle_entete')
        .eq('axe_0001', codeAffaire)
        .order('date_piece', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpvAffairePiece[];
    },
  });
}

export type SpvPieceCategorie =
  | 'ca_vendu'
  | 'ca_constate'
  | 'cogs_engage'
  | 'cogs_constate'
  | 'devis_client'
  | 'devis_fournisseur'
  | 'autre';

export const SPV_PIECE_CAT_LABEL: Record<SpvPieceCategorie, string> = {
  ca_vendu:          'Commande client (CA vendu)',
  ca_constate:       'Facture client (CA constaté)',
  cogs_engage:       'Commande fournisseur (COGS engagé)',
  cogs_constate:     'Facture fournisseur (COGS constaté)',
  devis_client:      'Devis client',
  devis_fournisseur: 'Devis fournisseur',
  autre:             'Autre',
};

/** Catégorise une pièce + renvoie le montant "présentable" (positif). */
export function classifySpvPiece(p: SpvAffairePiece): { categorie: SpvPieceCategorie; montant: number; isCA: boolean } {
  const isClient     = (p.tiers_code ?? '').toUpperCase().startsWith('C');
  const isFournisseur = (p.tiers_code ?? '').toUpperCase().startsWith('F');
  const isFacture    = p.doc_type === 'facture';
  const isDevis      = p.doc_type === 'devis';
  // client = négatif en base → on inverse pour présenter du positif
  const montant = isClient ? -Number(p.montant_ht || 0) : Number(p.montant_ht || 0);
  let categorie: SpvPieceCategorie = 'autre';
  if (isDevis) {
    categorie = isClient ? 'devis_client' : isFournisseur ? 'devis_fournisseur' : 'autre';
  } else if (isClient) {
    categorie = isFacture ? 'ca_constate' : 'ca_vendu';
  } else if (isFournisseur) {
    categorie = isFacture ? 'cogs_constate' : 'cogs_engage';
  }
  return { categorie, montant, isCA: isClient };
}
