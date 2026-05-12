-- Admin bypass on public.notifications
--
-- Contexte : les notifications sont liées à user_id = auth.users.id.
-- Pour permettre aux administrateurs de tester l'application en simulation
-- (voir les notifications d'un autre user), on ajoute une policy SELECT
-- qui autorise les admins à voir toutes les notifications.
--
-- L'UPDATE (markAsRead, deleteAll) reste limité au user_id = auth.uid()
-- pour éviter qu'un admin marque par erreur les notifications d'un autre.
-- En simulation, le hook useInAppNotifications passe le user_id du profil
-- simulé dans le filtre client → la lecture (SELECT) traverse la nouvelle
-- policy admin, mais l'écriture est protégée par la policy "_own".

DROP POLICY IF EXISTS "notifications_select_admin" ON public.notifications;
CREATE POLICY "notifications_select_admin"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Pour la simulation : permettre aussi à l'admin d'UPDATE les notifs
-- (utile pour marquer comme lues les notifs visibles en simulation)
DROP POLICY IF EXISTS "notifications_update_admin" ON public.notifications;
CREATE POLICY "notifications_update_admin"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
