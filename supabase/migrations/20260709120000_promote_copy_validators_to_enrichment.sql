-- Traçabilité fournisseur : la promotion (intégration au référentiel) doit
-- reporter sur la fiche enrichie qui a validé (Achats / Comptabilité) et quand.
-- Jusqu'ici, promote_supplier_waiting_to_enrichment ne copiait PAS ces colonnes,
-- si bien que la section « Traçabilité » de la fiche affichait toujours « — ».
--
-- On recrée la fonction à l'identique en ajoutant les 4 colonnes de validation
-- (validated_by_achats_at/user_id, validated_by_compta_at/user_id) à l'INSERT.

CREATE OR REPLACE FUNCTION public.promote_supplier_waiting_to_enrichment(p_waiting_ids uuid[])
 RETURNS TABLE(enrichment_id uuid, former_waiting_id uuid, attachments jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Notifier le demandeur que le fournisseur a été créé
    IF r.submitted_by_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, title, message, type,
        related_entity_type, related_entity_id
      ) VALUES (
        r.submitted_by_user_id,
        'Fournisseur créé dans le référentiel',
        format(
          'Le fournisseur « %s » a été créé avec le code %s. Les informations de votre demande (y compris les pièces jointes) ont été intégrées au référentiel.',
          coalesce(r.nomfournisseur, 'inconnu'),
          coalesce(btrim(r.tiers), '—')
        ),
        'supplier_promoted',
        'supplier_waiting_approval',
        r.id
      );
    END IF;

    DELETE FROM public.supplier_waiting_approval WHERE id = r.id;

    INSERT INTO public.supplier_purchase_enrichment (
      tiers, nomfournisseur, categorie, famille_source_initiale, famille,
      segment, sous_segment, entite, type_de_contrat, validite_prix,
      validite_du_contrat, date_premiere_signature, avenants,
      evolution_tarif_2026, echeances_de_paiement, delai_de_paiement,
      penalites, exclusivite_non_sollicitation, remise, rfa, incoterm,
      garanties_bancaire_et_equipement, transport, nom_contact, poste,
      adresse_mail, telephone, commentaires, commentaires_date_contrat,
      commentaires_type_de_contrat, site_web, delais_de_paiement_commentaires,
      completeness_score, status, ca_estime, description, siret, tva,
      validated_by_achats_at, validated_by_achats_user_id,
      validated_by_compta_at, validated_by_compta_user_id,
      created_at, updated_at, updated_by
    ) VALUES (
      btrim(r.tiers), r.nomfournisseur, r.categorie, r.famille_source_initiale, r.famille,
      r.segment, r.sous_segment, r.entite, r.type_de_contrat, r.validite_prix,
      r.validite_du_contrat, r.date_premiere_signature, r.avenants,
      r.evolution_tarif_2026, r.echeances_de_paiement, r.delai_de_paiement,
      r.penalites, r.exclusivite_non_sollicitation, r.remise, r.rfa, r.incoterm,
      r.garanties_bancaire_et_equipement, r.transport, r.nom_contact, r.poste,
      r.adresse_mail, r.telephone, r.commentaires, r.commentaires_date_contrat,
      r.commentaires_type_de_contrat, r.site_web, r.delais_de_paiement_commentaires,
      coalesce(r.completeness_score, 0), coalesce(r.status, 'a_completer'),
      r.ca_estime, r.description, r.siret, r.tva,
      r.validated_by_achats_at, r.validated_by_achats_user_id,
      r.validated_by_compta_at, r.validated_by_compta_user_id,
      now(), now(), auth.uid()
    )
    RETURNING id INTO v_new_id;

    enrichment_id := v_new_id;
    former_waiting_id := r.id;
    attachments := v_att;
    RETURN NEXT;
  END LOOP;
END;
$function$;
