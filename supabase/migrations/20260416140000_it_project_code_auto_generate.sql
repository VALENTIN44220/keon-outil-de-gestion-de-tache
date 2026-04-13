-- Auto-generate code_projet_digital for it_projects (NSK_IT-XXXXX)
-- Mirrors the same pattern used for be_projects (NSK_PROJ-XXXXX)

-- Sequence seeded past the highest existing NSK_IT-XXXXX code so generated
-- values never collide with rows that were already inserted manually.
CREATE SEQUENCE IF NOT EXISTS it_project_code_seq START WITH 1;

SELECT setval(
  'it_project_code_seq',
  GREATEST(
    1,
    COALESCE(
      MAX(NULLIF(regexp_replace(code_projet_digital, '^NSK_IT-0*', ''), '')::BIGINT),
      0
    )
  )
)
FROM public.it_projects
WHERE code_projet_digital ~ '^NSK_IT-\d+$';

-- Trigger function: only fills in the code when the caller omits it
CREATE OR REPLACE FUNCTION generate_it_project_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code_projet_digital IS NULL OR NEW.code_projet_digital = '' THEN
    NEW.code_projet_digital := 'NSK_IT-' || LPAD(nextval('it_project_code_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_generate_it_project_code
  BEFORE INSERT ON public.it_projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_it_project_code();
