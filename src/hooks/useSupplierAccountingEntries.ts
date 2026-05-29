/**
 * Hooks pour exploiter `supplier_accounting_entries` (écritures comptables
 * sur compte fournisseur F* poussées depuis Fabric) et la table de liaison
 * `it_budget_line_supplier_entries` (rattachement vers une it_budget_line).
 *
 * Cf. migration it_001 + brief produit FOURNISSEUR_ECRITURES.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const sb = supabase as any;

export type SupplierEntryStatus = 'pending' | 'validated' | 'rejected' | 'to_review';

export interface SupplierAccountingEntry {
  entry_key: string;
  id: string;
  dos: string;
  journal: string;
  numero: string;
  ecrlg: number;
  date: string | null;
  compte: string | null;
  supplier_code: string | null;
  supplier_name: string | null;
  libelle_ecriture: string | null;
  montant: number | null;
  sens: number | null;
  solde: number | null;
  devise: string | null;
  montant_devise: number | null;
  axe_1: string | null;
  axe_2: string | null;
  axe_3: string | null;
  has_gescom_piece: boolean;
  reference_externe: string | null;
  project_code: string | null;
  note_user: string | null;
  status_user: SupplierEntryStatus;
  fabric_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ITBudgetLineSupplierEntryLink {
  id: string;
  budget_line_id: string;
  supplier_entry_key: string;
  linked_by: string | null;
  linked_at: string;
  note: string | null;
}

export interface SupplierEntryFilters {
  has_gescom_piece?: boolean;
  dos?: string;
  date_from?: string;
  date_to?: string;
  /** Fuzzy : matche supplier_name / supplier_code / libelle_ecriture. */
  supplier_search?: string;
  /** Strict : matche exactement supplier_code. Prioritaire sur supplier_search si défini. */
  supplier_code?: string;
  amount_min?: number;
  amount_max?: number;
  status_user?: SupplierEntryStatus | '';
  linked?: 'all' | 'linked' | 'unlinked';
  page?: number;
  page_size?: number;
}

const DEFAULT_PAGE_SIZE = 50;

/** Liste paginée des écritures + total. */
export function useSupplierAccountingEntries(filters: SupplierEntryFilters) {
  const page = filters.page ?? 0;
  const pageSize = filters.page_size ?? DEFAULT_PAGE_SIZE;

  return useQuery({
    queryKey: ['supplier-accounting-entries', filters],
    queryFn: async () => {
      let q = sb
        .from('supplier_accounting_entries')
        .select('*', { count: 'exact' });

      if (filters.has_gescom_piece !== undefined)
        q = q.eq('has_gescom_piece', filters.has_gescom_piece);
      if (filters.dos) q = q.eq('dos', filters.dos);
      if (filters.date_from) q = q.gte('date', filters.date_from);
      if (filters.date_to) q = q.lte('date', filters.date_to);
      if (filters.supplier_code) {
        q = q.eq('supplier_code', filters.supplier_code);
      } else if (filters.supplier_search) {
        const s = filters.supplier_search.replace(/[%]/g, '');
        q = q.or(
          `supplier_name.ilike.%${s}%,supplier_code.ilike.%${s}%,libelle_ecriture.ilike.%${s}%`,
        );
      }
      if (filters.amount_min !== undefined) q = q.gte('solde', filters.amount_min);
      if (filters.amount_max !== undefined) q = q.lte('solde', filters.amount_max);
      if (filters.status_user) q = q.eq('status_user', filters.status_user);

      q = q
        .order('date', { ascending: false, nullsFirst: false })
        .order('numero', { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        data: (data ?? []) as SupplierAccountingEntry[],
        count: count ?? 0,
        page,
        pageSize,
      };
    },
  });
}

/** Liens existants pour une liste d'entry_keys (pour afficher l'état "déjà rattaché" dans la table). */
export function useSupplierEntryLinks(entryKeys: string[]) {
  return useQuery({
    queryKey: ['supplier-entry-links', entryKeys.slice().sort().join(',')],
    enabled: entryKeys.length > 0,
    queryFn: async () => {
      const { data, error } = await sb
        .from('it_budget_line_supplier_entries')
        .select('id, budget_line_id, supplier_entry_key, linked_at, note, linked_by')
        .in('supplier_entry_key', entryKeys);
      if (error) throw error;
      return (data ?? []) as ITBudgetLineSupplierEntryLink[];
    },
  });
}

/** Liens (avec écritures jointes) pour une ligne budgétaire. */
export function useITBudgetLineSupplierEntries(budgetLineId: string | null | undefined) {
  return useQuery({
    queryKey: ['it-budget-line-supplier-entries', budgetLineId],
    enabled: !!budgetLineId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('it_budget_line_supplier_entries')
        .select(
          `
          id, budget_line_id, supplier_entry_key, linked_by, linked_at, note,
          supplier_accounting_entries (
            entry_key, dos, journal, numero, date, supplier_code, supplier_name,
            libelle_ecriture, solde, devise, status_user
          )
          `,
        )
        .eq('budget_line_id', budgetLineId)
        .order('linked_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Rattache une écriture à une ligne budgétaire IT. */
export function useLinkSupplierEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { budgetLineId: string; entryKey: string; note?: string }) => {
      const { data, error } = await sb
        .from('it_budget_line_supplier_entries')
        .insert({
          budget_line_id: input.budgetLineId,
          supplier_entry_key: input.entryKey,
          linked_by: user?.id ?? null,
          note: input.note ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-entry-links'] });
      qc.invalidateQueries({ queryKey: ['it-budget-line-supplier-entries'] });
    },
  });
}

/** Rattache plusieurs écritures à une ligne budgétaire en 1 insert. */
export function useLinkSupplierEntries() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { budgetLineId: string; entryKeys: string[]; note?: string }) => {
      if (input.entryKeys.length === 0) return { inserted: 0 };
      const rows = input.entryKeys.map((k) => ({
        budget_line_id: input.budgetLineId,
        supplier_entry_key: k,
        linked_by: user?.id ?? null,
        note: input.note ?? null,
      }));
      const { error } = await sb
        .from('it_budget_line_supplier_entries')
        .upsert(rows, {
          onConflict: 'budget_line_id,supplier_entry_key',
          ignoreDuplicates: true,
        });
      if (error) throw error;
      return { inserted: rows.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-entry-links'] });
      qc.invalidateQueries({ queryKey: ['it-budget-line-supplier-entries'] });
    },
  });
}

