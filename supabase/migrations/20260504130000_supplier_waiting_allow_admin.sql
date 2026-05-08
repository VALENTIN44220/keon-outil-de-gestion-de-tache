-- ============================================================
-- Autoriser les administrateurs (user_roles.role = 'admin') à
-- refuser et à valider les demandes fournisseurs.
-- ============================================================

-- Helper : renvoie TRUE si l'utilisateur courant a le rôle admin applicatif.
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- ---------------------------------------------------------------
-- reject_supplier_waiting : + check admin
-- ---------------------------------------------------------------
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
  v_pp_name         text;
  v_norm            text;
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

  -- Vérifier que la ligne n'est pas déjà refusée
  IF NOT EXISTS (
    SELECT 1 FROM public.supplier_waiting_approval
    WHERE id = p_waiting_id
      AND rejected_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cette demande a déjà été refusée ou n''existe pas';
  END IF;

  -- Profil de l'appelant
  SELECT pp.name INTO v_pp_name
  FROM public.profiles p
  LEFT JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
  WHERE p.user_id = auth.uid();

  v_norm := lower(trim(coalesce(v_pp_name, '')));

  v_can_reject :=
    public.is_app_admin()
    OR v_norm IN (
      'achat', 'comptabilité',
      'achat et comptabilité', 'comptabilité et achat',
      'achat & comptabilité', 'comptabilité & achat',
      'achat / comptabilité', 'comptabilité / achat'
    );

  IF NOT v_can_reject THEN
    RAISE EXCEPTION
      'Profil non autorisé à refuser une demande fournisseur. Profil actuel : %',
      coalesce(v_pp_name, 'aucun');
  END IF;

  -- Récupérer demandeur + nom fournisseur
  SELECT submitted_by_user_id, nomfournisseur
    INTO v_submitter_uid, v_supplier_name
  FROM public.supplier_waiting_approval
  WHERE id = p_waiting_id;

  -- Nom du refuseur pour la notification
  SELECT coalesce(display_name, 'Un validateur') INTO v_rejector_name
  FROM public.profiles
  WHERE user_id = auth.uid();

  -- Mettre à jour la ligne
  UPDATE public.supplier_waiting_approval
  SET
    rejected_at         = now(),
    rejected_by_user_id = auth.uid(),
    rejection_reason    = trim(p_reason)
  WHERE id = p_waiting_id;

  -- Notifier le demandeur si connu
  IF v_submitter_uid IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      related_entity_type,
      related_entity_id
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

-- ---------------------------------------------------------------
-- apply_supplier_waiting_validation : + check admin
-- Les admins peuvent valider en tant qu'achat ET compta.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_supplier_waiting_validation(p_waiting_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pp_name        text;
  v_norm           text;
  v_compta         boolean;
  v_achats         boolean;
  v_achats_stamped boolean := false;
  v_supplier_row   record;
  v_notif_uid      uuid;
  v_names          text;
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

  SELECT pp.name INTO v_pp_name
  FROM public.profiles p
  LEFT JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
  WHERE p.user_id = auth.uid();

  v_norm := lower(trim(coalesce(v_pp_name, '')));

  -- Les admins ont tous les droits de validation
  IF public.is_app_admin() THEN
    v_compta := true;
    v_achats  := true;
  ELSE
    v_compta := v_norm = lower('Comptabilité');
    v_achats  := v_norm = lower('Achat');

    IF v_norm IN (
      'achat et comptabilité',
      'comptabilité et achat',
      'achat & comptabilité',
      'comptabilité & achat',
      'achat / comptabilité',
      'comptabilité / achat'
    ) THEN
      v_compta := true;
      v_achats  := true;
    END IF;
  END IF;

  IF NOT v_compta AND NOT v_achats THEN
    RAISE EXCEPTION
      'Profil permission non autorisé pour cette validation (Achat, Comptabilité ou profil hybride). Profil actuel : %',
      coalesce(v_pp_name, 'aucun');
  END IF;

  -- Comptabilité seule : les achats doivent déjà avoir validé chaque ligne.
  IF v_compta AND NOT v_achats THEN
    IF EXISTS (
      SELECT 1
      FROM public.supplier_waiting_approval w
      WHERE w.id = ANY (p_waiting_ids)
        AND w.validated_by_achats_at IS NULL
    ) THEN
      RAISE EXCEPTION
        'La validation des achats doit être effectuée avant la validation comptabilité.';
    END IF;
  END IF;

  -- Détecter si on va poser un nouveau tampon Achats
  IF v_achats THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.supplier_waiting_approval w
      WHERE w.id = ANY (p_waiting_ids)
        AND w.validated_by_achats_at IS NULL
    ) INTO v_achats_stamped;
  END IF;

  UPDATE public.supplier_waiting_approval w
  SET
    validated_by_compta_at = CASE
      WHEN v_compta THEN COALESCE(w.validated_by_compta_at, now())
      ELSE w.validated_by_compta_at
    END,
    validated_by_compta_user_id = CASE
      WHEN v_compta THEN COALESCE(w.validated_by_compta_user_id, auth.uid())
      ELSE w.validated_by_compta_user_id
    END,
    validated_by_achats_at = CASE
      WHEN v_achats THEN COALESCE(w.validated_by_achats_at, now())
      ELSE w.validated_by_achats_at
    END,
    validated_by_achats_user_id = CASE
      WHEN v_achats THEN COALESCE(w.validated_by_achats_user_id, auth.uid())
      ELSE w.validated_by_achats_user_id
    END
  WHERE w.id = ANY (p_waiting_ids);

  -- Si des lignes Achats viennent d'être validées : notifier Comptabilité
  IF v_achats AND v_achats_stamped AND NOT v_compta THEN
    SELECT string_agg(coalesce(w.nomfournisseur, 'inconnu'), ', ')
      INTO v_names
    FROM public.supplier_waiting_approval w
    WHERE w.id = ANY (p_waiting_ids);

    FOR v_notif_uid IN
      SELECT p.user_id
      FROM public.profiles p
      LEFT JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
      WHERE lower(trim(coalesce(pp.name, ''))) IN (
        'comptabilité',
        'achat et comptabilité', 'comptabilité et achat',
        'achat & comptabilité', 'comptabilité & achat',
        'achat / comptabilité', 'comptabilité / achat'
      )
        AND p.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
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
