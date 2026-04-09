/**
 * Processus « DEMANDE SERVICE ACHAT » (contient le sous-processus « DEMANDE DE NOUVEAU FOURNISSEUR »).
 * @see supabase/migrations/20260207161105_d42214ca-33a6-4fed-aff0-e60b46349c9e.sql
 */
export const SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID = 'b1111111-1111-1111-1111-111111111111';

/** Query param pour ouvrir ce flux depuis une autre section (ex. /suppliers). */
export const SUPPLIER_REQUEST_QUERY_PARAM = 'supplierRequest';
