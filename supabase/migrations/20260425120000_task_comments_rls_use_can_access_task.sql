-- Align task_comments RLS with tasks visibility (stakeholder, hiérarchie, processus, etc.)

DROP POLICY IF EXISTS "Users can view comments on tasks they can see" ON public.task_comments;
CREATE POLICY "Users can view comments on tasks they can see"
ON public.task_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND public.can_access_task(t.id)
  )
);

DROP POLICY IF EXISTS "Users can create comments on accessible tasks" ON public.task_comments;
CREATE POLICY "Users can create comments on accessible tasks"
ON public.task_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND public.can_access_task(t.id)
  )
);
