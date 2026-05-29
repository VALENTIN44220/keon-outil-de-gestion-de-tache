-- Migration it_007 : ventilation des écritures multi-rattachées + vue d'audit
--
-- Problème : quand une écriture comptable est rattachée à N lignes
-- budgétaires (cas typique : CCA annuelle ventilée sur 12 lignes mensuelles),
-- la vue d'agrégation sommait son montant complet sur CHAQUE ligne. Au
-- global, on multipliait par N (constaté gonflé d'un facteur 12+).
--
-- Fix : on divise abs(solde) par le nombre total de liens de l'écriture
-- avant agrégation. La somme globale reste cohérente avec le montant réel
-- de l'écriture. Au niveau ligne, on voit la "part" qui revient à cette
-- ligne.
--
-- Bonus : vue d'audit v_it_supplier_entries_links_audit pour repérer les
-- écritures rattachées à plusieurs lignes (volontaire ou doublons).

DROP VIEW IF EXISTS public.v_it_budget_line_supplier_entries_agg;

CREATE VIEW public.v_it_budget_line_supplier_entries_agg AS
WITH link_counts AS (
  SELECT supplier_entry_key, COUNT(*)::int AS nb_links
  FROM public.it_budget_line_supplier_entries
  GROUP BY supplier_entry_key
)
SELECT
  l.budget_line_id,
  SUM(ABS(COALESCE(e.solde, 0)) / 1.20 / lc.nb_links)::numeric AS supplier_ht_amount,
  SUM(ABS(COALESCE(e.solde, 0)) / lc.nb_links)::numeric        AS supplier_ttc_amount,
  COUNT(*)::int                                                 AS nb_supplier_entries
FROM public.it_budget_line_supplier_entries l
JOIN public.supplier_accounting_entries e ON e.entry_key = l.supplier_entry_key
JOIN link_counts lc ON lc.supplier_entry_key = l.supplier_entry_key
GROUP BY l.budget_line_id;

GRANT SELECT ON public.v_it_budget_line_supplier_entries_agg TO authenticated;

-- Vue d'audit : pour chaque écriture rattachée, son nb_links et la liste
-- des budget_line_ids. Permet de détecter les multi-rattachements
-- (volontaires pour les CCA, ou doublons accidentels).
CREATE OR REPLACE VIEW public.v_it_supplier_entries_links_audit AS
SELECT
  e.entry_key,
  e.dos,
  e.journal,
  e.numero,
  e.date,
  e.supplier_code,
  e.supplier_name,
  e.libelle_ecriture,
  e.solde                                     AS solde_signed,
  ABS(COALESCE(e.solde, 0))::numeric           AS montant_abs_ttc,
  (ABS(COALESCE(e.solde, 0)) / 1.20)::numeric  AS montant_abs_ht,
  COUNT(l.id)::int                             AS nb_links,
  array_agg(l.budget_line_id ORDER BY l.linked_at) AS budget_line_ids
FROM public.supplier_accounting_entries e
JOIN public.it_budget_line_supplier_entries l ON l.supplier_entry_key = e.entry_key
GROUP BY e.entry_key, e.dos, e.journal, e.numero, e.date,
         e.supplier_code, e.supplier_name, e.libelle_ecriture, e.solde
ORDER BY COUNT(l.id) DESC, e.date DESC;

GRANT SELECT ON public.v_it_supplier_entries_links_audit TO authenticated;
