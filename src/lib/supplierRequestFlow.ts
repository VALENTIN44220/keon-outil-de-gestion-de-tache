/**
 * Processus « DEMANDE SERVICE ACHAT » (contient le sous-processus « DEMANDE DE NOUVEAU FOURNISSEUR »).
 * @see supabase/migrations/20260207161105_d42214ca-33a6-4fed-aff0-e60b46349c9e.sql
 */
export const SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID = 'b1111111-1111-1111-1111-111111111111';

/** Sous-processus ciblé : formulaire « nouveau fournisseur » (flux Service achat). */
export const SUPPLIER_NEW_REQUEST_SUB_PROCESS_TEMPLATE_ID = 'c1111111-1111-1111-1111-111111111111';

/** Route dédiée : ouverture directe du formulaire, sans passer par l’écran générique des demandes. */
export const SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH = '/requests/service-achat/nouveau-fournisseur';

/** @deprecated Préférer {@link SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH} ; conservé pour anciens liens. */
export const SUPPLIER_REQUEST_QUERY_PARAM = 'supplierRequest';
