-- Tâches filles liées à une demande : recopier demandeur / rapporteur depuis la demande parente si absents.
UPDATE public.tasks AS t
SET requester_id = p.requester_id,
    reporter_id = COALESCE(t.reporter_id, p.reporter_id)
FROM public.tasks p
WHERE t.parent_request_id = p.id
  AND t.type = 'task'
  AND t.requester_id IS NULL
  AND p.requester_id IS NOT NULL;
