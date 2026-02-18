
CREATE OR REPLACE FUNCTION public.compute_next_recurrence(
  p_current TIMESTAMP WITH TIME ZONE,
  p_interval INTEGER,
  p_unit TEXT
) RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_unit
    WHEN 'days' THEN p_current + (p_interval || ' days')::INTERVAL
    WHEN 'weeks' THEN p_current + (p_interval || ' weeks')::INTERVAL
    WHEN 'months' THEN p_current + (p_interval || ' months')::INTERVAL
    WHEN 'years' THEN p_current + (p_interval || ' years')::INTERVAL
  END
$$;
