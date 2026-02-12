
-- Table de droits d'accès par processus pour le suivi
CREATE TABLE public.process_tracking_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_template_id uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(process_template_id, profile_id)
);

ALTER TABLE public.process_tracking_access ENABLE ROW LEVEL SECURITY;

-- Fonction SECURITY DEFINER pour vérifier l'accès en lecture
CREATE OR REPLACE FUNCTION public.can_read_process_tracking(_process_template_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  -- Admin a toujours accès
  IF public.has_role(auth.uid(), 'admin') THEN RETURN true; END IF;
  -- Vérifier la table d'accès
  RETURN EXISTS (
    SELECT 1 FROM public.process_tracking_access pta
    JOIN public.profiles p ON p.id = pta.profile_id
    WHERE pta.process_template_id = _process_template_id
      AND p.user_id = auth.uid()
      AND pta.can_read = true
  );
END;
$$;

-- Fonction SECURITY DEFINER pour vérifier l'accès en écriture
CREATE OR REPLACE FUNCTION public.can_write_process_tracking(_process_template_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.process_tracking_access pta
    JOIN public.profiles p ON p.id = pta.profile_id
    WHERE pta.process_template_id = _process_template_id
      AND p.user_id = auth.uid()
      AND pta.can_write = true
  );
END;
$$;

-- RLS: chaque utilisateur ne voit que ses propres droits (ou admin voit tout)
CREATE POLICY "Users see own access"
  ON public.process_tracking_access
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR profile_id = public.get_my_profile_id()
  );

-- Admin peut gérer les accès
CREATE POLICY "Admins manage access"
  ON public.process_tracking_access
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_process_tracking_access_updated_at
  BEFORE UPDATE ON public.process_tracking_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
