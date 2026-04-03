-- Richer display_name + lovable_email for new auth users (Azure / OAuth often omit display_name).
-- Microsoft (azure) OAuth: do NOT auto-create public.profiles — the user links via link-microsoft-account.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  prov text;
  provs jsonb;
BEGIN
  prov := COALESCE(NEW.raw_app_meta_data->>'provider', '');
  provs := COALESCE(NEW.raw_app_meta_data->'providers', '[]'::jsonb);

  IF prov = 'azure' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(provs) = 'array' THEN provs ELSE '[]'::jsonb END
    ) AS elem(elem)
    WHERE elem = 'azure'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, lovable_email)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'preferred_username'), ''),
      NEW.email,
      'Utilisateur'
    ),
    NEW.email
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