/** Détache une écriture (suppression du lien). */
export function useUnlinkSupplierEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await sb
        .from('it_budget_line_supplier_entries')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-entry-links'] });
      qc.invalidateQueries({ queryKey: ['it-budget-line-supplier-entries'] });
    },
  });
}

/** Met à jour les colonnes user-owned (note_user, status_user). */
export function useUpdateSupplierEntryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { entryKey: string; status?: SupplierEntryStatus; note?: string }) => {
      const patch: Record<string, unknown> = {};
      if (input.status !== undefined) patch.status_user = input.status;
      if (input.note !== undefined) patch.note_user = input.note;
      const { error } = await sb
        .from('supplier_accounting_entries')
        .update(patch)
        .eq('entry_key', input.entryKey);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-accounting-entries'] });
    },
  });
}

export interface SupplierEntryVendor {
  supplier_code: string;
  supplier_name: string | null;
  nb: number;
}

/** Liste distincte des fournisseurs (via RPC). */
export function useSupplierEntryVendorList() {
  return useQuery({
    queryKey: ['supplier-entries-vendor-list'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await sb.rpc('supplier_entries_supplier_list');
      if (error) throw error;
      return (data ?? []) as SupplierEntryVendor[];
    },
  });
}

export interface ITBudgetLineSupplierEntryAgg {
  budget_line_id: string;
  supplier_ht_amount: number;
  supplier_ttc_amount: number;
  nb_supplier_entries: number;
}

/** Agrégation des écritures rattachées par ligne budgétaire IT. */
export function useITBudgetLineSupplierEntriesAgg() {
  return useQuery({
    queryKey: ['it-budget-line-supplier-entries-agg'],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await sb
        .from('v_it_budget_line_supplier_entries_agg')
        .select('budget_line_id, supplier_ht_amount, supplier_ttc_amount, nb_supplier_entries');
      if (error) throw error;
      return (data ?? []) as ITBudgetLineSupplierEntryAgg[];
    },
  });
}

/** Liste distincte des DOS pour le filtre (via RPC, sinon PostgREST tronque à 1000 lignes). */
export function useSupplierEntryDosList() {
  return useQuery({
    queryKey: ['supplier-entries-dos-list'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await sb.rpc('supplier_entries_dos_list');
      if (error) throw error;
      return ((data ?? []) as string[]).filter(Boolean).sort();
    },
  });
}
