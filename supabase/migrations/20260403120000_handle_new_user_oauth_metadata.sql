-- Richer display_name + lovable_email for new auth users (Azure / OAuth often omit display_name)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
