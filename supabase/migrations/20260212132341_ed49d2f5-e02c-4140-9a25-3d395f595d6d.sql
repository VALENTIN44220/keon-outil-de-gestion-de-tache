
-- Create demande_materiel table for material request lines
CREATE TABLE public.demande_materiel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  request_number TEXT,
  demandeur_id UUID REFERENCES public.profiles(id),
  demandeur_nom TEXT,
  article_id UUID,
  ref TEXT NOT NULL,
  des TEXT NOT NULL,
  quantite NUMERIC NOT NULL DEFAULT 1 CHECK (quantite > 0),
  etat_commande TEXT NOT NULL DEFAULT 'En attente validation'
    CHECK (etat_commande IN (
      'En attente validation',
      'Demande de devis',
      'Bon de commande envoyé',
      'AR reçu',
      'Commande livrée',
      'Commande distribuée'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demande_materiel ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX idx_demande_materiel_request_id ON public.demande_materiel(request_id);
CREATE INDEX idx_demande_materiel_etat ON public.demande_materiel(etat_commande);
CREATE INDEX idx_demande_materiel_demandeur ON public.demande_materiel(demandeur_id);

-- RLS Policies
-- Authenticated users can read lines they're linked to (demandeur or admin)
CREATE POLICY "Users can view material requests"
  ON public.demande_materiel FOR SELECT
  TO authenticated
  USING (
    demandeur_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
    OR public.can_access_task(request_id)
  );

-- Authenticated users can insert lines for their own requests
CREATE POLICY "Users can create material request lines"
  ON public.demande_materiel FOR INSERT
  TO authenticated
  WITH CHECK (
    demandeur_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admin and authorized users can update (especially etat_commande)
CREATE POLICY "Authorized users can update material requests"
  ON public.demande_materiel FOR UPDATE
  TO authenticated
  USING (
    demandeur_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
    OR public.can_access_task(request_id)
  );

-- Admin can delete
CREATE POLICY "Admin can delete material request lines"
  ON public.demande_materiel FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_demande_materiel_updated_at
  BEFORE UPDATE ON public.demande_materiel
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.demande_materiel;
