-- Transfert file d’attente → référentiel après double validation + TIERS renseigné.
-- Supprime la ligne d’attente (CASCADE sur supplier_waiting_approval_attachments) ; les fichiers
-- storage sont recopiés côté application vers supplier-attachments.

CREATE OR REPLACE FUNCTION public.promote_supplier_waiting_to_enrichment(p_waiting_ids uuid[])
RETURNS TABLE (
  enrichment_id uuid,
  former_waiting_id uuid,
  attachments jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.supplier_waiting_approval%ROWTYPE;
  v_att jsonb;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF NOT public.has_supplier_access() THEN
    RAISE EXCEPTION 'Accès fournisseurs requis';
  END IF;
  IF p_waiting_ids IS NULL OR coalesce(array_length(p_waiting_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Aucune ligne à promouvoir';
  END IF;

  FOR r IN
    SELECT w.*
    FROM public.supplier_waiting_approval w
    WHERE w.id = ANY (p_waiting_ids)
    ORDER BY w.created_at ASC
  LOOP
    IF r.validated_by_compta_at IS NULL OR r.validated_by_achats_at IS NULL THEN
      RAISE EXCEPTION 'La demande % nécessite les validations comptabilité et achats', r.id;
    END IF;
    IF btrim(coalesce(r.tiers, '')) = '' THEN
      RAISE EXCEPTION 'Le TIERS est obligatoire avant intégration au référentiel (demande %)', r.id;
    END IF;

    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'storage_path', a.storage_path,
          'file_name', a.file_name,
          'attachment_kind', a.attachment_kind
        )
      ),
      '[]'::jsonb
    )
    INTO v_att
    FROM public.supplier_waiting_approval_attachments a
    WHERE a.waiting_approval_id = r.id;

    DELETE FROM public.supplier_waiting_approval WHERE id = r.id;

    INSERT INTO public.supplier_purchase_enrichment (
      tiers,
      nomfournisseur,
      categorie,
      famille_source_initiale,
      famille,
      segment,
      sous_segment,
      entite,
      type_de_contrat,
      validite_prix,
      validite_du_contrat,
      date_premiere_signature,
      avenants,
      evolution_tarif_2026,
      echeances_de_paiement,
      delai_de_paiement,
      penalites,
      exclusivite_non_sollicitation,
      remise,
      rfa,
      incoterm,
      garanties_bancaire_et_equipement,
      transport,
      nom_contact,
      poste,
      adresse_mail,
      telephone,
      commentaires,
      commentaires_date_contrat,
      commentaires_type_de_contrat,
      site_web,
      delais_de_paiement_commentaires,
      completeness_score,
      status,
      ca_estime,
      description,
      siret,
      tva,
      created_at,
      updated_at,
      updated_by
    ) VALUES (
      btrim(r.tiers),
      r.nomfournisseur,
      r.categorie,
      r.famille_source_initiale,
      r.famille,
      r.segment,
      r.sous_segment,
      r.entite,
      r.type_de_contrat,
      r.validite_prix,
      r.validite_du_contrat,
      r.date_premiere_signature,
      r.avenants,
      r.evolution_tarif_2026,
      r.echeances_de_paiement,
      r.delai_de_paiement,
      r.penalites,
      r.exclusivite_non_sollicitation,
      r.remise,
      r.rfa,
      r.incoterm,
      r.garanties_bancaire_et_equipement,
      r.transport,
      r.nom_contact,
      r.poste,
      r.adresse_mail,
      r.telephone,
      r.commentaires,
      r.commentaires_date_contrat,
      r.commentaires_type_de_contrat,
      r.site_web,
      r.delais_de_paiement_commentaires,
      coalesce(r.completeness_score, 0),
      coalesce(r.status, 'a_completer'),
      r.ca_estime,
      r.description,
      r.siret,
      r.tva,
      now(),
      now(),
      auth.uid()
    )
    RETURNING id INTO v_new_id;

    enrichment_id := v_new_id;
    former_waiting_id := r.id;
    attachments := v_att;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_supplier_waiting_to_enrichment(uuid[]) TO authenticated;
