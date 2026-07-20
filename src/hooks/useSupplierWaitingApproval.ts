import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Champs résumés (liste)
export type SupplierWaitingApprovalRow = {
  id: string;
  line_index: string;
  tiers: string | null;
  nomfournisseur: string | null;
  entite: string | null;
  famille: string | null;
  siret: string | null;
  pays: string | null;
  created_at: string | null;
  validated_by_compta_at: string | null;
  validated_by_achats_at: string | null;
  submitted_by_user_id: string | null;
  rejected_at: string | null;
  rejected_by_user_id: string | null;
  rejection_reason: string | null;
  status: string | null;
};

// Champs complets (détail)
export type SupplierWaitingApprovalDetail = SupplierWaitingApprovalRow & {
  description: string | null;
  commentaires: string | null;
  tva: string | null;
  zone_intervention: string[] | null;
  delai_de_paiement: string | null;
  ca_estime: number | null;
  nom_contact: string | null;
  adresse_mail: string | null;
  telephone: string | null;
  poste: string | null;
  validated_by_achats_user_id: string | null;
  validated_by_compta_user_id: string | null;
  attachments?: SupplierWaitingAttachment[];
  field_reviews?: SupplierWaitingFieldReview[];
};

export type SupplierWaitingAttachment = {
  id: string;
  attachment_kind: string;
  file_name: string;
  file_url: string;
  storage_path: string;
};

export type SupplierWaitingFieldReview = {
  id: string;
  field_key: string;
  comment: string;
  created_at: string;
  resolved_at: string | null;
};

const LIST_SELECT =
  'id,line_index,tiers,nomfournisseur,entite,famille,siret,pays,created_at,status,' +
  'validated_by_compta_at,validated_by_achats_at,' +
  'submitted_by_user_id,rejected_at,rejected_by_user_id,rejection_reason';

const DETAIL_SELECT =
  LIST_SELECT +
  ',description,commentaires,tva,zone_intervention,delai_de_paiement,ca_estime,' +
  'nom_contact,adresse_mail,telephone,poste,' +
  'validated_by_achats_user_id,validated_by_compta_user_id,' +
  'supplier_waiting_approval_attachments(id,attachment_kind,file_name,file_url,storage_path),' +
  'supplier_waiting_field_reviews(id,field_key,comment,created_at,resolved_at)';

export function useSupplierWaitingApprovalList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['supplier-waiting-approval'],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_waiting_approval')
        .select(LIST_SELECT)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as SupplierWaitingApprovalRow[];
    },
  });
}

/**
 * Demandes soumises par un utilisateur donné (non supprimées).
 * @param userId  ID auth de l'utilisateur cible (réel ou simulé). Si absent, utilise l'utilisateur connecté.
 */
export function useMySupplierRequests(options?: { enabled?: boolean; userId?: string }) {
  const { user } = useAuth();
  const effectiveUserId = options?.userId ?? user?.id;

  return useQuery({
    queryKey: ['my-supplier-requests', effectiveUserId],
    enabled: (options?.enabled ?? true) && !!effectiveUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_waiting_approval')
        .select(LIST_SELECT)
        .is('deleted_at', null)
        .eq('submitted_by_user_id', effectiveUserId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as SupplierWaitingApprovalRow[];
    },
  });
}

export function useSupplierWaitingApprovalDetail(id: string | null) {
  return useQuery({
    queryKey: ['supplier-waiting-approval-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_waiting_approval')
        .select(DETAIL_SELECT)
        .eq('id', id!)
        .single();

      if (error) throw error;
      if (!data) return null;

      const raw = data as Record<string, unknown>;
      const attachments = Array.isArray(raw.supplier_waiting_approval_attachments)
        ? (raw.supplier_waiting_approval_attachments as SupplierWaitingAttachment[])
        : [];
      const field_reviews = Array.isArray(raw.supplier_waiting_field_reviews)
        ? (raw.supplier_waiting_field_reviews as SupplierWaitingFieldReview[]).filter(
            (r) => r.resolved_at === null,
          )
        : [];

      return { ...raw, attachments, field_reviews } as SupplierWaitingApprovalDetail;
    },
  });
}
