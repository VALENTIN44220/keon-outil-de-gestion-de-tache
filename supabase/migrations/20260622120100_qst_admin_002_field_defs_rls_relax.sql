-- =====================================================================
-- Questionnaire — administration globale
-- 002 : assouplissement RLS de questionnaire_field_definitions pour
--       autoriser les gestionnaires (can_manage_questionnaire) à
--       créer / modifier / désactiver TOUS les champs, y compris les
--       champs « système » (is_builtin = true), jusqu'ici verrouillés.
--
-- On CONSERVE le comportement existant : tout utilisateur authentifié
-- peut toujours ajouter / modifier un champ personnalisé (is_builtin=false)
-- dont il est le créateur. On AJOUTE une branche can_manage_questionnaire.
-- =====================================================================

DROP POLICY IF EXISTS "qfd_insert" ON public.questionnaire_field_definitions;
DROP POLICY IF EXISTS "qfd_update" ON public.questionnaire_field_definitions;
DROP POLICY IF EXISTS "qfd_delete" ON public.questionnaire_field_definitions;

-- INSERT : champ custom par tout utilisateur authentifié (inchangé)
--          OU n'importe quel champ (builtin inclus) par un gestionnaire.
CREATE POLICY "qfd_insert"
ON public.questionnaire_field_definitions FOR INSERT
TO authenticated
WITH CHECK (
  (is_builtin = false AND auth.uid() IS NOT NULL)
  OR public.can_manage_questionnaire(auth.uid())
);

-- UPDATE : champ custom par son créateur/admin (inchangé)
--          OU n'importe quel champ par un gestionnaire.
CREATE POLICY "qfd_update"
ON public.questionnaire_field_definitions FOR UPDATE
TO authenticated
USING (
  (
    is_builtin = false
    AND (
      created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
  OR public.can_manage_questionnaire(auth.uid())
)
WITH CHECK (
  is_builtin = false
  OR public.can_manage_questionnaire(auth.uid())
);

-- DELETE : suppression dure réservée aux gestionnaires, ou au créateur
--          d'un champ custom. (La désactivation passe par is_active=false.)
CREATE POLICY "qfd_delete"
ON public.questionnaire_field_definitions FOR DELETE
TO authenticated
USING (
  public.can_manage_questionnaire(auth.uid())
  OR (
    is_builtin = false
    AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);
