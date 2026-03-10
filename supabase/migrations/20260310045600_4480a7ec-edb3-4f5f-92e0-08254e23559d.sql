
ALTER TABLE public.template_custom_fields 
ADD COLUMN IF NOT EXISTS is_agent_field BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.template_custom_fields.is_agent_field 
IS 'When true, this field is hidden from the request creation form and only visible to agents processing tasks.';

UPDATE public.template_custom_fields 
SET is_agent_field = true
WHERE name IN ('commentaire_refus', 'reference_fournisseur')
AND sub_process_template_id = 'c1111111-1111-1111-1111-111111111111';
