-- ═══════════════════════════════════════════════════════════════════
-- Module EPI — tables, indexes, RLS, vue agrégée
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Catalogue articles EPI ─────────────────────────────────────
CREATE TABLE public.epi_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  designation TEXT NOT NULL,
  categorie TEXT NOT NULL CHECK (categorie IN ('classique','atex','accessoire','casque')),
  norme TEXT,
  caracteristiques TEXT,
  type_flocage TEXT NOT NULL DEFAULT 'aucun'
    CHECK (type_flocage IN ('aucun','broderie_coeur','marquage_coeur')),
  prix_flocage NUMERIC(8,2) NOT NULL DEFAULT 0,
  frequence_renouvellement TEXT,
  image_url TEXT,
  fiche_technique_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read EPI articles"
  ON public.epi_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage EPI articles"
  ON public.epi_articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_epi_articles_updated_at
  BEFORE UPDATE ON public.epi_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. Déclinaisons taille par article ────────────────────────────
CREATE TABLE public.epi_article_tailles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.epi_articles(id) ON DELETE CASCADE,
  taille TEXT NOT NULL,
  ref_sycomore TEXT NOT NULL,
  article_divalto_id UUID REFERENCES public.articles(id),
  prix_achat NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(article_id, taille)
);

ALTER TABLE public.epi_article_tailles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_epi_article_tailles_article ON public.epi_article_tailles(article_id);
CREATE INDEX idx_epi_article_tailles_divalto ON public.epi_article_tailles(article_divalto_id);

CREATE POLICY "Authenticated users can read EPI tailles"
  ON public.epi_article_tailles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage EPI tailles"
  ON public.epi_article_tailles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 3. Matrice éligibilité profil ↔ article ──────────────────────
CREATE TABLE public.epi_profil_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profil TEXT NOT NULL CHECK (profil IN (
    'non_concerne','visite','intervenant',
    'operation_non_atex','encadrement_atex','operationnel_atex'
  )),
  article_id UUID NOT NULL REFERENCES public.epi_articles(id) ON DELETE CASCADE,
  dotation_multiplicateur INTEGER NOT NULL DEFAULT 1,
  max_quantite INTEGER NOT NULL DEFAULT 1,
  UNIQUE(profil, article_id)
);

ALTER TABLE public.epi_profil_articles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_epi_profil_articles_profil ON public.epi_profil_articles(profil);
CREATE INDEX idx_epi_profil_articles_article ON public.epi_profil_articles(article_id);

CREATE POLICY "Authenticated users can read EPI profil articles"
  ON public.epi_profil_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage EPI profil articles"
  ON public.epi_profil_articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 4. Lignes de demande EPI ──────────────────────────────────────
CREATE TABLE public.epi_demande_lignes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.epi_articles(id),
  taille_id UUID NOT NULL REFERENCES public.epi_article_tailles(id),
  quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  prix_unitaire NUMERIC(8,2) NOT NULL DEFAULT 0,
  prix_flocage NUMERIC(8,2) NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','validee','commandee','attribuee','annulee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_demande_lignes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_epi_demande_lignes_request ON public.epi_demande_lignes(request_id);
CREATE INDEX idx_epi_demande_lignes_statut ON public.epi_demande_lignes(statut);

CREATE POLICY "Users can view EPI request lines"
  ON public.epi_demande_lignes FOR SELECT TO authenticated
  USING (public.can_access_task(request_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create EPI request lines"
  ON public.epi_demande_lignes FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task(request_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authorized users can update EPI request lines"
  ON public.epi_demande_lignes FOR UPDATE TO authenticated
  USING (public.can_access_task(request_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete EPI request lines"
  ON public.epi_demande_lignes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_epi_demande_lignes_updated_at
  BEFORE UPDATE ON public.epi_demande_lignes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.epi_demande_lignes;

-- ─── 5. Historique des attributions ────────────────────────────────
CREATE TABLE public.epi_attributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demande_ligne_id UUID REFERENCES public.epi_demande_lignes(id) ON DELETE SET NULL,
  beneficiaire_id UUID NOT NULL REFERENCES public.profiles(id),
  article_id UUID NOT NULL REFERENCES public.epi_articles(id),
  taille_id UUID NOT NULL REFERENCES public.epi_article_tailles(id),
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  date_attribution DATE NOT NULL DEFAULT CURRENT_DATE,
  campagne_annee INTEGER,
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_attributions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_epi_attributions_beneficiaire ON public.epi_attributions(beneficiaire_id);
CREATE INDEX idx_epi_attributions_campagne ON public.epi_attributions(campagne_annee);
CREATE INDEX idx_epi_attributions_company ON public.epi_attributions(company_id);

CREATE POLICY "Users can view EPI attributions"
  ON public.epi_attributions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage EPI attributions"
  ON public.epi_attributions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 6. Vue agrégée des demandes EPI ───────────────────────────────
CREATE OR REPLACE VIEW public.epi_requests_overview AS
SELECT
  t.id AS task_id,
  t.title,
  t.status,
  t.assignee_id,
  t.requester_id,
  t.created_at,
  t.updated_at,
  t.due_date,
  t.module_data,
  (t.module_data->>'type_demande')::text AS type_demande,
  (t.module_data->>'profil_epi')::text AS profil_epi,
  (t.module_data->>'campagne_annee')::text AS campagne_annee,
  (t.module_data->>'beneficiaire_nom')::text AS beneficiaire_nom,
  (t.module_data->>'beneficiaire_prenom')::text AS beneficiaire_prenom,
  (t.module_data->>'beneficiaire_id')::text AS beneficiaire_id,
  (t.module_data->>'filiale')::text AS filiale,
  (t.module_data->>'date_souhaitee')::text AS date_souhaitee,
  (t.module_data->>'justification')::text AS justification,
  (t.module_data->>'ref_commande_divalto')::text AS ref_commande_divalto,
  (t.module_data->>'ref_bl_divalto')::text AS ref_bl_divalto,
  (t.module_data->>'ref_facture_divalto')::text AS ref_facture_divalto,
  COALESCE(agg.lignes, '[]'::json) AS lignes,
  COALESCE(agg.nb_lignes, 0) AS nb_lignes,
  COALESCE(agg.montant_total, 0) AS montant_total
FROM public.tasks t
LEFT JOIN LATERAL (
  SELECT
    json_agg(json_build_object(
      'id', el.id,
      'article_id', el.article_id,
      'article_divalto_id', eat.article_divalto_id,
      'designation', ea.designation,
      'categorie', ea.categorie,
      'taille', eat.taille,
      'ref_sycomore', eat.ref_sycomore,
      'quantite', el.quantite,
      'prix_unitaire', el.prix_unitaire,
      'prix_flocage', el.prix_flocage,
      'statut', el.statut
    ) ORDER BY ea.order_index) AS lignes,
    COUNT(*)::int AS nb_lignes,
    SUM(el.quantite * (el.prix_unitaire + el.prix_flocage))::numeric(10,2) AS montant_total
  FROM public.epi_demande_lignes el
  JOIN public.epi_articles ea ON ea.id = el.article_id
  JOIN public.epi_article_tailles eat ON eat.id = el.taille_id
  WHERE el.request_id = t.id
) agg ON true
WHERE t.module_code = 'epi'
  AND t.type = 'request';
