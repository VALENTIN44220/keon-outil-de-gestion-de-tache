
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  art_id INTEGER NOT NULL,
  ref TEXT,
  des TEXT,
  prix_moy NUMERIC(13,4),
  qte NUMERIC(12,3),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index unique sur art_id pour l'upsert depuis Fabric
CREATE UNIQUE INDEX idx_articles_art_id ON public.articles (art_id);

-- Enable RLS
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can read articles"
  ON public.articles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
