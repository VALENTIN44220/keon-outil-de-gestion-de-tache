-- FDR : paramètres globaux et profils capacitaires
-- Ces tables pilotent le moteur de calcul du plan de charge.

CREATE TABLE IF NOT EXISTS public.fdr_settings (
  id                            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  jours_productifs_mois         INTEGER       NOT NULL DEFAULT 18,
  echeance_standard_permanentes DATE          NOT NULL DEFAULT '2030-12-31',
  horizon_debut                 DATE          NOT NULL DEFAULT '2026-06-01',
  horizon_duree_mois            INTEGER       NOT NULL DEFAULT 19,
  created_at                    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TRIGGER update_fdr_settings_updated_at
  BEFORE UPDATE ON public.fdr_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fdr_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fdr_settings"
  ON public.fdr_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert fdr_settings"
  ON public.fdr_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update fdr_settings"
  ON public.fdr_settings FOR UPDATE TO authenticated USING (true);

-- Profils capacitaires (table des ressources du plan de charge)
CREATE TABLE IF NOT EXISTS public.fdr_profils (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT          NOT NULL,
  code            TEXT          NOT NULL UNIQUE,
  capacite_j_mois NUMERIC       NOT NULL DEFAULT 18,
  note            TEXT,
  ordre           INTEGER       NOT NULL DEFAULT 0,
  actif           BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TRIGGER update_fdr_profils_updated_at
  BEFORE UPDATE ON public.fdr_profils
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fdr_profils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fdr_profils"
  ON public.fdr_profils FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert fdr_profils"
  ON public.fdr_profils FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update fdr_profils"
  ON public.fdr_profils FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete fdr_profils"
  ON public.fdr_profils FOR DELETE TO authenticated USING (true);

-- Seed : paramètres par défaut
INSERT INTO public.fdr_settings (jours_productifs_mois, echeance_standard_permanentes, horizon_debut, horizon_duree_mois)
VALUES (18, '2030-12-31', '2026-06-01', 19);

-- Seed : profils du modèle Excel validé
INSERT INTO public.fdr_profils (nom, code, capacite_j_mois, note, ordre) VALUES
  ('Chef de projet dev/IA/data',              'cp_dev_ia_data', 18, 'Robin',                         1),
  ('Chef de projet digital',                  'cp_digital',     18, 'Hugues',                        2),
  ('RSI — capacité totale (pilotage + appui)', 'rsi',           18, 'Valentin (0,5 ETP exécution)',  3),
  ('Technicien IT (run)',                     'tech_it',        18, 'Rangit',                        4),
  ('Responsable IT (run)',                    'resp_it',         0, 'Bruno — départ fin S1 2026',    5)
ON CONFLICT (code) DO NOTHING;
