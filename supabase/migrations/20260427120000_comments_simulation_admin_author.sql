-- Simulation admin : permettre d'insérer / modifier / supprimer des commentaires avec un
-- author_id (task_comments) ou user_id (be_project_comments) autre que le profil lié à auth.uid(),
-- tout en conservant les contrôles d'accès existants sur task_comments (can_access_task).

DROP POLICY IF EXISTS "Users can create comments on accessible tasks" ON public.task_comments;
CREATE POLICY "Users can create comments on accessible tasks"
ON public.task_comments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND public.can_access_task(t.id)
  )
  AND (
    author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.task_comments;
CREATE POLICY "Users can update their own comments"
ON public.task_comments
FOR UPDATE
TO authenticated
USING (
  author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.task_comments;
CREATE POLICY "Users can delete their own comments"
ON public.task_comments
FOR DELETE
TO authenticated
USING (
  author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Users can create project comments" ON public.be_project_comments;
CREATE POLICY "Users can create project comments"
ON public.be_project_comments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = be_project_comments.user_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.be_project_comments;
CREATE POLICY "Users can update their own comments"
ON public.be_project_comments
FOR UPDATE
TO authenticated
USING (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.be_project_comments;
CREATE POLICY "Users can delete their own comments"
ON public.be_project_comments
FOR DELETE
TO authenticated
USING (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
