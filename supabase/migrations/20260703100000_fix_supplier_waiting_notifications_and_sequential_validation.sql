-- ============================================================
-- Fix supplier waiting workflow (collaborator-group-based):
-- 0. Helper functions: is_supplier_achat_member / is_supplier_compta_member
-- 1. Trigger: notify Service Achat on new demand submission
-- 2. Sequential validation (achat first, then compta) via groups
-- 3. Rejection via groups
-- 4. Notify demandeur after promotion to enrichment
--
-- Group IDs:
--   Service Achat          = a1111111-1111-1111-1111-111111111111
--   Comptabilité (Divalto) = a2222222-2222-2222-2222-222222222222
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0a. Helper: is current user a member of the Service Achat group?
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_supplier_achat_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collaborator_group_members cgm
    WHERE cgm.group_id = 'a1111111-1111-1111-1111-111111111111'::uuid
      AND cgm.collaborator_id IN (
        SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_supplier_achat_member() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 0b. Helper: is current user a member of the Comptabilité group?
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_supplier_compta_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collaborator_group_members cgm
    WHERE cgm.group_id = 'a2222222-2222-2222-2222-222222222222'::uuid
      AND cgm.collaborator_id IN (
        SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_supplier_compta_member() TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 1. Trigger: notify Achat group members on new demand INSERT
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_achat_on_new_supplier_demand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_uid     uuid;
  v_submitter_name text;
BEGIN
  SELECT coalesce(display_name, 'Un collaborateur')
    INTO v_submitter_name
  FROM public.profiles
  WHERE user_id = NEW.submitted_by_user_id;

  FOR v_notif_uid IN
    SELECT p.user_id
    FROM public.collaborator_group_members cgm
    JOIN public.profiles p ON p.id = cgm.collaborator_id
    WHERE cgm.group_id = 'a1111111-1111-1111-1111-111111111111'::uuid
      AND p.user_id IS NOT NULL
      AND p.user_id IS DISTINCT FROM NEW.submitted_by_user_id
  LOOP
    INSERT INTO public.notifications (
      user_id, title, message, type,
      related_entity_type, related_entity_id
    ) VALUES (
      v_notif_uid,
      'Nouvelle demande de fournisseur',
      format(
        '%s a soumis une demande de création pour le fournisseur « %s » (%s). Votre validation est requise.',
        coalesce(v_submitter_name, 'Un collaborateur'),
        coalesce(NEW.nomfournisseur, 'inconnu'),
        coalesce(NEW.entite, '—')
      ),
      'supplier_new_demand',
      'supplier_waiting_approval',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_achat_on_new_supplier_demand
  ON public.supplier_waiting_approval;

CREATE TRIGGER trg_notify_achat_on_new_supplier_demand
  AFTER INSERT ON public.supplier_waiting_approval
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_achat_on_new_supplier_demand();


-- ─────────────────────────────────────────────────────────────
-- 2. apply_supplier_waiting_validation — sequential via groups
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_supplier_waiting_validation(p_waiting_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_achats    boolean;
  v_can_compta    boolean;
  v_do_achats     boolean := false;
  v_do_compta     boolean := false;
  v_achats_stamped boolean := false;
  v_notif_uid     uuid;
  v_names         text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF NOT public.has_supplier_access() THEN
    RAISE EXCEPTION 'Accès fournisseurs requis';
  END IF;
  IF p_waiting_ids IS NULL OR coalesce(array_length(p_waiting_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Aucune ligne à valider';
  END IF;

  -- Determine capabilities from collaborator groups (+ admin bypass)
  v_can_achats := public.is_app_admin() OR public.is_supplier_achat_member();
  v_can_compta := public.is_app_admin() OR public.is_supplier_compta_member();

  IF NOT v_can_achats AND NOT v_can_compta THEN
    RAISE EXCEPTION 'Vous n''êtes membre d''aucun groupe de validation fournisseur (Service Achat ou Comptabilité).';
  END IF;

  -- Sequential logic: if user can do both, only do one step at a time
  IF v_can_achats AND v_can_compta THEN
    IF EXISTS (
      SELECT 1 FROM public.supplier_waiting_approval w
      WHERE w.id = ANY (p_waiting_ids)
        AND w.validated_by_achats_at IS NULL
    ) THEN
      v_do_achats := true;
      v_do_compta := false;
    ELSE
      v_do_achats := false;
      v_do_compta := true;
    END IF;
  ELSE
    v_do_achats := v_can_achats;
    v_do_compta := v_can_compta;
  END IF;

  -- Compta-only users: achats must already be validated
  IF v_do_compta AND NOT v_do_achats THEN
    IF EXISTS (
      SELECT 1 FROM public.supplier_waiting_approval w
      WHERE w.id = ANY (p_waiting_ids)
        AND w.validated_by_achats_at IS NULL
    ) THEN
      RAISE EXCEPTION 'La validation des achats doit être effectuée avant la validation comptabilité.';
    END IF;
  END IF;

  -- Detect if we are stamping achats for the first time
  IF v_do_achats THEN
    SELECT EXISTS (
      SELECT 1 FROM public.supplier_waiting_approval w
      WHERE w.id = ANY (p_waiting_ids)
        AND w.validated_by_achats_at IS NULL
    ) INTO v_achats_stamped;
  END IF;

  UPDATE public.supplier_waiting_approval w
  SET
    validated_by_compta_at = CASE
      WHEN v_do_compta THEN COALESCE(w.validated_by_compta_at, now())
      ELSE w.validated_by_compta_at
    END,
    validated_by_compta_user_id = CASE
      WHEN v_do_compta THEN COALESCE(w.validated_by_compta_user_id, auth.uid())
      ELSE w.validated_by_compta_user_id
    END,
    validated_by_achats_at = CASE
      WHEN v_do_achats THEN COALESCE(w.validated_by_achats_at, now())
      ELSE w.validated_by_achats_at
    END,
    validated_by_achats_user_id = CASE
      WHEN v_do_achats THEN COALESCE(w.validated_by_achats_user_id, auth.uid())
      ELSE w.validated_by_achats_user_id
    END
  WHERE w.id = ANY (p_waiting_ids);

  -- Notify Comptabilité group when achats just got stamped
  IF v_do_achats AND v_achats_stamped THEN
    SELECT string_agg(coalesce(w.nomfournisseur, 'inconnu'), ', ')
      INTO v_names
    FROM public.supplier_waiting_approval w
    WHERE w.id = ANY (p_waiting_ids);

    FOR v_notif_uid IN
      SELECT p.user_id
      FROM public.collaborator_group_members cgm
      JOIN public.profiles p ON p.id = cgm.collaborator_id
      WHERE cgm.group_id = 'a2222222-2222-2222-2222-222222222222'::uuid
        AND p.user_id IS NOT NULL
        AND p.user_id IS DISTINCT FROM auth.uid()
    LOOP
      INSERT INTO public.notifications (
        user_id, title, message, type,
        related_entity_type
      ) VALUES (
        v_notif_uid,
        'Fournisseur(s) en attente de votre validation',
        format(
          'Les Achats ont validé %s demande(s) fournisseur. Votre validation comptabilité est requise : %s.',
          array_length(p_waiting_ids, 1),
          coalesce(v_names, '—')
        ),
        'supplier_achat_validated',
        'supplier_waiting_approval'
      );
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_supplier_waiting_validation(uuid[]) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 3. reject_supplier_waiting — group-based access
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_supplier_waiting(
  p_waiting_id uuid,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_reject      boolean;
  v_submitter_uid   uuid;
  v_supplier_name   text;
  v_rejector_name   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF NOT public.has_supplier_access() THEN
    RAISE EXCEPTION 'Accès fournisseurs requis';
  END IF;
  IF p_waiting_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant de demande manquant';
  END IF;
  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Le motif de refus est obligatoire';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.supplier_waiting_approval
    WHERE id = p_waiting_id AND rejected_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cette demande a déjà été refusée ou n''existe pas';
  END IF;

  v_can_reject :=
    public.is_app_admin()
    OR public.is_supplier_achat_member()
    OR public.is_supplier_compta_member();

  IF NOT v_can_reject THEN
    RAISE EXCEPTION 'Vous n''êtes membre d''aucun groupe autorisé à refuser une demande fournisseur.';
  END IF;

  SELECT submitted_by_user_id, nomfournisseur
    INTO v_submitter_uid, v_supplier_name
  FROM public.supplier_waiting_approval
  WHERE id = p_waiting_id;

  SELECT coalesce(display_name, 'Un validateur') INTO v_rejector_name
  FROM public.profiles
  WHERE user_id = auth.uid();

  UPDATE public.supplier_waiting_approval
  SET
    rejected_at         = now(),
    rejected_by_user_id = auth.uid(),
    rejection_reason    = trim(p_reason)
  WHERE id = p_waiting_id;

  IF v_submitter_uid IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, title, message, type,
      related_entity_type, related_entity_id
    ) VALUES (
      v_submitter_uid,
      'Demande fournisseur refusée',
      format(
        'Votre demande de création du fournisseur « %s » a été refusée par %s. Motif : %s',
        coalesce(v_supplier_name, 'inconnu'),
        v_rejector_name,
        trim(p_reason)
      ),
      'supplier_rejection',
      'supplier_waiting_approval',
      p_waiting_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_supplier_waiting(uuid, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 4. promote_supplier_waiting_to_enrichment — notify demandeur
-- ─────────────────────────────────────────────────────────────
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

    -- Notify the requester
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
