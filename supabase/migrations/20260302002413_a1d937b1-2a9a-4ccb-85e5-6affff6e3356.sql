
CREATE OR REPLACE FUNCTION public.get_fou_resultat_aggregated(
  p_tiers TEXT DEFAULT NULL,
  p_years TEXT[] DEFAULT NULL,
  p_months TEXT[] DEFAULT NULL,
  p_dos TEXT[] DEFAULT NULL,
  p_type_dates TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  tiers TEXT,
  dos TEXT,
  annee TEXT,
  mois TEXT,
  type_date TEXT,
  ca_commande NUMERIC,
  ca_facture NUMERIC,
  ecart_cmd_fac NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.tiers,
    f.dos,
    f.annee,
    f.mois,
    f.type_date,
    SUM(f.ca_commande)::NUMERIC as ca_commande,
    SUM(f.ca_facture)::NUMERIC as ca_facture,
    SUM(f.ecart_cmd_fac)::NUMERIC as ecart_cmd_fac
  FROM public.fou_resultat f
  WHERE (p_tiers IS NULL OR f.tiers = p_tiers)
    AND (p_years IS NULL OR f.annee = ANY(p_years))
    AND (p_months IS NULL OR f.mois = ANY(p_months))
    AND (p_dos IS NULL OR f.dos = ANY(p_dos))
    AND (p_type_dates IS NULL OR f.type_date = ANY(p_type_dates))
  GROUP BY f.tiers, f.dos, f.annee, f.mois, f.type_date
  ORDER BY f.annee, f.mois;
END;
$$ LANGUAGE plpgsql STABLE;
