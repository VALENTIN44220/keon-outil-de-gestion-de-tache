
-- Function to generate standard process tracking access based on service groups
-- For each user with a department, find all service groups containing that department,
-- then grant can_read=true on all process_templates belonging to those groups.
-- Existing access rows are preserved (upsert with no overwrite of can_write).
CREATE OR REPLACE FUNCTION public.generate_standard_process_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted INT := 0;
  v_skipped INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT p.id AS profile_id, pt.id AS process_template_id
    FROM profiles p
    JOIN service_group_departments sgd ON sgd.department_id = p.department_id
    JOIN process_templates pt ON pt.service_group_id = sgd.service_group_id
    WHERE p.department_id IS NOT NULL
      AND pt.service_group_id IS NOT NULL
  LOOP
    -- Insert only if not already existing
    INSERT INTO process_tracking_access (profile_id, process_template_id, can_read, can_write)
    VALUES (rec.profile_id, rec.process_template_id, true, false)
    ON CONFLICT (profile_id, process_template_id) DO NOTHING;
    
    IF FOUND THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
END;
$$;
